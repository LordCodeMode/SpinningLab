from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database.connection import get_db
from ...database.models import User
from ...api.dependencies import get_current_active_user

router = APIRouter()

ALLOWED_SETTING_FIELDS = {"ftp", "weight", "hr_max", "hr_rest", "lthr", "name"}
MAX_NAME_LENGTH = 100
NUMERIC_POSITIVE_FIELDS = {"ftp", "weight", "hr_max", "hr_rest", "lthr"}


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


def validate_positive_numeric(field: str, value):
    if value is None:
        return value
    if not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail=f"{field} must be a number")
    if value <= 0:
        raise HTTPException(status_code=400, detail=f"{field} must be greater than 0")
    return value


@router.get("/")
async def get_user_settings(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user settings."""
    return serialize_user_settings(current_user)

@router.put("/")
async def update_user_settings(
    settings: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user settings."""
    needs_rebuild = False
    for key, value in settings.items():
        if key not in ALLOWED_SETTING_FIELDS:
            continue

        if key == "name":
            setattr(current_user, "name", sanitize_name(value))
            continue

        if key in NUMERIC_POSITIVE_FIELDS:
            value = validate_positive_numeric(key, value)

        if hasattr(current_user, key) and value is not None:
            current_value = getattr(current_user, key)
            if key in {"ftp", "weight", "hr_max", "hr_rest", "lthr"} and current_value != value:
                needs_rebuild = True
            setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)

    if needs_rebuild:
        try:
            from ...services.cache.cache_tasks import rebuild_user_caches_task
            if background_tasks is not None:
                background_tasks.add_task(rebuild_user_caches_task, current_user.id)
        except Exception:
            pass

    return serialize_user_settings(current_user)
