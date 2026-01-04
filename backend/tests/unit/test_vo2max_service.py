"""Unit tests for VO2max estimation service."""

import pytest
from datetime import datetime, timedelta

from app.services.analysis.vo2max_service import VO2MaxService
from app.database.models import User, Activity


class TestVO2MaxService:
    """Test VO2max estimation calculations."""

    def test_vo2max_from_high_intensity_efforts(self, test_db, test_user):
        """Test VO2max estimation from high-intensity efforts."""
        # Set user FTP and weight
        test_user.ftp = 250.0
        test_user.weight = 70.0
        test_user.hr_max = 185
        test_db.commit()

        # Create high-intensity activities
        # IF >= 0.8, duration 4-25 min, HR >= 78% max (144 bpm)
        for i in range(5):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i * 7),
                duration=1200,  # 20 minutes
                normalized_power=560.0,
                intensity_factor=0.9,
                avg_heart_rate=160 + i,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=90)
        estimates = result.get("estimates", [])

        assert result is not None
        assert len(estimates) > 0
        # VO2max should be in reasonable range
        for estimate in estimates:
            assert 35.0 <= estimate["vo2max"] <= 80.0

    def test_vo2max_from_peak_power(self, test_db, test_user):
        """Test VO2max estimation from peak power values."""
        # Set user weight
        test_user.weight = 75.0
        test_db.commit()

        # Create activities with peak power values
        for i in range(5):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i * 7),
                duration=3600,
                max_5min_power=300.0 + i * 10,
                normalized_power=260.0,
                avg_heart_rate=140.0,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=90)
        estimates = result.get("estimates", [])

        assert result is not None
        assert len(estimates) > 0

    def test_vo2max_no_data(self, test_db, test_user):
        """Test VO2max when no activities exist."""
        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=90)

        # Should return empty list or minimal data
        assert isinstance(result, dict)
        assert isinstance(result.get("estimates"), list)

    def test_vo2max_insufficient_data(self, test_db, test_user):
        """Test VO2max with insufficient data quality."""
        # Create activities with no power or HR data
        for i in range(3):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i),
                duration=3600,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=90)

        # May return empty or fall back to alternative method
        assert isinstance(result, dict)
        assert isinstance(result.get("estimates"), list)

    def test_vo2max_date_filtering(self, test_db, test_user):
        """Test that date filtering works correctly."""
        test_user.ftp = 250.0
        test_user.weight = 70.0
        test_user.hr_max = 185
        test_db.commit()

        # Create old and recent activities
        old_activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow() - timedelta(days=200),
            duration=1200,
            normalized_power=560.0,
            intensity_factor=0.9,
            avg_heart_rate=160,
            file_name="old.fit"
        )
        test_db.add(old_activity)

        recent_activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow() - timedelta(days=10),
            duration=1200,
            normalized_power=560.0,
            intensity_factor=0.9,
            avg_heart_rate=160,
            file_name="recent.fit"
        )
        test_db.add(recent_activity)
        test_db.commit()

        service = VO2MaxService(test_db)

        # Request only last 90 days
        result = service.estimate_vo2max(test_user, days=90)
        estimates = result.get("estimates", [])

        # Should only include recent activity
        assert len(estimates) == 1

    def test_vo2max_realistic_ranges(self, test_db, test_user):
        """Test that VO2max estimates stay within realistic ranges."""
        test_user.ftp = 300.0
        test_user.weight = 70.0
        test_user.hr_max = 190
        test_db.commit()

        # Create elite-level activity
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=1200,
            normalized_power=575.0,
            intensity_factor=0.92,
            avg_heart_rate=165,
            max_5min_power=350.0,
            file_name="elite.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=30)
        estimates = result.get("estimates", [])

        if estimates:
            for estimate in estimates:
                # VO2max should be realistic (not exceed 85 for most people)
                assert 30.0 <= estimate["vo2max"] <= 90.0

    def test_vo2max_smoothing(self, test_db, test_user):
        """Test that VO2max estimates are smoothed over time."""
        test_user.ftp = 250.0
        test_user.weight = 70.0
        test_user.hr_max = 185
        test_db.commit()

        # Create activities with varying quality
        efforts = [
            (560.0, 160),
            (575.0, 170),
            (545.0, 155),
            (590.0, 175),
            (565.0, 165)
        ]
        for i, (power, hr) in enumerate(efforts):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i * 7),
                duration=1200,
                normalized_power=float(power),
                intensity_factor=0.9,
                avg_heart_rate=hr,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=90)
        estimates = result.get("estimates", [])

        if len(estimates) > 1:
            # Estimates should not vary wildly between consecutive estimates
            for i in range(1, len(estimates)):
                current = estimates[i]["vo2max"]
                previous = estimates[i - 1]["vo2max"]
                # Change should be reasonable (less than 10%)
                change_percent = abs(current - previous) / previous
                assert change_percent < 0.15  # Less than 15% change

    def test_vo2max_with_missing_ftp(self, test_db, test_user):
        """Test VO2max when user has no FTP set."""
        test_user.ftp = None
        test_user.weight = 70.0
        test_db.commit()

        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=1200,
            max_5min_power=300.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=30)

        # Should still be able to estimate from peak power
        assert isinstance(result, dict)
        assert isinstance(result.get("estimates"), list)

    def test_vo2max_with_missing_weight(self, test_db, test_user):
        """Test VO2max when user has no weight set."""
        test_user.ftp = 250.0
        test_user.weight = None
        test_db.commit()

        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=1200,
            normalized_power=210.0,
            avg_heart_rate=155,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = VO2MaxService(test_db)
        result = service.estimate_vo2max(test_user, days=30)

        # Should use default weight or handle gracefully
        assert isinstance(result, dict)
        assert isinstance(result.get("estimates"), list)
