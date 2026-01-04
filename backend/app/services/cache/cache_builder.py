# ============================================
# FILE: backend/app/services/cache/cache_builder.py
# Enhanced with comprehensive cache rebuilding
# ============================================

from typing import List, Optional
import math
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging

from ...database.models import User, Activity
from ...services.analysis.power_curve import PowerCurveService
from ...services.analysis.training_load import TrainingLoadService
from ...services.analysis.zones import ZoneAnalysisService
from ...services.analysis.critical_power import CriticalPowerService
from ...services.analysis.efficiency_service import EfficiencyService
from ...services.analysis.vo2max_service import VO2MaxService
from ...services.analysis.fitness_state_service import FitnessStateService
from .cache_manager import CacheManager

logger = logging.getLogger(__name__)

POWER_CURVE_RANGES = [30, 90, 180, 365]
COMPARISON_POWER_CURVE_RANGES = [30, 60, 180, 365]
POWER_CURVE_SAMPLE_DURATIONS = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]
BEST_POWER_RANGES = [90, 240, 365]
EFFICIENCY_RANGES = [60, 120, 180, 240]
TRAINING_LOAD_RANGES = [30, 60, 90, 120, 180, 365]
ZONE_RANGES = [60, 180, 365]
VO2MAX_RANGES = [30, 60, 90, 180, 365]
POLARIZED_RANGES = [30, 60, 90, 180, 365]
ZONE_BALANCE_WEEKS = [4, 8, 12]
ZONE_BALANCE_MODELS = ["polarized", "sweet_spot", "high_intensity"]


class CacheBuilder:
    """
    Builds and manages all analysis caches.
    Automatically rebuilds after FIT file import.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.cache_manager = CacheManager()

    def _power_curve_dates(self, days: int) -> tuple[str, str]:
        today = datetime.now().date()
        start = today - timedelta(days=days - 1)
        return start.isoformat(), today.isoformat()

    def _prepare_curve_payload(self, curve_list: Optional[List[float]], weighted: bool) -> Optional[dict]:
        if not curve_list:
            return None
        return {
            "durations": list(range(1, len(curve_list) + 1)),
            "powers": curve_list,
            "weighted": weighted
        }

    def _curve_lookup(self, curve) -> dict:
        if isinstance(curve, dict):
            durations = curve.get("durations") or []
            powers = curve.get("powers") or []
        elif isinstance(curve, list):
            durations = range(1, len(curve) + 1)
            powers = curve
        else:
            return {}

        lookup = {}
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
            lookup[duration_val] = power_val
        return lookup

    def _sample_curve_payload(self, curve, weighted: bool) -> dict:
        lookup = self._curve_lookup(curve)
        powers = [lookup.get(duration, 0.0) for duration in POWER_CURVE_SAMPLE_DURATIONS]
        return {
            "durations": POWER_CURVE_SAMPLE_DURATIONS,
            "powers": powers,
            "weighted": weighted
        }

    def build_power_curve_cache(self, user: User) -> bool:
        """
        Build and cache power curve data for user.
        Includes both absolute and weighted power curves.
        """
        try:
            logger.info(f"Building power curve cache for user {user.id}")
            power_curve_service = PowerCurveService(self.db)
            range_payloads = {}

            # Build absolute power curve (W)
            curve_list = power_curve_service.get_user_power_curve(user, weighted=False)
            if curve_list:
                curve_dict = self._prepare_curve_payload(curve_list, False)
                self.cache_manager.set("power_curve_absolute", user.id, curve_dict)
                logger.debug(f"Cached absolute power curve: {len(curve_list)} points")

            # Build weighted power curve (W/kg)
            if user.weight:
                curve_list_weighted = power_curve_service.get_user_power_curve(user, weighted=True)
                if curve_list_weighted:
                    curve_dict_weighted = self._prepare_curve_payload(curve_list_weighted, True)
                    self.cache_manager.set("power_curve_weighted", user.id, curve_dict_weighted)
                    logger.debug(f"Cached weighted power curve: {len(curve_list_weighted)} points")

            # Build range-specific power curves for quick toggles
            for days in POWER_CURVE_RANGES:
                start_date, end_date = self._power_curve_dates(days)
                curve_list_range = power_curve_service.get_user_power_curve(
                    user, weighted=False, start_date=start_date, end_date=end_date
                )
                payload = self._prepare_curve_payload(curve_list_range, False) or {
                    "durations": [],
                    "powers": [],
                    "weighted": False
                }
                cache_key = f"power_curve_absolute_{start_date}_{end_date}"
                self.cache_manager.set(cache_key, user.id, payload)
                range_payloads[(start_date, end_date, False)] = payload

                if days in (30, 90, 180, 365):
                    range_key = f"power_curve_absolute_range_{days}"
                    self.cache_manager.set(range_key, user.id, payload)

                if user.weight:
                    curve_list_range_weighted = power_curve_service.get_user_power_curve(
                        user, weighted=True, start_date=start_date, end_date=end_date
                    )
                    payload = self._prepare_curve_payload(curve_list_range_weighted, True) or {
                        "durations": [],
                        "powers": [],
                        "weighted": True
                    }
                    cache_key = f"power_curve_weighted_{start_date}_{end_date}"
                    self.cache_manager.set(cache_key, user.id, payload)
                    range_payloads[(start_date, end_date, True)] = payload

                    if days in (30, 90, 180, 365):
                        range_key = f"power_curve_weighted_range_{days}"
                        self.cache_manager.set(range_key, user.id, payload)

            # YTD caches (Jan 1 -> today), kept for explicit YTD queries.
            today = datetime.now().date()
            ytd_start = datetime(today.year, 1, 1).date()
            ytd_start_key = ytd_start.isoformat()
            ytd_end_key = today.isoformat()
            payload = range_payloads.get((ytd_start_key, ytd_end_key, False))
            if payload is None:
                curve_list_ytd = power_curve_service.get_user_power_curve(
                    user, weighted=False, start_date=ytd_start_key, end_date=ytd_end_key
                )
                payload = self._prepare_curve_payload(curve_list_ytd, False) or {
                    "durations": [],
                    "powers": [],
                    "weighted": False
                }
            self.cache_manager.set(f"power_curve_absolute_{ytd_start_key}_{ytd_end_key}", user.id, payload)
            self.cache_manager.set("power_curve_absolute_ytd", user.id, payload)

            if user.weight:
                payload_weighted = range_payloads.get((ytd_start_key, ytd_end_key, True))
                if payload_weighted is None:
                    curve_list_ytd_weighted = power_curve_service.get_user_power_curve(
                        user, weighted=True, start_date=ytd_start_key, end_date=ytd_end_key
                    )
                    payload_weighted = self._prepare_curve_payload(curve_list_ytd_weighted, True) or {
                        "durations": [],
                        "powers": [],
                        "weighted": True
                    }
                self.cache_manager.set(f"power_curve_weighted_{ytd_start_key}_{ytd_end_key}", user.id, payload_weighted)
                self.cache_manager.set("power_curve_weighted_ytd", user.id, payload_weighted)

            # Precompute date-specific power curves for comparison ranges (current + previous).
            comparison_ranges = []
            for days in COMPARISON_POWER_CURVE_RANGES:
                current_start = today - timedelta(days=days - 1)
                current_end = today
                comparison_ranges.append((current_start, current_end))

                previous_end = current_start - timedelta(days=1)
                previous_start = previous_end - timedelta(days=days - 1)
                comparison_ranges.append((previous_start, previous_end))

            # Month-to-date current + previous range
            mtd_start = datetime(today.year, today.month, 1).date()
            mtd_days = (today - mtd_start).days + 1
            comparison_ranges.append((mtd_start, today))
            mtd_prev_end = mtd_start - timedelta(days=1)
            mtd_prev_start = mtd_prev_end - timedelta(days=mtd_days - 1)
            comparison_ranges.append((mtd_prev_start, mtd_prev_end))

            for start_date, end_date in comparison_ranges:
                start_key = start_date.isoformat()
                end_key = end_date.isoformat()

                payload = range_payloads.get((start_key, end_key, False))
                if payload is None:
                    curve_list_range = power_curve_service.get_user_power_curve(
                        user, weighted=False, start_date=start_key, end_date=end_key
                    )
                    payload = self._prepare_curve_payload(curve_list_range, False) or {
                        "durations": [],
                        "powers": [],
                        "weighted": False
                    }
                self.cache_manager.set(f"power_curve_absolute_{start_key}_{end_key}", user.id, payload)

                if user.weight:
                    payload_weighted = range_payloads.get((start_key, end_key, True))
                    if payload_weighted is None:
                        curve_list_range_weighted = power_curve_service.get_user_power_curve(
                            user, weighted=True, start_date=start_key, end_date=end_key
                        )
                        payload_weighted = self._prepare_curve_payload(curve_list_range_weighted, True) or {
                            "durations": [],
                            "powers": [],
                            "weighted": True
                        }
                    self.cache_manager.set(f"power_curve_weighted_{start_key}_{end_key}", user.id, payload_weighted)

            return True
        except Exception as e:
            logger.error(f"Error building power curve cache for user {user.id}: {e}")
            return False

    def build_training_load_cache(self, user: User) -> bool:
        """
        Build and cache training load data (CTL/ATL/TSB) for user.
        CRITICAL: This must be rebuilt after every import to update fitness/fatigue.

        OPTIMIZED: Fetches data once for maximum period, filters for shorter periods.
        """
        try:
            logger.info(f"Building training load cache for user {user.id}")
            training_load_service = TrainingLoadService(self.db)

            # Build training load for different periods
            periods = TRAINING_LOAD_RANGES

            # OPTIMIZATION: Calculate once for max period
            # This fetches activities from database only once
            max_days = max(periods)
            max_training_load = training_load_service.calculate_training_load(user, days=max_days)

            if not max_training_load:
                return False

            # Cache the max-day result
            self.cache_manager.set(f"training_load_{max_days}d", user.id, max_training_load)
            logger.debug(f"Cached training load for {max_days} days: {len(max_training_load)} entries")

            # Filter in-memory for shorter periods (no additional DB queries!)
            from datetime import datetime, timedelta

            for days in [d for d in periods if d != max_days]:
                cutoff_date = datetime.utcnow() - timedelta(days=days)

                # Filter the max_training_load data in memory
                filtered_load = [
                    item for item in max_training_load
                    if item.date >= cutoff_date
                ]

                if filtered_load:
                    cache_key = f"training_load_{days}d"
                    self.cache_manager.set(cache_key, user.id, filtered_load)
                    logger.debug(f"Cached training load for {days} days: {len(filtered_load)} entries (filtered in-memory)")

            return True
        except Exception as e:
            logger.error(f"Error building training load cache for user {user.id}: {e}")
            return False

    def build_zone_distribution_cache(self, user: User) -> bool:
        """
        Build and cache zone distribution data for user.

        OPTIMIZED: Fetches data once for all-time, filters for shorter periods.
        """
        try:
            logger.info(f"Building zone distribution cache for user {user.id}")
            zones_service = ZoneAnalysisService(self.db)

            # Build zone distributions for different periods
            periods = [None] + ZONE_RANGES  # None = all time

            # OPTIMIZATION: Get data once for all-time (None)
            max_power_zones = zones_service.get_power_zone_distribution(user, days=None)
            max_hr_zones = zones_service.get_hr_zone_distribution(user, days=None)

            # Cache all-time data
            if max_power_zones:
                self.cache_manager.set("power_zones_alld", user.id, max_power_zones)
            if max_hr_zones:
                self.cache_manager.set("hr_zones_alld", user.id, max_hr_zones)

            # For specific periods, filter in memory (zones may need recalculation from activities)
            # Note: Zone distribution aggregates seconds_in_zone, so we still need to query per-period
            # This optimization is less effective for zones, but we cache all-time separately
            for days in ZONE_RANGES:
                try:
                    # For zones, we still need per-period queries because we need to recalculate percentages
                    # But we've already cached all-time above
                    power_zones = zones_service.get_power_zone_distribution(user, days=days)
                    if power_zones:
                        cache_key = f"power_zones_{days}d"
                        self.cache_manager.set(cache_key, user.id, power_zones)

                    hr_zones = zones_service.get_hr_zone_distribution(user, days=days)
                    if hr_zones:
                        cache_key = f"hr_zones_{days}d"
                        self.cache_manager.set(cache_key, user.id, hr_zones)

                except Exception as e:
                    logger.warning(f"Error caching zones for {days} days: {e}")

            return True
        except Exception as e:
            logger.error(f"Error building zone distribution cache for user {user.id}: {e}")
            return False

    def build_critical_power_cache(self, user: User) -> bool:
        """Build and cache critical power model for user."""
        try:
            logger.info(f"Building critical power cache for user {user.id}")
            cp_service = CriticalPowerService(self.db)
            
            critical_power = cp_service.calculate_critical_power(user)
            if critical_power:
                self.cache_manager.set("critical_power", user.id, critical_power)
                logger.debug(f"Cached critical power: CP={critical_power.get('critical_power')}")
            
            return True
        except Exception as e:
            logger.error(f"Error building critical power cache for user {user.id}: {e}")
            return False

    def build_efficiency_cache(self, user: User) -> bool:
        """
        Build and cache efficiency analysis for user.

        OPTIMIZED: Fetches data once for maximum period, filters for shorter periods.
        """
        try:
            logger.info(f"Building efficiency cache for user {user.id}")
            efficiency_service = EfficiencyService(self.db)

            # Build efficiency for different periods
            periods = EFFICIENCY_RANGES
            max_days = max(periods)

            # OPTIMIZATION: Get data once for max period
            max_efficiency_data = efficiency_service.get_efficiency_factors(user, max_days)
            max_efficiency_trend = efficiency_service.get_efficiency_trend(user, max_days)

            # Format all data once
            all_formatted_data = []
            for item in max_efficiency_data:
                all_formatted_data.append({
                    "start_time": item.start_time.isoformat() if hasattr(item.start_time, 'isoformat') else str(item.start_time),
                    "normalized_power": float(item.normalized_power) if item.normalized_power else None,
                    "avg_heart_rate": float(item.avg_heart_rate) if item.avg_heart_rate else None,
                    "intensity_factor": float(item.intensity_factor) if item.intensity_factor else None,
                    "ef": float(item.ef) if item.ef else None
                })

            # Cache max-day result
            cache_data_180 = {
                "efficiency_data": all_formatted_data,
                "trend": max_efficiency_trend if max_efficiency_trend else {"trend": "no_data"}
            }
            self.cache_manager.set(f"efficiency_{max_days}d", user.id, cache_data_180)
            logger.debug(f"Cached efficiency for {max_days} days: {len(all_formatted_data)} activities")

            # Filter in-memory for shorter periods
            from datetime import datetime, timedelta

            for days in [d for d in periods if d != max_days]:
                try:
                    cutoff_date = datetime.utcnow() - timedelta(days=days)

                    # Filter formatted data in memory
                    filtered_data = [
                        item for item in all_formatted_data
                        if datetime.fromisoformat(item['start_time']) >= cutoff_date
                    ]

                    cache_data = {
                        "efficiency_data": filtered_data,
                        "trend": max_efficiency_trend if max_efficiency_trend else {"trend": "no_data"}  # Could recalculate trend
                    }

                    cache_key = f"efficiency_{days}d"
                    self.cache_manager.set(cache_key, user.id, cache_data)
                    logger.debug(f"Cached efficiency for {days} days: {len(filtered_data)} activities (filtered in-memory)")
                except Exception as e:
                    logger.warning(f"Error caching efficiency for {days} days: {e}")

            return True
        except Exception as e:
            logger.error(f"Error building efficiency cache for user {user.id}: {e}")
            return False

    def build_vo2max_cache(self, user: User) -> bool:
        """
        Build and cache VO2Max estimation for user.

        OPTIMIZED: Fetches data once for maximum period, filters for shorter periods.
        """
        try:
            logger.info(f"Building VO2Max cache for user {user.id}")
            vo2max_service = VO2MaxService(self.db)

            # Build VO2Max for different periods
            periods = VO2MAX_RANGES
            max_days = max(periods)

            # OPTIMIZATION: Calculate once for max period
            max_vo2_payload = vo2max_service.estimate_vo2max(user, days=max_days)

            if not max_vo2_payload:
                return False

            # Cache the max-day result
            self.cache_manager.set(f"vo2max_{max_days}d", user.id, max_vo2_payload)
            logger.debug(f"Cached VO2Max for {max_days} days: {len(max_vo2_payload.get('estimates', []))} estimates")

            # Filter in-memory for shorter periods
            from datetime import datetime, timedelta

            for days in [d for d in periods if d != max_days]:
                try:
                    cutoff_date = datetime.utcnow() - timedelta(days=days)

                    # Filter estimates in memory
                    all_estimates = max_vo2_payload.get('estimates', [])
                    filtered_estimates = [
                        est for est in all_estimates
                        if datetime.fromisoformat(est['date']) >= cutoff_date
                    ]

                    # Create filtered payload
                    filtered_payload = {
                        'current_vo2max': max_vo2_payload.get('current_vo2max'),  # Keep most recent
                        'estimates': filtered_estimates,
                        'trend': max_vo2_payload.get('trend')  # Recalculate if needed
                    }

                    cache_key = f"vo2max_{days}d"
                    self.cache_manager.set(cache_key, user.id, filtered_payload)
                    logger.debug(f"Cached VO2Max for {days} days: {len(filtered_estimates)} estimates (filtered in-memory)")
                except Exception as e:
                    logger.warning(f"Error caching VO2Max for {days} days: {e}")

            return True
        except Exception as e:
            logger.error(f"Error building VO2Max cache for user {user.id}: {e}")
            return False

    def build_best_power_cache(self, user: User) -> bool:
        """Build and cache best power values for quick ranges."""
        try:
            logger.info(f"Building best power cache for user {user.id}")
            from sqlalchemy import func

            def fetch_best_powers(start_dt=None):
                filters = [Activity.user_id == user.id]
                if start_dt:
                    filters.append(Activity.start_time >= start_dt)

                result = self.db.query(
                    func.max(Activity.max_5sec_power).label('max_5sec'),
                    func.max(Activity.max_1min_power).label('max_1min'),
                    func.max(Activity.max_3min_power).label('max_3min'),
                    func.max(Activity.max_5min_power).label('max_5min'),
                    func.max(Activity.max_10min_power).label('max_10min'),
                    func.max(Activity.max_20min_power).label('max_20min'),
                    func.max(Activity.max_30min_power).label('max_30min'),
                    func.max(Activity.max_60min_power).label('max_60min')
                ).filter(*filters).first()

                return {
                    "max_5sec_power": float(result.max_5sec) if result and result.max_5sec else None,
                    "max_1min_power": float(result.max_1min) if result and result.max_1min else None,
                    "max_3min_power": float(result.max_3min) if result and result.max_3min else None,
                    "max_5min_power": float(result.max_5min) if result and result.max_5min else None,
                    "max_10min_power": float(result.max_10min) if result and result.max_10min else None,
                    "max_20min_power": float(result.max_20min) if result and result.max_20min else None,
                    "max_30min_power": float(result.max_30min) if result and result.max_30min else None,
                    "max_60min_power": float(result.max_60min) if result and result.max_60min else None,
                    "weight": float(user.weight or 70.0)
                }

            # Cache all-time
            self.cache_manager.set("best_power_values_all", user.id, fetch_best_powers())

            for days in BEST_POWER_RANGES:
                start_dt = datetime.utcnow() - timedelta(days=days)
                payload = fetch_best_powers(start_dt)
                cache_key = f"best_power_values_days_{days}"
                self.cache_manager.set(cache_key, user.id, payload)

            return True
        except Exception as e:
            logger.error(f"Error building best power cache for user {user.id}: {e}")
            return False

    def build_fitness_state_cache(self, user: User) -> bool:
        """Build and cache fitness state analysis for user."""
        try:
            logger.info(f"Building fitness state cache for user {user.id}")
            fitness_service = FitnessStateService(self.db)
            
            fitness_state = fitness_service.analyze_fitness_state(user)
            if fitness_state:
                payload = fitness_state._asdict() if hasattr(fitness_state, "_asdict") else fitness_state
                self.cache_manager.set("fitness_state", user.id, payload)
                logger.debug(f"Cached fitness state: {payload.get('status')}")
            
            return True
        except Exception as e:
            logger.error(f"Error building fitness state cache for user {user.id}: {e}")
            return False

    def build_activity_summary_cache(self, user: User) -> bool:
        """Build and cache activity summary data for user."""
        try:
            logger.info(f"Building activity summary cache for user {user.id}")
            from sqlalchemy import func
            
            # Get activity summaries for different periods
            periods = [7, 30, 60, 90, 180, 365]
            
            for days in periods:
                start_date = datetime.utcnow() - timedelta(days=days)
                
                result = self.db.query(
                    func.count(Activity.id).label('count'),
                    func.sum(Activity.duration).label('total_duration'),
                    func.sum(Activity.distance).label('total_distance'),
                    func.sum(Activity.tss).label('total_tss'),
                    func.avg(Activity.avg_power).label('avg_power'),
                    func.max(Activity.max_20min_power).label('max_20min_power')
                ).filter(
                    Activity.user_id == user.id,
                    Activity.start_time >= start_date
                ).first()
                
                summary = {
                    "count": result.count or 0,
                    "total_duration": result.total_duration or 0,
                    "total_distance": result.total_distance or 0,
                    "total_tss": result.total_tss or 0,
                    "avg_power": result.avg_power or 0,
                    "max_20min_power": result.max_20min_power or 0,
                    "period_days": days
                }
                
                cache_key = f"activity_summary_{days}d"
                self.cache_manager.set(cache_key, user.id, summary)
            
            return True
        except Exception as e:
            logger.error(f"Error building activity summary cache for user {user.id}: {e}")
            return False

    def build_comparisons_cache(self, user: User) -> bool:
        """Precompute comparisons for quick ranges to avoid slow first loads."""
        try:
            logger.info(f"Building comparisons cache for user {user.id}")
            from ...services.analysis.comparisons import ComparisonsService
            service = ComparisonsService(self.db)
            power_curve_service = PowerCurveService(self.db)

            today = datetime.now().date()
            presets = []

            # Default range: month-to-date
            month_start = datetime(today.year, today.month, 1).date()
            presets.append((month_start, today))

            # Quick ranges used by the comparisons page
            for days in [30, 60, 180, 365]:
                start = today - timedelta(days=days - 1)
                presets.append((start, today))

            for start_date, end_date in presets:
                range_days = (end_date - start_date).days + 1
                months = min(60, max(6, math.ceil(range_days / 30)))
                years = min(10, max(2, math.ceil(range_days / 365)))
                compare_mode = "previous"
                include_year_curve = False
                include_pr_timeline = True
                include_ftp_progression = True
                include_seasonal_volume = True

                end_dt = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1) - timedelta(seconds=1)
                start_dt = datetime.combine(start_date, datetime.min.time())

                cache_key = "_".join([
                    "comparisons_v2",
                    start_date.isoformat(),
                    end_date.isoformat(),
                    compare_mode,
                    str(end_date.year),
                    str(end_date.year - 1),
                    str(months),
                    str(years),
                    f"yc{int(include_year_curve)}",
                    f"pr{int(include_pr_timeline)}",
                    f"ftp{int(include_ftp_progression)}",
                    f"sv{int(include_seasonal_volume)}"
                ])

                cached = self.cache_manager.get(cache_key, user.id, max_age_hours=6)
                if cached:
                    continue

                ranges = service.get_period_ranges(start_dt, end_dt, compare_mode)
                period_comparison = {
                    "current": service.get_period_summary(user, ranges["current_start"], ranges["current_end"]),
                    "previous": service.get_period_summary(user, ranges["previous_start"], ranges["previous_end"])
                }

                pr_current = service.get_pr_timeline(
                    user,
                    ranges["current_start"],
                    ranges["current_end"],
                    only_changes=True
                ) if include_pr_timeline else []

                pr_previous = service.get_pr_timeline(
                    user,
                    ranges["previous_start"],
                    ranges["previous_end"],
                    only_changes=True
                ) if include_pr_timeline else []

                current_bests = service.get_period_power_bests(user, ranges["current_start"], ranges["current_end"])
                previous_bests = service.get_period_power_bests(user, ranges["previous_start"], ranges["previous_end"])
                pr_summary = {
                    "current": current_bests,
                    "previous": previous_bests,
                    "delta": {
                        "best_5min": (
                            (current_bests.get("best_5min") or 0) - (previous_bests.get("best_5min") or 0)
                        ),
                        "best_20min": (
                            (current_bests.get("best_20min") or 0) - (previous_bests.get("best_20min") or 0)
                        )
                    }
                }

                def get_curve(start_dt, end_dt):
                    start_key = start_dt.date().isoformat()
                    end_key = end_dt.date().isoformat()
                    cached_curve = self.cache_manager.get(f"power_curve_absolute_{start_key}_{end_key}", user.id)
                    if cached_curve:
                        return cached_curve
                    curve_list = power_curve_service.get_user_power_curve(
                        user,
                        weighted=False,
                        start_date=start_key,
                        end_date=end_key
                    )
                    payload = self._prepare_curve_payload(curve_list, False) or {
                        "durations": [],
                        "powers": [],
                        "weighted": False
                    }
                    self.cache_manager.set(f"power_curve_absolute_{start_key}_{end_key}", user.id, payload)
                    return payload

                response = {
                    "period_comparison": period_comparison,
                    "pr_timeline": pr_current,
                    "pr_timeline_previous": pr_previous,
                    "pr_summary": pr_summary,
                    "power_curve_comparison": {
                        "current": self._sample_curve_payload(
                            get_curve(ranges["current_start"], ranges["current_end"]),
                            weighted=False
                        ),
                        "previous": self._sample_curve_payload(
                            get_curve(ranges["previous_start"], ranges["previous_end"]),
                            weighted=False
                        )
                    },
                    "year_over_year_power_curve": {},
                    "ftp_progression": [],
                    "ftp_progression_previous": [],
                    "seasonal_volume": [],
                    "seasonal_volume_previous": []
                }

                if include_ftp_progression:
                    response["ftp_progression"] = service.get_ftp_progression(
                        user,
                        ranges["current_start"],
                        ranges["current_end"],
                        months=months
                    )
                    response["ftp_progression_previous"] = service.get_ftp_progression(
                        user,
                        ranges["previous_start"],
                        ranges["previous_end"],
                        months=months
                    )

                if include_seasonal_volume:
                    response["seasonal_volume"] = self._aggregate_seasonal_by_season(
                        service.get_seasonal_volume(
                            user,
                            ranges["current_start"],
                            ranges["current_end"],
                            years=years
                        )
                    )
                    response["seasonal_volume_previous"] = self._aggregate_seasonal_by_season(
                        service.get_seasonal_volume(
                            user,
                            ranges["previous_start"],
                            ranges["previous_end"],
                            years=years
                        )
                    )

                self.cache_manager.set(cache_key, user.id, response)

                range_key = f"comparisons_range_{range_days}_{compare_mode}_yc{int(include_year_curve)}_pr{int(include_pr_timeline)}_ftp{int(include_ftp_progression)}_sv{int(include_seasonal_volume)}"
                self.cache_manager.set(range_key, user.id, response)
                if start_date.day == 1 and start_date.month == end_date.month and start_date.year == end_date.year:
                    mtd_key = f"comparisons_mtd_{compare_mode}_yc{int(include_year_curve)}_pr{int(include_pr_timeline)}_ftp{int(include_ftp_progression)}_sv{int(include_seasonal_volume)}"
                    self.cache_manager.set(mtd_key, user.id, response)

            return True
        except Exception as e:
            logger.error(f"Error building comparisons cache for user {user.id}: {e}")
            return False

    def _aggregate_seasonal_by_season(self, items):
        if not items:
            return []
        season_order = ["Winter", "Spring", "Summer", "Fall"]
        buckets = {season: {"label": season, "duration_hours": 0.0, "total_tss": 0.0} for season in season_order}
        for item in items:
            label = str(item.get("label", ""))
            season = label.split(" ")[0] if label else ""
            if season not in buckets:
                continue
            buckets[season]["duration_hours"] += float(item.get("duration_hours") or 0)
            buckets[season]["total_tss"] += float(item.get("total_tss") or 0)
        result = []
        for season in season_order:
            entry = buckets[season]
            result.append({
                "label": entry["label"],
                "duration_hours": round(entry["duration_hours"], 2),
                "total_tss": round(entry["total_tss"], 1)
            })
        return result

    def build_polarized_distribution_cache(self, user: User) -> bool:
        """Precompute polarized distribution for common ranges."""
        try:
            logger.info(f"Building polarized distribution cache for user {user.id}")
            from ...services.analysis.advanced_metrics import AdvancedMetricsService
            service = AdvancedMetricsService(self.db)

            for days in POLARIZED_RANGES:
                payload = service.polarized_distribution(user, days=days)
                cache_key = f"polarized_distribution_{days}d"
                self.cache_manager.set(cache_key, user.id, payload)

            return True
        except Exception as e:
            logger.error(f"Error building polarized distribution cache for user {user.id}: {e}")
            return False

    def build_zone_balance_cache(self, user: User) -> bool:
        """Precompute zone balance for default models and weeks."""
        try:
            logger.info(f"Building zone balance cache for user {user.id}")
            from ...services.analysis.zone_balance_service import ZoneBalanceService
            service = ZoneBalanceService(self.db)

            for model in ZONE_BALANCE_MODELS:
                for weeks in ZONE_BALANCE_WEEKS:
                    zone_balance = service.analyze_zone_balance(user, model, weeks)
                    recommendations = service.get_recommendations(zone_balance, model)
                    payload = {
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
                    cache_key = f"zone_balance_{model}_{weeks}w"
                    self.cache_manager.set(cache_key, user.id, payload)

            return True
        except Exception as e:
            logger.error(f"Error building zone balance cache for user {user.id}: {e}")
            return False

    def build_all_cache(self, user: User) -> dict:
        """
        Build ALL cache data for a user.
        Called automatically after FIT file import.
        
        Returns:
            dict: Status of each cache build operation
        """
        logger.info(f"Building all caches for user {user.id}")
        
        start_time = datetime.now()
        results = {
            "user_id": user.id,
            "started_at": start_time.isoformat(),
            "operations": {}
        }
        
        # Build each cache type
        operations = [
            ("power_curve", self.build_power_curve_cache),
            ("training_load", self.build_training_load_cache),
            ("zone_distribution", self.build_zone_distribution_cache),
            ("critical_power", self.build_critical_power_cache),
            ("efficiency", self.build_efficiency_cache),
            ("vo2max", self.build_vo2max_cache),
            ("fitness_state", self.build_fitness_state_cache),
            ("activity_summary", self.build_activity_summary_cache),
            ("best_power", self.build_best_power_cache),
            ("comparisons", self.build_comparisons_cache),
            ("polarized_distribution", self.build_polarized_distribution_cache),
            ("zone_balance", self.build_zone_balance_cache)
        ]
        
        for name, build_func in operations:
            try:
                success = build_func(user)
                results["operations"][name] = {
                    "success": success,
                    "message": f"{'Successfully' if success else 'Failed to'} build {name} cache"
                }
            except Exception as e:
                logger.error(f"Error building {name} cache: {e}")
                results["operations"][name] = {
                    "success": False,
                    "error": str(e)
                }
        
        # Set cache build timestamp
        self.cache_manager.set("cache_built_at", user.id, datetime.now().isoformat())
        
        end_time = datetime.now()
        results["completed_at"] = end_time.isoformat()
        results["duration_seconds"] = (end_time - start_time).total_seconds()
        results["success"] = all(
            op.get("success", False) 
            for op in results["operations"].values()
        )
        
        logger.info(f"Cache build completed for user {user.id} in {results['duration_seconds']:.2f}s: {results['success']}")
        
        return results

    def invalidate_cache(self, user: User, cache_keys: Optional[List[str]] = None) -> bool:
        """
        Invalidate specific cache keys or all cache for a user.
        Called before rebuilding to ensure fresh data.
        """
        try:
            if cache_keys:
                for key in cache_keys:
                    self.cache_manager.delete(key, user.id)
                logger.info(f"Invalidated {len(cache_keys)} cache keys for user {user.id}")
            else:
                self.cache_manager.clear_user_cache(user.id)
                logger.info(f"Cleared all cache for user {user.id}")
            
            return True
        except Exception as e:
            logger.error(f"Error invalidating cache for user {user.id}: {e}")
            return False

    def is_cache_valid(self, user: User, max_age_hours: int = 24) -> bool:
        """
        Check if cache is valid and not expired.
        Returns False if cache needs rebuilding.
        """
        cache_built_at = self.cache_manager.get("cache_built_at", user.id, max_age_hours)
        return cache_built_at is not None

    def rebuild_after_import(self, user: User, mode: str = "full") -> dict:
        """
        Rebuild cache after FIT file import.
        
        This is the main method called after successful file import.
        It invalidates old cache and rebuilds everything with new data.
        
        Returns:
            dict: Detailed results of the rebuild operation
        """
        logger.info("Rebuilding cache after import for user %s (mode=%s)", user.id, mode)

        if mode == "fast":
            return self.build_post_import_cache(user)
        
        # Step 1: Invalidate all existing cache
        logger.debug("Step 1: Invalidating existing cache")
        self.invalidate_cache(user)
        
        # Step 2: Rebuild all caches
        logger.debug("Step 2: Building all caches")
        results = self.build_all_cache(user)
        
        return results

    def build_post_import_cache(self, user: User) -> dict:
        """
        Build the critical caches needed right after a new activity import.

        This avoids clearing every cache and keeps the dashboard responsive.
        """
        start_time = datetime.now()
        results = {
            "user_id": user.id,
            "started_at": start_time.isoformat(),
            "mode": "fast",
            "operations": {}
        }

        operations = [
            ("training_load", self.build_training_load_cache),
            ("activity_summary", self.build_activity_summary_cache),
            ("best_power", self.build_best_power_cache),
            ("power_curve_recent", lambda u: self.build_power_curve_range_cache(u, [30]))
        ]

        for name, build_func in operations:
            try:
                success = build_func(user)
                results["operations"][name] = {
                    "success": success,
                    "message": f"{'Successfully' if success else 'Failed to'} build {name} cache"
                }
            except Exception as e:
                logger.error("Error building %s cache: %s", name, e)
                results["operations"][name] = {
                    "success": False,
                    "error": str(e)
                }

        self.cache_manager.set("cache_built_after_import", user.id, datetime.now().isoformat())

        end_time = datetime.now()
        results["completed_at"] = end_time.isoformat()
        results["duration_seconds"] = (end_time - start_time).total_seconds()
        results["success"] = all(
            op.get("success", False)
            for op in results["operations"].values()
        )

        logger.info(
            "Post-import cache build completed for user %s in %.2fs: %s",
            user.id,
            results["duration_seconds"],
            results["success"]
        )

        return results

    def build_power_curve_range_cache(self, user: User, ranges: List[int]) -> bool:
        """Build power curve caches for selected range windows only."""
        try:
            power_curve_service = PowerCurveService(self.db)

            for days in ranges:
                start_date, end_date = self._power_curve_dates(days)
                curve_list_range = power_curve_service.get_user_power_curve(
                    user, weighted=False, start_date=start_date, end_date=end_date
                )
                payload = self._prepare_curve_payload(curve_list_range, False) or {
                    "durations": [],
                    "powers": [],
                    "weighted": False
                }
                cache_key = f"power_curve_absolute_{start_date}_{end_date}"
                self.cache_manager.set(cache_key, user.id, payload)

                if days in (30, 90, 180, 365):
                    range_key = f"power_curve_absolute_range_{days}"
                    self.cache_manager.set(range_key, user.id, payload)

                if user.weight:
                    curve_list_range_weighted = power_curve_service.get_user_power_curve(
                        user, weighted=True, start_date=start_date, end_date=end_date
                    )
                    payload_weighted = self._prepare_curve_payload(curve_list_range_weighted, True) or {
                        "durations": [],
                        "powers": [],
                        "weighted": True
                    }
                    cache_key_weighted = f"power_curve_weighted_{start_date}_{end_date}"
                    self.cache_manager.set(cache_key_weighted, user.id, payload_weighted)

                    if days in (30, 90, 180, 365):
                        range_key = f"power_curve_weighted_range_{days}"
                        self.cache_manager.set(range_key, user.id, payload_weighted)

            return True
        except Exception as e:
            logger.error("Error building recent power curve cache for user %s: %s", user.id, e)
            return False

    def get_cache_status(self, user: User) -> dict:
        """
        Get current cache status for a user.
        Useful for debugging and monitoring.
        """
        cache_info = self.cache_manager.get_cache_info(user.id)
        cache_built_at = self.cache_manager.get("cache_built_at", user.id, max_age_hours=999)
        cache_built_after_import = self.cache_manager.get("cache_built_after_import", user.id, max_age_hours=999)
        
        return {
            "user_id": user.id,
            "cache_built_at": cache_built_at,
            "cache_built_after_import": cache_built_after_import,
            "is_valid": self.is_cache_valid(user),
            "total_files": cache_info["files"],
            "total_size_bytes": cache_info["total_size"],
            "files": cache_info["files_list"]
        }
