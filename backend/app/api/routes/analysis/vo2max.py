"""VO2max estimation endpoints."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.vo2max_service import VO2MaxService
from ....core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


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
        logger.info(f"Fetching VO2max estimates for user {current_user.id} ({days} days)")

        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = f"vo2max_{days}d"

        vo2max_data = cache_manager.get(cache_key, current_user.id, max_age_hours=24)

        if vo2max_data:
            logger.debug(f"Cache hit: VO2max data for {days} days retrieved from cache")
            return vo2max_data

        # Cache miss - calculate
        logger.debug(f"Cache miss: Calculating VO2max for {days} days")
        service = VO2MaxService(db)
        result = service.estimate_vo2max(current_user, days=days)

        if result:
            cache_manager.set(cache_key, current_user.id, result)

        logger.info(f"Successfully calculated VO2max for user {current_user.id}")
        return result if result else []

    except Exception as e:
        logger.error(f"Error getting VO2max for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error calculating VO2max estimates")
