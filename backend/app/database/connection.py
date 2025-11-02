from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

# Create database directory if it doesn't exist
if settings.DATABASE_URL.startswith("sqlite"):
    db_path = Path(settings.DATABASE_URL.replace("sqlite:///./", ""))
    db_dir = db_path.parent
    if not db_dir.exists():
        logger.info(f"Creating database directory: {db_dir}")
        db_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def check_database_exists() -> bool:
    """Check if database tables exist."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        # Check if essential tables exist
        required_tables = ['users', 'activities', 'training_load']
        return all(table in tables for table in required_tables)
    except Exception as e:
        logger.warning(f"Error checking database: {e}")
        return False


def run_migrations():
    """Run Alembic migrations to create/update database schema."""
    try:
        from alembic.config import Config
        from alembic import command

        # Get the backend directory (where alembic.ini is)
        backend_dir = Path(__file__).resolve().parent.parent.parent
        alembic_cfg = Config(str(backend_dir / "alembic.ini"))

        logger.info("Running database migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("✓ Database migrations completed successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to run migrations: {e}")
        # Fallback to basic table creation if migrations fail
        logger.info("Falling back to basic table creation...")
        Base.metadata.create_all(bind=engine)
        return False


def init_db():
    """
    Initialize database automatically.

    This function:
    1. Checks if database exists
    2. If not, runs migrations to create all tables
    3. For users: happens automatically on app startup
    4. For developers: can also use 'alembic upgrade head' manually
    """
    if not check_database_exists():
        logger.info("Database not found or incomplete. Initializing...")
        run_migrations()
    else:
        logger.info("Database already initialized")


def get_db() -> Session:
    """Database dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()