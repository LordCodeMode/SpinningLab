"""Unit tests for training load service (CTL/ATL/TSB)."""

import pytest
from datetime import datetime, timedelta

from app.services.analysis.training_load import TrainingLoadService
from app.database.models import User, Activity


class TestTrainingLoadCalculation:
    """Test CTL, ATL, TSB calculations."""

    def test_ctl_calculation_single_activity(self, test_db, test_user):
        """Test CTL calculation with one activity."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            tss=100.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=90)

        assert loads
        latest = loads[-1]
        assert latest.ctl > 0
        assert latest.atl > 0

    def test_ctl_progression_over_time(self, test_db, test_user):
        """Test that CTL builds up over consistent training."""
        # Create 42 days of consistent training (1 activity per day, 100 TSS each)
        for days_ago in range(42, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=100.0,
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=90)

        # After 42 days of 100 TSS/day, CTL should be around 60-70
        final_load = loads[-1]
        assert 55.0 < final_load.ctl < 75.0

    def test_atl_faster_than_ctl(self, test_db, test_user):
        """Test that ATL responds faster than CTL to training changes."""
        # 7 days of moderate training
        for days_ago in range(14, 7, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=50.0,
                file_name=f"moderate_{days_ago}.fit"
            )
            test_db.add(activity)

        # Followed by 7 days of intense training
        for days_ago in range(7, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=150.0,
                file_name=f"intense_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=90)

        if len(loads) >= 2:
            # ATL should increase more than CTL in recent period
            recent_atl_increase = loads[-1].atl - loads[-7].atl if len(loads) > 7 else loads[-1].atl
            recent_ctl_increase = loads[-1].ctl - loads[-7].ctl if len(loads) > 7 else loads[-1].ctl

            # ATL should increase more
            assert recent_atl_increase > recent_ctl_increase

    def test_tsb_calculation(self, test_db, test_user):
        """Test TSB (Training Stress Balance) calculation."""
        # Create training pattern
        for days_ago in range(20, 0, -1):
            tss = 100.0 if days_ago > 5 else 30.0  # Taper in last 5 days
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=tss,
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=90)

        # TSB should increase during taper (last 5 days)
        if len(loads) >= 5:
            early_tsb = loads[-10].tsb if len(loads) > 10 else loads[0].tsb
            final_tsb = loads[-1].tsb

            # TSB should be higher after taper
            assert final_tsb > early_tsb

    def test_tsb_formula(self, test_db, test_user):
        """Test that TSB = CTL - ATL."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            tss=100.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)
        load = loads[-1]

        # TSB should equal CTL - ATL
        calculated_tsb = load.ctl - load.atl
        assert abs(load.tsb - calculated_tsb) < 0.1

    def test_rest_day_decay(self, test_db, test_user):
        """Test that CTL and ATL decay on rest days."""
        # Training followed by rest
        for days_ago in range(10, 5, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=100.0,
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        # No activities in last 5 days
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)

        # Both CTL and ATL should decay over rest period
        if len(loads) >= 7:
            # Compare start of rest (5 days ago) to today
            rest_start = loads[-6]
            final = loads[-1]
            assert final.ctl < rest_start.ctl
            assert final.atl < rest_start.atl

    def test_overtraining_detection(self, test_db, test_user):
        """Test detection of overtraining (very negative TSB)."""
        # Create overreaching pattern: high volume without recovery
        for days_ago in range(14, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=150.0,  # High TSS every day
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)
        final_load = loads[-1]

        # TSB should be very negative (overtraining)
        assert final_load.tsb < -10.0

    def test_form_peak_detection(self, test_db, test_user):
        """Test detection of peak form (positive TSB with high CTL)."""
        # Build fitness then taper
        for days_ago in range(30, 7, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=100.0,
                file_name=f"build_{days_ago}.fit"
            )
            test_db.add(activity)

        # Taper
        for days_ago in range(7, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=2400,
                tss=50.0,
                file_name=f"taper_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)
        final_load = loads[-1]

        # TSB should improve during taper (less negative / more positive)
        if len(loads) >= 8:
            pre_taper = loads[-8].tsb
            assert final_load.tsb > pre_taper
        # And decent CTL (fit)
        assert final_load.ctl > 30.0


class TestTrainingLoadService:
    """Test training load service methods."""

    def test_get_training_load_time_series(self, test_db, test_user):
        """Test retrieving training load over time."""
        # Create training data
        for days_ago in range(30, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=100.0,
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)

        assert len(loads) > 0
        # Should have CTL, ATL, TSB for each day
        for load in loads:
            assert hasattr(load, 'ctl')
            assert hasattr(load, 'atl')
            assert hasattr(load, 'tsb')

    def test_training_load_date_filtering(self, test_db, test_user):
        """Test date range filtering for training load."""
        # Create 60 days of data
        for days_ago in range(60, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=100.0,
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)

        # Should have approximately 30 days of data
        assert 25 <= len(loads) <= 35

    def test_training_load_empty_data(self, test_db, test_user):
        """Test training load with no activities."""
        service = TrainingLoadService(test_db)
        loads = service.calculate_training_load(test_user, days=30)

        # Should return zeroed data for each day
        assert len(loads) > 0
        assert all(item.ctl == 0.0 and item.atl == 0.0 for item in loads)

    def test_training_load_recalculation(self, test_db, test_user):
        """Test that recalculating gives same results."""
        # Create activities
        for days_ago in range(10, 0, -1):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=days_ago),
                duration=3600,
                tss=100.0,
                file_name=f"day_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        service = TrainingLoadService(test_db)

        # Calculate twice
        loads1 = service.calculate_training_load(test_user, days=10)
        loads2 = service.calculate_training_load(test_user, days=10)

        # Results should be identical
        assert len(loads1) == len(loads2)
        for l1, l2 in zip(loads1, loads2):
            assert abs(l1.ctl - l2.ctl) < 0.1
            assert abs(l1.atl - l2.atl) < 0.1
            assert abs(l1.tsb - l2.tsb) < 0.1
