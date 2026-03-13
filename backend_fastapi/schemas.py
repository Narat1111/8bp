from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, strip_whitespace=True)
    description: str = Field(..., min_length=1, max_length=5000)
    price: float = Field(..., gt=0, le=100000)
    image_url: str = Field(default="", max_length=1000)

class ProductResponse(ProductCreate):
    id: int
    status: str = "active"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PaymentGenerate(BaseModel):
    productId: int = Field(..., gt=0)
    email: EmailStr
    order_id: int = Field(..., gt=0)

class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)
    email: EmailStr
    message: str = Field(..., min_length=5, max_length=2000)

class OrderCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    price: float = Field(..., gt=0)
    customer_email: Optional[EmailStr] = None

class LoginData(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)

class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: Optional[str] = Field(None, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    profile_picture: Optional[str] = None
    jwt_token: str

    class Config:
        from_attributes = True

class AccountCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    account_url: str = Field(..., min_length=1, max_length=500)
    account_password: str = Field(..., min_length=1, max_length=200)

class AccountResponse(BaseModel):
    id: int
    product_id: int
    account_url: str
    account_password: str
    status: str
    sold_to_email: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class OrderHistoryItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    amount: float
    status: str
    delivered_account_url: Optional[str] = None
    delivered_account_password: Optional[str] = None
    created_at: Optional[str] = None

class AdminLogResponse(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_username: Optional[str] = None
    action: str
    target: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
