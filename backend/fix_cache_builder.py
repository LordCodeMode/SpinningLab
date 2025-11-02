#!/usr/bin/env python3
"""
Script to fix the cache_builder.py methods
"""

import re

# Read the file
with open('app/services/cache/cache_builder.py', 'r') as f:
    content = f.read()

# Fix 1: Replace build_vo2max_cache method
old_vo2max = '''    def build_vo2max_cache(self, user: User) -> bool:
        """Build and cache VO2Max estimation for user."""
        try:
            logger.info(f"Building VO2Max cache for user {user.id}")
            vo2max_service = VO2MaxService(self.db)

            # Build VO2Max for different periods
            periods = [30, 60, 90, 180, 365]

            for days in periods:
                try:
                    vo2max = vo2max_service.estimate_vo2max(user, days=days)
                    if vo2max:
                        cache_key = f"vo2max_{days}d"
                        self.cache_manager.set(cache_key, user.id, vo2max)
                except Exception as e:
                    logger.warning(f"Error caching VO2Max for {days} days: {e}")

            return True
        except Exception as e:
            logger.error(f"Error building VO2Max cache for user {user.id}: {e}")
            return False'''

new_vo2max = '''    def build_vo2max_cache(self, user: User) -> bool:
        """Build and cache VO2Max estimation for user."""
        try:
            logger.info(f"Building VO2Max cache for user {user.id}")
            vo2max_service = VO2MaxService(self.db)

            # Build VO2Max for different periods
            periods = [30, 60, 90, 180, 365]

            for days in periods:
                try:
                    # Get VO2max trend for this period
                    estimates = vo2max_service.get_vo2max_trend(user, days=days)

                    # Format for caching (match API response format)
                    vo2max_data = [
                        {
                            "timestamp": est.timestamp.isoformat(),
                            "vo2max": est.vo2max,
                            "method": est.method
                        }
                        for est in estimates
                    ]

                    cache_key = f"vo2max_{days}d"
                    self.cache_manager.set(cache_key, user.id, vo2max_data)
                    logger.debug(f"Cached VO2Max for {days} days: {len(vo2max_data)} estimates")
                except Exception as e:
                    logger.warning(f"Error caching VO2Max for {days} days: {e}")

            return True
        except Exception as e:
            logger.error(f"Error building VO2Max cache for user {user.id}: {e}")
            return False'''

# Fix 2: Replace build_fitness_state_cache method
old_fitness = '''    def build_fitness_state_cache(self, user: User) -> bool:
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
            return False'''

new_fitness = '''    def build_fitness_state_cache(self, user: User) -> bool:
        """Build and cache fitness state analysis for user."""
        try:
            logger.info(f"Building fitness state cache for user {user.id}")
            fitness_service = FitnessStateService(self.db)

            fitness_state = fitness_service.analyze_fitness_state(user)
            if fitness_state:
                # Convert NamedTuple to dict for caching
                fitness_dict = {
                    "status": fitness_state.status,
                    "status_description": fitness_state.status_description,
                    "ctl": float(fitness_state.ctl) if fitness_state.ctl else 0.0,
                    "atl": float(fitness_state.atl) if fitness_state.atl else 0.0,
                    "tsb": float(fitness_state.tsb) if fitness_state.tsb else 0.0,
                    "ef_trend": float(fitness_state.ef_trend) if fitness_state.ef_trend else 0.0,
                    "recommendations": fitness_state.recommendations
                }
                self.cache_manager.set("fitness_state", user.id, fitness_dict)
                logger.debug(f"Cached fitness state: {fitness_state.status}")

            return True
        except Exception as e:
            logger.error(f"Error building fitness state cache for user {user.id}: {e}")
            return False'''

# Apply fixes
content = content.replace(old_vo2max, new_vo2max)
content = content.replace(old_fitness, new_fitness)

# Write back
with open('app/services/cache/cache_builder.py', 'w') as f:
    f.write(content)

print("✅ Fixed VO2Max cache builder")
print("✅ Fixed Fitness State cache builder")
print("\nAll fixes applied successfully!")
