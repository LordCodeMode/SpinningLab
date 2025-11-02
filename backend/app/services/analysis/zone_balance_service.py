from typing import Dict, List, NamedTuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from ...database.models import User, Activity, PowerZone
# Import canonical zone definitions
from shared.constants.training_zones import POWER_ZONES

class ZoneBalance(NamedTuple):
    zone_label: str
    actual_percentage: float
    target_percentage: float
    deviation: float
    watt_range: str
    status: str

class ZoneBalanceService:
    def __init__(self, db: Session):
        self.db = db

    TRAINING_MODELS = {
        "polarized": {
            "Z1 (Recovery)": 10,
            "Z2 (Endurance)": 65,
            "Z3 (Tempo)": 5,
            "Z4 (Threshold)": 10,
            "Z5 (VO2max)": 10
        },
        "sweet_spot": {
            "Z1 (Recovery)": 10,
            "Z2 (Endurance)": 35,
            "Z3 (Tempo)": 25,
            "Z4 (Threshold)": 25,
            "Z5 (VO2max)": 5
        },
        "high_intensity": {
            "Z1 (Recovery)": 5,
            "Z2 (Endurance)": 30,
            "Z3 (Tempo)": 15,
            "Z4 (Threshold)": 25,
            "Z5 (VO2max)": 25
        }
    }

    def analyze_zone_balance(self, user: User, model: str = "polarized", weeks: int = 4) -> List[ZoneBalance]:
        """Analyze zone balance against target model."""
        if model not in self.TRAINING_MODELS:
            model = "polarized"

        target_zones = self.TRAINING_MODELS[model]
        start_date = datetime.utcnow() - timedelta(weeks=weeks)

        # Get actual zone distribution
        zone_data = self.db.query(
            PowerZone.zone_label,
            func.sum(PowerZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(
            and_(
                Activity.user_id == user.id,
                Activity.start_time >= start_date
            )
        ).group_by(PowerZone.zone_label).all()

        total_time = sum(row.total_seconds for row in zone_data) or 1
        actual_distribution = {
            row.zone_label: (row.total_seconds / total_time) * 100
            for row in zone_data
        }

        results = []
        ftp = user.ftp or 250

        # Use canonical power zone definitions
        for zone_label in POWER_ZONES.keys():
            actual_pct = actual_distribution.get(zone_label, 0)
            target_pct = target_zones.get(zone_label, 0)
            deviation = actual_pct - target_pct

            # Determine status
            if abs(deviation) <= 5:
                status = "balanced"
            elif deviation > 5:
                status = "excess"
            else:
                status = "deficit"

            # Calculate watt range
            low_factor, high_factor = POWER_ZONES[zone_label]
            watt_range = f"{int(low_factor * ftp)}-{int(high_factor * ftp)} W"

            results.append(ZoneBalance(
                zone_label=zone_label,
                actual_percentage=round(actual_pct, 1),
                target_percentage=target_pct,
                deviation=round(deviation, 1),
                watt_range=watt_range,
                status=status
            ))

        return results

    def get_recommendations(self, zone_balance: List[ZoneBalance], model: str) -> List[str]:
        """Get training recommendations based on zone balance."""
        recommendations = []

        excess_zones = [zb for zb in zone_balance if zb.status == "excess" and abs(zb.deviation) > 10]
        deficit_zones = [zb for zb in zone_balance if zb.status == "deficit" and abs(zb.deviation) > 10]

        if excess_zones:
            for zone in excess_zones:
                if "Z1" in zone.zone_label or "Z2" in zone.zone_label:
                    recommendations.append(f"Consider adding more intensity - you have excess {zone.zone_label} time")
                else:
                    recommendations.append(f"Reduce {zone.zone_label} training - you're above target")

        if deficit_zones:
            for zone in deficit_zones:
                if "Z1" in zone.zone_label or "Z2" in zone.zone_label:
                    recommendations.append(f"Add more base/recovery training ({zone.zone_label})")
                else:
                    recommendations.append(f"Include more {zone.zone_label} sessions in your training")

        if not recommendations:
            recommendations.append("Your zone distribution looks well-balanced!")

        return recommendations