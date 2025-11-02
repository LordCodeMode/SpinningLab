"""Power curve analysis endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.power_curve import PowerCurveService

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
        cache_key = "power_curve_weighted" if weighted else "power_curve_absolute"
        if start and end:
            cache_key += f"_{start}_{end}"

        curve = cache_manager.get(cache_key, current_user.id, max_age_hours=24)

        if curve:
            print(f"[Cache HIT] Power curve ({'weighted' if weighted else 'absolute'}, {start or 'all'}-{end or 'all'}) from cache")
            return _prepare_power_curve_response(curve, weighted)

        # Cache miss - calculate
        print(f"[Cache MISS] Calculating power curve ({'weighted' if weighted else 'absolute'}, {start or 'all'}-{end or 'all'})")
        service = PowerCurveService(db)
        curve_data = service.get_user_power_curve(current_user, weighted=weighted, start_date=start, end_date=end)

        if not curve_data or len(curve_data) == 0:
            return {"durations": [], "powers": [], "weighted": weighted}

        # curve_data is a dict with durations and powers
        return _prepare_power_curve_response(curve_data, weighted)
    except Exception as e:
        print(f"Error getting power curve: {e}")
        import traceback
        traceback.print_exc()
        return {"durations": [], "powers": [], "weighted": weighted}
