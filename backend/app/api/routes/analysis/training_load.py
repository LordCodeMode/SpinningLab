"""Training load (CTL/ATL/TSB) analysis endpoints."""

from datetime import timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ....database.connection import get_db
from ....database.models import User, Activity
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

        cached_data, cached_at = cache_manager.get_with_meta(cache_key, current_user.id)

        cache_is_stale = False
        if cached_data and cached_at is not None:
            latest_activity_time = db.query(func.max(Activity.start_time)).filter(
                Activity.user_id == current_user.id,
                Activity.tss.isnot(None),
                Activity.tss > 0
            ).scalar()

            if latest_activity_time is not None:
                if latest_activity_time.tzinfo is None:
                    latest_activity_ts = latest_activity_time.replace(tzinfo=timezone.utc).timestamp()
                else:
                    latest_activity_ts = latest_activity_time.astimezone(timezone.utc).timestamp()

                cache_is_stale = latest_activity_ts > cached_at

        if cached_data and not cache_is_stale:
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

        if cache_is_stale:
            cache_manager.delete(cache_key, current_user.id)

        # Cache miss - calculate and return
        service = TrainingLoadService(db)
        training_load = service.calculate_training_load(current_user, days=days)
        cache_manager.set(cache_key, current_user.id, training_load)

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
        import traceback
        traceback.print_exc()
        return []
