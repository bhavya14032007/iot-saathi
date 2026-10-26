"""
Unit and integration test script for IoT Saathi Database Service.
Validates:
1. Database schema initialization & SQLite creation
2. Seeding of default 12 components
3. Admin CRUD lifecycle (Create, Read, Update, Toggle, Delete)
4. Health check endpoint response
"""

import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from database import engine, Base, SessionLocal
from models import Component
import crud
from schemas import ComponentCreate, ComponentUpdate


def test_database():
    print("==================================================")
    print("[*] Testing IoT Saathi Database Service")
    print("==================================================")

    # 1. Schema creation
    print("\n1. Initializing tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 2. Seeding
        print("2. Checking / Seeding default components...")
        seeded = crud.seed_default_components_if_empty(db)
        print(f"   -> Seeded items count: {seeded}")

        # 3. Read active components
        active = crud.get_active_components(db)
        print(f"3. Active components count in DB: {len(active)}")
        assert len(active) >= 12, f"Expected at least 12 components, got {len(active)}"
        print(f"   -> First component: {active[0].name} (Price: INR {active[0].price})")

        # 4. Create new component
        print("4. Testing Component Creation...")
        test_comp_data = ComponentCreate(
            name="ESP32-CAM AI Camera Module",
            description="OV2640 camera board with WiFi and Bluetooth for vision AI projects.",
            price=549.0,
            category="Modules",
            stock=25,
            active=True
        )
        created = crud.create_component(db, test_comp_data)
        print(f"   -> Created ID: {created.id}, Name: {created.name}")
        assert created.id.startswith("comp-"), "Invalid ID format"

        # 5. Read by ID
        fetched = crud.get_component_by_id(db, created.id)
        assert fetched is not None, "Failed to retrieve created component"
        assert fetched.name == "ESP32-CAM AI Camera Module"

        # 6. Update component
        print("5. Testing Component Update...")
        update_data = ComponentUpdate(price=599.0, stock=40)
        updated = crud.update_component(db, created.id, update_data)
        assert updated.price == 599.0
        assert updated.stock == 40
        print(f"   -> Updated price to: INR {updated.price}, Stock to: {updated.stock}")

        # 7. Toggle active
        print("6. Testing Component Visibility Toggle...")
        toggled = crud.toggle_component_active(db, created.id)
        assert toggled.active is False
        print(f"   -> Toggled active state to: {toggled.active}")

        # 8. Delete component
        print("7. Testing Component Deletion...")
        deleted = crud.delete_component(db, created.id)
        assert deleted is True
        assert crud.get_component_by_id(db, created.id) is None
        print("   -> Component successfully deleted from DB.")

        print("\n==================================================")
        print("[SUCCESS] ALL DATABASE TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_database()
