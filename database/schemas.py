"""
IoT Saathi - Pydantic Request & Response Schemas
Provides strict validation, OpenAPI documentation, and response serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ComponentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Display name of the component")
    description: Optional[str] = Field(default="", max_length=1000, description="Product description or specs")
    price: float = Field(..., gt=0, description="Price in INR (₹)")
    category: Optional[str] = Field(default="General", max_length=64, description="Category (e.g. Sensors, Microcontrollers)")
    image: Optional[str] = Field(default="", description="Image URL or SVG Data URI")
    stock: Optional[int] = Field(default=0, ge=0, description="Available stock quantity")
    active: Optional[bool] = Field(default=True, description="Whether component is active and visible in store")


class ComponentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = Field(None, max_length=64)
    image: Optional[str] = None
    stock: Optional[int] = Field(None, ge=0)
    active: Optional[bool] = None


class ComponentResponse(BaseModel):
    id: str
    name: str
    description: str
    price: float
    category: str
    image: str
    stock: int
    active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class AdminLoginRequest(BaseModel):
    password: str = Field(..., description="Administrator password")


class AdminLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str = ""


class DatabaseHealthResponse(BaseModel):
    status: str
    service: str
    version: str
    database_engine: str
    total_components: int
    active_components: int
