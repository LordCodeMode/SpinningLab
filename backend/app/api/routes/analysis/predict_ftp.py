"""FTP prediction endpoint."""

from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.ml.ftp_predictor import FtpPredictor

router = APIRouter()


@router.post("")
def predict_ftp(
    days: int = Query(90, ge=14, le=365, description="Days of history for features"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        predictor = FtpPredictor(db)
        prediction = predictor.predict(current_user, days=days)

        delta = prediction.predicted_ftp - (current_user.ftp or 0.0)
        notification = None
        if delta >= 5:
            notification = f"Your estimated FTP has increased to {prediction.predicted_ftp:.0f}W"

        return {
            "predicted_ftp": prediction.predicted_ftp,
            "confidence": prediction.confidence,
            "model_version": prediction.model_version,
            "features": prediction.features,
            "current_ftp": current_user.ftp,
            "delta": round(delta, 1),
            "prediction_time": prediction.prediction_time.isoformat(),
            "notification": notification
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"FTP prediction failed: {exc}")
