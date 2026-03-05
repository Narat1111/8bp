from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.models import User
from schemas.schemas import UserCreate, UserLogin, AdminLogin, Token
from utils.auth import hash_password, verify_password, create_access_token
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123456")


@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        is_admin=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"user_id": new_user.id, "email": new_user.email})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        is_admin=False,
    )


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and receive JWT token."""
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"user_id": user.id, "email": user.email})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        email=user.email,
        is_admin=user.is_admin,
    )


@router.post("/admin/login", response_model=Token)
def admin_login(credentials: AdminLogin, db: Session = Depends(get_db)):
    """Admin login endpoint."""
    # Check database admin user first
    user = db.query(User).filter(
        User.username == credentials.username,
        User.is_admin == True,
        User.is_active == True
    ).first()

    if user and verify_password(credentials.password, user.password_hash):
        token = create_access_token({"user_id": user.id, "email": user.email})
        return Token(
            access_token=token,
            token_type="bearer",
            user_id=user.id,
            username=user.username,
            email=user.email,
            is_admin=True,
        )

    # Fallback to env admin credentials
    if credentials.username == ADMIN_USERNAME and credentials.password == ADMIN_PASSWORD:
        # Create/get the env admin user
        env_admin = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if not env_admin:
            env_admin = User(
                username=ADMIN_USERNAME,
                email=f"{ADMIN_USERNAME}@digitalstore.com",
                password_hash=hash_password(ADMIN_PASSWORD),
                is_admin=True,
            )
            db.add(env_admin)
            db.commit()
            db.refresh(env_admin)

        token = create_access_token({"user_id": env_admin.id, "email": env_admin.email})
        return Token(
            access_token=token,
            token_type="bearer",
            user_id=env_admin.id,
            username=env_admin.username,
            email=env_admin.email,
            is_admin=True,
        )

    raise HTTPException(status_code=401, detail="Invalid admin credentials")
