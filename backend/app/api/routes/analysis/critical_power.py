"""Critical power analysis endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.critical_power import CriticalPowerService

router = APIRouter()


@router.get("")
async def get_critical_power(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get critical power model parameters and curve data.
    """
    try:
        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()

        cp_model = cache_manager.get("critical_power", current_user.id, max_age_hours=24)

        if cp_model:
            return cp_model

        # Cache miss - calculate
        service = CriticalPowerService(db)
        cp_model = service.calculate_critical_power(current_user)

        # Ensure all values are JSON-serializable
        result = {
            "critical_power": float(cp_model.get("critical_power", 0)),
            "w_prime": float(cp_model.get("w_prime", 0)),
            "durations": cp_model.get("durations", []),
            "actual": cp_model.get("actual", []),
            "predicted": cp_model.get("predicted", [])
        }
        cache_manager.set("critical_power", current_user.id, result)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "critical_power": 0.0,
            "w_prime": 0.0,
            "durations": [],
            "actual": [],
            "predicted": []
        }
