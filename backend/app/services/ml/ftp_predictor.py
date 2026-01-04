"""
FTP Prediction Service
Builds features from recent best efforts + load, and predicts FTP.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Tuple, List

import numpy as np
from sqlalchemy.orm import Session

from ..analysis.power_curve import PowerCurveService
from ..analysis.training_load import TrainingLoadService
from ...database.models import User, Activity

try:
    import joblib
except Exception:  # pragma: no cover - optional dependency
    joblib = None


MODEL_PATH = Path(__file__).resolve().parents[3] / "ml_models" / "ftp_predictor.pkl"


@dataclass
class FtpPrediction:
    predicted_ftp: float
    confidence: float
    features: Dict[str, float]
    model_version: str
    prediction_time: datetime


class FtpPredictor:
    """Predict FTP based on best efforts and recent training load."""

    def __init__(self, db: Session):
        self.db = db
        self.power_curve_service = PowerCurveService(db)
        self.training_load_service = TrainingLoadService(db)

    def extract_features(self, user: User, days: int = 90) -> Dict[str, float]:
        """Build feature vector for FTP prediction."""
        best_powers = self._get_best_efforts(user, days)
        ctl, recent_tss = self._get_load_features(user, days)

        return {
            "best_5min": best_powers.get("5min", 0.0),
            "best_8min": best_powers.get("8min", 0.0),
            "best_12min": best_powers.get("12min", 0.0),
            "best_20min": best_powers.get("20min", 0.0),
            "ctl": ctl,
            "recent_tss": recent_tss
        }

    def predict(self, user: User, days: int = 90) -> FtpPrediction:
        features = self.extract_features(user, days)
        model = self._load_model()

        if model is None:
            predicted, confidence = self._heuristic_prediction(features, user.ftp)
            model_version = "heuristic-v1"
        else:
            predicted, confidence = self._model_prediction(model, features)
            model_version = "ml-v1"

        return FtpPrediction(
            predicted_ftp=round(predicted, 1),
            confidence=round(confidence, 2),
            features=features,
            model_version=model_version,
            prediction_time=datetime.utcnow()
        )

    def _load_model(self):
        if not joblib or not MODEL_PATH.exists():
            return None
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            return None

    def _model_prediction(self, model, features: Dict[str, float]) -> Tuple[float, float]:
        values = np.array([[
            features["best_5min"],
            features["best_8min"],
            features["best_12min"],
            features["best_20min"],
            features["ctl"],
            features["recent_tss"]
        ]], dtype=float)

        if isinstance(model, dict) and "ensemble" in model:
            preds = [m.predict(values)[0] for m in model["ensemble"]]
            predicted = float(np.mean(preds))
            confidence = float(max(0.5, 1.0 - (np.std(preds) / max(predicted, 1.0))))
            return predicted, confidence

        predicted = float(model.predict(values)[0])
        return predicted, 0.7

    def _heuristic_prediction(self, features: Dict[str, float], current_ftp: float) -> Tuple[float, float]:
        # Use common FTP heuristics when ML model is unavailable.
        est_20min = features.get("best_20min", 0.0) * 0.95
        est_12min = features.get("best_12min", 0.0) * 0.9
        est_8min = features.get("best_8min", 0.0) * 0.9
        candidates = [v for v in [est_20min, est_12min, est_8min, current_ftp] if v > 0]
        predicted = float(np.mean(candidates)) if candidates else float(current_ftp or 0)
        return predicted, 0.55

    def _get_load_features(self, user: User, days: int) -> Tuple[float, float]:
        # Get CTL and recent TSS from training load service
        training_load = self.training_load_service.calculate_training_load(user, days=days)
        if not training_load:
            return 0.0, 0.0

        ctl = float(training_load[-1].ctl) if training_load else 0.0
        recent_tss = float(sum(item.tss for item in training_load[-7:])) if training_load else 0.0
        return ctl, recent_tss

    def _get_best_efforts(self, user: User, days: int) -> Dict[str, float]:
        # Prefer power curve if available for precise durations.
        curve = self._get_power_curve(user, days)
        best = {}

        if curve:
            best["5min"] = self._curve_value(curve, 300)
            best["8min"] = self._curve_value(curve, 480)
            best["12min"] = self._curve_value(curve, 720)
            best["20min"] = self._curve_value(curve, 1200)
        else:
            best = self._best_efforts_from_activity(user, days)

        return {
            "5min": float(best.get("5min", 0.0) or 0.0),
            "8min": float(best.get("8min", 0.0) or 0.0),
            "12min": float(best.get("12min", 0.0) or 0.0),
            "20min": float(best.get("20min", 0.0) or 0.0)
        }

    def _get_power_curve(self, user: User, days: int) -> Optional[List[float]]:
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)
        return self.power_curve_service.get_user_power_curve(
            user,
            weighted=False,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat()
        )

    @staticmethod
    def _curve_value(curve: List[float], seconds: int) -> float:
        if not curve or seconds <= 0:
            return 0.0
        idx = min(len(curve), seconds) - 1
        value = curve[idx]
        return float(value) if value is not None else 0.0

    def _best_efforts_from_activity(self, user: User, days: int) -> Dict[str, float]:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        query = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.start_time >= start_date
        )

        activities = query.all()
        best_5 = max((a.max_5min_power or 0 for a in activities), default=0)
        best_10 = max((a.max_10min_power or 0 for a in activities), default=0)
        best_20 = max((a.max_20min_power or 0 for a in activities), default=0)

        # Approximate 8min and 12min from 5/10/20 when curve unavailable.
        best_8 = best_10 * 1.02 if best_10 else best_5 * 0.95
        best_12 = (best_10 * 0.98 + best_20 * 0.05) if best_10 else best_20 * 1.02

        return {
            "5min": best_5,
            "8min": best_8,
            "12min": best_12,
            "20min": best_20
        }
