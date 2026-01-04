from datetime import datetime, timedelta
from types import SimpleNamespace

from app.database.models import Activity
from app.services.insights.insight_generator import InsightGenerator
from app.services.insights.coaching_advisor import CoachingAdvisor


def _create_activity(test_db, test_user, **kwargs):
    activity = Activity(
        user_id=test_user.id,
        start_time=kwargs.get("start_time", datetime.utcnow()),
        duration=kwargs.get("duration", 3600),
        distance=kwargs.get("distance", 30.0),
        tss=kwargs.get("tss", 75.0),
        max_5min_power=kwargs.get("max_5min_power", 300.0),
        max_20min_power=kwargs.get("max_20min_power", 260.0),
    )
    test_db.add(activity)
    return activity


def test_insight_generator_paths(test_db, test_user, monkeypatch):
    now = datetime.utcnow()
    _create_activity(test_db, test_user, start_time=now - timedelta(days=2), tss=120, max_5min_power=320, max_20min_power=280)
    _create_activity(test_db, test_user, start_time=now - timedelta(days=10), tss=40, max_5min_power=250, max_20min_power=230)
    _create_activity(test_db, test_user, start_time=now - timedelta(days=30), tss=30, max_5min_power=240, max_20min_power=220)
    test_db.commit()

    generator = InsightGenerator(test_db)

    # Force fatigue/ramp insight with synthetic training load
    load = [SimpleNamespace(ctl=20.0, tsb=-35.0)] * 14
    monkeypatch.setattr(generator.training_load_service, "calculate_training_load", lambda user, days=14: load)

    fatigue = generator._fatigue_insight(test_user, days=14)
    assert fatigue

    ramp_load = [SimpleNamespace(ctl=30.0, tsb=0.0)] * 7 + [SimpleNamespace(ctl=40.0, tsb=0.0)] * 7
    monkeypatch.setattr(generator.training_load_service, "calculate_training_load", lambda user, days=14: ramp_load)
    ramp = generator._ramp_rate_insight(test_user, days=14)
    assert ramp

    breakthrough = generator._breakthrough_insight(test_user, days=14)
    assert breakthrough

    pattern = generator._weekday_pattern_insight(test_user, days=60)
    assert isinstance(pattern, list)

    summary = generator.weekly_summary(test_user, days=7)
    assert summary["sessions"] >= 1

    insights = generator.generate_insights(test_user, days=14)
    advisor = CoachingAdvisor()
    recommendations = advisor.build_recommendations(insights)
    assert isinstance(recommendations, list)

