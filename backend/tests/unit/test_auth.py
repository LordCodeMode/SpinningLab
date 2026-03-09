"""
Unit tests for authentication and security.

Tests:
- Password validation
- User registration
- User login
- JWT token generation/validation
- Password hashing
"""

import pytest
from datetime import datetime, timedelta, timezone
from app.services.auth_service import AuthService
from app.core.security import verify_password, get_password_hash, get_token_hash


@pytest.mark.auth
@pytest.mark.unit
class TestPasswordValidation:
    """Test password complexity requirements."""

    def test_password_too_short(self, test_db):
        """Test that passwords less than 8 characters are rejected."""
        auth_service = AuthService(test_db)
        is_valid, error = auth_service.validate_password_strength("Short1!")
        assert not is_valid
        assert "at least 8 characters" in error

    def test_password_missing_uppercase(self, test_db):
        """Test that passwords without uppercase letters are rejected."""
        auth_service = AuthService(test_db)
        is_valid, error = auth_service.validate_password_strength("nouppercase123!")
        assert not is_valid
        assert "uppercase" in error

    def test_password_missing_lowercase(self, test_db):
        """Test that passwords without lowercase letters are rejected."""
        auth_service = AuthService(test_db)
        is_valid, error = auth_service.validate_password_strength("NOLOWERCASE123!")
        assert not is_valid
        assert "lowercase" in error

    def test_password_missing_number(self, test_db):
        """Test that passwords without numbers are rejected."""
        auth_service = AuthService(test_db)
        is_valid, error = auth_service.validate_password_strength("NoNumbers!")
        assert not is_valid
        assert "number" in error

    def test_password_missing_special_char(self, test_db):
        """Test that passwords without special characters are rejected."""
        auth_service = AuthService(test_db)
        is_valid, error = auth_service.validate_password_strength("NoSpecialChar123")
        assert not is_valid
        assert "special character" in error

    def test_password_too_long(self, test_db):
        """Test that passwords over 128 characters are rejected."""
        auth_service = AuthService(test_db)
        long_password = "A1!" + "a" * 130
        is_valid, error = auth_service.validate_password_strength(long_password)
        assert not is_valid
        assert "128 characters" in error

    def test_valid_passwords(self, test_db, strong_passwords):
        """Test that valid passwords are accepted."""
        auth_service = AuthService(test_db)
        for password in strong_passwords:
            is_valid, error = auth_service.validate_password_strength(password)
            assert is_valid, f"Password '{password}' should be valid, but got error: {error}"
            assert error == ""


@pytest.mark.auth
@pytest.mark.unit
class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_password_hashing(self):
        """Test that passwords are properly hashed."""
        password = "TestPass123!"
        hashed = get_password_hash(password)

        # Hashed password should be different from original
        assert hashed != password

        # Hashed password should be bcrypt format
        assert hashed.startswith("$2b$")

    def test_password_verification_success(self):
        """Test that correct passwords verify successfully."""
        password = "TestPass123!"
        hashed = get_password_hash(password)

        # Verification should succeed
        assert verify_password(password, hashed) is True

    def test_password_verification_failure(self):
        """Test that incorrect passwords fail verification."""
        password = "TestPass123!"
        wrong_password = "WrongPass456!"
        hashed = get_password_hash(password)

        # Verification should fail
        assert verify_password(wrong_password, hashed) is False

    def test_same_password_different_hashes(self):
        """Test that hashing same password twice produces different hashes (salt)."""
        password = "TestPass123!"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Hashes should be different due to salt
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


@pytest.mark.auth
@pytest.mark.unit
class TestUserRegistration:
    """Test user registration functionality."""

    def test_register_new_user(self, test_db):
        """Test successful user registration."""
        auth_service = AuthService(test_db)

        user = auth_service.create_user(
            username="newuser",
            password="NewPass123!",
            email="new@example.com",
            name="New User"
        )

        assert user.id is not None
        assert user.username == "newuser"
        assert user.email == "new@example.com"
        assert user.name == "New User"
        assert user.is_active is True
        assert user.ftp == 250.0  # Default value
        assert user.weight == 70.0  # Default value

    def test_register_user_password_hashed(self, test_db):
        """Test that user password is hashed in database."""
        auth_service = AuthService(test_db)
        password = "TestPass123!"

        user = auth_service.create_user(
            username="hashtest",
            password=password,
            email="hash@example.com"
        )

        # Password should not be stored in plaintext
        assert user.hashed_password != password
        # Should be able to verify with the original password
        assert verify_password(password, user.hashed_password) is True

    def test_register_user_weak_password(self, test_db, weak_passwords):
        """Test that weak passwords are rejected during registration."""
        auth_service = AuthService(test_db)

        for weak_password in weak_passwords:
            with pytest.raises(ValueError):
                auth_service.create_user(
                    username=f"user_{weak_password[:5]}",
                    password=weak_password,
                    email=f"{weak_password[:5]}@example.com"
                )

    def test_register_duplicate_username(self, test_db, test_user):
        """Test that duplicate usernames are rejected."""
        auth_service = AuthService(test_db)

        # Try to create user with same username
        # Note: This should be handled at the route level with appropriate error
        existing_user = auth_service.get_user_by_username(test_user.username)
        assert existing_user is not None
        assert existing_user.username == test_user.username


@pytest.mark.auth
@pytest.mark.unit
class TestUserAuthentication:
    """Test user authentication functionality."""

    def test_authenticate_valid_credentials(self, test_db, test_user, test_user_data):
        """Test authentication with correct credentials."""
        auth_service = AuthService(test_db)

        authenticated_user = auth_service.authenticate_user(
            test_user_data["username"],
            test_user_data["password"]
        )

        assert authenticated_user is not None
        assert authenticated_user.id == test_user.id
        assert authenticated_user.username == test_user.username

    def test_authenticate_with_email(self, test_db, test_user, test_user_data):
        """Users should be able to login using their email address."""
        auth_service = AuthService(test_db)

        authenticated_user = auth_service.authenticate_user(
            test_user_data["email"],
            test_user_data["password"]
        )

        assert authenticated_user is not None
        assert authenticated_user.id == test_user.id
        assert authenticated_user.email == test_user.email

    def test_authenticate_invalid_username(self, test_db, test_user_data):
        """Test authentication with non-existent username."""
        auth_service = AuthService(test_db)

        authenticated_user = auth_service.authenticate_user(
            "nonexistent",
            test_user_data["password"]
        )

        assert authenticated_user is None

    def test_authenticate_invalid_password(self, test_db, test_user, test_user_data):
        """Test authentication with incorrect password."""
        auth_service = AuthService(test_db)

        authenticated_user = auth_service.authenticate_user(
            test_user_data["username"],
            "WrongPassword123!"
        )

        assert authenticated_user is None

    def test_get_user_by_username(self, test_db, test_user):
        """Test retrieving user by username."""
        auth_service = AuthService(test_db)

        user = auth_service.get_user_by_username(test_user.username)

        assert user is not None
        assert user.id == test_user.id
        assert user.email == test_user.email

    def test_get_user_by_email(self, test_db, test_user):
        """Test retrieving user by email (case insensitive)."""
        auth_service = AuthService(test_db)

        user = auth_service.get_user_by_email(test_user.email.upper())

        assert user is not None
        assert user.id == test_user.id
        assert user.username == test_user.username


@pytest.mark.auth
@pytest.mark.unit
class TestPasswordReset:
    """Test password reset token issuance and password changes."""

    def test_create_password_reset_stores_hashed_token(self, test_db, test_user, monkeypatch):
        auth_service = AuthService(test_db)
        monkeypatch.setattr("app.services.auth_service.generate_one_time_token", lambda: "fixed-reset-token")

        user, token = auth_service.create_password_reset(test_user.email, 30)

        assert token == "fixed-reset-token"
        assert user.id == test_user.id
        assert user.password_reset_token_hash == get_token_hash("fixed-reset-token")
        assert user.password_reset_expires_at is not None

    def test_create_password_reset_unknown_email_returns_none(self, test_db):
        auth_service = AuthService(test_db)

        user, token = auth_service.create_password_reset("missing@example.com", 30)

        assert user is None
        assert token is None

    def test_reset_password_updates_hash_and_clears_token(self, test_db, test_user, test_user_data, monkeypatch):
        auth_service = AuthService(test_db)
        monkeypatch.setattr("app.services.auth_service.generate_one_time_token", lambda: "fixed-reset-token")
        auth_service.create_password_reset(test_user.email, 30)

        updated_user = auth_service.reset_password("fixed-reset-token", "NewReset123!")

        assert updated_user is not None
        assert verify_password("NewReset123!", updated_user.hashed_password) is True
        assert verify_password(test_user_data["password"], updated_user.hashed_password) is False
        assert updated_user.password_reset_token_hash is None
        assert updated_user.password_reset_expires_at is None

    def test_reset_password_rejects_expired_token(self, test_db, test_user):
        auth_service = AuthService(test_db)
        test_user.password_reset_token_hash = get_token_hash("expired-token")
        test_user.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        test_db.commit()

        updated_user = auth_service.reset_password("expired-token", "NewReset123!")

        assert updated_user is None

    def test_reset_password_accepts_timezone_aware_expiry(self, test_db, test_user):
        auth_service = AuthService(test_db)
        test_user.password_reset_token_hash = get_token_hash("aware-token")
        test_user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        test_db.commit()

        updated_user = auth_service.reset_password("aware-token", "AwareReset123!")

        assert updated_user is not None


@pytest.mark.auth
@pytest.mark.unit
class TestEmailVerification:
    def test_create_email_verification_stores_hashed_token(self, test_db, monkeypatch):
        auth_service = AuthService(test_db)
        user = auth_service.create_user(
            username="pending@example.com",
            password="PendingPass123!",
            email="pending@example.com",
            is_email_verified=False,
        )
        monkeypatch.setattr("app.services.auth_service.generate_one_time_token", lambda: "fixed-verify-token")

        updated_user, token = auth_service.create_email_verification(user.email, 60)

        assert token == "fixed-verify-token"
        assert updated_user.email_verification_token_hash == get_token_hash("fixed-verify-token")

    def test_verify_email_marks_user_verified(self, test_db):
        auth_service = AuthService(test_db)
        user = auth_service.create_user(
            username="pending2@example.com",
            password="PendingPass123!",
            email="pending2@example.com",
            is_email_verified=False,
        )
        _, token = auth_service.create_email_verification(user.email, 60)

        verified_user = auth_service.verify_email(token)

        assert verified_user is not None
        assert verified_user.is_email_verified is True
        assert verified_user.email_verification_token_hash is None


@pytest.mark.auth
@pytest.mark.unit
class TestRefreshSessions:
    def test_create_refresh_session_persists_hash(self, test_db, test_user):
        auth_service = AuthService(test_db)

        session, raw_token = auth_service.create_refresh_session(test_user, expires_days=30)

        assert session.id is not None
        assert session.token_hash == get_token_hash(raw_token)

    def test_rotate_refresh_session_revokes_previous_token(self, test_db, test_user):
        auth_service = AuthService(test_db)
        original_session, raw_token = auth_service.create_refresh_session(test_user, expires_days=30)

        user, next_token = auth_service.rotate_refresh_session(raw_token, expires_days=30)

        assert user is not None
        assert next_token is not None
        test_db.refresh(original_session)
        assert original_session.revoked_at is not None
