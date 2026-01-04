"""
Decoupling analysis (power/HR drift).
Computes change in power-to-HR ratio across workout halves.
"""

from __future__ import annotations

from typing import Dict, Optional, List
from sqlalchemy.orm import Session
from fitparse import FitFile
import os
import json
import pandas as pd

from .power_curve import PowerCurveService
from ...database.models import Activity
from ...core.config import settings


class DecouplingService:
    def __init__(self, db: Session):
        self.db = db
        self.power_curve_service = PowerCurveService(db)

    def analyze_activity(self, activity_id: int) -> Optional[Dict]:
        activity = self.db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return None

        power_series = self.power_curve_service.get_power_series(activity)
        hr_series = self._get_hr_series(activity)

        if not power_series or not hr_series:
            return None

        length = min(len(power_series), len(hr_series))
        if length < 600:
            return None

        power_series = power_series[:length]
        hr_series = hr_series[:length]

        half = length // 2
        power_first = sum(power_series[:half]) / half
        power_last = sum(power_series[half:]) / (length - half)
        hr_first = sum(hr_series[:half]) / half
        hr_last = sum(hr_series[half:]) / (length - half)

        if hr_first <= 0 or power_first <= 0:
            return None

        ratio_first = power_first / hr_first
        ratio_last = power_last / hr_last
        decoupling = ((ratio_last - ratio_first) / ratio_first) * 100

        return {
            "activity_id": activity_id,
            "power_first": round(power_first, 1),
            "power_last": round(power_last, 1),
            "hr_first": round(hr_first, 1),
            "hr_last": round(hr_last, 1),
            "decoupling_percent": round(decoupling, 2)
        }

    def _get_hr_series(self, activity: Activity) -> List[float]:
        fit_path = getattr(activity, "get_fit_path", lambda: None)()
        if fit_path and os.path.exists(fit_path):
            return self._extract_hr_from_fit(fit_path)

        stream = self._extract_hr_from_stream_json(activity)
        if stream:
            return stream

        return []

    @staticmethod
    def _extract_hr_from_fit(file_path: str) -> List[float]:
        try:
            fitfile = FitFile(file_path)
            hr_values = []
            for rec in fitfile.get_messages("record"):
                row = {f.name: f.value for f in rec}
                val = row.get("heart_rate")
                if isinstance(val, (int, float)) and pd.notna(val) and val > 0:
                    hr_values.append(float(val))
            return hr_values
        except Exception:
            return []

    @staticmethod
    def _extract_hr_from_stream_json(activity: Activity) -> List[float]:
        stream_path = os.path.join(settings.FIT_FILES_DIR, "streams", f"{activity.strava_activity_id or activity.id}.json")
        if not os.path.exists(stream_path):
            return []
        try:
            with open(stream_path, "r") as f:
                raw = json.load(f)
        except Exception:
            return []

        def get_stream(name):
            stream = raw.get(name, {})
            data = stream.get("data") if isinstance(stream, dict) else None
            return data if isinstance(data, list) else []

        time_stream = get_stream("time")
        hr_stream = get_stream("heartrate") or get_stream("heart_rate")
        if not hr_stream:
            return []

        try:
            if time_stream:
                base = float(time_stream[0])
                elapsed = [float(t) - base for t in time_stream]
                series = pd.Series(hr_stream, index=pd.to_timedelta(elapsed, unit="s"))
                resampled = series.resample("1S").mean().interpolate(limit_direction="both")
                return resampled.dropna().tolist()
            return [float(h) for h in hr_stream if h is not None]
        except Exception:
            return []
