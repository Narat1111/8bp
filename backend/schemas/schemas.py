from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ─── Auth Schemas ───────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

    @validator("username")
    def username_alphanumeric(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 50:
            raise ValueError("Username must not exceed 50 characters")
        return v

    @validator("password")
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    email: str
    is_admin: bool


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Product Schemas ─────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    account_email: Optional[str] = None
    account_password: Optional[str] = None

    @validator("price")
    def price_positive(cls, v):
        if v <= 0:
            raise ValueError("Price must be positive")
        return v


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    account_email: Optional[str] = None
    account_password: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    price: float
    image: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductAdminResponse(ProductResponse):
    account_email: Optional[str]
    account_password: Optional[str]
    updated_at: Optional[datetime]


# ─── Payment Schemas ─────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    product_id: int


class PaymentStatusEnum(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentResponse(BaseModel):
    payment_id: int
    order_id: int
    qr_code_data: str
    qr_image_base64: str
    amount: float
    currency: str
    status: str
    md5_hash: str


class PaymentVerifyResponse(BaseModel):
    status: str
    message: str
    order_id: Optional[int] = None
    product_title: Optional[str] = None


# ─── Order Schemas ────────────────────────────────────────────────────────────

class OrderStatusEnum(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class OrderResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    status: str
    payment_id: Optional[int]
    created_at: datetime
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True


class PurchasedProductResponse(BaseModel):
    order_id: int
    product_id: int
    product_title: str
    product_description: Optional[str]
    account_email: str
    account_password: str
    purchased_at: datetime


# ─── Admin Stats Schema ───────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_users: int
    total_products: int
    total_orders: int
    total_revenue: float
    pending_orders: int
    paid_orders: int
