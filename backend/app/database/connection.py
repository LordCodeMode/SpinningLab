import os
from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

url = make_url(settings.DATABASE_URL)
connect_args = {}

if url.drivername.startswith("postgresql"):
    connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))
    connect_args["connect_timeout"] = connect_timeout
elif url.drivername.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
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
        alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
        alembic_cfg.set_main_option("prepend_sys_path", str(backend_dir))

        logger.info("Running database migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("✓ Database migrations completed successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to run migrations: {e}")
        if settings.is_dev:
            logger.info("Falling back to basic table creation for local development...")
            Base.metadata.create_all(bind=engine)
        return False


def init_db():
    """
    Initialize database automatically and keep schema at latest revision.

    This function:
    1. Runs Alembic migrations on startup
    2. Falls back to table creation if migrations are unavailable
    3. Verifies essential tables exist afterwards
    """
    logger.info("Ensuring database schema is up to date...")
    if settings.is_dev:
        run_migrations()

    if not check_database_exists():
        if settings.is_dev:
            logger.warning("Database schema still incomplete after migrations. Falling back to metadata creation...")
            Base.metadata.create_all(bind=engine)
        else:
            raise RuntimeError("Database schema is not ready. Run migrations before starting the app.")
    else:
        logger.info("Database schema is ready")


def get_db() -> Session:
    """Database dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
