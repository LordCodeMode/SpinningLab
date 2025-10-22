from typing import Optional, Dict, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from ...database.models import User, Activity, PowerZone, HrZone
from shared.models.schemas import ZoneDistributionResponse, ZoneData

POWER_ZONES = {
    "Z1 (Recovery)": (0.0, 0.55),
    "Z2 (Endurance)": (0.55, 0.75),
    "Z3 (Tempo)": (0.75, 0.90),
    "Z4 (Threshold)": (0.90, 1.05),
    "Z5 (VO2max)": (1.05, 1.20),
    "Z6 (Anaerobic)": (1.20, 1.50),
    "Z7 (Sprint)": (1.50, 10.0)
}

HR_ZONES = {
    "Z1 (Recovery)": (0.50, 0.60),
    "Z2 (Endurance)": (0.60, 0.70),
    "Z3 (GA2)": (0.70, 0.80),
    "Z4 (Threshold)": (0.80, 0.90),
    "Z5 (VO2max)": (0.90, 1.00),
}

class ZoneAnalysisService:
    def __init__(self, db: Session):
        self.db = db

    def get_power_zone_distribution(self, user: User, days: Optional[int] = None) -> ZoneDistributionResponse:
        """Get power zone distribution for user."""
        query = self.db.query(
            PowerZone.zone_label,
            func.sum(PowerZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(Activity.user_id == user.id)

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Activity.start_time >= start_date)

        results = query.group_by(PowerZone.zone_label).all()

        zone_data = []
        total_time = sum(result.total_seconds for result in results)

        for zone_label in POWER_ZONES.keys():
            seconds = next(
                (result.total_seconds for result in results if result.zone_label == zone_label),
                0
            )
            
            low_factor, high_factor = POWER_ZONES[zone_label]
            watt_range = f"{int(low_factor * user.ftp)}–{int(high_factor * user.ftp)} W"
            
            zone_data.append(ZoneData(
                zone_label=zone_label,
                seconds_in_zone=seconds,
                percentage=round((seconds / total_time * 100), 1) if total_time > 0 else 0,
                watt_range=watt_range
            ))

        return ZoneDistributionResponse(
            zone_data=zone_data,
            total_time=total_time,
            period_days=days
        )

    def get_hr_zone_distribution(self, user: User, days: Optional[int] = None) -> ZoneDistributionResponse:
        """Get heart rate zone distribution for user."""
        query = self.db.query(
            HrZone.zone_label,
            func.sum(HrZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(Activity.user_id == user.id)

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Activity.start_time >= start_date)

        results = query.group_by(HrZone.zone_label).all()

        zone_data = []
        total_time = sum(result.total_seconds for result in results)

        for zone_label in HR_ZONES.keys():
            seconds = next(
                (result.total_seconds for result in results if result.zone_label == zone_label),
                0
            )
            
            low_factor, high_factor = HR_ZONES[zone_label]
            hr_range = f"{int(low_factor * user.hr_max)}–{int(high_factor * user.hr_max)} bpm"
            
            zone_data.append(ZoneData(
                zone_label=zone_label,
                seconds_in_zone=seconds,
                percentage=round((seconds / total_time * 100), 1) if total_time > 0 else 0,
                hr_range=hr_range
            ))

        return ZoneDistributionResponse(
            zone_data=zone_data,
            total_time=total_time,
            period_days=days
        )