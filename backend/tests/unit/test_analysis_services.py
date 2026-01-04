from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.database.models import Activity, PowerZone, HrZone
from app.services.analysis.advanced_metrics import AdvancedMetricsService
from app.services.analysis.comparisons import ComparisonsService
from app.services.analysis.critical_power import CriticalPowerService
from app.services.analysis.decoupling import DecouplingService
from app.services.analysis.efficiency_service import EfficiencyService
from app.services.analysis.fatigue_resistance import FatigueResistanceService
from app.services.analysis.rider_profile_service import RiderProfileService
from app.services.analysis.w_prime_balance import WPrimeBalanceService
from app.services.analysis.zone_balance_service import ZoneBalanceService
from app.services.analysis.zones import ZoneAnalysisService


def _add_activity(test_db, test_user, **kwargs):
    activity = Activity(
        user_id=test_user.id,
        start_time=kwargs.get("start_time", datetime.utcnow()),
        duration=kwargs.get("duration", 3600),
        distance=kwargs.get("distance", 30.0),
        avg_power=kwargs.get("avg_power", 200.0),
        normalized_power=kwargs.get("normalized_power", 210.0),
        max_5sec_power=kwargs.get("max_5sec_power", 900.0),
        max_1min_power=kwargs.get("max_1min_power", 600.0),
        max_3min_power=kwargs.get("max_3min_power", 450.0),
        max_5min_power=kwargs.get("max_5min_power", 400.0),
        max_10min_power=kwargs.get("max_10min_power", 350.0),
        max_20min_power=kwargs.get("max_20min_power", 300.0),
        max_30min_power=kwargs.get("max_30min_power", 280.0),
        max_60min_power=kwargs.get("max_60min_power", 250.0),
        avg_heart_rate=kwargs.get("avg_heart_rate", 140.0),
        max_heart_rate=kwargs.get("max_heart_rate", 175.0),
        tss=kwargs.get("tss", 75.0),
        intensity_factor=kwargs.get("intensity_factor", 0.85),
    )
    test_db.add(activity)
    test_db.commit()
    test_db.refresh(activity)
    return activity


def test_comparisons_service(test_db, test_user):
    now = datetime.utcnow()
    _add_activity(test_db, test_user, start_time=now - timedelta(days=10), max_5min_power=320.0)
    _add_activity(test_db, test_user, start_time=now - timedelta(days=5), max_5min_power=340.0)

    service = ComparisonsService(test_db)
    ranges = service.get_period_ranges(now - timedelta(days=30), now, compare_mode="previous")
    assert ranges["current_start"] < ranges["current_end"]

    summary = service.get_period_summary(test_user, ranges["current_start"], ranges["current_end"])
    assert summary["sessions"] >= 1

    timeline = service.get_pr_timeline(test_user, ranges["current_start"], ranges["current_end"], only_changes=True)
    assert timeline

    progression = service.get_ftp_progression(test_user, ranges["current_start"], ranges["current_end"], months=6)
    assert isinstance(progression, list)

    seasonal = service.get_seasonal_volume(test_user, ranges["current_start"], ranges["current_end"], years=2)
    assert isinstance(seasonal, list)

    bests = service.get_period_power_bests(test_user, ranges["current_start"], ranges["current_end"])
    assert "best_5min" in bests


def test_critical_power_service(test_db, test_user):
    for i, power in enumerate([280.0, 300.0, 320.0, 340.0]):
        _add_activity(
            test_db,
            test_user,
            start_time=datetime.utcnow() - timedelta(days=i + 1),
            max_5min_power=power + 50,
            max_10min_power=power + 20,
            max_20min_power=power,
            max_30min_power=power - 10,
        )

    service = CriticalPowerService(test_db)
    model = service.estimate_critical_power(test_user)
    assert model is not None

    payload = service.calculate_critical_power(test_user)
    assert payload["critical_power"] > 0
    assert len(payload["durations"]) == len(payload["actual"])


def test_efficiency_service(test_db, test_user):
    base = datetime.utcnow() - timedelta(days=20)
    _add_activity(test_db, test_user, start_time=base, normalized_power=200.0, avg_heart_rate=130.0, intensity_factor=0.7)
    _add_activity(test_db, test_user, start_time=base + timedelta(days=5), normalized_power=210.0, avg_heart_rate=132.0, intensity_factor=0.72)
    _add_activity(test_db, test_user, start_time=base + timedelta(days=10), normalized_power=215.0, avg_heart_rate=134.0, intensity_factor=0.74)

    service = EfficiencyService(test_db)
    factors = service.get_efficiency_factors(test_user, days=60)
    assert factors

    trend = service.get_efficiency_trend(test_user, days=60)
    assert trend["trend"] in {"improving", "declining", "stable", "insufficient_data", "no_data"}


def test_zone_services(test_db, test_user):
    activity = _add_activity(test_db, test_user)
    test_db.add_all([
        PowerZone(activity_id=activity.id, zone_label="Z1", seconds_in_zone=600),
        PowerZone(activity_id=activity.id, zone_label="Z2", seconds_in_zone=1200),
        HrZone(activity_id=activity.id, zone_label="Z1", seconds_in_zone=500),
        HrZone(activity_id=activity.id, zone_label="Z2", seconds_in_zone=800),
    ])
    test_db.commit()

    zone_service = ZoneAnalysisService(test_db)
    power_dist = zone_service.get_power_zone_distribution(test_user, days=30)
    hr_dist = zone_service.get_hr_zone_distribution(test_user, days=30)
    assert power_dist.total_time > 0
    assert hr_dist.total_time > 0

    balance_service = ZoneBalanceService(test_db)
    balance = balance_service.analyze_zone_balance(test_user, model="polarized", weeks=4)
    recs = balance_service.get_recommendations(balance, model="polarized")
    assert balance
    assert recs


def test_advanced_metrics_service(test_db, test_user):
    activity = _add_activity(test_db, test_user)
    test_db.add_all([
        PowerZone(activity_id=activity.id, zone_label="Z1", seconds_in_zone=600),
        PowerZone(activity_id=activity.id, zone_label="Z5", seconds_in_zone=120),
    ])
    test_db.commit()

    service = AdvancedMetricsService(test_db)
    payload = service.polarized_distribution(test_user, days=30)
    assert payload["days"] == 30


def test_fatigue_and_decoupling_services(test_db, test_user, monkeypatch):
    activity = _add_activity(test_db, test_user)

    monkeypatch.setattr(
        "app.services.analysis.fatigue_resistance.PowerCurveService.get_power_series",
        lambda self, act: [200.0] * 1200,
    )
    fr_service = FatigueResistanceService(test_db)
    result = fr_service.analyze_activity(activity.id)
    assert result is not None

    monkeypatch.setattr(
        "app.services.analysis.decoupling.PowerCurveService.get_power_series",
        lambda self, act: [180.0] * 1200,
    )
    monkeypatch.setattr(
        DecouplingService,
        "_get_hr_series",
        lambda self, act: [150.0] * 1200,
    )
    dec_service = DecouplingService(test_db)
    dec = dec_service.analyze_activity(activity.id)
    assert dec is not None


def test_w_prime_balance_service(test_db, test_user, monkeypatch):
    activity = _add_activity(test_db, test_user)

    monkeypatch.setattr(
        "app.services.analysis.w_prime_balance.PowerCurveService.get_power_series",
        lambda self, act: [250.0] * 600,
    )
    monkeypatch.setattr(
        "app.services.analysis.w_prime_balance.CriticalPowerService.estimate_critical_power",
        lambda self, user: SimpleNamespace(critical_power=220.0, w_prime=15000.0),
    )

    service = WPrimeBalanceService(test_db)
    payload = service.analyze_activity(test_user, activity.id)
    assert payload is not None


def test_rider_profile_service(test_db, test_user):
    _add_activity(
        test_db,
        test_user,
        max_5sec_power=900.0,
        max_1min_power=600.0,
        max_5min_power=400.0,
        max_20min_power=300.0,
    )

    service = RiderProfileService(test_db)
    profile = service.analyze_rider_profile(test_user)
    assert profile["rider_type"] != "Unknown"

