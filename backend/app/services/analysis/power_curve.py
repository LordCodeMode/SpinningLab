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

    def get_user_power_curve(self, user: User, weighted: bool = False, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Optional[List[float]]:
        """Get power curve for a user, optionally filtered by date range."""
        from datetime import datetime, timedelta

        # Build query with date filters
        query = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.avg_power.isnot(None)
        )

        # Apply date filters if provided
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(Activity.start_time >= start_dt)
                print(f"[PowerCurve] Filtering from date: {start_dt}")
            except ValueError:
                print(f"Invalid start date format: {start_date}")

        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                # Include the full end day (until 23:59:59)
                end_dt = end_dt + timedelta(days=1) - timedelta(seconds=1)
                query = query.filter(Activity.start_time <= end_dt)
                print(f"[PowerCurve] Filtering to date: {end_dt}")
            except ValueError:
                print(f"Invalid end date format: {end_date}")

        activities = query.all()
        print(f"[PowerCurve] Found {len(activities)} activities with power data in date range")

        all_curves = []
        skipped_no_filename = 0
        skipped_no_power_values = 0
        skipped_too_short = 0

        for activity in activities:
            if not activity.file_name:
                skipped_no_filename += 1
                continue

            # For now, create a synthetic power curve from best power values
            # In a real implementation, you'd read the actual FIT files
            power_values = self.create_synthetic_power_curve(activity)

            if not power_values:
                skipped_no_power_values += 1
                continue

            if weighted and user.weight:
                power_values = [p / user.weight for p in power_values if p]

            if len(power_values) < 30:
                skipped_too_short += 1
                continue

            curve = self.compute_power_curve(power_values)
            if curve:
                all_curves.append(curve)

        print(f"[PowerCurve] Processed activities - Valid curves: {len(all_curves)}, Skipped (no filename): {skipped_no_filename}, Skipped (no power): {skipped_no_power_values}, Skipped (too short): {skipped_too_short}")

        if not all_curves:
            print(f"[PowerCurve] No valid power curves generated from {len(activities)} activities")
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
        # Check if activity has any power data at all
        if not activity.avg_power or activity.avg_power <= 0:
            return []

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

        # Check if we have at least some best power values
        has_power_data = any(v and v > 0 for v in best_powers.values())
        if not has_power_data:
            # If no best power values, we can't create a meaningful curve
            return []

        # Interpolate between known values
        power_curve = []
        duration = activity.duration or 3600

        if duration <= 0:
            return []

        for i in range(1, min(int(duration) + 1, 3601)):
            # Find the best power for this duration by interpolation
            power = self.interpolate_power(i, best_powers, activity.avg_power)
            if power and power > 0:
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
        
    
    