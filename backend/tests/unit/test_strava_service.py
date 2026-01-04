import asyncio
from datetime import datetime, timezone

import pytest

from app.database.models import Activity, User
from app.services.strava_service import StravaService


@pytest.mark.asyncio
async def test_get_valid_token_refreshes(test_db):
    user = User(
        username="stravauser",
        email="strava@example.com",
        hashed_password="hashed",
        strava_access_token="old",
        strava_refresh_token="refresh",
        strava_token_expires_at=int(datetime.now().timestamp()) - 10,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)

    service = StravaService()

    async def fake_refresh(token):
        return {
            "access_token": "new-token",
            "refresh_token": "new-refresh",
            "expires_at": int(datetime.now().timestamp()) + 3600,
        }

    service.refresh_access_token = fake_refresh
    token = await service.get_valid_token(user, test_db)
    assert token == "new-token"


def test_parse_strava_activity():
    service = StravaService()
    data = {
        "id": 123,
        "name": "Morning Ride",
        "start_date": "2024-01-01T10:00:00Z",
        "moving_time": 3600,
        "distance": 30000,
        "average_watts": 210,
        "average_heartrate": 145,
        "max_heartrate": 180,
    }

    parsed = service.parse_strava_activity(data)
    assert parsed["strava_activity_id"] == 123
    assert parsed["custom_name"] == "Morning Ride"
    assert parsed["duration"] == 3600
    assert parsed["distance"] == 30


def test_streams_to_dataframe_and_process(monkeypatch):
    service = StravaService()
    streams = {
        "time": {"data": [0, 1, 2, 3]},
        "watts": {"data": [100, 150, 200, 250]},
        "heartrate": {"data": [120, 130, 140, 150]},
        "distance": {"data": [0, 10, 20, 30]},
        "moving": {"data": [1, 1, 1, 1]},
        "velocity_smooth": {"data": [3.0, 3.2, 3.1, 3.3]},
    }

    df, moving_seconds, elapsed = service._streams_to_dataframe(streams)
    assert df is not None
    assert moving_seconds is not None
    assert elapsed is not None

    monkeypatch.setattr(
        "app.services.strava_service.extract_power_metrics",
        lambda df, hr_avg, user: {"avg_power": 200, "normalized_power": 210, "tss": 50, "intensity_factor": 0.8},
    )
    monkeypatch.setattr(
        "app.services.strava_service.compute_power_zones",
        lambda df, ftp: {"Z1": 10, "Z2": 20},
    )
    monkeypatch.setattr(
        "app.services.strava_service.compute_hr_zones",
        lambda df, hr_max: {"Z1": 5, "Z2": 15},
    )

    user = User(username="u", hashed_password="x", ftp=250, hr_max=190)
    metrics = service._process_streams(streams, user)
    assert metrics["avg_heart_rate"] > 0
    assert metrics["power_zones"]
    assert metrics["hr_zones"]


@pytest.mark.asyncio
async def test_import_user_activities(monkeypatch, test_db):
    user = User(
        username="stravaimport",
        email="import@example.com",
        hashed_password="hashed",
        strava_access_token="token",
        strava_refresh_token="refresh",
        strava_token_expires_at=int(datetime.now().timestamp()) + 3600,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)

    service = StravaService()

    async def fake_get_valid_token(u, db):
        return "token"

    async def fake_fetch_activities(token, after=None, per_page=200, limit=None):
        return [
            {"id": 111, "start_date": "2024-01-01T10:00:00Z", "moving_time": 3600, "distance": 20000, "type": "Ride", "sport_type": "Ride"},
            {"id": 222, "start_date": "2024-01-02T10:00:00Z", "moving_time": 1800, "distance": 5000, "type": "Run", "sport_type": "Run"},
            {"id": 111, "start_date": "2024-01-01T10:00:00Z", "moving_time": 3600, "distance": 20000, "type": "Ride", "sport_type": "Ride"},
        ]

    async def fake_fetch_streams(token, activity_id, stream_types=None):
        return {"time": {"data": [0, 1, 2]}, "watts": {"data": [100, 110, 120]}, "heartrate": {"data": [120, 125, 130]}}

    monkeypatch.setattr(service, "get_valid_token", fake_get_valid_token)
    monkeypatch.setattr(service, "fetch_athlete_activities", fake_fetch_activities)
    monkeypatch.setattr(service, "fetch_activity_streams", fake_fetch_streams)
    monkeypatch.setattr(service, "_store_streams", lambda activity_id, streams: None)
    monkeypatch.setattr(
        service,
        "_process_streams",
        lambda streams, user: {
            "avg_power": 200,
            "normalized_power": 210,
            "tss": 50,
            "intensity_factor": 0.8,
            "power_zones": [{"zone_label": "Z1", "seconds_in_zone": 10}],
            "hr_zones": [{"zone_label": "Z1", "seconds_in_zone": 8}],
        },
    )

    result = await service.import_user_activities(user, test_db)
    assert result["imported"] == 1
    assert result["skipped"] >= 1
    assert test_db.query(Activity).filter(Activity.user_id == user.id).count() == 1
