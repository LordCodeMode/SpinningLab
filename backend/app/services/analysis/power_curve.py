import numpy as np
import pandas as pd
from typing import List, Optional
from sqlalchemy.orm import Session
from ...database.models import User, Activity
from ...services.fit_processing.power_metrics import rolling_best_powers
from fitparse import FitFile
import os
from ...core.config import settings

class PowerCurveService:
    def __init__(self, db: Session):
        self.db = db

    def compute_power_curve(self, power_series: List[float]) -> Optional[List[float]]:
        """Compute power curve from power series."""
        if not power_series or len(power_series) < 3:
            return None

        s = pd.Series(power_series, dtype="float64").dropna()
        if s.empty:
            return None

        curve = [
            round(s.rolling(window=i, min_periods=i).mean().max(), 2)
            for i in range(1, min(len(s) + 1, 3601))  # Limit to 1 hour
        ]
        return curve if any(pd.notna(v) for v in curve) else None

    def extract_power_series_from_file(self, file_path: str) -> List[float]:
        """Extract power series from FIT file."""
        try:
            fitfile = FitFile(file_path)
            power_values = []

            for rec in fitfile.get_messages("record"):
                row = {f.name: f.value for f in rec}
                val = row.get("power")

                if isinstance(val, (int, float)) and pd.notna(val) and val >= 0:
                    power_values.append(float(val))

            return power_values
        except Exception as e:
            print(f"Error extracting power from {file_path}: {e}")
            return []

    def get_user_power_curve(self, user: User, weighted: bool = False) -> Optional[List[float]]:
        """Get all-time power curve for a user."""
        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.avg_power.isnot(None)
        ).all()
        
        all_curves = []
        user_fit_dir = os.path.join(settings.FIT_FILES_DIR, str(user.id))
        
        for activity in activities:
            if not activity.file_name:
                continue
                
            # For now, create a synthetic power curve from best power values
            # In a real implementation, you'd read the actual FIT files
            power_values = self.create_synthetic_power_curve(activity)
            
            if weighted and user.weight:
                power_values = [p / user.weight for p in power_values if p]

            if power_values and len(power_values) > 30:
                curve = self.compute_power_curve(power_values)
                if curve:
                    all_curves.append(curve)

        if not all_curves:
            return None

        # Combine all curves to get maximum values
        max_len = max(len(c) for c in all_curves)
        padded_curves = [
            np.pad(c, (0, max_len - len(c)), constant_values=np.nan) 
            for c in all_curves
        ]
        
        return np.nanmax(padded_curves, axis=0).tolist()
    
    
    def create_synthetic_power_curve(self, activity: Activity) -> List[float]:
        """Create synthetic power curve from activity best power values."""
        # This is a simplified version - in reality you'd read the FIT file
        best_powers = {
            5: activity.max_5sec_power,
            60: activity.max_1min_power,
            180: activity.max_3min_power,
            300: activity.max_5min_power,
            600: activity.max_10min_power,
            1200: activity.max_20min_power,
            1800: activity.max_30min_power
        }
        
        # Interpolate between known values
        power_curve = []
        duration = activity.duration or 3600
        
        for i in range(1, min(int(duration) + 1, 3601)):
            # Find the best power for this duration by interpolation
            power = self.interpolate_power(i, best_powers, activity.avg_power or 200)
            power_curve.append(power)
        
        return power_curve
    
    def interpolate_power(self, duration: int, best_powers: dict, avg_power: float) -> float:
        """Interpolate power value for given duration."""
        # Simple interpolation logic
        if duration <= 5:
            return best_powers.get(5) or avg_power * 1.5
        elif duration <= 60:
            return best_powers.get(60) or avg_power * 1.2
        elif duration <= 300:
            return best_powers.get(300) or avg_power * 1.1
        elif duration <= 1200:
            return best_powers.get(1200) or avg_power
        else:
            return avg_power * 0.95
        
    
    