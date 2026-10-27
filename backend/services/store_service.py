# ==========================================================================
# IoT Saathi - Store Data Layer
# SQLAlchemy Database Layer with PostgreSQL & SQLite Support.
# Connects to production database via DATABASE_URL, with local SQLite fallback.
# ==========================================================================

import os
import json
import time
import uuid
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, DateTime, Text, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

load_dotenv()
logger = logging.getLogger("store_service")

# Data directory and JSON backup path
DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)
STORE_DB_PATH = os.path.join(DATA_DIR, "store_db.json")

# Default seed components (preserved from original dataset)
DEFAULT_COMPONENTS = [
    {
        "id": "comp-001",
        "name": "ESP32 DevKit V1",
        "description": "Dual-core 240MHz WiFi + Bluetooth development board with 30 GPIO pins. Ideal for IoT projects.",
        "price": 399.0,
        "category": "Microcontrollers",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><rect x='5' y='2' width='14' height='20' rx='2'/><circle cx='12' cy='8' r='3'/><path d='M9 16h6M9 18h6'/></svg>",
        "stock": 50,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-002",
        "name": "Arduino Uno R3",
        "description": "ATmega328P microcontroller board with 14 digital I/O pins, 6 analog inputs. Perfect for beginners.",
        "price": 349.0,
        "category": "Microcontrollers",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%230ea5e9' stroke-width='1.5'><rect x='4' y='3' width='16' height='18' rx='2'/><circle cx='9' cy='8' r='1.5'/><circle cx='15' cy='8' r='1.5'/><path d='M7 16h10'/></svg>",
        "stock": 30,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-003",
        "name": "DHT22 Temp & Humidity Sensor",
        "description": "High-precision digital sensor for temperature (-40 to 80°C) and relative humidity. 1-wire interface.",
        "price": 180.0,
        "category": "Sensors",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='1.5'><path d='M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z'/></svg>",
        "stock": 100,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-004",
        "name": "HC-SR04 Ultrasonic Sensor",
        "description": "2cm–400cm non-contact ultrasonic distance measurement sensor. 5V operation, TTL output.",
        "price": 89.0,
        "category": "Sensors",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><circle cx='7' cy='12' r='4'/><circle cx='17' cy='12' r='4'/><rect x='3' y='6' width='18' height='12' rx='2'/></svg>",
        "stock": 80,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-005",
        "name": "5V Single Channel Relay Module",
        "description": "Opto-isolated relay module for controlling high-voltage AC/DC loads. 10A max switching current.",
        "price": 65.0,
        "category": "Actuators",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='1.5'><rect x='4' y='4' width='16' height='16' rx='2'/><path d='M9 9h6v6H9z'/></svg>",
        "stock": 60,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-006",
        "name": "SSD1306 0.96\" OLED Display (I2C)",
        "description": "128x64 pixel monochrome OLED display. I2C interface, 3.3V/5V compatible. Ultra-low power.",
        "price": 149.0,
        "category": "Displays",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%230ea5e9' stroke-width='1.5'><rect x='3' y='4' width='18' height='14' rx='2'/><path d='M7 9h10M7 13h6'/></svg>",
        "stock": 45,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-007",
        "name": "NodeMCU ESP8266 (CP2102)",
        "description": "WiFi-enabled development board based on ESP8266. 11 GPIO pins, analog input, LUA/Arduino support.",
        "price": 249.0,
        "category": "Microcontrollers",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><rect x='5' y='3' width='14' height='18' rx='2'/><circle cx='12' cy='9' r='2.5'/></svg>",
        "stock": 35,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-008",
        "name": "L298N Dual H-Bridge Motor Driver",
        "description": "Controls 2 DC motors or 1 stepper motor. 5V–35V motor supply, 2A per channel, PWM speed control.",
        "price": 129.0,
        "category": "Actuators",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='12' cy='12' r='4'/></svg>",
        "stock": 40,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-009",
        "name": "MQ-2 Gas & Smoke Sensor",
        "description": "Detects LPG, propane, methane, hydrogen, smoke. Analog and digital output. 5V operation.",
        "price": 110.0,
        "category": "Sensors",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='1.5'><circle cx='12' cy='12' r='8'/><path d='M12 8v4l3 3'/></svg>",
        "stock": 55,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-010",
        "name": "Soil Moisture Sensor Module",
        "description": "Capacitive soil moisture sensor with analog output. 3.3V/5V compatible. For smart irrigation projects.",
        "price": 75.0,
        "category": "Sensors",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='1.5'><path d='M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z'/></svg>",
        "stock": 70,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-011",
        "name": "SG90 Micro Servo Motor",
        "description": "9g miniature servo with 180° rotation. PWM control (50Hz), 4.8V–6V operation. Torque: 1.8 kg·cm.",
        "price": 99.0,
        "category": "Actuators",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%230ea5e9' stroke-width='1.5'><rect x='4' y='8' width='16' height='10' rx='2'/><circle cx='12' cy='8' r='3'/></svg>",
        "stock": 65,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "comp-012",
        "name": "PIR Motion Sensor (HC-SR501)",
        "description": "Passive infrared motion detector, adjustable sensitivity and delay. 5–20V, 3.3V TTL output.",
        "price": 85.0,
        "category": "Sensors",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><circle cx='12' cy='12' r='7'/><circle cx='12' cy='12' r='3'/></svg>",
        "stock": 90,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    }
]

# ==============================================================================
# Database Engine Initialization
# ==============================================================================
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if raw_db_url:
    # Render PostgreSQL / External DB
    if raw_db_url.startswith("postgres://"):
        DATABASE_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
    else:
        DATABASE_URL = raw_db_url
    is_postgres = "postgres" in DATABASE_URL
    is_sqlite = False
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        echo=False
    )
    db_engine_name = "postgresql" if is_postgres else "external_sql"
else:
    # Zero-config SQLite database in backend/data/store.db
    sqlite_path = os.path.join(DATA_DIR, "store.db")
    DATABASE_URL = f"sqlite:///{sqlite_path}"
    is_postgres = False
    is_sqlite = True
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
    db_engine_name = "sqlite"

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ComponentORM(Base):
    __tablename__ = "components"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, default="")
    price = Column(Float, nullable=False)
    category = Column(String(64), default="General", index=True)
    image = Column(Text, default="")
    stock = Column(Integer, default=0)
    active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "price": float(self.price),
            "category": self.category or "General",
            "image": self.image or "",
            "stock": int(self.stock or 0),
            "active": bool(self.active),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


def _get_existing_seed_data() -> List[Dict[str, Any]]:
    """Loads existing components from JSON backup or default list without data loss."""
    if os.path.exists(STORE_DB_PATH):
        try:
            with open(STORE_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "components" in data and len(data["components"]) > 0:
                    return data["components"]
        except Exception as e:
            logger.warning(f"Could not load store_db.json: {e}")
    return DEFAULT_COMPONENTS


def init_database() -> None:
    """Creates tables and seeds initial components if database is empty."""
    Base.metadata.create_all(bind=engine)
    session: Session = SessionLocal()
    try:
        count = session.query(ComponentORM).count()
        if count == 0:
            seed_items = _get_existing_seed_data()
            logger.info(f"Seeding database with {len(seed_items)} components...")
            for item in seed_items:
                dt_created = datetime.utcnow()
                if item.get("created_at"):
                    try:
                        dt_created = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
                    except Exception:
                        pass
                comp = ComponentORM(
                    id=item["id"],
                    name=item["name"],
                    description=item.get("description", ""),
                    price=float(item["price"]),
                    category=item.get("category", "General"),
                    image=item.get("image", ""),
                    stock=int(item.get("stock", 0)),
                    active=bool(item.get("active", True)),
                    created_at=dt_created,
                    updated_at=dt_created
                )
                session.add(comp)
            session.commit()
            logger.info("Database seeding completed.")
    except Exception as e:
        session.rollback()
        logger.error(f"Error during database initialization: {e}")
    finally:
        session.close()


# Initialize database schema immediately on module load
try:
    init_database()
except Exception as e:
    logger.error(f"Failed to initialize database on startup: {e}")


# ==============================================================================
# Genuine Database Health Check
# ==============================================================================
def check_db_health() -> Dict[str, Any]:
    """
    Executes a real query against the active database connection,
    measures round-trip latency, and returns live component counts.
    """
    start_time = time.time()
    session: Session = SessionLocal()
    try:
        # Test connection with a live query
        session.execute(text("SELECT 1"))
        total = session.query(ComponentORM).count()
        active = session.query(ComponentORM).filter(ComponentORM.active == True).count()
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "connected",
            "engine": db_engine_name,
            "latency_ms": elapsed_ms,
            "total_components": total,
            "active_components": active,
            "error": None
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "disconnected",
            "engine": db_engine_name,
            "latency_ms": None,
            "total_components": 0,
            "active_components": 0,
            "error": str(e)
        }
    finally:
        session.close()


# ==============================================================================
# Public Product Queries
# ==============================================================================
def get_active_components() -> List[Dict[str, Any]]:
    """Return all active components for public store."""
    session: Session = SessionLocal()
    try:
        comps = session.query(ComponentORM).filter(ComponentORM.active == True).order_by(ComponentORM.created_at.desc()).all()
        return [c.to_dict() for c in comps]
    finally:
        session.close()


def get_all_components() -> List[Dict[str, Any]]:
    """Return all components including inactive (admin only)."""
    session: Session = SessionLocal()
    try:
        comps = session.query(ComponentORM).order_by(ComponentORM.created_at.desc()).all()
        return [c.to_dict() for c in comps]
    finally:
        session.close()


def get_component_by_id(comp_id: str) -> Optional[Dict[str, Any]]:
    session: Session = SessionLocal()
    try:
        comp = session.query(ComponentORM).filter(ComponentORM.id == comp_id).first()
        return comp.to_dict() if comp else None
    finally:
        session.close()


# ==============================================================================
# Admin CRUD Operations
# ==============================================================================
def create_component(data: Dict[str, Any]) -> Dict[str, Any]:
    session: Session = SessionLocal()
    try:
        comp_id = f"comp-{uuid.uuid4().hex[:8]}"
        comp = ComponentORM(
            id=comp_id,
            name=data["name"],
            description=data.get("description", ""),
            price=float(data["price"]),
            category=data.get("category", "General"),
            image=data.get("image", ""),
            stock=int(data.get("stock", 0)),
            active=bool(data.get("active", True)),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(comp)
        session.commit()
        session.refresh(comp)
        return comp.to_dict()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def update_component(comp_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    session: Session = SessionLocal()
    try:
        comp = session.query(ComponentORM).filter(ComponentORM.id == comp_id).first()
        if not comp:
            return None
        updatable = ["name", "description", "price", "category", "image", "stock", "active"]
        for field in updatable:
            if field in data and data[field] is not None:
                if field == "price":
                    setattr(comp, field, float(data[field]))
                elif field == "stock":
                    setattr(comp, field, int(data[field]))
                elif field == "active":
                    setattr(comp, field, bool(data[field]))
                else:
                    setattr(comp, field, data[field])
        comp.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(comp)
        return comp.to_dict()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def delete_component(comp_id: str) -> bool:
    session: Session = SessionLocal()
    try:
        comp = session.query(ComponentORM).filter(ComponentORM.id == comp_id).first()
        if not comp:
            return False
        session.delete(comp)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def toggle_component_active(comp_id: str) -> Optional[Dict[str, Any]]:
    session: Session = SessionLocal()
    try:
        comp = session.query(ComponentORM).filter(ComponentORM.id == comp_id).first()
        if not comp:
            return None
        comp.active = not comp.active
        comp.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(comp)
        return comp.to_dict()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()
