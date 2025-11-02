"""Training load (CTL/ATL/TSB) analysis endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.training_load import TrainingLoadService

router = APIRouter()


@router.get("")
async def get_training_load(
    days: int = Query(90, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get training load (CTL/ATL/TSB) for the specified period.
    Returns a list of daily values.
    """
    try:
        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = f"training_load_{days}d"

        cached_data = cache_manager.get(cache_key, current_user.id, max_age_hours=24)

        if cached_data:
            print(f"[Cache HIT] Training load for {days} days from cache")
            # Cache contains TrainingLoadResponse objects, convert to dicts
            return [
                {
                    "date": item.date.isoformat() if hasattr(item.date, 'isoformat') else str(item.date),
                    "ctl": float(item.ctl) if item.ctl is not None else 0.0,
                    "atl": float(item.atl) if item.atl is not None else 0.0,
                    "tsb": float(item.tsb) if item.tsb is not None else 0.0,
                    "tss": float(getattr(item, "tss", 0.0) or 0.0)
                }
                for item in cached_data
            ]

        # Cache miss - calculate and return (don't cache here, cache builder handles it)
        print(f"[Cache MISS] Calculating training load for {days} days")
        service = TrainingLoadService(db)
        training_load = service.calculate_training_load(current_user, days=days)

        return [
            {
                "date": item.date.isoformat(),
                "ctl": float(item.ctl) if item.ctl is not None else 0.0,
                "atl": float(item.atl) if item.atl is not None else 0.0,
                "tsb": float(item.tsb) if item.tsb is not None else 0.0,
                "tss": float(getattr(item, "tss", 0.0) or 0.0)
            }
            for item in training_load
        ]
    except Exception as e:
        print(f"Error getting training load: {e}")
        import traceback
        traceback.print_exc()
        return []
