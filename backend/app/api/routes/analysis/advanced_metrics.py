"""Advanced performance metrics endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.fatigue_resistance import FatigueResistanceService
from ....services.analysis.w_prime_balance import WPrimeBalanceService
from ....services.analysis.decoupling import DecouplingService
from ....services.analysis.advanced_metrics import AdvancedMetricsService

router = APIRouter()


@router.get("/fatigue-resistance")
def fatigue_resistance(
    activity_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from ....services.cache.cache_manager import CacheManager
    cache_manager = CacheManager()
    cache_key = f"fatigue_resistance_{activity_id}"
    cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
    if cached:
        return cached

    service = FatigueResistanceService(db)
    result = service.analyze_activity(activity_id)
    if not result:
        raise HTTPException(status_code=404, detail="Insufficient data for fatigue resistance")
    cache_manager.set(cache_key, current_user.id, result)
    return result


@router.get("/w-prime-balance")
def w_prime_balance(
    activity_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from ....services.cache.cache_manager import CacheManager
    cache_manager = CacheManager()
    cache_key = f"w_prime_balance_{activity_id}"
    cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
    if cached:
        return cached

    service = WPrimeBalanceService(db)
    result = service.analyze_activity(current_user, activity_id)
    if not result:
        raise HTTPException(status_code=404, detail="Insufficient data for W' balance")
    cache_manager.set(cache_key, current_user.id, result)
    return result


@router.get("/variability-index")
def variability_index(
    activity_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from ....services.cache.cache_manager import CacheManager
    cache_manager = CacheManager()
    cache_key = f"variability_index_{activity_id}"
    cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
    if cached:
        return cached

    service = AdvancedMetricsService(db)
    result = service.variability_index(activity_id)
    if not result:
        raise HTTPException(status_code=404, detail="Insufficient data for variability index")
    cache_manager.set(cache_key, current_user.id, result)
    return result


@router.get("/decoupling")
def decoupling(
    activity_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from ....services.cache.cache_manager import CacheManager
    cache_manager = CacheManager()
    cache_key = f"decoupling_{activity_id}"
    cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
    if cached:
        return cached

    service = DecouplingService(db)
    result = service.analyze_activity(activity_id)
    if not result:
        raise HTTPException(status_code=404, detail="Insufficient data for decoupling")
    cache_manager.set(cache_key, current_user.id, result)
    return result


@router.get("/polarized-distribution")
def polarized_distribution(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from ....services.cache.cache_manager import CacheManager
    cache_manager = CacheManager()
    cache_key = f"polarized_distribution_{days}d"
    cached = cache_manager.get(cache_key, current_user.id, max_age_hours=24)
    if cached:
        return cached

    service = AdvancedMetricsService(db)
    result = service.polarized_distribution(current_user, days=days)
    cache_manager.set(cache_key, current_user.id, result)
    return result
