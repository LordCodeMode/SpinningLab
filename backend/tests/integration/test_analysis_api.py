from datetime import datetime, timedelta

import pytest

from app.database.models import Activity, PowerZone, HrZone


class FakeCacheManager:
    def __init__(self):
        self.store = {}

    def get(self, key, user_id, max_age_hours=None):
        return self.store.get((user_id, key))

    def set(self, key, user_id, value):
        self.store[(user_id, key)] = value
        return True

    def get_with_meta(self, key, user_id, max_age_hours=None):
        return self.get(key, user_id, max_age_hours), None


def _seed_activity(test_db, test_user):
    now = datetime.utcnow()
    activities = []
    for i in range(3):
        activity = Activity(
            user_id=test_user.id,
            start_time=now - timedelta(days=i + 1),
            duration=3600,
            distance=25 + i,
            avg_power=200 + i * 10,
            normalized_power=210 + i * 10,
            max_5sec_power=900,
            max_1min_power=600,
            max_3min_power=450,
            max_5min_power=400,
            max_10min_power=350,
            max_20min_power=300,
            max_30min_power=280,
            max_60min_power=250,
            avg_heart_rate=140,
            max_heart_rate=175,
            tss=60 + i * 5,
            intensity_factor=0.85,
        )
        activities.append(activity)
        test_db.add(activity)
    test_db.commit()
    test_db.refresh(activities[0])

    test_db.add_all([
        PowerZone(activity_id=activities[0].id, zone_label="Z1", seconds_in_zone=600),
        PowerZone(activity_id=activities[0].id, zone_label="Z2", seconds_in_zone=1200),
        HrZone(activity_id=activities[0].id, zone_label="Z1", seconds_in_zone=500),
        HrZone(activity_id=activities[0].id, zone_label="Z2", seconds_in_zone=800),
    ])
    test_db.commit()

    return activities[0]


@pytest.fixture
def cache_patch(monkeypatch):
    monkeypatch.setattr("app.services.cache.cache_manager.CacheManager", FakeCacheManager)


def test_power_curve_and_best_power(client, auth_headers, test_db, test_user, cache_patch):
    activity = _seed_activity(test_db, test_user)

    response = client.get("/api/analysis/power-curve?weighted=false", headers=auth_headers)
    assert response.status_code == 200
    assert "durations" in response.json()

    response = client.get("/api/analysis/best-power-values", headers=auth_headers)
    assert response.status_code == 200
    assert "max_20min_power" in response.json()

    response = client.get("/api/analysis/best-power-values/record?duration=300", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["duration_seconds"] == 300


def test_training_load_zones_fitness(client, auth_headers, test_db, test_user, cache_patch):
    _seed_activity(test_db, test_user)

    response = client.get("/api/analysis/training-load?days=30", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

    response = client.get("/api/analysis/zones/power?days=30", headers=auth_headers)
    assert response.status_code == 200
    assert "zone_data" in response.json()

    response = client.get("/api/analysis/zones/hr?days=30", headers=auth_headers)
    assert response.status_code == 200
    assert "zone_data" in response.json()

    response = client.get("/api/analysis/zones/balance?model=polarized&weeks=4", headers=auth_headers)
    assert response.status_code == 200
    assert "zone_balance" in response.json()

    response = client.get("/api/analysis/efficiency?days=30", headers=auth_headers)
    assert response.status_code == 200
    assert "efficiency_data" in response.json()

    response = client.get("/api/analysis/fitness-state", headers=auth_headers)
    assert response.status_code == 200
    assert "status" in response.json()


def test_metrics_and_insights(client, auth_headers, test_db, test_user, monkeypatch, cache_patch):
    activity = _seed_activity(test_db, test_user)

    monkeypatch.setattr(
        "app.services.analysis.fatigue_resistance.FatigueResistanceService.analyze_activity",
        lambda self, activity_id: {"activity_id": activity_id, "fatigue_ratio": 0.9},
    )
    monkeypatch.setattr(
        "app.services.analysis.w_prime_balance.WPrimeBalanceService.analyze_activity",
        lambda self, user, activity_id: {"activity_id": activity_id, "min_w_balance": 5000},
    )
    monkeypatch.setattr(
        "app.services.analysis.decoupling.DecouplingService.analyze_activity",
        lambda self, activity_id: {"activity_id": activity_id, "decoupling_percent": 2.0},
    )
    monkeypatch.setattr(
        "app.services.analysis.advanced_metrics.AdvancedMetricsService.variability_index",
        lambda self, activity_id: {"activity_id": activity_id, "variability_index": 1.02},
    )

    response = client.get(f"/api/analysis/metrics/fatigue-resistance?activity_id={activity.id}", headers=auth_headers)
    assert response.status_code == 200

    response = client.get(f"/api/analysis/metrics/w-prime-balance?activity_id={activity.id}", headers=auth_headers)
    assert response.status_code == 200

    response = client.get(f"/api/analysis/metrics/decoupling?activity_id={activity.id}", headers=auth_headers)
    assert response.status_code == 200

    response = client.get(f"/api/analysis/metrics/variability-index?activity_id={activity.id}", headers=auth_headers)
    assert response.status_code == 200

    response = client.get("/api/analysis/metrics/polarized-distribution?days=30", headers=auth_headers)
    assert response.status_code == 200

    response = client.get("/api/analysis/insights?days=14", headers=auth_headers)
    assert response.status_code == 200
    assert "insights" in response.json()

    response = client.get("/api/analysis/insights/weekly-summary?days=7", headers=auth_headers)
    assert response.status_code == 200
    assert "sessions" in response.json()


def test_predict_ftp_and_comparisons(client, auth_headers, test_db, test_user, monkeypatch, cache_patch):
    _seed_activity(test_db, test_user)

    class StubPredictor:
        def __init__(self, db):
            pass

        def predict(self, user, days=90):
            class Result:
                predicted_ftp = 270.0
                confidence = 0.8
                model_version = "stub"
                features = {"best_20min": 300.0}
                prediction_time = datetime.utcnow()
            return Result()

    monkeypatch.setattr("app.api.routes.analysis.predict_ftp.FtpPredictor", StubPredictor)

    response = client.post("/api/analysis/predict-ftp?days=90", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["predicted_ftp"] == 270.0

    response = client.get(
        "/api/analysis/comparisons?start_date=2024-01-01&end_date=2024-02-01&include_year_curve=false",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "period_comparison" in response.json()

