# ============================================
# FILE: backend/app/services/cache/cache_builder.py
# Enhanced with comprehensive cache rebuilding
# ============================================

from typing import List, Optional
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


class CacheBuilder:
    """
    Builds and manages all analysis caches.
    Automatically rebuilds after FIT file import.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.cache_manager = CacheManager()

    def build_power_curve_cache(self, user: User) -> bool:
        """
        Build and cache power curve data for user.
        Includes both absolute and weighted power curves.
        """
        try:
            logger.info(f"Building power curve cache for user {user.id}")
            power_curve_service = PowerCurveService(self.db)

            # Build absolute power curve (W)
            curve_list = power_curve_service.get_user_power_curve(user, weighted=False)
            if curve_list:
                # Convert list to dict format expected by frontend
                curve_dict = {
                    "durations": list(range(1, len(curve_list) + 1)),
                    "powers": curve_list,
                    "weighted": False
                }
                self.cache_manager.set("power_curve_absolute", user.id, curve_dict)
                logger.debug(f"Cached absolute power curve: {len(curve_list)} points")

            # Build weighted power curve (W/kg)
            if user.weight:
                curve_list_weighted = power_curve_service.get_user_power_curve(user, weighted=True)
                if curve_list_weighted:
                    curve_dict_weighted = {
                        "durations": list(range(1, len(curve_list_weighted) + 1)),
                        "powers": curve_list_weighted,
                        "weighted": True
                    }
                    self.cache_manager.set("power_curve_weighted", user.id, curve_dict_weighted)
                    logger.debug(f"Cached weighted power curve: {len(curve_list_weighted)} points")

            return True
        except Exception as e:
            logger.error(f"Error building power curve cache for user {user.id}: {e}")
            return False

    def build_training_load_cache(self, user: User) -> bool:
        """
        Build and cache training load data (CTL/ATL/TSB) for user.
        CRITICAL: This must be rebuilt after every import to update fitness/fatigue.
        """
        try:
            logger.info(f"Building training load cache for user {user.id}")
            training_load_service = TrainingLoadService(self.db)
            
            # Build training load for different periods
            periods = [30, 60, 90, 120, 180, 365]
            
            for days in periods:
                training_load = training_load_service.calculate_training_load(user, days=days)
                
                if training_load:
                    cache_key = f"training_load_{days}d"
                    self.cache_manager.set(cache_key, user.id, training_load)
                    logger.debug(f"Cached training load for {days} days: {len(training_load)} entries")
            
            return True
        except Exception as e:
            logger.error(f"Error building training load cache for user {user.id}: {e}")
            return False

    def build_zone_distribution_cache(self, user: User) -> bool:
        """Build and cache zone distribution data for user."""
        try:
            logger.info(f"Building zone distribution cache for user {user.id}")
            zones_service = ZoneAnalysisService(self.db)
            
            # Build zone distributions for different periods
            periods = [None, 30, 60, 90, 180, 365]  # None = all time
            
            for days in periods:
                try:
                    # Power zones
                    power_zones = zones_service.get_power_zone_distribution(user, days=days)
                    if power_zones:
                        cache_key = f"power_zones_{days or 'all'}d"
                        self.cache_manager.set(cache_key, user.id, power_zones)
                    
                    # HR zones
                    hr_zones = zones_service.get_hr_zone_distribution(user, days=days)
                    if hr_zones:
                        cache_key = f"hr_zones_{days or 'all'}d"
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
        """Build and cache efficiency analysis for user."""
        try:
            logger.info(f"Building efficiency cache for user {user.id}")
            efficiency_service = EfficiencyService(self.db)

            # Build efficiency for different periods
            periods = [30, 60, 90, 120, 180]

            for days in periods:
                try:
                    # Get both efficiency data and trend
                    efficiency_data = efficiency_service.get_efficiency_factors(user, days)
                    efficiency_trend = efficiency_service.get_efficiency_trend(user, days)

                    # Format for caching (match API response format)
                    formatted_data = []
                    for item in efficiency_data:
                        formatted_data.append({
                            "start_time": item.start_time.isoformat() if hasattr(item.start_time, 'isoformat') else str(item.start_time),
                            "normalized_power": float(item.normalized_power) if item.normalized_power else None,
                            "avg_heart_rate": float(item.avg_heart_rate) if item.avg_heart_rate else None,
                            "intensity_factor": float(item.intensity_factor) if item.intensity_factor else None,
                            "ef": float(item.ef) if item.ef else None
                        })

                    cache_data = {
                        "efficiency_data": formatted_data,
                        "trend": efficiency_trend if efficiency_trend else {"trend": "no_data"}
                    }

                    cache_key = f"efficiency_{days}d"
                    self.cache_manager.set(cache_key, user.id, cache_data)
                    logger.debug(f"Cached efficiency for {days} days: {len(formatted_data)} activities")
                except Exception as e:
                    logger.warning(f"Error caching efficiency for {days} days: {e}")

            return True
        except Exception as e:
            logger.error(f"Error building efficiency cache for user {user.id}: {e}")
            return False

    def build_vo2max_cache(self, user: User) -> bool:
        """Build and cache VO2Max estimation for user."""
        try:
            logger.info(f"Building VO2Max cache for user {user.id}")
            vo2max_service = VO2MaxService(self.db)
            
            # Build VO2Max for different periods
            periods = [30, 60, 90, 180, 365]
            
            for days in periods:
                try:
                    vo2_payload = vo2max_service.estimate_vo2max(user, days=days)
                    cache_key = f"vo2max_{days}d"
                    self.cache_manager.set(cache_key, user.id, vo2_payload)
                    logger.debug(f"Cached VO2Max for {days} days: {len(vo2_payload.get('estimates', []))} estimates")
                except Exception as e:
                    logger.warning(f"Error caching VO2Max for {days} days: {e}")
            
            return True
        except Exception as e:
            logger.error(f"Error building VO2Max cache for user {user.id}: {e}")
            return False

    def build_fitness_state_cache(self, user: User) -> bool:
        """Build and cache fitness state analysis for user."""
        try:
            logger.info(f"Building fitness state cache for user {user.id}")
            fitness_service = FitnessStateService(self.db)
            
            fitness_state = fitness_service.analyze_fitness_state(user)
            if fitness_state:
                self.cache_manager.set("fitness_state", user.id, fitness_state)
                logger.debug(f"Cached fitness state: {fitness_state.get('status')}")
            
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
            ("activity_summary", self.build_activity_summary_cache)
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

    def rebuild_after_import(self, user: User) -> dict:
        """
        Rebuild cache after FIT file import.
        
        This is the main method called after successful file import.
        It invalidates old cache and rebuilds everything with new data.
        
        Returns:
            dict: Detailed results of the rebuild operation
        """
        logger.info(f"Rebuilding cache after import for user {user.id}")
        
        # Step 1: Invalidate all existing cache
        logger.debug("Step 1: Invalidating existing cache")
        self.invalidate_cache(user)
        
        # Step 2: Rebuild all caches
        logger.debug("Step 2: Building all caches")
        results = self.build_all_cache(user)
        
        return results

    def get_cache_status(self, user: User) -> dict:
        """
        Get current cache status for a user.
        Useful for debugging and monitoring.
        """
        cache_info = self.cache_manager.get_cache_info(user.id)
        cache_built_at = self.cache_manager.get("cache_built_at", user.id, max_age_hours=999)
        
        return {
            "user_id": user.id,
            "cache_built_at": cache_built_at,
            "is_valid": self.is_cache_valid(user),
            "total_files": cache_info["files"],
            "total_size_bytes": cache_info["total_size"],
            "files": cache_info["files_list"]
        }
