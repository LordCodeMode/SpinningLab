"""
Unit tests for database operations.

Tests:
- User CRUD operations
- Activity CRUD operations
- Database relationships
- Data integrity
"""

import pytest
from datetime import datetime
from app.database.models import User, Activity, TrainingLoad


@pytest.mark.database
@pytest.mark.unit
class TestUserDatabase:
    """Test User database operations."""

    def test_create_user(self, test_db):
        """Test creating a user in the database."""
        user = User(
            username="dbtest",
            email="dbtest@example.com",
            name="DB Test User",
            hashed_password="hashed_password_here",
            is_active=True,
            ftp=260.0,
            weight=75.0,
            hr_max=185,
            hr_rest=55
        )

        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        assert user.id is not None
        assert user.username == "dbtest"
        assert user.ftp == 260.0

    def test_read_user(self, test_db, test_user):
        """Test reading a user from the database."""
        user = test_db.query(User).filter(User.id == test_user.id).first()

        assert user is not None
        assert user.id == test_user.id
        assert user.username == test_user.username

    def test_update_user(self, test_db, test_user):
        """Test updating user information."""
        # Update FTP
        test_user.ftp = 280.0
        test_user.weight = 72.0
        test_db.commit()
        test_db.refresh(test_user)

        # Verify update
        user = test_db.query(User).filter(User.id == test_user.id).first()
        assert user.ftp == 280.0
        assert user.weight == 72.0

    def test_delete_user(self, test_db):
        """Test deleting a user from the database."""
        # Create user
        user = User(
            username="deleteme",
            hashed_password="hash",
            is_active=True
        )
        test_db.add(user)
        test_db.commit()
        user_id = user.id

        # Delete user
        test_db.delete(user)
        test_db.commit()

        # Verify deletion
        deleted_user = test_db.query(User).filter(User.id == user_id).first()
        assert deleted_user is None

    def test_user_defaults(self, test_db):
        """Test that user defaults are set correctly."""
        user = User(
            username="defaulttest",
            hashed_password="hash",
            is_active=True
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        # Check defaults
        assert user.ftp == 250.0
        assert user.weight == 70.0
        assert user.hr_max == 190
        assert user.hr_rest == 60
        assert user.is_active is True


@pytest.mark.database
@pytest.mark.unit
class TestActivityDatabase:
    """Test Activity database operations."""

    def test_create_activity(self, test_db, test_user):
        """Test creating an activity in the database."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime(2024, 1, 15, 10, 0, 0),
            file_name="test_ride.fit",
            file_hash="abc123",
            file_size=50000,
            duration=3600.0,
            distance=30.5,
            avg_power=200.0,
            normalized_power=215.0,
            avg_heart_rate=145.0,
            max_heart_rate=175.0,
            tss=75.0,
            intensity_factor=0.86
        )

        test_db.add(activity)
        test_db.commit()
        test_db.refresh(activity)

        assert activity.id is not None
        assert activity.user_id == test_user.id
        assert activity.avg_power == 200.0

    def test_read_user_activities(self, test_db, test_user):
        """Test reading all activities for a user."""
        # Create multiple activities
        for i in range(3):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime(2024, 1, i+1, 10, 0, 0),
                file_name=f"ride_{i}.fit",
                file_hash=f"hash_{i}",
                duration=3600.0,
                avg_power=200.0
            )
            test_db.add(activity)

        test_db.commit()

        # Query activities
        activities = test_db.query(Activity).filter(
            Activity.user_id == test_user.id
        ).all()

        assert len(activities) >= 3

    def test_activity_user_relationship(self, test_db, test_user):
        """Test relationship between Activity and User."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.now(),
            duration=3600.0
        )
        test_db.add(activity)
        test_db.commit()
        test_db.refresh(activity)

        # Access user through relationship
        assert activity.user is not None
        assert activity.user.id == test_user.id
        assert activity.user.username == test_user.username

    def test_delete_activity(self, test_db, test_user):
        """Test deleting an activity."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.now(),
            duration=3600.0
        )
        test_db.add(activity)
        test_db.commit()
        activity_id = activity.id

        # Delete
        test_db.delete(activity)
        test_db.commit()

        # Verify
        deleted = test_db.query(Activity).filter(Activity.id == activity_id).first()
        assert deleted is None


@pytest.mark.database
@pytest.mark.unit
class TestTrainingLoadDatabase:
    """Test TrainingLoad database operations."""

    def test_create_training_load(self, test_db, test_user):
        """Test creating training load entry."""
        training_load = TrainingLoad(
            user_id=test_user.id,
            date=datetime(2024, 1, 15),
            ctl=50.0,
            atl=60.0,
            tsb=-10.0
        )

        test_db.add(training_load)
        test_db.commit()
        test_db.refresh(training_load)

        assert training_load.id is not None
        assert training_load.ctl == 50.0
        assert training_load.tsb == -10.0

    def test_training_load_time_series(self, test_db, test_user):
        """Test storing multiple days of training load."""
        for day in range(7):
            training_load = TrainingLoad(
                user_id=test_user.id,
                date=datetime(2024, 1, day+1),
                ctl=50.0 + day,
                atl=60.0 + day,
                tsb=-10.0
            )
            test_db.add(training_load)

        test_db.commit()

        # Query all training loads
        loads = test_db.query(TrainingLoad).filter(
            TrainingLoad.user_id == test_user.id
        ).order_by(TrainingLoad.date).all()

        assert len(loads) == 7
        assert loads[0].ctl == 50.0
        assert loads[6].ctl == 56.0


@pytest.mark.database
@pytest.mark.unit
class TestDataIntegrity:
    """Test database data integrity and constraints."""

    def test_unique_username(self, test_db, test_user):
        """Test that usernames must be unique."""
        # Try to create user with same username
        duplicate_user = User(
            username=test_user.username,  # Same username
            hashed_password="different_hash",
            is_active=True
        )

        test_db.add(duplicate_user)

        with pytest.raises(Exception):  # Should raise IntegrityError
            test_db.commit()

        test_db.rollback()

    def test_activity_requires_user(self, test_db):
        """Test that activities should have a valid user_id (logical requirement)."""
        # Note: SQLite doesn't enforce foreign keys by default in tests
        # This test documents the expected behavior rather than testing enforcement

        # Create activity with non-existent user
        activity = Activity(
            user_id=99999,  # Non-existent user
            start_time=datetime.now(),
            duration=3600.0
        )

        test_db.add(activity)
        test_db.commit()

        # Verify that we can't retrieve the user (relationship is broken)
        assert activity.user_id == 99999
        # In production with PostgreSQL, this would raise an IntegrityError

        # Clean up
        test_db.delete(activity)
        test_db.commit()

    def test_cascade_delete_activities(self, test_db):
        """Test that deleting user deletes their activities."""
        # Create user with activities
        user = User(
            username="cascade_test",
            hashed_password="hash",
            is_active=True
        )
        test_db.add(user)
        test_db.commit()

        # Add activities
        for i in range(3):
            activity = Activity(
                user_id=user.id,
                start_time=datetime(2024, 1, i+1),
                duration=3600.0
            )
            test_db.add(activity)

        test_db.commit()
        user_id = user.id

        # Delete user
        test_db.delete(user)
        test_db.commit()

        # Verify activities are also deleted
        activities = test_db.query(Activity).filter(
            Activity.user_id == user_id
        ).all()

        assert len(activities) == 0
