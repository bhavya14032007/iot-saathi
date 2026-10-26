"""
IoT Saathi - Dedicated Database & Real-Time Sync Service
Provides persistent SQL storage, Admin CRUD, and real-time Server-Sent Events (SSE)
for the E-Tron Store hardware catalog. Deployable directly to Render.
"""

import os
import sys
import json
import hmac
import secrets
import logging
import asyncio
from typing import List, Optional, Set
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# Load environment configuration
load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from database import engine, Base, get_db, get_db_info
from models import Component

# Auto-create tables on import to guarantee schema existence
Base.metadata.create_all(bind=engine)

import crud
from schemas import (
    ComponentCreate,
    ComponentUpdate,
    ComponentResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    DatabaseHealthResponse
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("database-service")

# --------------------------------------------------------------------------
# Real-Time Event Broadcaster (Server-Sent Events)
# --------------------------------------------------------------------------
class EventBroadcaster:
    """Manages connected SSE client queues and broadcasts real-time catalog changes."""
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._subscribers.add(q)
        logger.info(f"SSE client connected. Active subscribers: {len(self._subscribers)}")
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q)
        logger.info(f"SSE client disconnected. Active subscribers: {len(self._subscribers)}")

    async def broadcast(self, event_type: str, payload: dict):
        if not self._subscribers:
            return
        message = json.dumps({"type": event_type, "payload": payload})
        sse_data = f"event: {event_type}\ndata: {message}\n\n"
        dead_queues = []
        for q in self._subscribers:
            try:
                q.put_nowait(sse_data)
            except Exception:
                dead_queues.append(q)
        for q in dead_queues:
            self.unsubscribe(q)


broadcaster = EventBroadcaster()


# --------------------------------------------------------------------------
# Database Lifecycle & Startup Seeding
# --------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)

    # Seed default components if database is freshly created
    db = next(get_db())
    try:
        seeded = crud.seed_default_components_if_empty(db)
        if seeded > 0:
            logger.info(f"Successfully seeded database with {seeded} IoT components.")
        else:
            logger.info("Database already contains items. Skipping seed.")
    finally:
        db.close()

    yield
    logger.info("Database service shutting down.")


app = FastAPI(
    title="IoT Saathi - Hardware Database & Real-Time Sync Service",
    description="Production database API service for IoT Saathi storing hardware components with real-time SSE push.",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for all frontend origins (Vercel, Render, Localhost, GitHub Pages)
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins_env.split(",")] if cors_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Admin Security
# --------------------------------------------------------------------------
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "iotsaathi_admin_2026")
_valid_tokens: Set[str] = set()


def _verify_admin_token(x_admin_token: Optional[str] = Header(default=None)) -> str:
    if not x_admin_token or x_admin_token not in _valid_tokens:
        raise HTTPException(status_code=401, detail="Unauthorized: Valid admin token required.")
    return x_admin_token


# --------------------------------------------------------------------------
# Public Health & Config Endpoints
# --------------------------------------------------------------------------
@app.get("/health", response_model=DatabaseHealthResponse)
@app.get("/api/health", response_model=DatabaseHealthResponse)
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint indicating database connectivity and item counts."""
    total = db.query(Component).count()
    active = db.query(Component).filter(Component.active == True).count()
    info = get_db_info()
    return DatabaseHealthResponse(
        status="healthy",
        service="IoT Saathi Database Service",
        version="2.0.0",
        database_engine=info["engine"],
        total_components=total,
        active_components=active
    )


@app.get("/api/config")
@app.get("/api/config/whatsapp")
def get_public_config():
    """Returns public site contact configuration for WhatsApp ordering."""
    number = os.getenv("WHATSAPP_NUMBER") or os.getenv("mobileNumber") or os.getenv("MOBILE_NUMBER", "919389860087")
    return {
        "mobile_number": number,
        "mobileNumber": number,
        "whatsapp_number": number,
        "number": number
    }


# --------------------------------------------------------------------------
# Real-Time SSE Stream Endpoint
# --------------------------------------------------------------------------
@app.get("/api/events")
async def stream_events():
    """
    Server-Sent Events (SSE) endpoint.
    Subscribing clients automatically receive real-time updates whenever
    any component is added, modified, toggled, or deleted.
    """
    queue = broadcaster.subscribe()

    async def event_generator():
        try:
            # Send initial handshake message
            yield "event: connected\ndata: {\"status\":\"connected\",\"message\":\"IoT Saathi Real-Time Stream Connected\"}\n\n"
            while True:
                try:
                    # Wait for message with timeout to send keepalive ping
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield message
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP connection alive through proxies
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# --------------------------------------------------------------------------
# Public Store Components Endpoints
# --------------------------------------------------------------------------
@app.get("/api/components", response_model=List[ComponentResponse])
@app.get("/api/store/components", response_model=List[ComponentResponse])
def list_active_components(category: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Fetch active components for storefront display, optionally filtered by category."""
    comps = crud.get_active_components(db, category)
    return [c.to_dict() for c in comps]


@app.get("/api/components/{comp_id}", response_model=ComponentResponse)
@app.get("/api/store/components/{comp_id}", response_model=ComponentResponse)
def get_component(comp_id: str, db: Session = Depends(get_db)):
    """Fetch details of a single component by its ID."""
    comp = crud.get_component_by_id(db, comp_id)
    if not comp or not comp.active:
        raise HTTPException(status_code=404, detail="Component not found or inactive.")
    return comp.to_dict()


# --------------------------------------------------------------------------
# Admin Authentication Endpoints
# --------------------------------------------------------------------------
@app.post("/api/admin/login", response_model=AdminLoginResponse)
def admin_login(req: AdminLoginRequest):
    """Authenticate admin and return a secure session token."""
    if hmac.compare_digest(req.password, ADMIN_PASSWORD):
        token = secrets.token_hex(32)
        _valid_tokens.add(token)
        logger.info("Admin authentication successful.")
        return AdminLoginResponse(success=True, token=token, message="Authenticated successfully.")
    logger.warning("Admin login failed: incorrect password.")
    raise HTTPException(status_code=403, detail="Invalid admin password.")


@app.post("/api/admin/logout")
def admin_logout(token: str = Depends(_verify_admin_token)):
    """Invalidate session token."""
    _valid_tokens.discard(token)
    return {"success": True, "message": "Logged out."}


@app.get("/api/admin/verify")
def verify_admin(token: str = Depends(_verify_admin_token)):
    """Verify session token status."""
    return {"valid": True}


# --------------------------------------------------------------------------
# Admin Component CRUD Endpoints (Protected with Real-Time Broadcasts)
# --------------------------------------------------------------------------
@app.get("/api/admin/components", response_model=List[ComponentResponse])
def admin_list_components(token: str = Depends(_verify_admin_token), db: Session = Depends(get_db)):
    """Admin: Return all components including inactive and low stock items."""
    comps = crud.get_all_components(db)
    return [c.to_dict() for c in comps]


@app.post("/api/admin/components", response_model=ComponentResponse, status_code=201)
async def admin_create_component(
    comp_in: ComponentCreate,
    token: str = Depends(_verify_admin_token),
    db: Session = Depends(get_db)
):
    """Admin: Add a new component to the database and broadcast real-time event."""
    new_comp = crud.create_component(db, comp_in)
    comp_dict = new_comp.to_dict()
    # Broadcast to all connected clients in real time
    await broadcaster.broadcast("component_created", comp_dict)
    return comp_dict


@app.put("/api/admin/components/{comp_id}", response_model=ComponentResponse)
async def admin_update_component(
    comp_id: str,
    comp_in: ComponentUpdate,
    token: str = Depends(_verify_admin_token),
    db: Session = Depends(get_db)
):
    """Admin: Update component fields in database and broadcast real-time event."""
    updated = crud.update_component(db, comp_id, comp_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Component not found.")
    comp_dict = updated.to_dict()
    # Broadcast to all connected clients in real time
    await broadcaster.broadcast("component_updated", comp_dict)
    return comp_dict


@app.delete("/api/admin/components/{comp_id}")
async def admin_delete_component(
    comp_id: str,
    token: str = Depends(_verify_admin_token),
    db: Session = Depends(get_db)
):
    """Admin: Delete component from database and broadcast real-time event."""
    deleted = crud.delete_component(db, comp_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Component not found.")
    # Broadcast delete event
    await broadcaster.broadcast("component_deleted", {"id": comp_id})
    return {"success": True, "message": f"Component {comp_id} permanently deleted."}


@app.patch("/api/admin/components/{comp_id}/toggle", response_model=ComponentResponse)
async def admin_toggle_component(
    comp_id: str,
    token: str = Depends(_verify_admin_token),
    db: Session = Depends(get_db)
):
    """Admin: Toggle component active status and broadcast real-time event."""
    toggled = crud.toggle_component_active(db, comp_id)
    if not toggled:
        raise HTTPException(status_code=404, detail="Component not found.")
    comp_dict = toggled.to_dict()
    # Broadcast to all connected clients
    await broadcaster.broadcast("component_toggled", comp_dict)
    return comp_dict


# --------------------------------------------------------------------------
# Direct Execution Entry Point
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    logger.info(f"Starting IoT Saathi Database Service on port {port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
