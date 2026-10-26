"""
IoT Saathi - Database CRUD Operations Layer
Handles transactional queries, inserts, updates, deletes, and database seeding.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from models import Component
from schemas import ComponentCreate, ComponentUpdate
from seed_data import DEFAULT_COMPONENTS


def get_active_components(db: Session, category: Optional[str] = None) -> List[Component]:
    """Retrieve all active components visible in public storefront."""
    query = db.query(Component).filter(Component.active == True)
    if category and category.lower() != "all":
        query = query.filter(Component.category == category)
    return query.order_by(Component.created_at.desc()).all()


def get_all_components(db: Session) -> List[Component]:
    """Retrieve all components for admin management (active and inactive)."""
    return db.query(Component).order_by(Component.created_at.desc()).all()


def get_component_by_id(db: Session, comp_id: str) -> Optional[Component]:
    """Find a single component by its primary ID."""
    return db.query(Component).filter(Component.id == comp_id).first()


def create_component(db: Session, comp_in: ComponentCreate) -> Component:
    """Create a new hardware component in the database."""
    comp_id = f"comp-{uuid.uuid4().hex[:8]}"
    db_comp = Component(
        id=comp_id,
        name=comp_in.name,
        description=comp_in.description or "",
        price=float(comp_in.price),
        category=comp_in.category or "General",
        image=comp_in.image or "",
        stock=int(comp_in.stock or 0),
        active=bool(comp_in.active if comp_in.active is not None else True),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(db_comp)
    db.commit()
    db.refresh(db_comp)
    return db_comp


def update_component(db: Session, comp_id: str, comp_in: ComponentUpdate) -> Optional[Component]:
    """Update existing component attributes."""
    db_comp = get_component_by_id(db, comp_id)
    if not db_comp:
        return None

    update_data = comp_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(db_comp, field, value)

    db_comp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_comp)
    return db_comp


def delete_component(db: Session, comp_id: str) -> bool:
    """Permanently delete a component from the database."""
    db_comp = get_component_by_id(db, comp_id)
    if not db_comp:
        return False
    db.delete(db_comp)
    db.commit()
    return True


def toggle_component_active(db: Session, comp_id: str) -> Optional[Component]:
    """Toggle visibility status of a component."""
    db_comp = get_component_by_id(db, comp_id)
    if not db_comp:
        return None
    db_comp.active = not db_comp.active
    db_comp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_comp)
    return db_comp


def seed_default_components_if_empty(db: Session) -> int:
    """Populate database with default seed components if the components table is empty."""
    count = db.query(Component).count()
    if count == 0:
        for item in DEFAULT_COMPONENTS:
            db_comp = Component(
                id=item["id"],
                name=item["name"],
                description=item["description"],
                price=float(item["price"]),
                category=item["category"],
                image=item["image"],
                stock=int(item["stock"]),
                active=bool(item["active"]),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(db_comp)
        db.commit()
        return len(DEFAULT_COMPONENTS)
    return 0
