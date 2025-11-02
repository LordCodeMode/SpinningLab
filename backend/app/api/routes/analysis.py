# ============================================
# FILE 3: api/routes/analysis.py
# ============================================

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import func, desc

from ...database.connection import get_db
from ...database.models import User, Activity, PowerZone, HrZone
from ...api.dependencies import get_current_active_user
from ...services.analysis.power_curve import PowerCurveService
from ...services.analysis.training_load import TrainingLoadService
from ...services.analysis.vo2max_service import VO2MaxService
from ...services.analysis.critical_power import CriticalPowerService 
from ...services.analysis.rider_profile_service import RiderProfileService
from ...services.analysis.efficiency_service import EfficiencyService
from ...services.analysis.fitness_state_service import FitnessStateService
from ...services.analysis.zone_balance_service import ZoneBalanceService


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

router = APIRouter()

# ============================================
# TRAINING LOAD
# ============================================
@router.get("/training-load")
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
        from ...services.cache.cache_manager import CacheManager
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

# ============================================
# POWER CURVE
# ============================================
@router.get("/power-curve")
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
        from ...services.cache.cache_manager import CacheManager
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

# ============================================
# CRITICAL POWER
# ============================================
@router.get("/critical-power")
async def get_critical_power(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get critical power model parameters and curve data.
    """
    try:
        # Try to get from cache first
        from ...services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()

        cp_model = cache_manager.get("critical_power", current_user.id, max_age_hours=24)

        if cp_model:
            print(f"[Cache HIT] Critical power from cache")
            return cp_model

        # Cache miss - calculate
        print(f"[Cache MISS] Calculating critical power")
        service = CriticalPowerService(db)
        cp_model = service.calculate_critical_power(current_user)

        # Ensure all values are JSON-serializable
        return {
            "critical_power": float(cp_model.get("critical_power", 0)),
            "w_prime": float(cp_model.get("w_prime", 0)),
            "durations": cp_model.get("durations", []),
            "actual": cp_model.get("actual", []),
            "predicted": cp_model.get("predicted", [])
        }
    except Exception as e:
        print(f"Error getting critical power: {e}")
        import traceback
        traceback.print_exc()
        return {
            "critical_power": 0.0,
            "w_prime": 0.0,
            "durations": [],
            "actual": [],
            "predicted": []
        }

# ============================================
# EFFICIENCY
# ============================================
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
        from ...services.cache.cache_manager import CacheManager
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

# ============================================
# FITNESS STATE
# ============================================
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
        from ...services.cache.cache_manager import CacheManager
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

# ============================================
# ZONE BALANCE
# ============================================
@router.get("/zone-balance")
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
        service = ZoneBalanceService(db)
        zone_balance = service.analyze_zone_balance(current_user, model, weeks)
        recommendations = service.get_recommendations(zone_balance, model)
        
        return {
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
    except Exception as e:
        print(f"Error getting zone balance: {e}")
        return {
            "model": model,
            "weeks": weeks,
            "zone_balance": [],
            "recommendations": []
        }

# ============================================
# POWER ZONES
# ============================================
@router.get("/zones/power")
async def get_power_zone_distribution(
    days: Optional[int] = Query(None, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get power zone distribution (time spent in each zone).
    """
    try:
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
        
        # Define all zones
        all_zones = [
            "Z1 (Recovery)",
            "Z2 (Endurance)",
            "Z3 (Tempo)",
            "Z4 (Threshold)",
            "Z5 (VO2max)",
            "Z6 (Anaerobic)",
            "Z7 (Sprint)"
        ]
        
        # Get FTP for watt ranges
        ftp = current_user.ftp or 250
        zone_ranges = {
            "Z1 (Recovery)": (0.0, 0.55),
            "Z2 (Endurance)": (0.55, 0.75),
            "Z3 (Tempo)": (0.75, 0.90),
            "Z4 (Threshold)": (0.90, 1.05),
            "Z5 (VO2max)": (1.05, 1.20),
            "Z6 (Anaerobic)": (1.20, 1.50),
            "Z7 (Sprint)": (1.50, 10.0)
        }
        
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

        return {
            "zone_data": zone_data,
            "total_time": int(total_time),
            "period_days": days
        }
    except Exception as e:
        print(f"Error getting power zones: {e}")
        return {
            "zone_data": [],
            "total_time": 0,
            "period_days": days
        }

# ============================================
# HR ZONES
# ============================================
@router.get("/zones/hr")
async def get_hr_zone_distribution(
    days: Optional[int] = Query(None, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get heart rate zone distribution.
    """
    try:
        query = db.query(
            HrZone.zone_label,
            func.sum(HrZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(Activity.user_id == current_user.id)

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Activity.start_time >= start_date)

        results = query.group_by(HrZone.zone_label).all()
        total_time = sum(result.total_seconds for result in results) or 1

        all_zones = [
            "Z1 (Recovery)",
            "Z2 (Endurance)",
            "Z3 (GA2)",
            "Z4 (Threshold)",
            "Z5 (VO2max)"
        ]
        
        hr_max = current_user.hr_max or 190
        zone_ranges = {
            "Z1 (Recovery)": (0.50, 0.60),
            "Z2 (Endurance)": (0.60, 0.70),
            "Z3 (GA2)": (0.70, 0.80),
            "Z4 (Threshold)": (0.80, 0.90),
            "Z5 (VO2max)": (0.90, 1.00)
        }
        
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

        return {
            "zone_data": zone_data,
            "total_time": int(total_time),
            "period_days": days
        }
    except Exception as e:
        print(f"Error getting HR zones: {e}")
        return {
            "zone_data": [],
            "total_time": 0,
            "period_days": days
        }

# ============================================
# BEST POWER VALUES
# ============================================
@router.get("/best-power-values")
async def get_best_power_values(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get best power values for standard durations."""
    try:
        print("\n" + "="*80)
        print("[BEST POWER DEBUG] Starting endpoint")
        print("="*80)
        
        # 1. Check database connection
        db_url = str(db.get_bind().url)
        print(f"[DEBUG] Database URL: {db_url}")
        
        # 2. Check current user
        print(f"[DEBUG] Current user: {current_user.username} (ID: {current_user.id})")
        print(f"[DEBUG] User weight: {current_user.weight}")
        
        # 3. Count total activities
        total_activities = db.query(Activity).filter(Activity.user_id == current_user.id).count()
        print(f"[DEBUG] Total activities for user: {total_activities}")
        
        # 4. Check if activities have power data
        with_avg_power = db.query(Activity).filter(
            Activity.user_id == current_user.id,
            Activity.avg_power.isnot(None)
        ).count()
        print(f"[DEBUG] Activities with avg_power: {with_avg_power}")
        
        with_1min = db.query(Activity).filter(
            Activity.user_id == current_user.id,
            Activity.max_1min_power.isnot(None)
        ).count()
        print(f"[DEBUG] Activities with max_1min_power: {with_1min}")
        
        # 5. Sample one activity to check its values
        sample = db.query(Activity).filter(
            Activity.user_id == current_user.id
        ).first()
        
        if sample:
            print(f"\n[DEBUG] Sample activity:")
            print(f"  - ID: {sample.id}")
            print(f"  - File: {sample.file_name}")
            print(f"  - avg_power: {sample.avg_power}")
            print(f"  - max_1min_power: {sample.max_1min_power}")
            print(f"  - max_5min_power: {sample.max_5min_power}")
            print(f"  - max_20min_power: {sample.max_20min_power}")
        else:
            print("[DEBUG] No activities found!")
        
        # 6. Run the actual query
        print("\n[DEBUG] Running MAX query...")
        result = db.query(
            func.max(Activity.max_5sec_power).label('max_5sec'),
            func.max(Activity.max_1min_power).label('max_1min'),
            func.max(Activity.max_3min_power).label('max_3min'),
            func.max(Activity.max_5min_power).label('max_5min'),
            func.max(Activity.max_10min_power).label('max_10min'),
            func.max(Activity.max_20min_power).label('max_20min'),
            func.max(Activity.max_30min_power).label('max_30min'),
            func.max(Activity.max_60min_power).label('max_60min')
        ).filter(Activity.user_id == current_user.id).first()
        
        print(f"[DEBUG] Query returned: {result}")
        if result:
            print(f"[DEBUG] Individual max values:")
            print(f"  - max_5sec: {result.max_5sec}")
            print(f"  - max_1min: {result.max_1min}")
            print(f"  - max_3min: {result.max_3min}")
            print(f"  - max_5min: {result.max_5min}")
            print(f"  - max_10min: {result.max_10min}")
            print(f"  - max_20min: {result.max_20min}")
            print(f"  - max_30min: {result.max_30min}")
            print(f"  - max_60min: {result.max_60min}")
        
        # 7. Build response
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
        
        print(f"\n[DEBUG] Response being sent:")
        print(f"  {response}")
        print("="*80 + "\n")
        
        return response
        
    except Exception as e:
        print(f"\n[ERROR] Exception in best-power-values: {e}")
        import traceback
        traceback.print_exc()
        return {
            "max_5sec_power": None,
            "max_1min_power": None,
            "max_3min_power": None,
            "max_5min_power": None,
            "max_10min_power": None,
            "max_20min_power": None,
            "max_30min_power": None,
            "max_60min_power": None,
            "weight": 70.0
        }

# ============================================
# VO2MAX
# ============================================
@router.get("/vo2max")
async def get_vo2max(
    days: int = Query(90, ge=30, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get VO2max estimates over time.
    """
    try:
        # Try to get from cache first
        from ...services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_key = f"vo2max_{days}d"

        vo2max_data = cache_manager.get(cache_key, current_user.id, max_age_hours=24)

        if vo2max_data:
            print(f"[Cache HIT] VO2max for {days} days from cache")
            return vo2max_data

        # Cache miss - calculate
        print(f"[Cache MISS] Calculating VO2max for {days} days")
        service = VO2MaxService(db)
        result = service.estimate_vo2max(current_user, days=days)
        return result if result else []
    except Exception as e:
        print(f"Error getting VO2max: {e}")
        import traceback
        traceback.print_exc()
        return []

# ============================================
# RIDER PROFILE
# ============================================
@router.get("/rider-profile")
async def get_rider_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get rider profile analysis (sprinter, climber, etc.).
    """
    try:
        service = RiderProfileService(db)
        result = service.analyze_rider_profile(current_user)
        
        if not result:
            return {
                "rider_type": "Unknown",
                "confidence": 0.0,
                "power_profile": {},
                "recommendations": []
            }
        
        return result
    except Exception as e:
        print(f"Error getting rider profile: {e}")
        return {
            "rider_type": "Unknown",
            "confidence": 0.0,
            "power_profile": {},
            "recommendations": []
        }
