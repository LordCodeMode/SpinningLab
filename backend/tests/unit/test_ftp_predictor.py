from datetime import datetime, timedelta
from types import SimpleNamespace

from app.database.models import Activity
from app.services.ml import ftp_predictor as fp


class StubPowerCurveService:
    def __init__(self, db):
        self.db = db

    def get_user_power_curve(self, user, weighted=False, start_date=None, end_date=None):
        return [300.0] * 1200


class StubTrainingLoadService:
    def __init__(self, db):
        self.db = db

    def calculate_training_load(self, user, days=90):
        return [
            SimpleNamespace(ctl=40.0, tss=50.0),
            SimpleNamespace(ctl=42.0, tss=55.0),
            SimpleNamespace(ctl=45.0, tss=60.0),
        ]


class StubModel:
    def __init__(self, value):
        self.value = value

    def predict(self, values):
        return [self.value]


def test_extract_features_with_curve(test_db, test_user, monkeypatch):
    monkeypatch.setattr(fp, "PowerCurveService", StubPowerCurveService)
    monkeypatch.setattr(fp, "TrainingLoadService", StubTrainingLoadService)

    predictor = fp.FtpPredictor(test_db)
    features = predictor.extract_features(test_user, days=90)

    assert features["best_20min"] == 300.0
    assert features["ctl"] == 45.0
    assert features["recent_tss"] > 0


def test_predict_heuristic(test_db, test_user, monkeypatch):
    monkeypatch.setattr(fp, "PowerCurveService", StubPowerCurveService)
    monkeypatch.setattr(fp, "TrainingLoadService", StubTrainingLoadService)
    monkeypatch.setattr(fp.FtpPredictor, "_load_model", lambda self: None)

    predictor = fp.FtpPredictor(test_db)
    prediction = predictor.predict(test_user, days=90)
    assert prediction.predicted_ftp > 0
    assert prediction.model_version == "heuristic-v1"


def test_model_prediction_ensemble(test_db, test_user, monkeypatch):
    monkeypatch.setattr(fp, "PowerCurveService", StubPowerCurveService)
    monkeypatch.setattr(fp, "TrainingLoadService", StubTrainingLoadService)

    predictor = fp.FtpPredictor(test_db)
    model = {"ensemble": [StubModel(260.0), StubModel(280.0)]}
    predicted, confidence = predictor._model_prediction(model, {
        "best_5min": 300,
        "best_8min": 290,
        "best_12min": 280,
        "best_20min": 270,
        "ctl": 40,
        "recent_tss": 200,
    })
    assert predicted == 270.0
    assert 0.5 <= confidence <= 1.0


def test_best_efforts_from_activity(test_db, test_user):
    now = datetime.utcnow()
    activity = Activity(
        user_id=test_user.id,
        start_time=now - timedelta(days=1),
        duration=3600,
        avg_power=200,
        max_5min_power=300,
        max_10min_power=280,
        max_20min_power=260,
    )
    test_db.add(activity)
    test_db.commit()

    predictor = fp.FtpPredictor(test_db)
    efforts = predictor._best_efforts_from_activity(test_user, days=30)
    assert efforts["5min"] == 300
    assert efforts["20min"] == 260

