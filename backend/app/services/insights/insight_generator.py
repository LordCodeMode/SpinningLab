"""
Insight Generator Service
Rule-based training insights and anomaly detection.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Dict

from sqlalchemy.orm import Session

from ...database.models import User, Activity
from ..analysis.training_load import TrainingLoadService


class InsightGenerator:
    def __init__(self, db: Session):
        self.db = db
        self.training_load_service = TrainingLoadService(db)

    def generate_insights(self, user: User, days: int = 14) -> List[Dict]:
        insights: List[Dict] = []
        insights.extend(self._fatigue_insight(user, days))
        insights.extend(self._ramp_rate_insight(user, days))
        insights.extend(self._breakthrough_insight(user, days))
        insights.extend(self._weekday_pattern_insight(user, days=90))
        return insights

    def weekly_summary(self, user: User, days: int = 7) -> Dict:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        ).all()

        total_distance = sum(a.distance or 0 for a in activities)
        total_duration = sum(a.duration or 0 for a in activities)
        total_tss = sum(a.tss or 0 for a in activities)

        return {
            "start_date": start_date.date().isoformat(),
            "end_date": end_date.date().isoformat(),
            "sessions": len(activities),
            "distance_km": round(total_distance, 1),
            "duration_hours": round(total_duration / 3600, 2) if total_duration else 0.0,
            "total_tss": round(total_tss, 1)
        }

    def _fatigue_insight(self, user: User, days: int) -> List[Dict]:
        training_load = self.training_load_service.calculate_training_load(user, days=days)
        if not training_load:
            return []

        tsb = training_load[-1].tsb
        if tsb < -30:
            return [{
                "type": "fatigue",
                "severity": "high",
                "title": "High fatigue detected",
                "message": "Your TSB is below -30. Consider extra recovery or reducing intensity.",
                "value": round(tsb, 1)
            }]
        if tsb < -15:
            return [{
                "type": "fatigue",
                "severity": "moderate",
                "title": "Building fatigue",
                "message": "TSB is trending negative. Keep an eye on recovery.",
                "value": round(tsb, 1)
            }]
        return []

    def _ramp_rate_insight(self, user: User, days: int) -> List[Dict]:
        training_load = self.training_load_service.calculate_training_load(user, days=days)
        if len(training_load) < 14:
            return []

        last_week = training_load[-7:]
        prev_week = training_load[-14:-7]
        ctl_last = sum(t.ctl for t in last_week) / len(last_week)
        ctl_prev = sum(t.ctl for t in prev_week) / len(prev_week)
        delta = ctl_last - ctl_prev

        if delta > 5:
            return [{
                "type": "ramp",
                "severity": "warning",
                "title": "Aggressive ramp detected",
                "message": f"CTL increased by {delta:.1f} this week. Watch for overtraining.",
                "value": round(delta, 1)
            }]
        return []

    def _breakthrough_insight(self, user: User, days: int) -> List[Dict]:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        recent = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        ).all()

        if not recent:
            return []

        all_time = self.db.query(Activity).filter(
            Activity.user_id == user.id
        ).all()

        def best_power(activities, field):
            return max((getattr(a, field) or 0 for a in activities), default=0)

        insights = []
        for field, label in [("max_5min_power", "5-min"), ("max_20min_power", "20-min")]:
            recent_best = best_power(recent, field)
            all_best = best_power(all_time, field)
            if recent_best and recent_best >= all_best and all_best > 0:
                insights.append({
                    "type": "breakthrough",
                    "severity": "positive",
                    "title": "Breakthrough detected",
                    "message": f"New {label} power PR: {recent_best:.0f} W",
                    "value": round(recent_best, 1)
                })

        return insights

    def _weekday_pattern_insight(self, user: User, days: int = 90) -> List[Dict]:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        ).all()

        if not activities:
            return []

        by_day: Dict[int, List[float]] = {}
        for activity in activities:
            if not activity.start_time:
                continue
            day = activity.start_time.weekday()
            by_day.setdefault(day, []).append(activity.tss or 0)

        averages = {day: (sum(vals) / len(vals)) for day, vals in by_day.items() if vals}
        if len(averages) < 3:
            return []

        best_day = max(averages.items(), key=lambda item: item[1])
        avg_all = sum(averages.values()) / len(averages)

        if best_day[1] >= avg_all * 1.2:
            names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            return [{
                "type": "pattern",
                "severity": "info",
                "title": "Performance pattern",
                "message": f"You tend to perform best on {names[best_day[0]]}.",
                "value": round(best_day[1], 1)
            }]

        return []
