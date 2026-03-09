import pytest

from app.core.config import settings
from app.core.security import create_access_token
from app.services.auth_service import AuthService


@pytest.mark.auth
@pytest.mark.integration
class TestRegistrationAPI:
    def test_register_new_user_success(self, client, monkeypatch):
        monkeypatch.setattr(
            "app.services.email_service.EmailService.can_deliver_auth_emails",
            lambda self: False,
        )
        monkeypatch.setattr("app.services.auth_service.generate_one_time_token", lambda: "verify-token")

        response = client.post(
            "/api/auth/register",
            json={
                "username": "apiuser@example.com",
                "password": "ApiPass123!",
                "email": "apiuser@example.com",
                "name": "API User",
            },
            headers={"Origin": "http://localhost:8080"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert "verify your email" in payload["message"].lower()
        assert payload["dev_verify_url"].endswith("mode=verify&token=verify-token")

    def test_register_weak_password(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "username": "weakuser@example.com",
                "password": "weak",
                "email": "weakuser@example.com",
            },
        )

        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.integration
class TestEmailVerificationAPI:
    def test_confirm_email_verification(self, client, test_db):
        auth_service = AuthService(test_db)
        user = auth_service.create_user(
            username="pending@example.com",
            password="PendingPass123!",
            email="pending@example.com",
            is_email_verified=False,
        )
        _, token = auth_service.create_email_verification(user.email, 30)

        response = client.post("/api/auth/verify-email/confirm", json={"token": token})

        assert response.status_code == 200
        assert "verified" in response.json()["message"].lower()
        test_db.refresh(user)
        assert user.is_email_verified is True


@pytest.mark.auth
@pytest.mark.integration
class TestLoginAndSessionAPI:
    def test_login_success_sets_auth_cookies(self, client, test_user, test_user_data):
        response = client.post(
            "/api/auth/login",
            data={"username": test_user_data["username"], "password": test_user_data["password"]},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["user"]["email"] == test_user_data["email"]
        assert settings.SESSION_COOKIE_NAME in response.cookies
        assert settings.REFRESH_COOKIE_NAME in response.cookies

    def test_login_unverified_user_rejected(self, client, test_db):
        auth_service = AuthService(test_db)
        auth_service.create_user(
            username="pending@example.com",
            password="PendingPass123!",
            email="pending@example.com",
            is_email_verified=False,
        )

        response = client.post(
            "/api/auth/login",
            data={"username": "pending@example.com", "password": "PendingPass123!"},
        )

        assert response.status_code == 403
        assert "verify your email" in response.json()["detail"].lower()

    def test_refresh_rotates_cookie(self, client, test_user, test_user_data):
        login_response = client.post(
            "/api/auth/login",
            data={"username": test_user_data["username"], "password": test_user_data["password"]},
        )
        old_refresh = login_response.cookies.get(settings.REFRESH_COOKIE_NAME)

        refresh_response = client.post("/api/auth/refresh")

        assert refresh_response.status_code == 200
        assert refresh_response.cookies.get(settings.REFRESH_COOKIE_NAME)
        assert refresh_response.cookies.get(settings.REFRESH_COOKIE_NAME) != old_refresh

    def test_me_accepts_cookie_session(self, client, test_user, test_user_data):
        login_response = client.post(
            "/api/auth/login",
            data={"username": test_user_data["username"], "password": test_user_data["password"]},
        )
        client.cookies.update(login_response.cookies)

        response = client.get("/api/auth/me")

        assert response.status_code == 200
        assert response.json()["id"] == test_user.id

    def test_me_accepts_legacy_bearer_token(self, client, test_user):
        token = create_access_token({"sub": test_user.username})

        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        assert response.json()["username"] == test_user.username

    def test_logout_clears_cookies(self, client, test_user, test_user_data):
        client.post(
            "/api/auth/login",
            data={"username": test_user_data["username"], "password": test_user_data["password"]},
        )
        csrf_token = client.cookies.get(settings.CSRF_COOKIE_NAME)

        response = client.post("/api/auth/logout", headers={settings.CSRF_HEADER_NAME: csrf_token})

        assert response.status_code == 200
        assert settings.SESSION_COOKIE_NAME not in client.cookies


@pytest.mark.auth
@pytest.mark.integration
class TestPasswordResetAPI:
    def test_password_reset_request_returns_local_dev_link_without_smtp(self, client, test_user, monkeypatch):
        monkeypatch.setattr(
            "app.services.email_service.EmailService.can_deliver_auth_emails",
            lambda self: False,
        )
        monkeypatch.setattr("app.services.auth_service.generate_one_time_token", lambda: "local-reset-token")

        response = client.post(
            "/api/auth/password-reset/request",
            json={"email": test_user.email},
            headers={"Origin": "http://localhost:8080"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert "development" in payload["message"].lower()
        assert "local-reset-token" in payload["dev_reset_url"]

    def test_password_reset_confirm_sets_session_cookies(self, client, test_db, test_user):
        auth_service = AuthService(test_db)
        _, reset_token = auth_service.create_password_reset(test_user.email, 30)

        response = client.post(
            "/api/auth/password-reset/confirm",
            json={"token": reset_token, "password": "RecoveryPass123!"},
        )

        assert response.status_code == 200
        assert response.cookies.get(settings.SESSION_COOKIE_NAME)
        assert response.cookies.get(settings.REFRESH_COOKIE_NAME)

    def test_password_reset_confirm_rejects_invalid_token(self, client):
        response = client.post(
            "/api/auth/password-reset/confirm",
            json={"token": "bad-token", "password": "RecoveryPass123!"},
        )

        assert response.status_code == 400
        assert "invalid or expired" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.integration
class TestProtectedEndpoints:
    def test_protected_endpoint_activities(self, client, auth_headers):
        response = client.get("/api/activities")
        assert response.status_code == 401

        response = client.get("/api/activities", headers=auth_headers)
        assert response.status_code in [200, 404]
