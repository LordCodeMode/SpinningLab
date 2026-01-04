from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.services.cache import cache_builder as cb
from app.database.models import Activity


class FakeCacheManager:
    def __init__(self):
        self.store = {}
        self.redis = True

    def set(self, key, user_id, value):
        self.store[(user_id, key)] = value
        return True

    def get(self, key, user_id, max_age_hours=None):
        return self.store.get((user_id, key))

    def delete(self, key, user_id):
        self.store.pop((user_id, key), None)

    def clear_user_cache(self, user_id):
        keys = [k for k in self.store if k[0] == user_id]
        for key in keys:
            self.store.pop(key, None)

    def get_cache_info(self, user_id):
        keys = [k for k in self.store if k[0] == user_id]
        return {
            "files": len(keys),
            "total_size": len(keys),
            "files_list": [k[1] for k in keys],
        }

    def acquire_lock(self, user_id, ttl_seconds=60, suffix="lock"):
        return True

    def release_lock(self, user_id, suffix="lock"):
        return True


class StubPowerCurveService:
    def __init__(self, db):
        self.db = db

    def get_user_power_curve(self, user, weighted=False, start_date=None, end_date=None):
        if weighted:
            return [2.5, 2.3, 2.1]
        return [320.0, 300.0, 280.0]


class StubTrainingLoadService:
    def __init__(self, db):
        self.db = db

    def calculate_training_load(self, user, days=365):
        now = datetime.utcnow()
        class Load:
            def __init__(self, dt):
                self.date = dt
        return [
            Load(now - timedelta(days=1)),
            Load(now - timedelta(days=40)),
            Load(now - timedelta(days=200)),
        ]


class StubZoneAnalysisService:
    def __init__(self, db):
        self.db = db

    def get_power_zone_distribution(self, user, days=None):
        return {"period_days": days, "zone_data": []}

    def get_hr_zone_distribution(self, user, days=None):
        return {"period_days": days, "zone_data": []}


class StubCriticalPowerService:
    def __init__(self, db):
        self.db = db

    def calculate_critical_power(self, user):
        return {"critical_power": 280.0, "w_prime": 15000.0}


class StubEfficiencyService:
    def __init__(self, db):
        self.db = db

    def get_efficiency_factors(self, user, days=120):
        base = datetime.utcnow() - timedelta(days=5)
        return [
            SimpleNamespace(
                start_time=base,
                normalized_power=210.0,
                avg_heart_rate=140.0,
                intensity_factor=0.72,
                ef=1.5,
            ),
            SimpleNamespace(
                start_time=base + timedelta(days=2),
                normalized_power=220.0,
                avg_heart_rate=142.0,
                intensity_factor=0.74,
                ef=1.55,
            ),
        ]

    def get_efficiency_trend(self, user, days=120):
        return {"trend": "stable"}


class StubVO2MaxService:
    def __init__(self, db):
        self.db = db

    def estimate_vo2max(self, user, days=120):
        now = datetime.utcnow().date().isoformat()
        return {
            "current_vo2max": 55.2,
            "estimates": [{"date": now, "vo2max": 55.2}],
            "trend": {"direction": "stable"},
        }


class StubFitnessStateService:
    def __init__(self, db):
        self.db = db

    def analyze_fitness_state(self, user):
        return SimpleNamespace(status="fresh", _asdict=lambda: {"status": "fresh"})


class StubAdvancedMetricsService:
    def __init__(self, db):
        self.db = db

    def polarized_distribution(self, user, days=30):
        return {
            "days": days,
            "zone_1_2_seconds": 100,
            "zone_3_4_seconds": 20,
            "zone_5_plus_seconds": 10,
            "polarized_score": 80.0,
        }


class StubZoneBalanceService:
    def __init__(self, db):
        self.db = db

    def analyze_zone_balance(self, user, model="polarized", weeks=4):
        return [
            SimpleNamespace(
                zone_label="Z2 (Endurance)",
                actual_percentage=60.0,
                target_percentage=65.0,
                deviation=-5.0,
                watt_range="150-220 W",
                status="balanced",
            )
        ]

    def get_recommendations(self, zone_balance, model):
        return ["Keep it up"]


class StubComparisonsService:
    def __init__(self, db):
        self.db = db

    def get_period_ranges(self, start_date=None, end_date=None, compare_mode="previous"):
        start = start_date
        end = end_date
        delta = end - start
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - delta
        return {
            "current_start": start,
            "current_end": end,
            "previous_start": prev_start,
            "previous_end": prev_end,
        }

    def get_period_summary(self, user, start, end):
        return {"start": start.date().isoformat(), "end": end.date().isoformat(), "sessions": 0}

    def get_pr_timeline(self, user, start_date, end_date, only_changes=False):
        return [{"date": start_date.date().isoformat(), "best_5min": 250.0, "best_20min": 220.0}]

    def get_period_power_bests(self, user, start_date, end_date):
        return {"best_5min": 250.0, "best_20min": 220.0}

    def get_ftp_progression(self, user, start_date, end_date, months=6):
        return [{"month": start_date.strftime("%Y-%m"), "estimated_ftp": 250.0}]

    def get_seasonal_volume(self, user, start_date, end_date, years=2):
        return [
            {"label": "Winter 2024", "duration_hours": 10.0, "total_tss": 500.0},
            {"label": "Spring 2024", "duration_hours": 12.0, "total_tss": 550.0},
        ]


def _patch_cache_builder_services(monkeypatch):
    fake_manager = FakeCacheManager()
    monkeypatch.setattr(cb, "CacheManager", lambda: fake_manager)
    monkeypatch.setattr(cb, "PowerCurveService", StubPowerCurveService)
    monkeypatch.setattr(cb, "TrainingLoadService", StubTrainingLoadService)
    monkeypatch.setattr(cb, "ZoneAnalysisService", StubZoneAnalysisService)
    monkeypatch.setattr(cb, "CriticalPowerService", StubCriticalPowerService)
    monkeypatch.setattr(cb, "EfficiencyService", StubEfficiencyService)
    monkeypatch.setattr(cb, "VO2MaxService", StubVO2MaxService)
    monkeypatch.setattr(cb, "FitnessStateService", StubFitnessStateService)
    monkeypatch.setattr("app.services.analysis.advanced_metrics.AdvancedMetricsService", StubAdvancedMetricsService)
    monkeypatch.setattr("app.services.analysis.zone_balance_service.ZoneBalanceService", StubZoneBalanceService)
    monkeypatch.setattr("app.services.analysis.comparisons.ComparisonsService", StubComparisonsService)
    return fake_manager


def _seed_activities(test_db, test_user):
    now = datetime.utcnow()
    activity = Activity(
        user_id=test_user.id,
        start_time=now - timedelta(days=2),
        duration=3600,
        distance=30.0,
        avg_power=200.0,
        normalized_power=210.0,
        max_5sec_power=900.0,
        max_1min_power=600.0,
        max_3min_power=450.0,
        max_5min_power=400.0,
        max_10min_power=350.0,
        max_20min_power=300.0,
        max_30min_power=280.0,
        max_60min_power=250.0,
        avg_heart_rate=140.0,
        max_heart_rate=175.0,
        tss=75.0,
        intensity_factor=0.85,
    )
    test_db.add(activity)
    test_db.commit()


def test_build_all_cache_success(test_db, test_user, monkeypatch):
    fake_manager = _patch_cache_builder_services(monkeypatch)
    _seed_activities(test_db, test_user)

    builder = cb.CacheBuilder(test_db)
    results = builder.build_all_cache(test_user)

    assert results["success"] is True
    assert fake_manager.get("cache_built_at", test_user.id) is not None
    assert fake_manager.get("power_curve_absolute", test_user.id) is not None
    assert fake_manager.get("training_load_365d", test_user.id) is not None
    assert fake_manager.get("best_power_values_all", test_user.id) is not None


def test_invalidate_and_status(test_db, test_user, monkeypatch):
    fake_manager = _patch_cache_builder_services(monkeypatch)
    builder = cb.CacheBuilder(test_db)

    fake_manager.set("cache_built_at", test_user.id, "2025-01-01")
    assert builder.is_cache_valid(test_user) is True

    status = builder.get_cache_status(test_user)
    assert status["is_valid"] is True

    builder.invalidate_cache(test_user)
    assert builder.is_cache_valid(test_user) is False


def test_prepare_curve_payload():
    builder = cb.CacheBuilder.__new__(cb.CacheBuilder)
    assert builder._prepare_curve_payload([], False) is None
    payload = builder._prepare_curve_payload([100.0, 200.0], False)
    assert payload["durations"] == [1, 2]

