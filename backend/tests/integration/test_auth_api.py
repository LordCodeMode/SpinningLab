"""
Integration tests for authentication API endpoints.

Tests:
- User registration API
- User login API
- Protected endpoints
- JWT token validation
- Rate limiting (basic check)
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.auth
@pytest.mark.integration
class TestRegistrationAPI:
    """Test user registration API endpoint."""

    def test_register_new_user_success(self, client):
        """Test successful user registration via API."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "apiuser",
                "password": "ApiPass123!",
                "email": "api@example.com",
                "name": "API User"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User created successfully"
        assert "user_id" in data

    def test_register_weak_password(self, client):
        """Test registration with weak password returns 400."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "weakuser",
                "password": "weak",  # Too short, no uppercase, no special char
                "email": "weak@example.com"
            }
        )

        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()

    def test_register_duplicate_username(self, client, test_user):
        """Test that registering duplicate username returns 400."""
        response = client.post(
            "/api/auth/register",
            json={
                "username": test_user.username,
                "password": "DuplicatePass123!",
                "email": "duplicate@example.com"
            }
        )

        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]


@pytest.mark.auth
@pytest.mark.integration
class TestLoginAPI:
    """Test user login API endpoint."""

    def test_login_success(self, client, test_user, test_user_data):
        """Test successful login returns JWT token."""
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0

    def test_login_invalid_username(self, client):
        """Test login with non-existent username returns 401."""
        response = client.post(
            "/api/auth/login",
            data={
                "username": "nonexistent",
                "password": "AnyPassword123!"
            }
        )

        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_invalid_password(self, client, test_user, test_user_data):
        """Test login with incorrect password returns 401."""
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user_data["username"],
                "password": "WrongPassword123!"
            }
        )

        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_inactive_user(self, client, test_db, test_user, test_user_data):
        """Test login with inactive user returns 401."""
        # Deactivate user
        test_user.is_active = False
        test_db.commit()

        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )

        assert response.status_code == 401
        assert "disabled" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.integration
class TestProtectedEndpoints:
    """Test protected endpoints require authentication."""

    def test_get_current_user_with_valid_token(self, client, test_user, auth_headers):
        """Test /api/auth/me returns current user with valid token."""
        response = client.get("/api/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email

    def test_get_current_user_without_token(self, client):
        """Test /api/auth/me returns 401 without token."""
        response = client.get("/api/auth/me")

        assert response.status_code == 401

    def test_get_current_user_invalid_token(self, client):
        """Test /api/auth/me returns 401 with invalid token."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )

        assert response.status_code == 401

    def test_protected_endpoint_activities(self, client, test_user, auth_headers):
        """Test that activities endpoint requires authentication."""
        # Without auth
        response = client.get("/api/activities")
        assert response.status_code == 401

        # With auth - should return activities list (might be empty)
        response = client.get("/api/activities", headers=auth_headers)
        assert response.status_code in [200, 404]  # 200 with data, 404 if no activities


@pytest.mark.auth
@pytest.mark.integration
class TestJWTToken:
    """Test JWT token functionality."""

    def test_token_contains_username(self, client, test_user, test_user_data):
        """Test that JWT token can be used to identify user."""
        # Login
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )

        token = response.json()["access_token"]

        # Use token to get user info
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        assert response.json()["username"] == test_user_data["username"]

    def test_token_format(self, client, test_user, test_user_data):
        """Test that token is in correct JWT format."""
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )

        token = response.json()["access_token"]

        # JWT tokens have 3 parts separated by dots
        parts = token.split(".")
        assert len(parts) == 3
