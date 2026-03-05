import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ADMIN_SECRET_PATH = os.getenv("ADMIN_SECRET_PATH", "x7k2p9admin").strip("/")

# ─── DB Setup ────────────────────────────────────────────────────────────────

from database import create_database_if_not_exists, engine, Base

create_database_if_not_exists()

from models.models import User, Product, Order, Payment

Base.metadata.create_all(bind=engine)

# ─── Routers ─────────────────────────────────────────────────────────────────

from routers import auth, products, payment, orders

# ─── FastAPI App ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Digital Products Store API",
    description="Digital Products Platform with KHQR payment",
    version="1.0.0",
    # In production, hide docs behind secret path too
    docs_url="/api/docs" if ENVIRONMENT != "production" else None,
    redoc_url=None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routes ───────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(payment.router, prefix="/api")
app.include_router(orders.router, prefix="/api")

# ─── Static Directories ──────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
ADMIN_DIR = os.path.join(BASE_DIR, "admin_panel")

# ─── Frontend Static Files ────────────────────────────────────────────────────

if os.path.exists(FRONTEND_DIR):
    app.mount("/static/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend_static")

# ─── Hidden Admin Static Mount ────────────────────────────────────────────────

# Admin panel is only accessible at /{ADMIN_SECRET_PATH}/
# The path is set via environment variable and is NOT linked anywhere on the public site

if os.path.exists(ADMIN_DIR):
    app.mount(
        f"/{ADMIN_SECRET_PATH}",
        StaticFiles(directory=ADMIN_DIR, html=True),
        name="admin_panel"
    )


# ─── Frontend Page Routes ─────────────────────────────────────────────────────

def _serve_frontend(page: str):
    path = os.path.join(FRONTEND_DIR, page)
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Page not found")


@app.get("/", response_class=HTMLResponse)
@app.get("/index.html", response_class=HTMLResponse)
def homepage():
    return _serve_frontend("index.html")


@app.get("/{page_name}", response_class=HTMLResponse)
def catch_all_frontend(page_name: str):
    """
    Catch requests like /login, /login.html, /register, /register.html
    and serve the correct frontend file.
    """
    # Don't intercept API or admin paths
    if page_name.startswith("api") or page_name == ADMIN_SECRET_PATH:
        raise HTTPException(status_code=404, detail="Not found")
        
    # Ensure it ends with .html for our file lookup
    if not page_name.endswith(".html"):
        page_name += ".html"
        
    return _serve_frontend(page_name)


# ─── Block direct /admin* guessing ───────────────────────────────────────────

@app.get("/admin")
@app.get("/admin/")
@app.get("/admin-panel")
@app.get("/admin_panel")
@app.get("/administrator")
async def block_admin_guessing():
    """Return 404 for common admin URL guesses."""
    raise HTTPException(status_code=404, detail="Not found")


# ─── Health & Info ────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Digital Store API", "env": ENVIRONMENT}


# ─── Seed Sample Products ────────────────────────────────────────────────────

def seed_sample_data():
    from database import SessionLocal
    from utils.auth import hash_password

    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            sample_products = [
                Product(
                    title="Netflix Premium Account",
                    description="1 Month Netflix Premium 4K UHD subscription. Works on all devices. Instant delivery after payment.",
                    price=4.99,
                    image="https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&q=80",
                    account_email="netflix_user_001@example.com",
                    account_password="NetPass@2024",
                ),
                Product(
                    title="Spotify Premium 3 Months",
                    description="3 months Spotify Premium. Ad-free music, offline downloads, unlimited skips. Works worldwide.",
                    price=9.99,
                    image="https://images.unsplash.com/photo-1614680376739-414d95ff43df?w=400&q=80",
                    account_email="spotify_user_002@example.com",
                    account_password="SpotPass@2024",
                ),
                Product(
                    title="Adobe Creative Cloud",
                    description="Adobe Creative Cloud 1 Month – All apps included: Photoshop, Illustrator, Premiere Pro and more.",
                    price=14.99,
                    image="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80",
                    account_email="adobe_user_003@example.com",
                    account_password="AdobePass@2024",
                ),
                Product(
                    title="ChatGPT Plus 1 Month",
                    description="ChatGPT Plus subscription for 1 month. Access to GPT-4, DALL-E, faster responses and priority access.",
                    price=19.99,
                    image="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=80",
                    account_email="chatgpt_user_004@example.com",
                    account_password="GptPass@2024",
                ),
                Product(
                    title="YouTube Premium",
                    description="YouTube Premium 1 Month – No ads, background play, YouTube Music included. For all devices.",
                    price=5.99,
                    image="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&q=80",
                    account_email="youtube_user_005@example.com",
                    account_password="YtPass@2024",
                ),
                Product(
                    title="Microsoft Office 365",
                    description="Microsoft 365 Personal – 1 Year license. Word, Excel, PowerPoint, Outlook and 1TB OneDrive storage.",
                    price=24.99,
                    image="https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80",
                    account_email="office_user_006@example.com",
                    account_password="OfficePass@2024",
                ),
            ]
            db.add_all(sample_products)
            db.commit()
            print(f"[Seed] ✅ Seeded {len(sample_products)} products")
    except Exception as e:
        print(f"[Seed] Error: {e}")
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    seed_sample_data()
    print(f"🚀 Digital Store running in [{ENVIRONMENT}] mode")
    print(f"🌐 Frontend:  /")
    print(f"🔐 Admin:     /{ADMIN_SECRET_PATH}/admin_login.html  (keep this secret!)")
    print(f"📖 API Docs:  /api/docs")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=(ENVIRONMENT == "development"))
