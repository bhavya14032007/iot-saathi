# ==========================================================================
# IoT Saathi - Store Data Layer
# JSON-file based persistent store. No external DB dependency required.
# ==========================================================================

import json
import os
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

# Persistent data file path - stored alongside backend
STORE_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "store_db.json")
STORE_DB_PATH = os.path.normpath(STORE_DB_PATH)

# Default seed components (shown on first boot)
DEFAULT_COMPONENTS = [
    {
        "id": "comp-001",
        "name": "ESP32 DevKit V1",
        "description": "Dual-core 240MHz WiFi + Bluetooth development board with 30 GPIO pins. Ideal for IoT projects.",
        "price": 399,
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
        "price": 349,
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
        "price": 180,
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
        "price": 89,
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
        "price": 65,
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
        "price": 149,
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
        "price": 249,
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
        "price": 129,
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
        "price": 110,
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
        "price": 75,
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
        "price": 99,
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
        "price": 85,
        "category": "Sensors",
        "image": "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><circle cx='12' cy='12' r='7'/><circle cx='12' cy='12' r='3'/></svg>",
        "stock": 90,
        "active": True,
        "created_at": datetime.utcnow().isoformat()
    }
]


def _load_db() -> Dict[str, Any]:
    """Load store database from JSON file."""
    if not os.path.exists(STORE_DB_PATH):
        return {"components": DEFAULT_COMPONENTS}
    try:
        with open(STORE_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"components": DEFAULT_COMPONENTS}


def _save_db(data: Dict[str, Any]) -> None:
    """Persist store database to JSON file."""
    os.makedirs(os.path.dirname(STORE_DB_PATH), exist_ok=True)
    with open(STORE_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---- Public Product Queries ----

def get_active_components() -> List[Dict]:
    """Return all active components for the public store."""
    db = _load_db()
    return [c for c in db["components"] if c.get("active", True)]


def get_all_components() -> List[Dict]:
    """Return all components including inactive (admin only)."""
    db = _load_db()
    return db["components"]


def get_component_by_id(comp_id: str) -> Optional[Dict]:
    db = _load_db()
    for c in db["components"]:
        if c["id"] == comp_id:
            return c
    return None


# ---- Admin CRUD ----

def create_component(data: Dict) -> Dict:
    db = _load_db()
    new_comp = {
        "id": f"comp-{uuid.uuid4().hex[:8]}",
        "name": data["name"],
        "description": data.get("description", ""),
        "price": float(data["price"]),
        "category": data.get("category", "General"),
        "image": data.get("image", ""),
        "stock": int(data.get("stock", 0)),
        "active": bool(data.get("active", True)),
        "created_at": datetime.utcnow().isoformat()
    }
    db["components"].append(new_comp)
    _save_db(db)
    return new_comp


def update_component(comp_id: str, data: Dict) -> Optional[Dict]:
    db = _load_db()
    for i, c in enumerate(db["components"]):
        if c["id"] == comp_id:
            updatable = ["name", "description", "price", "category", "image", "stock", "active"]
            for field in updatable:
                if field in data:
                    if field == "price":
                        db["components"][i][field] = float(data[field])
                    elif field == "stock":
                        db["components"][i][field] = int(data[field])
                    elif field == "active":
                        db["components"][i][field] = bool(data[field])
                    else:
                        db["components"][i][field] = data[field]
            db["components"][i]["updated_at"] = datetime.utcnow().isoformat()
            _save_db(db)
            return db["components"][i]
    return None


def delete_component(comp_id: str) -> bool:
    db = _load_db()
    original_len = len(db["components"])
    db["components"] = [c for c in db["components"] if c["id"] != comp_id]
    if len(db["components"]) < original_len:
        _save_db(db)
        return True
    return False


def toggle_component_active(comp_id: str) -> Optional[Dict]:
    db = _load_db()
    for i, c in enumerate(db["components"]):
        if c["id"] == comp_id:
            db["components"][i]["active"] = not c.get("active", True)
            db["components"][i]["updated_at"] = datetime.utcnow().isoformat()
            _save_db(db)
            return db["components"][i]
    return None
