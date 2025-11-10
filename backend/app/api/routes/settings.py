from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database.connection import get_db
from ...database.models import User
from ...api.dependencies import get_current_active_user

router = APIRouter()

ALLOWED_SETTING_FIELDS = {"ftp", "weight", "hr_max", "hr_rest", "lthr", "name"}
MAX_NAME_LENGTH = 100


def serialize_user_settings(user: User) -> dict:
    return {
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "ftp": user.ftp or 250,
        "weight": user.weight or 70,
        "hr_max": user.hr_max or 190,
        "hr_rest": user.hr_rest or 60,
        "lthr": getattr(user, "lthr", None)
    }


def sanitize_name(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail="Name must be a string")
    sanitized = value.strip()
    if not sanitized:
        return None
    if len(sanitized) > MAX_NAME_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Name must be fewer than {MAX_NAME_LENGTH} characters"
        )
    return sanitized


@router.get("/")
async def get_user_settings(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user settings."""
    return serialize_user_settings(current_user)

@router.put("/")
async def update_user_settings(
    settings: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user settings."""
    for key, value in settings.items():
        if key not in ALLOWED_SETTING_FIELDS:
            continue

        if key == "name":
            setattr(current_user, "name", sanitize_name(value))
            continue

        if hasattr(current_user, key) and value is not None:
            setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)

    return serialize_user_settings(current_user)
