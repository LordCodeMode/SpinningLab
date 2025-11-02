from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...database.connection import get_db
from ...database.models import User
from ...api.dependencies import get_current_active_user

router = APIRouter()

@router.get("/")
async def get_user_settings(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user settings."""
    return {
        "ftp": current_user.ftp or 250,
        "weight": current_user.weight or 70,
        "hr_max": current_user.hr_max or 190,
        "hr_rest": current_user.hr_rest or 60
    }

@router.put("/")
async def update_user_settings(
    settings: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user settings."""
    # Update user settings directly
    for key, value in settings.items():
        if hasattr(current_user, key) and value is not None:
            setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)

    return {
        "ftp": current_user.ftp or 250,
        "weight": current_user.weight or 70,
        "hr_max": current_user.hr_max or 190,
        "hr_rest": current_user.hr_rest or 60
    }