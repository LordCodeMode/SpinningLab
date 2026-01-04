"""
Pytest configuration and fixtures for Training Dashboard Pro tests.

This file contains shared fixtures used across all tests.
"""

import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure testing mode is active before app imports
os.environ.setdefault("TESTING", "true")

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.database.connection import Base, get_db
from app.database.models import User, Activity, TrainingLoad
from app.main import app
from app.services.auth_service import AuthService


# Test database setup
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def test_engine():
    """Create a test database engine using in-memory SQLite."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_db(test_engine):
    """Create a test database session."""
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with test database."""

    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Sample user data for testing."""
    return {
        "username": "testuser",
        "password": "TestPass123!",
        "email": "test@example.com",
        "name": "Test User"
    }


@pytest.fixture
def test_user(test_db, test_user_data):
    """Create a test user in the database."""
    auth_service = AuthService(test_db)
    user = auth_service.create_user(
        username=test_user_data["username"],
        password=test_user_data["password"],
        email=test_user_data["email"],
        name=test_user_data["name"]
    )
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user, test_user_data):
    """Get authentication headers with valid JWT token."""
    # Login to get token
    response = client.post(
        "/api/auth/login",
        data={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_activity_data():
    """Sample activity data for testing."""
    return {
        "start_time": "2024-01-15T10:00:00",
        "duration": 3600.0,
        "distance": 30.5,
        "avg_power": 200.0,
        "normalized_power": 215.0,
        "avg_heart_rate": 145.0,
        "max_heart_rate": 175.0,
        "tss": 75.0,
        "intensity_factor": 0.86,
    }


@pytest.fixture
def weak_passwords():
    """List of passwords that should fail validation."""
    return [
        "short",  # Too short
        "nouppercase123!",  # No uppercase
        "NOLOWERCASE123!",  # No lowercase
        "NoNumbers!",  # No numbers
        "NoSpecialChar123",  # No special characters
        "",  # Empty
        "a" * 129,  # Too long
    ]


@pytest.fixture
def strong_passwords():
    """List of passwords that should pass validation."""
    return [
        "ValidPass123!",
        "Str0ng&Secure",
        "Test@Pass2024",
        "My$ecure99Pass",
        "C0mpl3x!Password",
    ]
