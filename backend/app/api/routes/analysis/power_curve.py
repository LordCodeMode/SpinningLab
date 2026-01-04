"""Power curve analysis endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.power_curve import PowerCurveService
from ....core.config import settings

router = APIRouter()


def _prepare_power_curve_response(raw_curve, weighted: bool):
    """Normalize power curve response shape for API consumers."""
    if not raw_curve:
        return {"durations": [], "powers": [], "weighted": weighted}

    # Accept cached dicts or raw lists from service
    if isinstance(raw_curve, dict):
        durations = raw_curve.get("durations")
        powers = raw_curve.get("powers")
        response_weighted = raw_curve.get("weighted", weighted)
    elif isinstance(raw_curve, list):
        durations = list(range(1, len(raw_curve) + 1))
        powers = raw_curve
        response_weighted = weighted
    else:
        return {"durations": [], "powers": [], "weighted": weighted}

    if not isinstance(durations, list) or not isinstance(powers, list):
        return {"durations": [], "powers": [], "weighted": weighted}

    # Pair up durations/powers, coerce types, and drop invalid entries
    pairs = []
    for duration, power in zip(durations, powers):
        if duration is None or power is None:
            continue
        try:
            duration_val = int(round(float(duration)))
            power_val = float(power)
        except (TypeError, ValueError):
            continue
        if duration_val <= 0:
            continue
        pairs.append((duration_val, power_val))

    if not pairs:
        return {"durations": [], "powers": [], "weighted": response_weighted}

    pairs.sort(key=lambda item: item[0])
    normalized_durations = [item[0] for item in pairs]
    normalized_powers = [item[1] for item in pairs]

    return {
        "durations": normalized_durations,
        "powers": normalized_powers,
        "weighted": response_weighted
    }


@router.get("")
async def get_power_curve(
    background_tasks: BackgroundTasks,
    weighted: bool = Query(False, description="Return watts per kg instead of absolute watts"),
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD) for filtering activities"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD) for filtering activities"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's power duration curve (best power for each duration within date range).
    """
    try:
        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()

        # Build cache key including date range
        cache_prefix = "power_curve_weighted" if weighted else "power_curve_absolute"
        cache_key = cache_prefix
        if start and end:
            cache_key += f"_{start}_{end}"

        curve = None
        cached_at = None
        cache_candidates = []

        if start and end:
            try:
                start_dt = datetime.strptime(start, "%Y-%m-%d")
                end_dt = datetime.strptime(end, "%Y-%m-%d")
                range_days = (end_dt.date() - start_dt.date()).days + 1
                today = datetime.now().date()
                if end_dt.date() == today and range_days in (30, 90, 180, 365):
                    expected_start = today - timedelta(days=range_days - 1)
                    if start_dt.date() == expected_start:
                        cache_candidates.append(f"{cache_prefix}_range_{range_days}")
                if end_dt.date() == today and start_dt.month == 1 and start_dt.day == 1 and start_dt.year == end_dt.year:
                    cache_candidates.append(f"{cache_prefix}_ytd")
            except Exception:
                cache_candidates = []

        cache_candidates.append(cache_key)

        for candidate in cache_candidates:
            curve, cached_at = cache_manager.get_with_meta(candidate, current_user.id)
            if curve:
                break

        if curve:
            if cached_at:
                cache_age = datetime.now().timestamp() - cached_at
                cache_age_hours = cache_age / 3600
                if cache_age_hours > settings.POWER_CURVE_CACHE_MAX_AGE_HOURS:
                    try:
                        from ....services.cache.cache_tasks import rebuild_power_curve_cache_task
                        background_tasks.add_task(rebuild_power_curve_cache_task, current_user.id)
                    except Exception:
                        pass
            return _prepare_power_curve_response(curve, weighted)

        # Cache miss - calculate
        service = PowerCurveService(db)
        curve_data = service.get_user_power_curve(current_user, weighted=weighted, start_date=start, end_date=end)

        prepared = _prepare_power_curve_response(curve_data, weighted)
        cache_manager.set(cache_key, current_user.id, prepared)
        return prepared
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"durations": [], "powers": [], "weighted": weighted}
