"""Rider profile analysis endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.rider_profile_service import RiderProfileService

router = APIRouter()


@router.get("")
async def get_rider_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get rider profile analysis (sprinter, climber, etc.).
    """
    try:
        service = RiderProfileService(db)
        result = service.analyze_rider_profile(current_user)

        if not result:
            return {
                "rider_type": "Unknown",
                "confidence": 0.0,
                "power_profile": {},
                "recommendations": []
            }

        return result
    except Exception as e:
        return {
            "rider_type": "Unknown",
            "confidence": 0.0,
            "power_profile": {},
            "recommendations": []
        }
