"""
Comparative & historical analytics.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from .power_curve import PowerCurveService
from ...database.models import User, Activity


class ComparisonsService:
    def __init__(self, db: Session):
        self.db = db
        self.power_curve_service = PowerCurveService(db)

    def get_year_power_curve(self, user: User, year: int) -> Optional[List[float]]:
        start = datetime(year, 1, 1).date().isoformat()
        end = datetime(year, 12, 31).date().isoformat()
        return self.power_curve_service.get_user_power_curve(user, weighted=False, start_date=start, end_date=end)

    def get_period_ranges(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        compare_mode: str = "previous"
    ) -> Dict[str, datetime]:
        if not start_date or not end_date:
            today = datetime.utcnow()
            start_this = datetime(today.year, today.month, 1)
            end_this = today

            prev_month_end = start_this - timedelta(days=1)
            start_prev = datetime(prev_month_end.year, prev_month_end.month, 1)
            end_prev = prev_month_end
        else:
            start_this = start_date
            end_this = end_date
            compare_mode = compare_mode if compare_mode in ("previous", "year") else "previous"

            if compare_mode == "year":
                start_prev = self._shift_year(start_this, -1)
                end_prev = self._shift_year(end_this, -1)
            else:
                delta = end_this - start_this
                prev_end = start_this - timedelta(days=1)
                start_prev = prev_end - delta
                end_prev = prev_end

        return {
            "current_start": start_this,
            "current_end": end_this,
            "previous_start": start_prev,
            "previous_end": end_prev
        }

    def get_period_summary(self, user: User, start: datetime, end: datetime) -> Dict:
        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start,
            Activity.start_time <= end
        ).all()

        total_distance = sum(a.distance or 0 for a in activities)
        total_duration = sum(a.duration or 0 for a in activities)
        total_tss = sum(a.tss or 0 for a in activities)

        return {
            "start": start.date().isoformat(),
            "end": end.date().isoformat(),
            "sessions": len(activities),
            "distance_km": round(total_distance, 1),
            "duration_hours": round(total_duration / 3600, 2) if total_duration else 0.0,
            "total_tss": round(total_tss, 1)
        }

    def get_period_comparison(
        self,
        user: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        compare_mode: str = "previous"
    ) -> Dict:
        ranges = self.get_period_ranges(start_date, end_date, compare_mode)
        start_this = ranges["current_start"]
        end_this = ranges["current_end"]
        start_prev = ranges["previous_start"]
        end_prev = ranges["previous_end"]

        return {
            "current": self.get_period_summary(user, start_this, end_this),
            "previous": self.get_period_summary(user, start_prev, end_prev)
        }

    def get_pr_timeline(
        self,
        user: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        only_changes: bool = False
    ) -> List[Dict]:
        query = self.db.query(Activity).filter(Activity.user_id == user.id)
        if start_date:
            query = query.filter(Activity.start_time >= start_date)
        if end_date:
            query = query.filter(Activity.start_time <= end_date)
        activities = query.order_by(Activity.start_time).all()

        best_5 = 0.0
        best_20 = 0.0
        timeline = []

        for activity in activities:
            if not activity.start_time:
                continue
            prev_best_5 = best_5
            prev_best_20 = best_20
            if activity.max_5min_power and activity.max_5min_power > best_5:
                best_5 = activity.max_5min_power
            if activity.max_20min_power and activity.max_20min_power > best_20:
                best_20 = activity.max_20min_power

            if only_changes and best_5 == prev_best_5 and best_20 == prev_best_20:
                continue

            timeline.append({
                "date": activity.start_time.date().isoformat(),
                "best_5min": round(best_5, 1) if best_5 else None,
                "best_20min": round(best_20, 1) if best_20 else None
            })

        return timeline[-200:]

    def get_ftp_progression(
        self,
        user: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        months: int = 24
    ) -> List[Dict]:
        end_date = end_date or datetime.utcnow()
        start_date = start_date or (end_date - timedelta(days=months * 30))

        rows = self.db.query(
            Activity.start_time,
            Activity.max_20min_power
        ).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date,
            Activity.start_time <= end_date,
            Activity.start_time.isnot(None)
        ).order_by(Activity.start_time).all()

        monthly_best: Dict[str, float] = {}
        for start_time, best_20 in rows:
            if not start_time:
                continue
            month_key = start_time.strftime("%Y-%m")
            best_val = float(best_20 or 0)
            if best_val <= 0:
                continue
            current_best = monthly_best.get(month_key, 0)
            if best_val > current_best:
                monthly_best[month_key] = best_val

        progression = []
        for month in sorted(monthly_best.keys()):
            best_20 = monthly_best[month]
            est_ftp = round(best_20 * 0.95, 1) if best_20 else None
            progression.append({
                "month": month,
                "estimated_ftp": est_ftp
            })

        return progression

    def get_seasonal_volume(
        self,
        user: User,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        years: int = 2
    ) -> List[Dict]:
        end_date = end_date or datetime.utcnow()
        start_date = start_date or (end_date - timedelta(days=years * 365))

        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date,
            Activity.start_time <= end_date
        ).all()

        buckets = {}
        for activity in activities:
            if not activity.start_time:
                continue
            month = activity.start_time.month
            year = activity.start_time.year
            season = self._season_label(month)
            key = f"{year}-{season}"
            if key not in buckets:
                buckets[key] = {"season": season, "year": year, "duration": 0.0, "tss": 0.0}
            buckets[key]["duration"] += activity.duration or 0
            buckets[key]["tss"] += activity.tss or 0

        result = []
        for key, item in buckets.items():
            result.append({
                "label": f"{item['season']} {item['year']}",
                "duration_hours": round(item["duration"] / 3600, 2) if item["duration"] else 0.0,
                "total_tss": round(item["tss"], 1)
            })

        result.sort(key=lambda r: r["label"])
        return result

    def get_period_power_bests(
        self,
        user: User,
        start_date: Optional[datetime],
        end_date: Optional[datetime]
    ) -> Dict:
        query = self.db.query(
            func.max(Activity.max_5min_power).label("best_5"),
            func.max(Activity.max_20min_power).label("best_20")
        ).filter(Activity.user_id == user.id)

        if start_date:
            query = query.filter(Activity.start_time >= start_date)
        if end_date:
            query = query.filter(Activity.start_time <= end_date)

        best_5, best_20 = query.first() or (None, None)
        return {
            "best_5min": round(best_5, 1) if best_5 else None,
            "best_20min": round(best_20, 1) if best_20 else None
        }

    @staticmethod
    def _season_label(month: int) -> str:
        if month in (12, 1, 2):
            return "Winter"
        if month in (3, 4, 5):
            return "Spring"
        if month in (6, 7, 8):
            return "Summer"
        return "Fall"

    @staticmethod
    def _shift_year(value: datetime, delta: int) -> datetime:
        try:
            return value.replace(year=value.year + delta)
        except ValueError:
            # Handle Feb 29th by shifting to Feb 28th
            return value.replace(month=2, day=28, year=value.year + delta)
