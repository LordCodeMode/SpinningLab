import numpy as np
import pandas as pd
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from ...database.models import User, Activity


class VO2MaxEstimate:
    def __init__(self, timestamp: datetime, vo2max: float, method: str):
        self.timestamp = timestamp
        self.vo2max = vo2max
        self.method = method


class VO2MaxService:
    def __init__(self, db: Session):
        self.db = db

    def estimate_vo2max_trend(self, user: User) -> List[Dict]:
        """Estimate VO2max trend - API endpoint method"""
        estimates = self.get_vo2max_trend(user)
        return [
            {
                "timestamp": est.timestamp.isoformat(),
                "vo2max": est.vo2max,
                "method": est.method
            }
            for est in estimates
        ]

    def get_vo2max_trend(self, user: User, days: int = 180) -> List[VO2MaxEstimate]:
        """Get VO2max trend over time using multi-stage estimation."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        activities = self.db.query(Activity).options(
            joinedload(Activity.power_zones),
            joinedload(Activity.hr_zones)
        ).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        ).order_by(Activity.start_time).all()
        
        estimates = []
        valid_values = []
        weight = user.weight or 70.0
        max_hr = user.hr_max or 190
        
        # Constants tuned for realistic athlete ranges
        factor_peak = 14.5  # brings high-intensity estimates in line with ~60 ml/kg/min ceiling
        drift_per_day = -0.015  # slower decay between maximal efforts
        
        for activity in activities:
            ts = activity.start_time
            np_val = activity.normalized_power
            hr = activity.avg_heart_rate
            if_val = activity.intensity_factor
            dur = activity.duration
            p5 = activity.max_5min_power
            p10 = activity.max_10min_power
            
            estimation_done = False
            
            # Stage 1: High-intensity efforts (IF >= 0.8, 4-25 min, HR >= 78% max)
            if (np_val and hr and if_val and dur and
                if_val >= 0.8 and 240 <= dur <= 1500 and hr / max_hr >= 0.78):

                vo2_abs = (np_val / hr) * if_val * weight * factor_peak
                vo2_rel = vo2_abs / weight
                
                if self._validate_vo2max(vo2_rel, vo2_abs, valid_values, hr, np_val):
                    # Smooth with previous values
                    if valid_values:
                        smoothed_vals = valid_values[-2:] + [vo2_abs]
                        vo2_abs = sum(smoothed_vals) / len(smoothed_vals)
                    
                    estimates.append(VO2MaxEstimate(
                        timestamp=ts,
                        vo2max=round(vo2_abs / weight, 1),  # Store as ml/kg/min
                        method="high_intensity"
                    ))
                    valid_values.append(vo2_abs)
                    estimation_done = True
                    continue
            
            # Stage 2: Peak power efforts (VO2max ≈ 14.2 × peak_power / weight)
            if not estimation_done:
                for p_peak in [p5, p10]:
                    if p_peak and p_peak > 0:
                        vo2_rel_peak = (14.2 * p_peak) / weight
                        vo2_abs_peak = vo2_rel_peak * weight
                        
                        if self._validate_vo2max(vo2_rel_peak, vo2_abs_peak, valid_values, hr, np_val):
                            # Smooth with previous values
                            if valid_values:
                                smoothed_vals = valid_values[-2:] + [vo2_abs_peak]
                                vo2_abs_peak = sum(smoothed_vals) / len(smoothed_vals)
                            
                            estimates.append(VO2MaxEstimate(
                                timestamp=ts,
                                vo2max=round(vo2_abs_peak / weight, 1),
                                method="peak_power"
                            ))
                            valid_values.append(vo2_abs_peak)
                            estimation_done = True
                            break
            
            # Stage 3: Moderate efforts with decay interpolation (IF >= 0.65, >20 min, HR >= 70% max)
            if not estimation_done:
                if (np_val and hr and if_val and dur and
                    if_val >= 0.65 and dur >= 1200 and hr / max_hr >= 0.7 and valid_values):
                    
                    # Calculate decay from last valid estimate
                    if estimates:
                        days_since_last = (ts - estimates[-1].timestamp).days
                        est_vo2 = max(0, valid_values[-1] + (drift_per_day * days_since_last))
                        vo2_rel_est = est_vo2 / weight
                        
                        if self._validate_vo2max(vo2_rel_est, est_vo2, valid_values, hr, np_val):
                            estimates.append(VO2MaxEstimate(
                                timestamp=ts,
                                vo2max=round(vo2_rel_est, 1),
                                method="decay_interpolation"
                            ))
                            valid_values.append(est_vo2)
        
        # Apply final rolling median smoothing (window=5, like in your old model)
        if len(estimates) >= 5:
            values = [e.vo2max for e in estimates]
            smoothed = pd.Series(values).rolling(window=5, center=True, min_periods=1).median()
            
            for i, est in enumerate(estimates):
                est.vo2max = round(smoothed.iloc[i], 1)
        
        return estimates

    def estimate_vo2max(self, user: User, days: int = 180) -> Dict:
        """Full VO2max payload including training context."""
        estimates = self.get_vo2max_trend(user, days=days)

        estimates_payload = [
            {
                "timestamp": est.timestamp.isoformat(),
                "date": est.timestamp.isoformat(),
                "vo2max": est.vo2max,
                "method": est.method
            }
            for est in estimates
        ]

        activities = self.db.query(Activity).options(
            joinedload(Activity.power_zones),
            joinedload(Activity.hr_zones)
        ).filter(
            Activity.user_id == user.id,
            Activity.start_time >= datetime.utcnow() - timedelta(days=days)
        ).all()

        total_seconds, intensity_mix, vo2_minutes = self._compute_intensity_distribution(activities)
        average_weekly_hours = 0.0
        if total_seconds > 0:
            average_weekly_hours = (total_seconds / 3600) / max(days / 7, 1)

        return {
            "period_days": days,
            "estimates": estimates_payload,
            "average_weekly_hours": round(average_weekly_hours, 2),
            "intensity_mix": intensity_mix,
            "vo2_minutes": round(vo2_minutes, 1)
        }

    def _validate_vo2max(
        self, 
        vo2_rel: float, 
        vo2_abs: float, 
        last_vals: List[float], 
        hr: Optional[float], 
        np_val: Optional[float]
    ) -> bool:
        """
        Validate VO2max estimate using multiple criteria.
        Based on your proven validation logic.
        """
        # 1. Range check: VO2max should be 40-75 ml/kg/min for athletes
        if not (45 <= vo2_rel <= 80):
            return False

        # 2. Heart rate sanity check
        if hr is None or hr < 110:
            return False

        # 3. Power-to-HR ratio check (avoid unrealistic values)
        if np_val is not None and (np_val / hr > 3.5):
            return False

        # 4. Consistency check with previous values (avoid huge jumps)
        if last_vals:
            avg_recent = sum(last_vals[-3:]) / min(3, len(last_vals))
            if abs(vo2_abs - avg_recent) > 600:  # allow slightly larger jumps for breakthroughs
                return False
        
        return True

    def estimate_vo2max_from_activity(self, activity: Activity, user: User) -> Optional[float]:
        """
        Legacy method - kept for backward compatibility.
        Simplified single-activity estimation.
        """
        weight = user.weight or 70.0
        max_hr = user.hr_max or 190
        
        # Method 1: From 5-min power (Midgley et al. 2007)
        if activity.max_5min_power:
            vo2_rel = (15 * activity.max_5min_power) / weight
            if 40 <= vo2_rel <= 75:
                return vo2_rel
        
        # Method 2: From NP/HR ratio during intense efforts
        if (activity.normalized_power and activity.avg_heart_rate and 
            activity.intensity_factor and activity.intensity_factor >= 0.75 and
            activity.duration and activity.duration >= 300):
            
            factor = 10.8
            vo2_estimate = (activity.normalized_power / weight) * factor + 7
            
            hr_factor = activity.avg_heart_rate / max_hr
            if hr_factor >= 0.75:
                vo2_estimate *= (0.9 + hr_factor * 0.2)
            
            if 40 <= vo2_estimate <= 75:
                return vo2_estimate
        
        # Method 3: From 20min power
        if activity.max_20min_power:
            vo2_rel = (activity.max_20min_power / weight) * 10.8 + 5
            if 40 <= vo2_rel <= 75:
                return vo2_rel

        return None

    def _compute_intensity_distribution(self, activities: List[Activity]) -> Tuple[float, Dict[str, float], float]:
        buckets = {
            "recovery": 0.0,
            "aerobic": 0.0,
            "tempo": 0.0,
            "threshold": 0.0,
            "vO2": 0.0
        }
        total_seconds = 0.0
        vo2_minutes = 0.0

        def add_to_bucket(bucket_key, seconds):
            if seconds <= 0:
                return
            buckets[bucket_key] += seconds

        for activity in activities:
            zones_added = False

            # Prefer power zone data if present
            if activity.power_zones:
                for zone in activity.power_zones:
                    label = (zone.zone_label or '').lower()
                    seconds = int(zone.seconds_in_zone or 0)
                    total_seconds += seconds
                    zones_added = True

                    if 'z5' in label or 'anaerobic' in label or 'neuromuscular' in label:
                        add_to_bucket('vO2', seconds)
                        vo2_minutes += seconds / 60.0
                    elif 'z4' in label or 'threshold' in label:
                        add_to_bucket('threshold', seconds)
                        vo2_minutes += seconds / 60.0
                    elif 'z3' in label or 'tempo' in label:
                        add_to_bucket('tempo', seconds)
                    elif 'z2' in label or 'endurance' in label:
                        add_to_bucket('aerobic', seconds)
                    else:
                        add_to_bucket('recovery', seconds)

            # Fallback to HR zones if no power zones
            if not zones_added and activity.hr_zones:
                for zone in activity.hr_zones:
                    label = (zone.zone_label or '').lower()
                    seconds = int(zone.seconds_in_zone or 0)
                    total_seconds += seconds
                    zones_added = True

                    if 'z5' in label or 'max' in label or 'anaerobic' in label:
                        add_to_bucket('vO2', seconds)
                        vo2_minutes += seconds / 60.0
                    elif 'z4' in label or 'threshold' in label:
                        add_to_bucket('threshold', seconds)
                        vo2_minutes += seconds / 60.0
                    elif 'z3' in label:
                        add_to_bucket('tempo', seconds)
                    elif 'z2' in label:
                        add_to_bucket('aerobic', seconds)
                    else:
                        add_to_bucket('recovery', seconds)

            # Final fallback to activity intensity factor
            if not zones_added:
                duration = float(activity.duration or 0)
                if duration <= 0:
                    continue
                total_seconds += duration
                intensity_factor = activity.intensity_factor or 0

                if intensity_factor >= 1.05:
                    add_to_bucket('vO2', duration)
                    vo2_minutes += duration / 60.0
                elif intensity_factor >= 0.9:
                    add_to_bucket('threshold', duration)
                    vo2_minutes += duration / 60.0
                elif intensity_factor >= 0.75:
                    add_to_bucket('tempo', duration)
                elif intensity_factor >= 0.6:
                    add_to_bucket('aerobic', duration)
                else:
                    add_to_bucket('recovery', duration)

        distribution = {}
        if total_seconds > 0:
            for key, value in buckets.items():
                distribution[key] = round((value / total_seconds) * 100, 2)
        else:
            distribution = {key: 0.0 for key in buckets}

        return total_seconds, distribution, vo2_minutes
