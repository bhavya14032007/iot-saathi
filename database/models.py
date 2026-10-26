"""
IoT Saathi - Database ORM Models
Defines schema for hardware components, catalog inventory, and admin auditing.
"""

from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text
from database import Base


class Component(Base):
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

    def to_dict(self):
        """Serialize ORM object to JSON-friendly dictionary."""
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
