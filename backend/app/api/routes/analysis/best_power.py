"""Best power values endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta

from ....database.connection import get_db
from ....database.models import User, Activity
from ....api.dependencies import get_current_active_user
from ....core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


def _duration_to_column(seconds: int) -> str:
    mapping = {
        5: "max_5sec_power",
        10: "max_5sec_power",
        15: "max_5sec_power",
        30: "max_5sec_power",
        60: "max_1min_power",
        90: "max_1min_power",
        120: "max_3min_power",
        180: "max_3min_power",
        240: "max_5min_power",
        300: "max_5min_power",
        450: "max_5min_power",
        600: "max_10min_power",
        900: "max_20min_power",
        1200: "max_20min_power",
        1800: "max_30min_power",
        3600: "max_60min_power"
    }
    return mapping.get(seconds, "max_60min_power")


@router.get("")
async def get_best_power_values(
    days: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get best power values for standard durations."""
    try:
        logger.info(f"Fetching best power values for user {current_user.username} (ID: {current_user.id})")

        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        if days and days > 0:
            cache_key = f"best_power_values_days_{days}"
        elif start_date or end_date:
            cache_key = f"best_power_values_custom_{start_date or 'none'}_{end_date or 'none'}"
        else:
            cache_key = "best_power_values_all"

        cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
        if cached:
            return cached

        # Build date filters
        filters = [Activity.user_id == current_user.id]

        if days and days > 0:
            start_dt = datetime.utcnow() - timedelta(days=days)
            filters.append(Activity.start_time >= start_dt)
            logger.debug(f"Applying days filter: last {days} days")
        else:
            if start_date:
                try:
                    start_dt = datetime.fromisoformat(start_date)
                    filters.append(Activity.start_time >= start_dt)
                    logger.debug(f"Applying start_date filter: {start_dt}")
                except ValueError as e:
                    logger.warning(f"Invalid start_date '{start_date}': {e}")
                    raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}")
            if end_date:
                try:
                    end_dt = datetime.fromisoformat(end_date)
                    filters.append(Activity.start_time <= end_dt)
                    logger.debug(f"Applying end_date filter: {end_dt}")
                except ValueError as e:
                    logger.warning(f"Invalid end_date '{end_date}': {e}")
                    raise HTTPException(status_code=400, detail=f"Invalid end_date format: {end_date}")

        # Query for maximum power values
        result = db.query(
            func.max(Activity.max_5sec_power).label('max_5sec'),
            func.max(Activity.max_1min_power).label('max_1min'),
            func.max(Activity.max_3min_power).label('max_3min'),
            func.max(Activity.max_5min_power).label('max_5min'),
            func.max(Activity.max_10min_power).label('max_10min'),
            func.max(Activity.max_20min_power).label('max_20min'),
            func.max(Activity.max_30min_power).label('max_30min'),
            func.max(Activity.max_60min_power).label('max_60min')
        ).filter(*filters).first()

        logger.debug(f"Query returned max power values for user {current_user.id}")

        # Build response with user weight
        weight = current_user.weight or 70.0

        response = {
            "max_5sec_power": float(result.max_5sec) if result and result.max_5sec else None,
            "max_1min_power": float(result.max_1min) if result and result.max_1min else None,
            "max_3min_power": float(result.max_3min) if result and result.max_3min else None,
            "max_5min_power": float(result.max_5min) if result and result.max_5min else None,
            "max_10min_power": float(result.max_10min) if result and result.max_10min else None,
            "max_20min_power": float(result.max_20min) if result and result.max_20min else None,
            "max_30min_power": float(result.max_30min) if result and result.max_30min else None,
            "max_60min_power": float(result.max_60min) if result and result.max_60min else None,
            "weight": float(weight)
        }

        cache_manager.set(cache_key, current_user.id, response)
        logger.info(f"Successfully returned best power values for user {current_user.id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching best power values for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching best power values")


@router.get("/record")
async def get_best_power_record(
    duration: int = Query(..., ge=1, description="Duration in seconds (ex: 300 for 5min)"),
    days: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the activity that produced the best power for a given duration."""
    try:
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()

        range_key = "all"
        if days and days > 0:
            range_key = f"days_{days}"
        elif start_date or end_date:
            range_key = f"custom_{start_date or 'none'}_{end_date or 'none'}"

        cache_key = f"best_power_record_{duration}_{range_key}"
        cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
        if cached:
            return cached

        column_name = _duration_to_column(duration)
        if not hasattr(Activity, column_name):
            raise HTTPException(status_code=400, detail=f"Unsupported duration: {duration}")

        filters = [Activity.user_id == current_user.id]
        filters.append(getattr(Activity, column_name).isnot(None))

        if days and days > 0:
            start_dt = datetime.utcnow() - timedelta(days=days)
            filters.append(Activity.start_time >= start_dt)
        else:
            if start_date:
                try:
                    start_dt = datetime.fromisoformat(start_date)
                    filters.append(Activity.start_time >= start_dt)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}") from e
            if end_date:
                try:
                    end_dt = datetime.fromisoformat(end_date)
                    filters.append(Activity.start_time <= end_dt)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=f"Invalid end_date format: {end_date}") from e

        value_col = getattr(Activity, column_name)
        activity = (
            db.query(Activity)
            .filter(*filters)
            .order_by(desc(value_col), desc(Activity.start_time))
            .first()
        )

        if not activity:
            return {"activity_id": None, "duration_seconds": duration, "power_value": None}

        response = {
            "activity_id": activity.id,
            "duration_seconds": duration,
            "power_value": float(getattr(activity, column_name) or 0),
            "column": column_name,
            "custom_name": activity.custom_name or activity.file_name,
            "start_time": activity.start_time.isoformat() if activity.start_time else None,
            "duration": activity.duration,
            "distance": activity.distance,
            "avg_power": activity.avg_power,
            "normalized_power": activity.normalized_power,
            "avg_heart_rate": activity.avg_heart_rate,
            "max_heart_rate": activity.max_heart_rate,
            "tss": activity.tss,
            "intensity_factor": activity.intensity_factor,
            "efficiency_factor": activity.efficiency_factor
        }

        cache_manager.set(cache_key, current_user.id, response)
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching best power record for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching best power record")
