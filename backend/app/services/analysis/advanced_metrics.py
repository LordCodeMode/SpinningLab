"""
Additional performance metrics.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...database.models import Activity, PowerZone, User


class AdvancedMetricsService:
    def __init__(self, db: Session):
        self.db = db

    def variability_index(self, activity_id: int) -> Optional[Dict]:
        activity = self.db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity or not activity.avg_power or not activity.normalized_power:
            return None
        vi = activity.normalized_power / activity.avg_power if activity.avg_power else 0
        return {
            "activity_id": activity_id,
            "variability_index": round(vi, 3),
            "normalized_power": round(activity.normalized_power, 1),
            "avg_power": round(activity.avg_power, 1)
        }

    def polarized_distribution(self, user: User, days: int = 30) -> Dict:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        activities = self.db.query(Activity.id).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        ).all()
        activity_ids = [row[0] for row in activities]

        if not activity_ids:
            return {
                "days": days,
                "zone_1_2_seconds": 0,
                "zone_3_4_seconds": 0,
                "zone_5_plus_seconds": 0,
                "polarized_score": 0.0
            }

        zones = self.db.query(
            PowerZone.zone_label,
            func.sum(PowerZone.seconds_in_zone).label("seconds")
        ).filter(PowerZone.activity_id.in_(activity_ids)).group_by(PowerZone.zone_label).all()

        zone_map = {z: secs for z, secs in zones}
        z1 = zone_map.get("Z1", 0)
        z2 = zone_map.get("Z2", 0)
        z3 = zone_map.get("Z3", 0)
        z4 = zone_map.get("Z4", 0)
        z5 = zone_map.get("Z5", 0)
        z6 = zone_map.get("Z6", 0)
        z7 = zone_map.get("Z7", 0)

        low = z1 + z2
        mid = z3 + z4
        high = z5 + z6 + z7
        total = low + mid + high

        polarized_score = (low / total * 100) if total else 0.0

        return {
            "days": days,
            "zone_1_2_seconds": int(low),
            "zone_3_4_seconds": int(mid),
            "zone_5_plus_seconds": int(high),
            "polarized_score": round(polarized_score, 1)
        }
