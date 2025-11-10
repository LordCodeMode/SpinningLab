from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database.models import User
from ..core.security import verify_password, get_password_hash
from typing import Optional
import re

class AuthService:
    def __init__(self, db: Session):
        self.db = db

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
        return self.db.query(User).filter(User.username == username).first()

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

    def create_user(self, username: str, password: str, email: str = None, name: str = None) -> User:
        # Validate password strength
        is_valid, error_msg = self.validate_password_strength(password)
        if not is_valid:
            raise ValueError(error_msg)
        hashed_password = get_password_hash(password)
        db_user = User(
            username=username,
            email=email,
            name=name,
            hashed_password=hashed_password,
            is_active=True,
            ftp=250.0,
            weight=70.0,
            hr_max=190,
            hr_rest=60
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

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
