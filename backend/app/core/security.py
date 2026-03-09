from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import hashlib
import secrets
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_jwt_token(
    data: dict,
    token_type: str,
    expires_delta: Union[timedelta, None] = None,
) -> str:
    to_encode = data.copy()
    now = _utc_now()
    expire = now + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "iat": now, "type": token_type})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(
    data: dict, expires_delta: Union[timedelta, None] = None
) -> str:
    return create_jwt_token(
        data=data,
        token_type="access",
        expires_delta=expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def verify_token(token: str) -> Optional[str]:
    payload = decode_token(token)
    if not payload:
        return None
    token_type = payload.get("type")
    if token_type not in {None, "access"}:
        return None
    username: str = payload.get("sub")
    if username is None:
        return None
    return username

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def generate_one_time_token() -> str:
    """Generate a URL-safe token for one-time flows like password resets."""
    return secrets.token_urlsafe(32)


def generate_refresh_token() -> str:
    """Generate a strong opaque token for refresh session cookies."""
    return secrets.token_urlsafe(48)


def get_token_hash(token: str) -> str:
    """Hash one-time tokens so they are not stored in plaintext."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
