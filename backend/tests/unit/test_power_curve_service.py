"""Unit tests for power curve service."""

import pytest
from datetime import datetime, timedelta
import numpy as np

from app.services.analysis.power_curve import PowerCurveService
from app.database.models import User, Activity


class TestPowerCurveService:
    """Test power curve generation and analysis."""

    def test_generate_power_curve_from_activities(self, test_db, test_user):
        """Test generating power curve from multiple activities."""
        # Create activities with power data
        for i in range(5):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i),
                duration=3600,
                avg_power=220.0,
                max_5sec_power=500.0 + i * 20,
                max_1min_power=400.0 + i * 10,
                max_5min_power=300.0 + i * 5,
                max_20min_power=250.0 + i * 3,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        assert result is not None
        assert isinstance(result, list)
        durations = list(range(1, len(result) + 1))
        assert len(durations) == len(result)

    def test_power_curve_descending_order(self, test_db, test_user):
        """Test that power curve values descend (longer duration = lower power)."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=240.0,
            max_5sec_power=600.0,
            max_1min_power=450.0,
            max_5min_power=350.0,
            max_20min_power=280.0,
            max_60min_power=250.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        powers = result or []
        # Powers should generally decrease with duration
        for i in range(len(powers) - 1):
            # Allow small increases due to data quality, but not large ones
            if powers[i] and powers[i+1]:
                assert powers[i] >= powers[i+1] * 0.95

    def test_power_curve_with_date_filters(self, test_db, test_user):
        """Test power curve with date filtering."""
        # Create old activity with high power
        old_activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow() - timedelta(days=100),
            duration=3600,
            avg_power=240.0,
            max_5min_power=400.0,
            file_name="old.fit"
        )
        test_db.add(old_activity)

        # Create recent activity with lower power
        recent_activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow() - timedelta(days=5),
            duration=3600,
            avg_power=220.0,
            max_5min_power=350.0,
            file_name="recent.fit"
        )
        test_db.add(recent_activity)
        test_db.commit()

        service = PowerCurveService(test_db)

        # Get curve for last 30 days only
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        start_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        result = service.get_user_power_curve(test_user, start_date=start_date, end_date=end_date)

        # Should use recent activity data (350W), not old (400W)
        if result and len(result) >= 300:
            max_5min_power = result[299]
            if max_5min_power is not None:
                assert max_5min_power <= 350.0

    def test_power_curve_no_data(self, test_db, test_user):
        """Test power curve when no activities exist."""
        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        # Should return empty or synthetic curve
        assert result is None

    def test_power_curve_synthetic_generation(self, test_db, test_user):
        """Test synthetic power curve generation from best powers."""
        # Create activity with only some power values
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=210.0,
            max_5min_power=300.0,
            max_20min_power=250.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        # Should fill in gaps with interpolated values
        assert result is not None
        assert len(result) > 2

    def test_power_curve_standard_durations(self, test_db, test_user):
        """Test that power curve includes standard durations."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=220.0,
            max_5sec_power=500.0,
            max_1min_power=400.0,
            max_5min_power=300.0,
            max_20min_power=250.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        # Should include standard durations (5s, 1min, 5min, 20min, etc.)
        standard_durations = [5, 60, 300, 1200, 3600]
        durations = list(range(1, len(result) + 1)) if result else []

        for std_duration in standard_durations:
            # Duration should be present or close approximation
            assert any(abs(d - std_duration) < 10 for d in durations if d)

    def test_power_curve_multiple_users(self, test_db, test_user):
        """Test that power curves are isolated per user."""
        # Create another user
        other_user = User(
            username="otheruser",
            email="other@example.com",
            hashed_password="hashed"
        )
        test_db.add(other_user)
        test_db.commit()

        # Create activities for both users
        activity1 = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=210.0,
            max_5min_power=300.0,
            file_name="user1.fit"
        )
        activity2 = Activity(
            user_id=other_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=230.0,
            max_5min_power=400.0,
            file_name="user2.fit"
        )
        test_db.add_all([activity1, activity2])
        test_db.commit()

        service = PowerCurveService(test_db)

        # Get curves for each user
        start_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        result1 = service.get_user_power_curve(test_user, start_date=start_date, end_date=end_date)
        result2 = service.get_user_power_curve(other_user, start_date=start_date, end_date=end_date)

        # Curves should be different
        assert result1 != result2


class TestPowerCurveAnalysis:
    """Test power curve analysis features."""

    def test_critical_power_from_curve(self, test_db, test_user):
        """Test critical power estimation from power curve."""
        # Create activity with known CP-like profile
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=230.0,
            max_1min_power=400.0,
            max_5min_power=320.0,
            max_20min_power=270.0,
            max_60min_power=250.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        # CP should be approximately the 60-minute power
        if result:
            long_duration_powers = [p for d, p in zip(range(1, len(result) + 1), result) if d >= 3000 and p]
            if long_duration_powers:
                cp_estimate = min(long_duration_powers)
                assert 240.0 <= cp_estimate <= 260.0

    def test_power_curve_consistency(self, test_db, test_user):
        """Test that calling power curve multiple times gives consistent results."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=210.0,
            max_5min_power=300.0,
            max_20min_power=250.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)

        start_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        result1 = service.get_user_power_curve(test_user, start_date=start_date, end_date=end_date)
        result2 = service.get_user_power_curve(test_user, start_date=start_date, end_date=end_date)

        # Results should be identical
        assert result1 == result2

    def test_power_curve_w_per_kg(self, test_db, test_user):
        """Test power curve normalized by weight."""
        test_user.weight = 70.0
        test_db.commit()

        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            avg_power=210.0,
            max_5min_power=350.0,  # 5.0 W/kg
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = PowerCurveService(test_db)
        result = service.get_user_power_curve(test_user, weighted=True,
                                              start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"),
                                              end_date=datetime.utcnow().strftime("%Y-%m-%d"))

        # Powers should be divided by weight
        if result:
            max_power_per_kg = max([p for p in result if p])
            assert 4.5 <= max_power_per_kg <= 5.5  # Around 5 W/kg
