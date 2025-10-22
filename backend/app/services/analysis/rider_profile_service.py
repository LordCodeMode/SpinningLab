from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from ...database.models import User, Activity

class RiderProfileService:
    def __init__(self, db: Session):
        self.db = db

    # ADD THIS METHOD - this is what the API is calling
    def analyze_rider_profile(self, user: User) -> Dict:
        """Analyze rider profile - API endpoint method"""
        return self.calculate_rider_profile(user) or {
            "rider_type": "Unknown",
            "confidence": 0,
            "power_profile": {},
            "recommendations": []
        }

    def calculate_rider_profile(self, user: User) -> Optional[Dict]:
        """Calculate rider type profile based on power ratios."""
        # Get best power values
        best_values = self.db.query(
            func.max(Activity.max_5sec_power).label('max_5sec'),
            func.max(Activity.max_1min_power).label('max_1min'), 
            func.max(Activity.max_5min_power).label('max_5min'),
            func.max(Activity.max_20min_power).label('max_20min')
        ).filter(Activity.user_id == user.id).first()

        if not best_values or not best_values.max_20min:
            return None

        # Calculate power ratios relative to 20-min power (FTP proxy)
        ftp_proxy = best_values.max_20min
        
        profile = {
            "sprint_5s": round((best_values.max_5sec or 0) / ftp_proxy, 2) if best_values.max_5sec else 1.0,
            "anaerobic_1min": round((best_values.max_1min or 0) / ftp_proxy, 2) if best_values.max_1min else 1.0,
            "vo2max_5min": round((best_values.max_5min or 0) / ftp_proxy, 2) if best_values.max_5min else 1.0,
            "ftp_20min": 1.00
        }

        # Determine rider type and confidence
        rider_type, confidence = self._classify_rider_type(profile)
        recommendations = self._get_recommendations(rider_type)

        return {
            "rider_type": rider_type,
            "confidence": confidence,
            "power_profile": profile,
            "recommendations": recommendations,
            "best_values": {
                "max_5sec_power": best_values.max_5sec,
                "max_1min_power": best_values.max_1min,
                "max_5min_power": best_values.max_5min,
                "max_20min_power": best_values.max_20min
            }
        }

    def _classify_rider_type(self, profile: Dict[str, float]) -> tuple:
        """Classify rider type and return confidence score."""
        sprint = profile.get("sprint_5s", 0)
        anaerobic = profile.get("anaerobic_1min", 0)
        vo2max = profile.get("vo2max_5min", 0)

        if sprint > 1.7 and vo2max < 1.15:
            return "Sprinter", 85
        elif vo2max > 1.4 and sprint < 1.3:
            return "Climber", 80
        elif anaerobic > 1.35 and vo2max > 1.3:
            return "Puncheur", 75
        elif sprint < 1.2 and anaerobic < 1.15 and vo2max < 1.25:
            return "Time Trialist", 70
        else:
            return "All-rounder", 60

    def _get_recommendations(self, rider_type: str) -> List[str]:
        """Get training recommendations based on rider type."""
        recommendations = {
            "Sprinter": [
                "Focus on explosive power development",
                "Include sprint intervals in training", 
                "Work on neuromuscular power"
            ],
            "Climber": [
                "Develop sustained power at threshold",
                "Include long climbing intervals",
                "Focus on power-to-weight ratio"
            ],
            "Puncheur": [
                "Train short, intense efforts",
                "Work on anaerobic capacity", 
                "Practice explosive attacks"
            ],
            "Time Trialist": [
                "Focus on sustained threshold power",
                "Work on aerodynamic position",
                "Train long steady efforts"
            ],
            "All-rounder": [
                "Maintain balanced training approach",
                "Work on all energy systems",
                "Adapt training to race demands"
            ]
        }
        return recommendations.get(rider_type, ["Continue balanced training"])