"""VO2max estimation endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.vo2max_service import VO2MaxService

router = APIRouter()


@router.get("")
async def get_vo2max(
    days: int = Query(90, ge=30, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get VO2max estimates over time.
    """
    try:
        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = f"vo2max_{days}d"

        vo2max_data = cache_manager.get(cache_key, current_user.id, max_age_hours=24)

        if vo2max_data:
            print(f"[Cache HIT] VO2max for {days} days from cache")
            return vo2max_data

        # Cache miss - calculate
        print(f"[Cache MISS] Calculating VO2max for {days} days")
        service = VO2MaxService(db)
        result = service.estimate_vo2max(current_user, days=days)
        return result if result else []
    except Exception as e:
        print(f"Error getting VO2max: {e}")
        import traceback
        traceback.print_exc()
        return []
