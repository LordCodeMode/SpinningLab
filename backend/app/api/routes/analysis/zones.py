"""Zone distribution and balance analysis endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy import func

from ....database.connection import get_db
from ....database.models import User, Activity, PowerZone, HrZone
from ....api.dependencies import get_current_active_user
from ....services.analysis.zone_balance_service import ZoneBalanceService
from shared.constants.training_zones import POWER_ZONES, HEART_RATE_ZONES

router = APIRouter()


def _serialize_cached(value):
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value


@router.get("/power")
async def get_power_zone_distribution(
    days: Optional[int] = Query(None, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get power zone distribution (time spent in each zone).
    """
    try:
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = "power_zones_alld" if not days else f"power_zones_{days}d"
        cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
        if cached:
            return _serialize_cached(cached)

        # Query power zones
        query = db.query(
            PowerZone.zone_label,
            func.sum(PowerZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(Activity.user_id == current_user.id)

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Activity.start_time >= start_date)

        results = query.group_by(PowerZone.zone_label).all()

        # Calculate total time
        total_time = sum(result.total_seconds for result in results) or 1

        # Use canonical power zone definitions
        all_zones = list(POWER_ZONES.keys())
        ftp = current_user.ftp or 250
        zone_ranges = POWER_ZONES

        # Build zone data
        zone_data = []
        for zone_label in all_zones:
            seconds = next(
                (result.total_seconds for result in results if result.zone_label == zone_label),
                0
            )

            low_factor, high_factor = zone_ranges.get(zone_label, (0, 0))
            watt_range = f"{int(low_factor * ftp)}-{int(high_factor * ftp)} W"

            zone_data.append({
                "zone_label": zone_label,
                "seconds_in_zone": int(seconds),
                "percentage": round((seconds / total_time * 100), 1),
                "watt_range": watt_range
            })

        response = {
            "zone_data": zone_data,
            "total_time": int(total_time),
            "period_days": days
        }
        cache_manager.set(cache_key, current_user.id, response)
        return response
    except Exception as e:
        return {
            "zone_data": [],
            "total_time": 0,
            "period_days": days
        }


@router.get("/hr")
async def get_hr_zone_distribution(
    days: Optional[int] = Query(None, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get heart rate zone distribution.
    """
    try:
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = "hr_zones_alld" if not days else f"hr_zones_{days}d"
        cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
        if cached:
            return _serialize_cached(cached)

        query = db.query(
            HrZone.zone_label,
            func.sum(HrZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(Activity.user_id == current_user.id)

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Activity.start_time >= start_date)

        results = query.group_by(HrZone.zone_label).all()
        total_time = sum(result.total_seconds for result in results) or 1

        # Use canonical HR zone definitions
        all_zones = list(HEART_RATE_ZONES.keys())
        hr_max = current_user.hr_max or 190
        zone_ranges = HEART_RATE_ZONES

        zone_data = []
        for zone_label in all_zones:
            seconds = next(
                (result.total_seconds for result in results if result.zone_label == zone_label),
                0
            )

            low_factor, high_factor = zone_ranges.get(zone_label, (0, 0))
            bpm_range = f"{int(low_factor * hr_max)}-{int(high_factor * hr_max)} bpm"

            zone_data.append({
                "zone_label": zone_label,
                "seconds_in_zone": int(seconds),
                "percentage": round((seconds / total_time * 100), 1),
                "bpm_range": bpm_range
            })

        response = {
            "zone_data": zone_data,
            "total_time": int(total_time),
            "period_days": days
        }
        cache_manager.set(cache_key, current_user.id, response)
        return response
    except Exception as e:
        return {
            "zone_data": [],
            "total_time": 0,
            "period_days": days
        }


@router.get("/balance")
async def get_zone_balance(
    model: str = Query("polarized", description="Training model: polarized, sweet_spot, high_intensity"),
    weeks: int = Query(4, ge=1, le=12, description="Number of weeks to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get zone balance analysis comparing actual vs target distribution.
    """
    try:
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = f"zone_balance_{model}_{weeks}w"
        cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
        if cached:
            return cached

        service = ZoneBalanceService(db)
        zone_balance = service.analyze_zone_balance(current_user, model, weeks)
        recommendations = service.get_recommendations(zone_balance, model)

        response = {
            "model": model,
            "weeks": weeks,
            "zone_balance": [
                {
                    "zone_label": zb.zone_label,
                    "actual_percentage": float(zb.actual_percentage),
                    "target_percentage": float(zb.target_percentage),
                    "deviation": float(zb.deviation),
                    "watt_range": zb.watt_range,
                    "status": zb.status
                }
                for zb in zone_balance
            ],
            "recommendations": recommendations
        }
        cache_manager.set(cache_key, current_user.id, response)
        return response
    except Exception as e:
        return {
            "model": model,
            "weeks": weeks,
            "zone_balance": [],
            "recommendations": []
        }
