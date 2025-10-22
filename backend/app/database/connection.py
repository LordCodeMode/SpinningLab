from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from ..core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db():
    """Initialize database tables."""
    from .models import User, Activity, PowerZone, HrZone
    Base.metadata.create_all(bind=engine)

def get_db() -> Session:
    """Database dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()