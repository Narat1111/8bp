from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/digital_store")

# Render provides postgres:// but SQLAlchemy needs postgresql://
# Also handle Render's PostgreSQL URL scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Detect DB type for engine args
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
    "echo": False,
}

# PostgreSQL on Render needs connection pool adjustments
if IS_POSTGRES:
    engine_kwargs.update({
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 30,
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_database_if_not_exists():
    """Create the MySQL database if it doesn't exist (skip for PostgreSQL – Render creates it)."""
    if IS_POSTGRES:
        # Render PostgreSQL DB is pre-created; just ensure tables exist
        return
    try:
        base_url = DATABASE_URL.rsplit("/", 1)[0]
        db_name = DATABASE_URL.rsplit("/", 1)[1].split("?")[0]
        temp_engine = create_engine(base_url + "/mysql", echo=False)
        with temp_engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{db_name}`"))
            conn.commit()
        temp_engine.dispose()
    except Exception as e:
        print(f"[DB] Note: {e}")
