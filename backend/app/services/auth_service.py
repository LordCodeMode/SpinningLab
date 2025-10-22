from sqlalchemy.orm import Session
from ..database.models import User
from ..core.security import verify_password, get_password_hash
from typing import Optional

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        user = self.get_user_by_username(username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def create_user(self, username: str, password: str, email: str = None) -> User:
        hashed_password = get_password_hash(password)
        db_user = User(
            username=username,
            email=email,
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