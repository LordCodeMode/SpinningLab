"""Fitness state and efficiency analysis endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.fitness_state_service import FitnessStateService
from ....services.analysis.efficiency_service import EfficiencyService

router = APIRouter()


@router.get("/fitness-state")
async def get_fitness_state(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive fitness state analysis including CTL/ATL/TSB and recommendations.
    """
    try:
        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()

        fitness_state = cache_manager.get("fitness_state", current_user.id, max_age_hours=24)

        if fitness_state:
            print(f"[Cache HIT] Fitness state from cache")
            return fitness_state

        # Cache miss - calculate
        print(f"[Cache MISS] Calculating fitness state")
        service = FitnessStateService(db)
        fitness_state_data = service.analyze_fitness_state(current_user)

        return {
            "status": fitness_state_data.status if fitness_state_data else "unknown",
            "status_description": fitness_state_data.status_description if fitness_state_data else "Unable to determine",
            "ctl": float(fitness_state_data.ctl) if fitness_state_data and fitness_state_data.ctl else 0.0,
            "atl": float(fitness_state_data.atl) if fitness_state_data and fitness_state_data.atl else 0.0,
            "tsb": float(fitness_state_data.tsb) if fitness_state_data and fitness_state_data.tsb else 0.0,
            "ef_trend": float(fitness_state_data.ef_trend) if fitness_state_data and fitness_state_data.ef_trend else 0.0,
            "recommendations": fitness_state_data.recommendations if fitness_state_data else ["Ensure you have sufficient training data"]
        }
    except Exception as e:
        print(f"Error getting fitness state: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "unknown",
            "status_description": "Unable to determine fitness state",
            "ctl": 0.0,
            "atl": 0.0,
            "tsb": 0.0,
            "ef_trend": 0.0,
            "recommendations": ["Ensure you have sufficient training data"]
        }


@router.get("/efficiency")
async def get_efficiency_analysis(
    days: int = Query(120, ge=30, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get efficiency factor (EF = NP / HR) analysis over time.
    """
    try:
        # Try to get from cache first
        from ....services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = f"efficiency_{days}d"

        cached_data = cache_manager.get(cache_key, current_user.id, max_age_hours=24)

        if cached_data:
            print(f"[Cache HIT] Efficiency for {days} days from cache")
            return cached_data

        # Cache miss - calculate
        print(f"[Cache MISS] Calculating efficiency for {days} days")
        service = EfficiencyService(db)
        efficiency_data = service.get_efficiency_factors(current_user, days)
        efficiency_trend = service.get_efficiency_trend(current_user, days)

        # Format data for frontend
        formatted_data = []
        for item in efficiency_data:
            formatted_data.append({
                "start_time": item.start_time.isoformat() if hasattr(item.start_time, 'isoformat') else str(item.start_time),
                "normalized_power": float(item.normalized_power) if item.normalized_power else None,
                "avg_heart_rate": float(item.avg_heart_rate) if item.avg_heart_rate else None,
                "intensity_factor": float(item.intensity_factor) if item.intensity_factor else None,
                "ef": float(item.ef) if item.ef else None
            })

        return {
            "efficiency_data": formatted_data,
            "trend": efficiency_trend if efficiency_trend else {"trend": "no_data"}
        }
    except Exception as e:
        print(f"Error getting efficiency analysis: {e}")
        import traceback
        traceback.print_exc()
        return {
            "efficiency_data": [],
            "trend": {"trend": "no_data"}
        }
