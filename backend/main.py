import os
import sys
import logging
import hmac
import hashlib
import secrets
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Ensure backend directory is in sys.path for direct or module execution
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from models.prompt_schema import (
    PromptGenerationRequest,
    PromptGenerationResponse,
    ProjectTemplate,
    ChatFollowupRequest,
    ChatFollowupResponse
)
from models.store_schema import (
    ComponentCreate,
    ComponentUpdate,
    ComponentResponse,
    AdminLoginRequest,
    AdminLoginResponse
)
from services.gemini_service import generate_master_prompt_with_gemini, process_chat_followup
from services.store_service import (
    get_active_components,
    get_all_components,
    get_component_by_id,
    create_component,
    update_component,
    delete_component,
    toggle_component_active
)
from data.templates import TEMPLATES

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backend")

app = FastAPI(
    title="IoT Saathi - Embedded C++ Master Prompt Engine",
    description="Backend API for IoT Saathi providing token-optimized Master Prompt generation for embedded microcontrollers (ESP32, ESP8266, Arduino, STM32) and starter blueprints.",
    version="1.0.0"
)

# Enable CORS for frontend development and production hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Admin Auth Helpers
# --------------------------------------------------------------------------
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "iotsaathi_admin_2026")
# Simple in-memory token store (per-process, resets on restart – acceptable for single-admin use)
_valid_tokens: set = set()


def _generate_token() -> str:
    return secrets.token_hex(32)


def _verify_admin_token(x_admin_token: Optional[str] = Header(default=None)) -> str:
    if not x_admin_token or x_admin_token not in _valid_tokens:
        raise HTTPException(status_code=401, detail="Unauthorized: Valid admin token required.")
    return x_admin_token


# --------------------------------------------------------------------------
# Existing: Health, Templates, Prompt Engine, Chat Followup
# --------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    """Health status check and API key detection."""
    has_api_key = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "healthy",
        "service": "IoT Saathi Backend API",
        "version": "1.0.0",
        "gemini_api_configured": has_api_key,
        "mode": "Gemini Live Synthesis" if has_api_key else "Deterministic Engine Mode"
    }

@app.get("/api/templates", response_model=List[ProjectTemplate])
def get_templates():
    """Returns curated starter templates for quick IoT project prompt generation."""
    return TEMPLATES

@app.post("/api/generate-prompt", response_model=PromptGenerationResponse)
def generate_prompt(req: PromptGenerationRequest):
    """
    Transforms user's IoT hardware components, logic flow, and constraints into a dense,
    token-minimized Embedded C++ Master Prompt ready for input to frontier LLMs.
    """
    try:
        master_prompt, token_count, engine_name = generate_master_prompt_with_gemini(req)
        summary = f"{req.microcontroller} running {req.framework} with {len(req.components)} components"
        return PromptGenerationResponse(
            success=True,
            master_prompt=master_prompt,
            tokens_estimated=token_count,
            engine_used=engine_name,
            target_board=req.microcontroller,
            framework=req.framework,
            system_architecture_summary=summary
        )
    except Exception as e:
        logger.error(f"Error in generate_prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate master prompt: {str(e)}")

@app.post("/api/chat-followup", response_model=ChatFollowupResponse)
def chat_followup(req: ChatFollowupRequest):
    """Conversational state extractor and follow-up question generator for IoT Saathi Chat UI."""
    try:
        return process_chat_followup(req)
    except Exception as e:
        logger.error(f"Error in chat_followup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")


# --------------------------------------------------------------------------
# Admin Auth
# --------------------------------------------------------------------------

@app.post("/api/admin/login", response_model=AdminLoginResponse)
def admin_login(req: AdminLoginRequest):
    """Authenticate admin and return a session token."""
    if hmac.compare_digest(req.password, ADMIN_PASSWORD):
        token = _generate_token()
        _valid_tokens.add(token)
        logger.info("Admin login successful.")
        return AdminLoginResponse(success=True, token=token, message="Logged in successfully.")
    logger.warning("Admin login failed: wrong password.")
    raise HTTPException(status_code=403, detail="Invalid admin credentials.")


@app.post("/api/admin/logout")
def admin_logout(token: str = Depends(_verify_admin_token)):
    """Invalidate admin token."""
    _valid_tokens.discard(token)
    return {"success": True, "message": "Logged out."}


@app.get("/api/admin/verify")
def verify_admin_token(token: str = Depends(_verify_admin_token)):
    """Check if the provided admin token is valid."""
    return {"valid": True}


# --------------------------------------------------------------------------
# Public Store Endpoints
# --------------------------------------------------------------------------

@app.get("/api/store/components", response_model=List[ComponentResponse])
def list_store_components():
    """Returns all active components visible in the public store."""
    return get_active_components()


@app.get("/api/store/components/{comp_id}", response_model=ComponentResponse)
def get_store_component(comp_id: str):
    """Returns a single component by ID (public – only active)."""
    comp = get_component_by_id(comp_id)
    if not comp or not comp.get("active", True):
        raise HTTPException(status_code=404, detail="Component not found.")
    return comp


@app.get("/api/config/whatsapp")
def get_whatsapp_config():
    """Returns configured WhatsApp contact number for ordering."""
    number = os.getenv("WHATSAPP_NUMBER", "919389860087")
    return {"whatsapp_number": number}


# --------------------------------------------------------------------------
# Admin Store Management Endpoints (protected)
# --------------------------------------------------------------------------

@app.get("/api/admin/components", response_model=List[ComponentResponse])
def admin_list_components(token: str = Depends(_verify_admin_token)):
    """Admin: Returns ALL components including inactive ones."""
    return get_all_components()


@app.post("/api/admin/components", response_model=ComponentResponse, status_code=201)
def admin_create_component(data: ComponentCreate, token: str = Depends(_verify_admin_token)):
    """Admin: Add a new component to the store."""
    try:
        return create_component(data.model_dump())
    except Exception as e:
        logger.error(f"Error creating component: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/admin/components/{comp_id}", response_model=ComponentResponse)
def admin_update_component(comp_id: str, data: ComponentUpdate, token: str = Depends(_verify_admin_token)):
    """Admin: Update component details (partial update supported)."""
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    result = update_component(comp_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Component not found.")
    return result


@app.delete("/api/admin/components/{comp_id}")
def admin_delete_component(comp_id: str, token: str = Depends(_verify_admin_token)):
    """Admin: Permanently delete a component."""
    success = delete_component(comp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Component not found.")
    return {"success": True, "message": f"Component {comp_id} deleted."}


@app.patch("/api/admin/components/{comp_id}/toggle", response_model=ComponentResponse)
def admin_toggle_component(comp_id: str, token: str = Depends(_verify_admin_token)):
    """Admin: Toggle component active/inactive status."""
    result = toggle_component_active(comp_id)
    if not result:
        raise HTTPException(status_code=404, detail="Component not found.")
    return result


if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

