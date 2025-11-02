#!/usr/bin/env python3
"""
Database initialization script for Training Dashboard Pro.

This script:
1. Creates the database directory if it doesn't exist
2. Runs Alembic migrations to create all tables
3. Optionally creates a demo user for testing

Usage:
    python init_db.py              # Initialize database
    python init_db.py --demo-user  # Initialize with demo user
"""

import os
import sys
import subprocess
from pathlib import Path


def run_command(cmd, description):
    """Run a shell command and print the result."""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=True,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed")
        if e.stdout:
            print(e.stdout)
        if e.stderr:
            print(e.stderr)
        return False


def create_demo_user():
    """Create a demo user for testing."""
    print(f"\n{'='*60}")
    print("Creating demo user")
    print(f"{'='*60}")

    # Import here to avoid issues if database doesn't exist yet
    from app.database.connection import SessionLocal
    from app.services.auth_service import AuthService

    db = SessionLocal()
    try:
        auth_service = AuthService(db)

        # Check if demo user already exists
        existing_user = auth_service.get_user_by_username("demo")
        if existing_user:
            print("Demo user already exists. Skipping creation.")
            return

        # Create demo user
        # Password: Demo123!
        user = auth_service.create_user(
            username="demo",
            password="Demo123!",
            email="demo@example.com",
            name="Demo User"
        )

        print(f"✓ Demo user created successfully!")
        print(f"  Username: demo")
        print(f"  Password: Demo123!")
        print(f"  Email: demo@example.com")

    except Exception as e:
        print(f"✗ Failed to create demo user: {e}")
    finally:
        db.close()


def main():
    """Main initialization function."""
    print("\n" + "="*60)
    print("Training Dashboard Pro - Database Initialization")
    print("="*60)

    # Check if .env exists
    env_file = Path(".env")
    if not env_file.exists():
        print("\n⚠ WARNING: .env file not found!")
        print("Please copy .env.example to .env and configure it before proceeding.")
        print("\nRun: cp .env.example .env")
        sys.exit(1)

    # Load environment to check database path
    from app.core.config import settings

    # Create database directory
    db_path = Path(settings.DATABASE_URL.replace("sqlite:///./", ""))
    db_dir = db_path.parent

    print(f"\nDatabase will be created at: {db_path}")

    if not db_dir.exists():
        print(f"Creating database directory: {db_dir}")
        db_dir.mkdir(parents=True, exist_ok=True)

    # Run migrations
    success = run_command(
        "alembic upgrade head",
        "Running database migrations"
    )

    if not success:
        print("\n✗ Database initialization failed!")
        sys.exit(1)

    # Create demo user if requested
    if "--demo-user" in sys.argv:
        create_demo_user()

    print(f"\n{'='*60}")
    print("✓ Database initialization complete!")
    print(f"{'='*60}")
    print("\nYou can now start the server with:")
    print("  python -m uvicorn app.main:app --reload")

    if "--demo-user" not in sys.argv:
        print("\nTo create a demo user, run:")
        print("  python init_db.py --demo-user")


if __name__ == "__main__":
    main()
