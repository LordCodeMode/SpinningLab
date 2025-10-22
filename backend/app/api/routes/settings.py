from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database.connection import get_db
from ...database.models import User
from ...api.dependencies import get_current_active_user
from ...services.auth_service import AuthService
from shared.models.schemas import UserSettings, UserResponse

router = APIRouter()

@router.get("/", response_model=UserResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user settings."""
    return UserResponse.from_attributes(current_user)

@router.put("/", response_model=UserResponse)
async def update_user_settings(
    settings: UserSettings,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user settings."""
    auth_service = AuthService(db)
    
    # Filter out None values
    settings_dict = {k: v for k, v in settings.dict().items() if v is not None}
    
    if not settings_dict:
        raise HTTPException(status_code=400, detail="No settings provided")
    
    updated_user = auth_service.update_user_settings(current_user.id, settings_dict)
    return UserResponse.from_attributes(updated_user)