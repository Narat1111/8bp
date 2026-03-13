from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form, Request
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from urllib.parse import quote
import jwt
import httpx
import time
import os
import shutil
import uuid
import http.client
import json
import models, schemas, database, khqr_generator

# Always run database setup to enforce tables creation!
database.Base.metadata.create_all(bind=database.engine)

db_session = database.SessionLocal()
try:
    if not db_session.query(models.Product).first():
        db_session.add_all([
            models.Product(name="Facebook Premium Account", description="Aged account with marketplace enabled.", price=15.99, image_url="https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"),
            models.Product(name="TikTok Creator Hub", description="10K+ followers ready for immediate monetization", price=45.00, image_url="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"),
            models.Product(name="YouTube Channel", description="Monetized channel with custom URL intact. Full transfer.", price=120.00, image_url="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80")
        ])
        db_session.commit()
    # Seed default admin if none exists (password: adminpassword)
    if not db_session.query(models.Admin).first():
        from passlib.context import CryptContext as _CryptContext
        _ctx = _CryptContext(schemes=["bcrypt"], deprecated="auto")
        db_session.add(models.Admin(
            username="admin",
            password_hash=_ctx.hash("adminpassword")
        ))
        db_session.commit()
        print("Seeded default admin — username: admin / password: adminpassword")
finally:
    db_session.close()

app = FastAPI(title="Digital Unlock API")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Bcrypt context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Security headers on every response
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# HTTPS redirect — active when FORCE_HTTPS=1 (set in production behind reverse proxy)
class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if os.getenv("FORCE_HTTPS") == "1":
            proto = request.headers.get("x-forwarded-proto", "https")
            if proto == "http":
                url = str(request.url).replace("http://", "https://", 1)
                return RedirectResponse(url, status_code=301)
        return await call_next(request)

app.add_middleware(HTTPSRedirectMiddleware)

# CORS — restrict to known frontend origins (set ALLOWED_ORIGINS env var for production)
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

JWT_SECRET = os.getenv("JWT_SECRET", "your_super_secret_jwt_key_change_in_production_2026")
INFOBIP_API_KEY = os.getenv("INFOBIP_API_KEY", "YOUR_INFOBIP_API_KEY")
INFOBIP_BASE_URL = os.getenv("INFOBIP_BASE_URL", "vy3lve.api.infobip.com")
INFOBIP_SENDER = os.getenv("INFOBIP_SENDER", "ChheakNarat@selfserve.worlds-connected.co")
pending_payments = {}

def send_account_email(user_email: str, product_name: str, account_url: str, account_password: str):
    """Send purchased account details to the user via Infobip Email API."""
    try:
        conn = http.client.HTTPSConnection(INFOBIP_BASE_URL)
        payload = json.dumps({
            "messages": [
                {
                    "destinations": [
                        {
                            "to": [
                                {"destination": user_email}
                            ]
                        }
                    ],
                    "sender": INFOBIP_SENDER,
                    "content": {
                        "subject": "Your Purchase is Successful — Account Details Inside",
                        "text": (
                            f"Thank you for your purchase of {product_name}!\n\n"
                            f"Here are your account details:\n\n"
                            f"Account URL:\n{account_url}\n\n"
                            f"Password:\n{account_password}\n\n"
                            "Please keep this information secure and do not share it.\n\n"
                            "— SocialKeys Team"
                        )
                    }
                }
            ]
        })
        headers = {
            "Authorization": f"App {INFOBIP_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        conn.request("POST", "/email/4/messages", payload, headers)
        res = conn.getresponse()
        response_body = res.read().decode("utf-8")
        print(f"Infobip email sent to {user_email}: HTTP {res.status} — {response_body}")
        return res.status < 400
    except Exception as e:
        print(f"Email send error for {user_email}: {e}")
        return False

def log_admin_action(db: Session, admin: dict, action: str, target: str = None):
    """Write an audit log entry for admin actions."""
    try:
        entry = models.AdminLog(
            admin_id=admin.get("id"),
            admin_username=admin.get("username"),
            action=action,
            target=target
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"Admin log error: {e}")

def get_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    try:
        token = authorization.split(" ")[1]
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if decoded.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return decoded
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=403, detail="Failed to authenticate token")

def get_current_user(authorization: str = Header(None)):
    """Optional user auth — returns decoded token or None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ")[1]
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return decoded
    except Exception:
        return None

def require_user(authorization: str = Header(None)):
    """Required user auth — raises 401 if not authenticated."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# --- AUTH routes ---
@app.post("/api/auth/signup")
@limiter.limit("10/minute")
def signup(request: Request, data: schemas.UserSignup, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=data.email,
        name=data.name or data.email.split('@')[0],
        password_hash=pwd_context.hash(data.password),
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = jwt.encode({"id": user.id, "email": user.email, "name": user.name, "role": "user"}, JWT_SECRET, algorithm="HS256")
    return {"id": user.id, "email": user.email, "name": user.name, "jwt_token": token}

@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = jwt.encode({"id": user.id, "email": user.email, "name": user.name, "role": "user"}, JWT_SECRET, algorithm="HS256")
    return {"id": user.id, "email": user.email, "name": user.name, "jwt_token": token}

@app.post("/api/admin/login")
@limiter.limit("5/minute")
def admin_login(request: Request, login_data: schemas.LoginData, db: Session = Depends(database.get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == login_data.username).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not pwd_context.verify(login_data.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode({"id": admin.id, "username": admin.username, "role": "admin"}, JWT_SECRET, algorithm="HS256")
    return {"token": token, "message": "Logged in successfully"}

# --- Public Routes ---
@app.get("/api/products")
def get_products(db: Session = Depends(database.get_db)):
    products = db.query(models.Product).filter(models.Product.status == "active").order_by(models.Product.id.asc()).all()
    result = []
    for p in products:
        stock = db.query(func.count(models.Account.id)).filter(
            models.Account.product_id == p.id,
            models.Account.status == "available"
        ).scalar() or 0
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "image_url": p.image_url,
            "created_at": p.created_at,
            "stock": stock
        })
    return result

@app.post("/api/contact")
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(database.get_db)):
    contact_db = models.Contact(name=contact.name, email=contact.email, message=contact.message)
    db.add(contact_db)
    db.commit()
    return {"success": True, "message": "Message sent successfully!"}

# --- Payment Routes ---
@app.post("/api/orders")
def create_order(order: schemas.OrderCreate, db: Session = Depends(database.get_db), current_user: dict = Depends(get_current_user)):
    # Block order if stock is zero
    stock = db.query(func.count(models.Account.id)).filter(
        models.Account.product_id == order.product_id,
        models.Account.status == "available"
    ).scalar() or 0
    if stock == 0:
        raise HTTPException(status_code=400, detail="Product is out of stock")

    user_id = current_user["id"] if current_user else None
    new_order = models.Order(
        product_id=order.product_id,
        customer_email=order.customer_email,
        amount=order.price,
        status="pending",
        user_id=user_id
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@app.post("/api/payment/generate")
def generate_payment(data: schemas.PaymentGenerate, db: Session = Depends(database.get_db)):
    product = db.query(models.Product).filter(models.Product.id == data.productId).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Block payment if stock is zero (backend enforcement even if frontend is bypassed)
    stock = db.query(func.count(models.Account.id)).filter(
        models.Account.product_id == data.productId,
        models.Account.status == "available"
    ).scalar() or 0
    if stock == 0:
        raise HTTPException(status_code=400, detail="Product is out of stock")

    price = product.price
        
    qr_data, md5 = khqr_generator.generate_khqr_node(price)
    
    if not qr_data:
        raise HTTPException(status_code=500, detail={"error": "Failed to generate QR Code. Node.js backend integration failed."})
        
    pending_payments[md5] = {"productId": data.productId, "email": data.email, "order_id": data.order_id, "created": time.time(), "delivered": False}
    
    return {
        "success": True,
        "qrUrl": f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={quote(qr_data)}",
        "md5": md5,
        "qrData": qr_data
    }

@app.get("/api/payment/check")
async def check_payment(md5: str, db: Session = Depends(database.get_db)):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://mmotool.dev/check_payment.php?md5={quote(md5)}")
            data = resp.json()
            status = data.get("status", "UNPAID")
            
        if status == "PAID" and pending_payments.get(md5):
            payment_info = pending_payments[md5]
            if not payment_info["delivered"]:
                # Actually process purchase
                p_id = payment_info["productId"]
                email = payment_info["email"]

                # --- Try account delivery first ---
                account = db.query(models.Account).filter(
                    models.Account.product_id == p_id,
                    models.Account.status == "available"
                ).first()

                if account:
                    account.status = "sold"
                    account.sold_to_email = email
                    account.sold_at = func.now()

                    order = db.query(models.Order).filter(models.Order.id == payment_info["order_id"]).first()
                    if order:
                        order.status = "paid"
                        order.account_id = account.id
                        order.delivered_account_url = account.account_url
                        order.delivered_account_password = account.account_password
                    db.commit()

                    product = db.query(models.Product).filter(models.Product.id == p_id).first()
                    product_name = product.name if product else "Your Product"

                    # Also send by email as a backup delivery channel
                    send_account_email(email, product_name, account.account_url, account.account_password)

                    payment_info["delivered"] = True
                    payment_info["account_url"] = account.account_url
                    payment_info["account_password"] = account.account_password

                else:
                    # --- Fallback: try legacy License delivery ---
                    lic = db.query(models.License).filter(models.License.product_id == p_id, models.License.is_sold == False).first()
                    if lic:
                        lic.is_sold = True
                        lic.sold_to_email = email
                        lic.sold_at = func.now()

                        order = db.query(models.Order).filter(models.Order.id == payment_info["order_id"]).first()
                        if order:
                            order.status = "paid"
                            order.license_id = lic.id
                        db.commit()

                        payment_info["licenseKey"] = lic.key_value
                        payment_info["delivered"] = True
                    else:
                        payment_info["error"] = "Sold out after payment. No available accounts or license keys."
                        db.rollback()

        return {
            "status": status,
            "delivered": pending_payments.get(md5, {}).get("delivered", False),
            "account_url": pending_payments.get(md5, {}).get("account_url"),
            "account_password": pending_payments.get(md5, {}).get("account_password"),
            "licenseKey": pending_payments.get(md5, {}).get("licenseKey"),
            "error": pending_payments.get(md5, {}).get("error")
        }
    except Exception as e:
        print("Payment Check error:", e)
        return {"status": "UNPAID"}

# --- User Routes ---
@app.get("/api/user/orders")
def get_user_orders(current_user: dict = Depends(require_user), db: Session = Depends(database.get_db)):
    orders = (
        db.query(models.Order, models.Product)
        .outerjoin(models.Product, models.Order.product_id == models.Product.id)
        .filter(models.Order.user_id == current_user["id"])
        .order_by(models.Order.created_at.desc())
        .all()
    )
    return [
        {
            "id": o.id,
            "product_id": o.product_id,
            "product_name": p.name if p else "(Deleted Product)",
            "amount": float(o.amount),
            "status": o.status,
            "delivered_account_url": o.delivered_account_url,
            "delivered_account_password": o.delivered_account_password,
            "created_at": str(o.created_at),
        }
        for o, p in orders
    ]

# --- Admin Routes ---
@app.get("/api/admin/products")
def get_admin_products(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    """Returns all products (active + inactive) for admin panel."""
    products = db.query(models.Product).order_by(models.Product.id.asc()).all()
    result = []
    for p in products:
        stock = db.query(func.count(models.Account.id)).filter(
            models.Account.product_id == p.id,
            models.Account.status == "available"
        ).scalar() or 0
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "image_url": p.image_url,
            "status": p.status or "active",
            "created_at": p.created_at,
            "stock": stock
        })
    return result

@app.get("/api/admin/stats")
def get_admin_stats(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    active = db.query(func.count(models.Product.id)).filter(models.Product.status == "active").scalar()
    orders = db.query(func.count(models.Order.id)).scalar()
    rev = db.query(func.sum(models.Order.amount)).filter(models.Order.status == 'paid').scalar()
    return {"activeProducts": active or 0, "totalOrders": orders or 0, "totalRevenue": rev or 0}

@app.post("/api/admin/products")
async def create_product(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    image: Optional[UploadFile] = File(None),
    image_url: str = Form(""),
    admin: dict = Depends(get_admin),
    db: Session = Depends(database.get_db)
):
    final_image_url = image_url
    if image and image.filename:
        file_ext = os.path.splitext(image.filename)[1]
        filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join("uploads", filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await image.read())
        final_image_url = f"/uploads/{filename}"
    new_product = models.Product(name=name, description=description, price=price, image_url=final_image_url)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    log_admin_action(db, admin, "add product", f"id={new_product.id} name={name}")
    return new_product

@app.put("/api/admin/products/{id}")
async def update_product(
    id: int,
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    image: Optional[UploadFile] = File(None),
    image_url: str = Form(""),
    admin: dict = Depends(get_admin),
    db: Session = Depends(database.get_db)
):
    prod = db.query(models.Product).filter(models.Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404)
    final_image_url = image_url or prod.image_url
    if image and image.filename:
        file_ext = os.path.splitext(image.filename)[1]
        filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join("uploads", filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await image.read())
        final_image_url = f"/uploads/{filename}"
    prod.name = name
    prod.description = description
    prod.price = price
    prod.image_url = final_image_url
    db.commit()
    db.refresh(prod)
    log_admin_action(db, admin, "update product", f"id={id} name={name}")
    return prod

@app.delete("/api/admin/products/{id}")
def delete_product(id: int, admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    prod = db.query(models.Product).filter(models.Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    product_name = prod.name
    # Nullify product_id on orders to preserve order history
    db.query(models.Order).filter(models.Order.product_id == id).update({"product_id": None})
    # Remove associated accounts and licenses
    db.query(models.Account).filter(models.Account.product_id == id).delete()
    db.query(models.License).filter(models.License.product_id == id).delete()
    db.delete(prod)
    db.commit()
    log_admin_action(db, admin, "delete product", f"id={id} name={product_name}")
    return {"message": "Product deleted successfully"}

@app.patch("/api/admin/products/{id}/deactivate")
def deactivate_product(id: int, admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    prod = db.query(models.Product).filter(models.Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.status = "inactive"
    db.commit()
    log_admin_action(db, admin, "deactivate product", f"id={id} name={prod.name}")
    return {"message": "Product deactivated", "status": "inactive"}

@app.patch("/api/admin/products/{id}/reactivate")
def reactivate_product(id: int, admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    prod = db.query(models.Product).filter(models.Product.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.status = "active"
    db.commit()
    log_admin_action(db, admin, "reactivate product", f"id={id} name={prod.name}")
    return {"message": "Product reactivated", "status": "active"}

@app.get("/api/admin/orders")
def get_orders(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    orders = db.query(models.Order, models.Product).join(models.Product).order_by(models.Order.created_at.desc()).all()
    # Serialize manually for react
    return [{"id": o.id, "customer": o.customer_email, "product": p.name, "price": o.amount, "status": o.status, "created_at": o.created_at} for o, p in orders]

@app.get("/api/admin/customers")
def get_customers(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    res = db.query(models.Order.customer_email, func.count(models.Order.id), func.sum(models.Order.amount), func.max(models.Order.created_at)).filter(models.Order.status == 'paid').group_by(models.Order.customer_email).all()
    return [{"email": email, "total_orders": count, "total_spent": total, "last_order": date} for email, count, total, date in res]

@app.get("/api/admin/contacts")
def get_contacts(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    return db.query(models.Contact).order_by(models.Contact.created_at.desc()).all()

@app.delete("/api/admin/contacts/{id}")
def delete_contact(id: int, admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    c = db.query(models.Contact).filter(models.Contact.id == id).first()
    db.delete(c)
    db.commit()
    return {"success": True}

@app.post("/api/upload-image")
def upload_image(file: UploadFile = File(...), admin: dict = Depends(get_admin)):
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join("uploads", filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"imageUrl": f"/uploads/{filename}"}

# --- Admin Accounts CRUD ---
@app.get("/api/admin/accounts")
def get_accounts(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    accounts = db.query(models.Account, models.Product).join(models.Product).order_by(models.Account.id.asc()).all()
    return [
        {
            "id": a.id,
            "product_id": a.product_id,
            "product_name": p.name,
            "account_url": a.account_url,
            "account_password": a.account_password,
            "status": a.status,
            "sold_to_email": a.sold_to_email,
            "created_at": a.created_at
        }
        for a, p in accounts
    ]

@app.post("/api/admin/accounts")
def create_account(account: schemas.AccountCreate, admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    new_account = models.Account(
        product_id=account.product_id,
        account_url=account.account_url,
        account_password=account.account_password,
        status="available"
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    log_admin_action(db, admin, "add stock account", f"id={new_account.id} product_id={account.product_id}")
    return new_account

@app.delete("/api/admin/accounts/{id}")
def delete_account(id: int, admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    account = db.query(models.Account).filter(models.Account.id == id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    log_admin_action(db, admin, "delete stock account", f"id={id} product_id={account.product_id}")
    db.delete(account)
    db.commit()
    return {"success": True}

@app.get("/api/admin/stock")
def get_stock(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    """Returns available account count per product."""
    products = db.query(models.Product).all()
    result = []
    for p in products:
        available = db.query(func.count(models.Account.id)).filter(
            models.Account.product_id == p.id,
            models.Account.status == "available"
        ).scalar()
        result.append({"product_id": p.id, "product_name": p.name, "available_stock": available or 0})
    return result

@app.get("/api/admin/logs")
def get_admin_logs(admin: dict = Depends(get_admin), db: Session = Depends(database.get_db)):
    """Returns admin activity audit log, newest first."""
    logs = db.query(models.AdminLog).order_by(models.AdminLog.created_at.desc()).limit(500).all()
    return [
        {
            "id": log.id,
            "admin_username": log.admin_username,
            "action": log.action,
            "target": log.target,
            "created_at": str(log.created_at),
        }
        for log in logs
    ]
