from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from sqlalchemy import func

from ...database.models import User, Activity, HrZone
# Import canonical zone definitions
from shared.constants.training_zones import HEART_RATE_ZONES

class HeartRateService:
    def __init__(self, db: Session):
        self.db = db

    def get_hr_zone_distribution(self, user: User, days: Optional[int] = None) -> Dict:
        """Get heart rate zone distribution."""
        query = self.db.query(
            HrZone.zone_label,
            func.sum(HrZone.seconds_in_zone).label('total_seconds')
        ).join(Activity).filter(Activity.user_id == user.id)

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Activity.start_time >= start_date)

        results = query.group_by(HrZone.zone_label).all()

        zone_data = []
        total_time = sum(result.total_seconds for result in results) or 1
        max_hr = user.hr_max or 190

        # Use canonical HR zone definitions
        all_zones = list(HEART_RATE_ZONES.keys())
        zone_ranges = HEART_RATE_ZONES
        
        for zone_label in all_zones:
            seconds = next(
                (result.total_seconds for result in results if result.zone_label == zone_label),
                0
            )
            
            low_factor, high_factor = zone_ranges.get(zone_label, (0, 0))
            hr_range = f"{int(low_factor * max_hr)}-{int(high_factor * max_hr)} bpm"
            
            zone_data.append({
                "zone_label": zone_label,
                "seconds_in_zone": seconds,
                "percentage": round((seconds / total_time * 100), 1),
                "hr_range": hr_range
            })

        return {
            "zone_data": zone_data,
            "total_time": total_time,
            "period_days": days,
            "max_hr": max_hr
        }

    def get_efficiency_trend(self, user: User, days: int = 90) -> List[Dict]:
        """Calculate efficiency factor trend."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date,
            Activity.efficiency_factor.isnot(None),
            Activity.intensity_factor < 0.75  # GA1 efforts only
        ).order_by(Activity.start_time).all()
        
        trend_data = []
        for activity in activities:
            trend_data.append({
                "date": activity.start_time.isoformat(),
                "efficiency_factor": round(activity.efficiency_factor, 3),
                "normalized_power": activity.normalized_power,
                "avg_heart_rate": activity.avg_heart_rate,
                "intensity_factor": activity.intensity_factor
            })
        
        return trend_data