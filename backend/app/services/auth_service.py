from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database.models import User, RefreshSession, SecurityEvent
from ..core.security import (
    verify_password,
    get_password_hash,
    generate_one_time_token,
    generate_refresh_token,
    get_token_hash,
)
from typing import Optional, Any
import re
from ..core.config import settings

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _utc_now() -> datetime:
        """Return a timezone-aware UTC timestamp."""
        return datetime.now(timezone.utc)

    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        """
        Validate password meets security requirements.
        Returns (is_valid, error_message)
        """
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"

        if len(password) > 128:
            return False, "Password must not exceed 128 characters"

        # Check for at least one uppercase letter
        if not re.search(r"[A-Z]", password):
            return False, "Password must contain at least one uppercase letter"

        # Check for at least one lowercase letter
        if not re.search(r"[a-z]", password):
            return False, "Password must contain at least one lowercase letter"

        # Check for at least one digit
        if not re.search(r"\d", password):
            return False, "Password must contain at least one number"

        # Check for at least one special character
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\\/;'`~]", password):
            return False, "Password must contain at least one special character (!@#$%^&* etc.)"

        return True, ""

    def get_user_by_username(self, username: str) -> Optional[User]:
        if not username:
            return None
        normalized_username = username.strip()
        return self.db.query(User).filter(User.username == normalized_username).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Return the first user that matches the given email (case-insensitive)."""
        if not email:
            return None
        normalized_email = email.strip().lower()
        return (
            self.db.query(User)
            .filter(func.lower(User.email) == normalized_email)
            .first()
        )

    def authenticate_user(self, identifier: str, password: str) -> Optional[User]:
        """Authenticate by username or email so the UI can accept either input."""
        if not identifier:
            return None

        trimmed_identifier = identifier.strip()
        user = self.get_user_by_username(trimmed_identifier)

        # If no user found and the identifier looks like an email, check email column
        if not user:
            user = self.get_user_by_email(trimmed_identifier)

        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def create_user(
        self,
        username: str,
        password: str,
        email: str = None,
        name: str = None,
        *,
        is_email_verified: bool = True,
        is_active: bool = True,
    ) -> User:
        # Validate password strength
        is_valid, error_msg = self.validate_password_strength(password)
        if not is_valid:
            raise ValueError(error_msg)
        normalized_username = (username or "").strip()
        normalized_email = email.strip().lower() if email else None
        hashed_password = get_password_hash(password)
        db_user = User(
            username=normalized_username,
            email=normalized_email,
            name=name.strip() if isinstance(name, str) and name.strip() else None,
            hashed_password=hashed_password,
            is_active=is_active,
            is_email_verified=is_email_verified,
            ftp=250.0,
            weight=70.0,
            hr_max=190,
            hr_rest=60
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def is_login_locked(self, user: User) -> bool:
        if not user or not user.login_locked_until:
            return False
        locked_until = user.login_locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        return locked_until > self._utc_now()

    def register_failed_login(self, user: Optional[User]) -> None:
        if not user:
            return
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            user.login_locked_until = self._utc_now() + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
        self.db.commit()

    def clear_failed_logins(self, user: User, ip_address: str | None = None) -> None:
        user.failed_login_attempts = 0
        user.login_locked_until = None
        user.last_login_at = self._utc_now()
        user.last_login_ip = ip_address
        self.db.commit()
        self.db.refresh(user)

    def create_password_reset(self, email: str, expires_minutes: int) -> tuple[Optional[User], Optional[str]]:
        """Create a single-use password reset token for an active user."""
        user = self.get_user_by_email(email)
        if not user or not user.is_active:
            return None, None

        raw_token = generate_one_time_token()
        user.password_reset_token_hash = get_token_hash(raw_token)
        now = self._utc_now()
        user.password_reset_expires_at = now + timedelta(minutes=expires_minutes)
        user.password_reset_requested_at = now
        self.db.commit()
        self.db.refresh(user)
        return user, raw_token

    def reset_password(self, token: str, new_password: str) -> Optional[User]:
        """Reset a password using a valid, non-expired one-time token."""
        is_valid, error_msg = self.validate_password_strength(new_password)
        if not is_valid:
            raise ValueError(error_msg)

        if not token:
            return None

        token_hash = get_token_hash(token)
        user = (
            self.db.query(User)
            .filter(User.password_reset_token_hash == token_hash)
            .first()
        )

        if not user:
            return None

        if not user.password_reset_expires_at:
            user.password_reset_token_hash = None
            user.password_reset_expires_at = None
            user.password_reset_requested_at = None
            self.db.commit()
            return None

        expires_at = user.password_reset_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < self._utc_now():
            user.password_reset_token_hash = None
            user.password_reset_expires_at = None
            user.password_reset_requested_at = None
            self.db.commit()
            return None

        user.hashed_password = get_password_hash(new_password)
        user.password_reset_token_hash = None
        user.password_reset_expires_at = None
        user.password_reset_requested_at = None
        self.db.commit()
        self.db.refresh(user)
        return user

    def create_email_verification(self, email: str, expires_minutes: int) -> tuple[Optional[User], Optional[str]]:
        user = self.get_user_by_email(email)
        if not user or not user.is_active or user.is_email_verified:
            return None, None

        raw_token = generate_one_time_token()
        now = self._utc_now()
        user.email_verification_token_hash = get_token_hash(raw_token)
        user.email_verification_expires_at = now + timedelta(minutes=expires_minutes)
        user.email_verification_requested_at = now
        self.db.commit()
        self.db.refresh(user)
        return user, raw_token

    def verify_email(self, token: str) -> Optional[User]:
        if not token:
            return None
        token_hash = get_token_hash(token)
        user = (
            self.db.query(User)
            .filter(User.email_verification_token_hash == token_hash)
            .first()
        )
        if not user:
            return None

        expires_at = user.email_verification_expires_at
        if not expires_at:
            return None
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < self._utc_now():
            user.email_verification_token_hash = None
            user.email_verification_expires_at = None
            user.email_verification_requested_at = None
            self.db.commit()
            return None

        user.is_email_verified = True
        user.email_verification_token_hash = None
        user.email_verification_expires_at = None
        user.email_verification_requested_at = None
        self.db.commit()
        self.db.refresh(user)
        return user

    def create_refresh_session(
        self,
        user: User,
        expires_days: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[RefreshSession, str]:
        raw_token = generate_refresh_token()
        session = RefreshSession(
            user_id=user.id,
            token_hash=get_token_hash(raw_token),
            expires_at=self._utc_now() + timedelta(days=expires_days),
            ip_address=ip_address,
            user_agent=user_agent,
            last_used_at=self._utc_now(),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session, raw_token

    def rotate_refresh_session(
        self,
        raw_token: str,
        expires_days: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[Optional[User], Optional[str]]:
        if not raw_token:
            return None, None

        session = (
            self.db.query(RefreshSession)
            .filter(RefreshSession.token_hash == get_token_hash(raw_token))
            .first()
        )
        if not session or session.revoked_at:
            return None, None

        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < self._utc_now():
            session.revoked_at = self._utc_now()
            self.db.commit()
            return None, None

        user = self.db.query(User).filter(User.id == session.user_id).first()
        if not user or not user.is_active:
            return None, None

        next_session, next_raw_token = self.create_refresh_session(
            user,
            expires_days=expires_days,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.revoked_at = self._utc_now()
        session.replaced_by_session_id = next_session.id
        session.last_used_at = self._utc_now()
        self.db.commit()
        self.db.refresh(user)
        return user, next_raw_token

    def revoke_refresh_session(self, raw_token: str) -> None:
        if not raw_token:
            return
        session = (
            self.db.query(RefreshSession)
            .filter(RefreshSession.token_hash == get_token_hash(raw_token))
            .first()
        )
        if not session or session.revoked_at:
            return
        session.revoked_at = self._utc_now()
        session.last_used_at = self._utc_now()
        self.db.commit()

    def revoke_user_sessions(self, user_id: int) -> None:
        self.db.query(RefreshSession).filter(
            RefreshSession.user_id == user_id,
            RefreshSession.revoked_at.is_(None),
        ).update(
            {
                RefreshSession.revoked_at: self._utc_now(),
                RefreshSession.last_used_at: self._utc_now(),
            },
            synchronize_session=False,
        )
        self.db.commit()

    def record_security_event(
        self,
        event_type: str,
        *,
        user: Optional[User] = None,
        identifier: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        success: bool = True,
        detail: Optional[dict[str, Any]] = None,
    ) -> None:
        event = SecurityEvent(
            user_id=user.id if user else None,
            event_type=event_type,
            identifier=(identifier or "").strip() or None,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            detail=detail,
        )
        self.db.add(event)
        self.db.commit()

    def update_user_settings(self, user_id: int, settings: dict) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        
        for key, value in settings.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        self.db.commit()
        self.db.refresh(user)
        return user
