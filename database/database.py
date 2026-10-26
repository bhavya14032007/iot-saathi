"""
IoT Saathi - Database Connection & Engine Configuration
Supports PostgreSQL (Render Managed Database) and SQLite (Local / Free Web Service).
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# Base directory of database service
DB_DIR = os.path.dirname(os.path.abspath(__file__))

# Render provides DATABASE_URL in environment.
# Note: SQLAlchemy 1.4+ requires postgresql:// instead of postgres://
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if not raw_db_url or raw_db_url.startswith("sqlite"):
    default_sqlite_path = os.path.join(DB_DIR, "iot_saathi_store.db")
    DATABASE_URL = f"sqlite:///{default_sqlite_path}"
else:
    DATABASE_URL = raw_db_url
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite requires specific connect_args to allow multithreaded FastAPI requests
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# Engine configuration with pooling for PostgreSQL
if is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        echo=False
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency to provide a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_info():
    """Returns database type and connection state information for health checks."""
    return {
        "engine": "sqlite" if is_sqlite else "postgresql",
        "url_masked": (
            "sqlite:///iot_saathi_store.db"
            if is_sqlite
            else DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "postgresql://..."
        )
    }
