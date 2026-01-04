"""
Fatigue Resistance analysis.
Compares early vs late power in a workout.
"""

from __future__ import annotations

from typing import Dict, Optional
from sqlalchemy.orm import Session

from .power_curve import PowerCurveService
from ...database.models import Activity


class FatigueResistanceService:
    def __init__(self, db: Session):
        self.db = db
        self.power_curve_service = PowerCurveService(db)

    def analyze_activity(self, activity_id: int) -> Optional[Dict]:
        activity = self.db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return None

        series = self.power_curve_service.get_power_series(activity)
        if not series or len(series) < 600:
            return None

        duration = len(series)
        segment = min(1200, duration // 2)  # up to 20 minutes
        if segment <= 0:
            return None

        first = series[:segment]
        last = series[-segment:]

        avg_first = sum(first) / len(first)
        avg_last = sum(last) / len(last)

        if avg_first <= 0:
            return None

        decay_pct = ((avg_first - avg_last) / avg_first) * 100
        ratio = avg_last / avg_first

        return {
            "activity_id": activity_id,
            "segment_minutes": round(segment / 60, 1),
            "avg_power_first": round(avg_first, 1),
            "avg_power_last": round(avg_last, 1),
            "fatigue_ratio": round(ratio, 3),
            "decay_percent": round(decay_pct, 2)
        }
