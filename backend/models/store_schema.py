# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ComponentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Component display name")
    description: str = Field(default="", max_length=600, description="Short product description")
    price: float = Field(..., gt=0, description="Price in INR")
    category: str = Field(default="General", description="Component category")
    image: str = Field(default="", description="Image URL or base64 data URI")
    stock: int = Field(default=0, ge=0, description="Available stock count")
    active: bool = Field(default=True, description="Whether component is visible in the store")


class ComponentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=600)
    price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
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


class AdminLoginRequest(BaseModel):
    password: str = Field(..., description="Admin password")


class AdminLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str = ""
