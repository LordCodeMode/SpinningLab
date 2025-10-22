import numpy as np
import pandas as pd
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
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
        
        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        ).order_by(Activity.start_time).all()
        
        estimates = []
        valid_values = []
        weight = user.weight or 70.0
        max_hr = user.hr_max or 190
        
        # Constants from your proven model
        factor_peak = 23.0
        drift_per_day = -0.03
        
        for activity in activities:
            ts = activity.start_time
            np_val = activity.normalized_power
            hr = activity.avg_heart_rate
            if_val = activity.intensity_factor
            dur = activity.duration
            p5 = activity.max_5min_power
            p10 = activity.max_10min_power
            
            estimation_done = False
            
            # Stage 1: High-intensity efforts (IF >= 0.75, 5-25 min, HR >= 75% max)
            if (np_val and hr and if_val and dur and
                if_val >= 0.75 and 300 <= dur <= 1500 and hr / max_hr >= 0.75):
                
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
            
            # Stage 2: Peak power efforts (Midgley et al. 2007: VO2max ≈ 15 × peak_power / weight)
            if not estimation_done:
                for p_peak in [p5, p10]:
                    if p_peak and p_peak > 0:
                        vo2_rel_peak = (15 * p_peak) / weight
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
            
            # Stage 3: Moderate efforts with decay interpolation (IF >= 0.6, >25 min, HR >= 65% max)
            if not estimation_done:
                if (np_val and hr and if_val and dur and
                    if_val >= 0.6 and dur >= 1500 and hr / max_hr >= 0.65 and valid_values):
                    
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
        if not (40 <= vo2_rel <= 75):
            return False
        
        # 2. Heart rate sanity check
        if hr is None or hr < 90:
            return False
        
        # 3. Power-to-HR ratio check (avoid unrealistic values)
        if np_val is not None and (np_val / hr > 3.0):
            return False
        
        # 4. Consistency check with previous values (avoid huge jumps)
        if last_vals:
            avg_recent = sum(last_vals[-3:]) / min(3, len(last_vals))
            if abs(vo2_abs - avg_recent) > 400:  # Max 400 ml/min jump
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