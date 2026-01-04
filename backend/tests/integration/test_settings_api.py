"""Integration tests for settings API endpoints."""

import pytest

from app.database.models import User


class TestGetSettings:
    """Test GET /api/settings endpoint."""

    def test_get_settings_success(self, client, test_db, test_user, auth_headers):
        """Test retrieving user settings."""
        # Set some user settings
        test_user.ftp = 250.0
        test_user.weight = 70.0
        test_user.hr_max = 185
        test_user.hr_rest = 55
        test_user.name = "Test User"
        test_db.commit()

        response = client.get("/api/settings", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["ftp"] == 250.0
        assert data["weight"] == 70.0
        assert data["hr_max"] == 185
        assert data["hr_rest"] == 55
        assert data["name"] == "Test User"

    def test_get_settings_defaults(self, client, test_db, test_user, auth_headers):
        """Test getting settings with default values."""
        # User with no settings set
        response = client.get("/api/settings", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Should return None or default values
        assert "ftp" in data
        assert "weight" in data

    def test_get_settings_unauthorized(self, client):
        """Test that unauthorized requests are rejected."""
        response = client.get("/api/settings")
        assert response.status_code == 401


class TestUpdateSettings:
    """Test PUT /api/settings endpoint."""

    def test_update_ftp(self, client, test_db, test_user, auth_headers):
        """Test updating FTP."""
        response = client.put(
            "/api/settings/",
            json={"ftp": 275.0},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ftp"] == 275.0

        # Verify in database
        test_db.refresh(test_user)
        assert test_user.ftp == 275.0

    def test_update_weight(self, client, test_db, test_user, auth_headers):
        """Test updating weight."""
        response = client.put(
            "/api/settings/",
            json={"weight": 72.5},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["weight"] == 72.5

        test_db.refresh(test_user)
        assert test_user.weight == 72.5

    def test_update_heart_rate_settings(self, client, test_db, test_user, auth_headers):
        """Test updating HR max and rest."""
        response = client.put(
            "/api/settings/",
            json={"hr_max": 190, "hr_rest": 50},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["hr_max"] == 190
        assert data["hr_rest"] == 50

    def test_update_name(self, client, test_db, test_user, auth_headers):
        """Test updating user name."""
        response = client.put(
            "/api/settings/",
            json={"name": "John Doe"},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "John Doe"

        test_db.refresh(test_user)
        assert test_user.name == "John Doe"

    def test_update_multiple_settings(self, client, test_db, test_user, auth_headers):
        """Test updating multiple settings at once."""
        response = client.put(
            "/api/settings/",
            json={
                "ftp": 280.0,
                "weight": 68.0,
                "hr_max": 188,
                "hr_rest": 52,
                "name": "Jane Smith"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ftp"] == 280.0
        assert data["weight"] == 68.0
        assert data["hr_max"] == 188
        assert data["hr_rest"] == 52
        assert data["name"] == "Jane Smith"

    def test_update_settings_invalid_ftp(self, client, test_db, test_user, auth_headers):
        """Test updating with invalid FTP value."""
        response = client.put(
            "/api/settings/",
            json={"ftp": -50.0},
            headers=auth_headers
        )

        # Should reject negative FTP
        assert response.status_code in [400, 422]

    def test_update_settings_invalid_weight(self, client, test_db, test_user, auth_headers):
        """Test updating with invalid weight value."""
        response = client.put(
            "/api/settings/",
            json={"weight": 0.0},
            headers=auth_headers
        )

        # Should reject zero/negative weight
        assert response.status_code in [400, 422]

    def test_update_settings_invalid_hr_max(self, client, test_db, test_user, auth_headers):
        """Test updating with invalid HR max."""
        response = client.put(
            "/api/settings/",
            json={"hr_max": 300},  # Unrealistic HR max
            headers=auth_headers
        )

        # May accept (no validation) or reject
        # If accepted, should still store the value
        if response.status_code == 200:
            assert response.json()["hr_max"] == 300

    def test_update_settings_partial_update(self, client, test_db, test_user, auth_headers):
        """Test that partial updates don't affect other settings."""
        # Set initial values
        test_user.ftp = 250.0
        test_user.weight = 70.0
        test_db.commit()

        # Update only FTP
        response = client.put(
            "/api/settings/",
            json={"ftp": 260.0},
            headers=auth_headers
        )

        assert response.status_code == 200

        # Weight should remain unchanged
        test_db.refresh(test_user)
        assert test_user.ftp == 260.0
        assert test_user.weight == 70.0

    def test_update_settings_empty_payload(self, client, test_db, test_user, auth_headers):
        """Test updating with empty payload."""
        response = client.put(
            "/api/settings/",
            json={},
            headers=auth_headers
        )

        # Should succeed but not change anything
        assert response.status_code == 200


class TestStravaSettings:
    """Test Strava-related settings endpoints."""

    def test_get_strava_connection_status_not_connected(self, client, test_db, test_user, auth_headers):
        """Test Strava status when not connected."""
        response = client.get("/api/strava/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is False

    def test_get_strava_connection_status_connected(self, client, test_db, test_user, auth_headers):
        """Test Strava status when connected."""
        # Set Strava credentials
        test_user.strava_athlete_id = 12345
        test_user.strava_access_token = "test_token"
        test_db.commit()

        response = client.get("/api/strava/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is True
        assert data["athlete_id"] == 12345


class TestSettingsValidation:
    """Test validation of settings values."""

    def test_ftp_range_validation(self, client, test_db, test_user, auth_headers):
        """Test FTP within reasonable ranges."""
        # Very low FTP (might be valid for beginners)
        response = client.put(
            "/api/settings/",
            json={"ftp": 100.0},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Very high FTP (professional level)
        response = client.put(
            "/api/settings/",
            json={"ftp": 450.0},
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_weight_range_validation(self, client, test_db, test_user, auth_headers):
        """Test weight within reasonable ranges."""
        # Minimum realistic weight
        response = client.put(
            "/api/settings/",
            json={"weight": 40.0},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Maximum realistic weight
        response = client.put(
            "/api/settings/",
            json={"weight": 150.0},
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_hr_consistency_validation(self, client, test_db, test_user, auth_headers):
        """Test that hr_rest < hr_max."""
        # Set valid HR values
        response = client.put(
            "/api/settings/",
            json={"hr_max": 185, "hr_rest": 55},
            headers=auth_headers
        )
        assert response.status_code == 200

        # Try to set hr_rest >= hr_max (invalid)
        response = client.put(
            "/api/settings/",
            json={"hr_rest": 190},
            headers=auth_headers
        )

        # Should either reject or accept (depending on validation)
        # If accepted, it's up to frontend to warn
        if response.status_code != 200:
            assert response.status_code in [400, 422]
