from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from database import Base
from sqlalchemy.orm import relationship

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    role = Column(String, default="user")  # user / admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    price = Column(Float)
    image_url = Column(String)
    status = Column(String, default="active")  # active / inactive
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    licenses = relationship("License", back_populates="product", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="product")
    accounts = relationship("Account", back_populates="product", cascade="all, delete-orphan")

class License(Base):
    __tablename__ = "licenses"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    key_value = Column(String, unique=True, index=True)
    is_sold = Column(Boolean, default=False)
    sold_to_email = Column(String, nullable=True)
    sold_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    product = relationship("Product", back_populates="licenses")
    orders = relationship("Order", back_populates="license", cascade="all, delete-orphan")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_email = Column(String, index=True)
    amount = Column(Float)
    status = Column(String, default="pending")
    delivered_account_url = Column(String, nullable=True)
    delivered_account_password = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="orders")
    license = relationship("License", back_populates="orders")

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    account_url = Column(String)
    account_password = Column(String)
    status = Column(String, default="available")  # available / sold
    sold_to_email = Column(String, nullable=True)
    sold_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="accounts")

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String)
    message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AdminLog(Base):
    __tablename__ = "admin_logs"
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    admin_username = Column(String, nullable=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
