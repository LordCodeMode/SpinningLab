"""Integration tests for activities API endpoints."""

import pytest
from datetime import datetime, timedelta

from app.database.models import User, Activity


class TestGetActivities:
    """Test GET /api/activities endpoint."""

    def test_get_activities_success(self, client, test_db, test_user, auth_headers):
        """Test retrieving activities for authenticated user."""
        # Create test activities
        for i in range(5):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i),
                duration=3600,
                distance=20000.0,
                avg_power=200.0 + i * 10,
                file_name=f"test_activity_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        response = client.get("/api/activities", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert "total" in data
        assert data["total"] >= 5
        assert len(data["activities"]) >= 5

    def test_get_activities_with_pagination(self, client, test_db, test_user, auth_headers):
        """Test pagination parameters."""
        # Create 15 activities
        for i in range(15):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i),
                duration=3600,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        # Test skip and limit
        response = client.get("/api/activities?skip=0&limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 5

        response = client.get("/api/activities?skip=5&limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 5

    def test_get_activities_with_date_filters(self, client, test_db, test_user, auth_headers):
        """Test date range filtering."""
        now = datetime.utcnow()

        # Create activities at different dates
        for days_ago in [1, 5, 10, 20, 30]:
            activity = Activity(
                user_id=test_user.id,
                start_time=now - timedelta(days=days_ago),
                duration=3600,
                file_name=f"test_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        # Test start_date filter
        start_date = (now - timedelta(days=15)).isoformat()
        response = client.get(f"/api/activities?start_date={start_date}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3  # Activities from 1, 5, 10 days ago

        # Test end_date filter
        end_date = (now - timedelta(days=15)).isoformat()
        response = client.get(f"/api/activities?end_date={end_date}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # Activities from 20, 30 days ago

    def test_get_activities_unauthorized(self, client):
        """Test that unauthorized requests are rejected."""
        response = client.get("/api/activities")
        assert response.status_code == 401


class TestGetActivity:
    """Test GET /api/activities/{activity_id} endpoint."""

    def test_get_activity_success(self, client, test_db, test_user, auth_headers):
        """Test retrieving a single activity."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            distance=25000.0,
            avg_power=220.0,
            normalized_power=235.0,
            max_5sec_power=450.0,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        response = client.get(f"/api/activities/{activity.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == activity.id
        assert data["avg_power"] == 220.0
        assert data["normalized_power"] == 235.0

    def test_get_activity_not_found(self, client, test_db, auth_headers):
        """Test getting non-existent activity."""
        response = client.get("/api/activities/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_activity_wrong_user(self, client, test_db, test_user, auth_headers):
        """Test that users can't access other users' activities."""
        # Create another user and their activity
        other_user = User(
            username="otheruser",
            email="other@example.com",
            hashed_password="hashed"
        )
        test_db.add(other_user)
        test_db.commit()

        other_activity = Activity(
            user_id=other_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            file_name="other.fit"
        )
        test_db.add(other_activity)
        test_db.commit()

        response = client.get(f"/api/activities/{other_activity.id}", headers=auth_headers)
        assert response.status_code == 404  # Should not find it


class TestUpdateActivity:
    """Test PATCH /api/activities/{activity_id} endpoint."""

    def test_update_activity_name(self, client, test_db, test_user, auth_headers):
        """Test updating activity custom name."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()

        response = client.patch(
            f"/api/activities/{activity.id}",
            json={"name": "My Epic Ride"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["activity"]["name"] == "My Epic Ride"

        # Verify in database
        test_db.refresh(activity)
        assert activity.custom_name == "My Epic Ride"

    def test_update_activity_not_found(self, client, test_db, auth_headers):
        """Test updating non-existent activity."""
        response = client.patch(
            "/api/activities/99999",
            json={"custom_name": "Test"},
            headers=auth_headers
        )
        assert response.status_code == 404


class TestDeleteActivity:
    """Test DELETE /api/activities/{activity_id} endpoint."""

    def test_delete_activity_success(self, client, test_db, test_user, auth_headers):
        """Test deleting an activity."""
        activity = Activity(
            user_id=test_user.id,
            start_time=datetime.utcnow(),
            duration=3600,
            file_name="test.fit"
        )
        test_db.add(activity)
        test_db.commit()
        activity_id = activity.id

        response = client.delete(f"/api/activities/{activity_id}", headers=auth_headers)

        assert response.status_code == 200

        # Verify deletion
        deleted_activity = test_db.query(Activity).filter_by(id=activity_id).first()
        assert deleted_activity is None

    def test_delete_activity_not_found(self, client, test_db, auth_headers):
        """Test deleting non-existent activity."""
        response = client.delete("/api/activities/99999", headers=auth_headers)
        assert response.status_code == 404


class TestGetActivityStats:
    """Test GET /api/activities/summary endpoint."""

    def test_get_stats_success(self, client, test_db, test_user, auth_headers):
        """Test retrieving activity statistics."""
        # Create activities with various metrics
        for i in range(10):
            activity = Activity(
                user_id=test_user.id,
                start_time=datetime.utcnow() - timedelta(days=i),
                duration=3600 + i * 100,
                distance=20000.0 + i * 1000,
                avg_power=200.0 + i * 5,
                tss=100.0 + i * 5,
                file_name=f"test_{i}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        response = client.get("/api/activities/summary?days=30", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "total_distance" in data
        assert "total_duration" in data
        assert data["count"] >= 10

    def test_get_stats_with_date_filters(self, client, test_db, test_user, auth_headers):
        """Test summary with date filtering."""
        now = datetime.utcnow()

        # Create activities at different dates
        for days_ago in [1, 5, 10, 20]:
            activity = Activity(
                user_id=test_user.id,
                start_time=now - timedelta(days=days_ago),
                duration=3600,
                distance=20000.0,
                file_name=f"test_{days_ago}.fit"
            )
            test_db.add(activity)
        test_db.commit()

        # Get summary for last 15 days
        response = client.get("/api/activities/summary?days=15", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 3  # 1, 5, 10 days ago

    def test_get_stats_empty(self, client, test_db, test_user, auth_headers):
        """Test stats when no activities exist."""
        response = client.get("/api/activities/summary", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["total_distance"] == 0.0
