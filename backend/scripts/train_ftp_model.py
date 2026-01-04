"""
Train FTP prediction model.

Usage:
  python backend/scripts/train_ftp_model.py
"""

from pathlib import Path
from typing import List

import numpy as np

try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import LinearRegression
    import joblib
except Exception as exc:
    raise SystemExit("scikit-learn and joblib are required to train the model.") from exc

from app.database.connection import SessionLocal
from app.database.models import User
from app.services.ml.ftp_predictor import FtpPredictor, MODEL_PATH


def build_dataset() -> tuple[np.ndarray, np.ndarray]:
    db = SessionLocal()
    predictor = FtpPredictor(db)
    features: List[List[float]] = []
    targets: List[float] = []

    try:
        users = db.query(User).all()
        for user in users:
            if not user.ftp or user.ftp <= 0:
                continue
            feats = predictor.extract_features(user, days=180)
            row = [
                feats.get("best_5min", 0.0),
                feats.get("best_8min", 0.0),
                feats.get("best_12min", 0.0),
                feats.get("best_20min", 0.0),
                feats.get("ctl", 0.0),
                feats.get("recent_tss", 0.0)
            ]
            features.append(row)
            targets.append(float(user.ftp))
    finally:
        db.close()

    if not features:
        raise RuntimeError("No training data available.")

    return np.array(features, dtype=float), np.array(targets, dtype=float)


def train_and_save():
    X, y = build_dataset()

    rf = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        min_samples_leaf=max(1, len(y) // 20)
    )
    lr = LinearRegression()

    rf.fit(X, y)
    lr.fit(X, y)

    ensemble = [rf, lr]
    model = {"ensemble": ensemble}

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    train_and_save()
