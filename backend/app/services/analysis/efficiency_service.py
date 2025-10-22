import pandas as pd
from typing import List, NamedTuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ...database.models import User, Activity

class EfficiencyData(NamedTuple):
    start_time: datetime
    normalized_power: float
    avg_heart_rate: float
    intensity_factor: float
    ef: float

class EfficiencyService:
    def __init__(self, db: Session):
        self.db = db

    def get_efficiency_factors(self, user: User, days: int = 120) -> List[EfficiencyData]:
        """Get efficiency factors for user activities."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        activities = self.db.query(Activity).filter(
            and_(
                Activity.user_id == user.id,
                Activity.start_time >= start_date,
                Activity.normalized_power.isnot(None),
                Activity.avg_heart_rate.isnot(None),
                Activity.intensity_factor.isnot(None),
                Activity.avg_heart_rate > 60
            )
        ).order_by(Activity.start_time).all()

        results = []
        for activity in activities:
            if activity.normalized_power and activity.avg_heart_rate:
                ef = activity.normalized_power / activity.avg_heart_rate
                if ef < 3.0:  # Filter unrealistic values
                    results.append(EfficiencyData(
                        start_time=activity.start_time,
                        normalized_power=activity.normalized_power,
                        avg_heart_rate=activity.avg_heart_rate,
                        intensity_factor=activity.intensity_factor,
                        ef=round(ef, 3)
                    ))

        return results

    def get_efficiency_trend(self, user: User, days: int = 120) -> dict:
        """Get efficiency trend analysis."""
        efficiency_data = self.get_efficiency_factors(user, days)
        
        if not efficiency_data:
            return {"trend": "no_data", "current_ef": 0, "avg_ef": 0}

        # Filter GA1 workouts (IF < 0.75) for better efficiency analysis
        ga1_workouts = [e for e in efficiency_data if e.intensity_factor < 0.75]
        
        if len(ga1_workouts) < 2:
            return {"trend": "insufficient_data", "current_ef": 0, "avg_ef": 0}

        recent_ef = sum(e.ef for e in ga1_workouts[-3:]) / len(ga1_workouts[-3:])
        early_ef = sum(e.ef for e in ga1_workouts[:3]) / min(3, len(ga1_workouts))
        avg_ef = sum(e.ef for e in ga1_workouts) / len(ga1_workouts)
        
        trend_pct = ((recent_ef - early_ef) / early_ef) * 100 if early_ef > 0 else 0

        if trend_pct > 5:
            trend = "improving"
        elif trend_pct < -5:
            trend = "declining"
        else:
            trend = "stable"

        return {
            "trend": trend,
            "trend_percentage": round(trend_pct, 1),
            "current_ef": round(recent_ef, 3),
            "avg_ef": round(avg_ef, 3),
            "total_workouts": len(ga1_workouts)
        }