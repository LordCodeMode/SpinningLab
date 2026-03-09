from io import BytesIO

import pytest

from app.core.security import create_access_token
from app.services.auth_service import AuthService


@pytest.mark.integration
def test_cookie_session_requires_csrf_for_mutating_requests(client, test_user, test_user_data):
    login_response = client.post(
        "/api/auth/login",
        data={"username": test_user_data["username"], "password": test_user_data["password"]},
    )
    assert login_response.status_code == 200

    response = client.put("/api/settings/", json={"ftp": 280.0})
    assert response.status_code == 403

    csrf_token = client.cookies.get("td_csrf")
    response = client.put(
        "/api/settings/",
        json={"ftp": 280.0},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert response.status_code == 200


@pytest.mark.integration
def test_rebuild_cache_returns_job_and_status(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.import_routes.run_cache_rebuild_job",
        lambda user_id, mode="full": {
            "success": True,
            "mode": mode,
            "duration_seconds": 0.01,
            "operations": {},
        },
    )

    response = client.post("/api/import/rebuild-cache", headers=auth_headers)

    assert response.status_code == 202
    payload = response.json()
    assert payload["job_id"]

    status_response = client.get(f"/api/jobs/{payload['job_id']}", headers=auth_headers)
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["status"] in {"running", "succeeded"}


@pytest.mark.integration
def test_fit_import_returns_async_job(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.import_routes.run_fit_import_job",
        lambda user_id, staged_files: {
            "results": [{"filename": staged_files[0]["filename"], "success": True, "message": "Imported"}],
            "total": 1,
            "successful": 1,
            "failed": 0,
            "cache_rebuild_triggered": True,
            "message": "Imported 1 files. Cache rebuild completed.",
        },
    )

    response = client.post(
        "/api/import/fit-files",
        headers=auth_headers,
        files={"files": ("test.fit", BytesIO(b"fake-fit-data"), "application/octet-stream")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["job_id"]

    status_response = client.get(f"/api/jobs/{payload['job_id']}", headers=auth_headers)
    assert status_response.status_code == 200
    job_payload = status_response.json()
    assert job_payload["status"] == "succeeded"
    assert job_payload["result"]["successful"] == 1


@pytest.mark.integration
def test_strava_sync_returns_async_job(client, test_db, test_user, auth_headers, monkeypatch):
    test_user.strava_athlete_id = 12345
    test_user.strava_access_token = "token"
    test_user.strava_refresh_token = "refresh"
    test_user.strava_token_expires_at = 9999999999
    test_db.commit()

    monkeypatch.setattr(
        "app.api.routes.strava.run_strava_sync_job",
        lambda user_id, after_iso=None, limit=None: {
            "success": True,
            "message": "Imported 2 activities from Strava",
            "stats": {"imported": 2, "skipped": 0},
            "cache_rebuild_triggered": True,
        },
    )

    response = client.post("/api/strava/sync", headers=auth_headers)

    assert response.status_code == 202
    payload = response.json()
    assert payload["job_id"]

    status_response = client.get(f"/api/jobs/{payload['job_id']}", headers=auth_headers)
    assert status_response.status_code == 200
    assert status_response.json()["result"]["success"] is True


@pytest.mark.integration
def test_job_status_is_scoped_to_owner(client, test_db, test_user_data, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.import_routes.run_cache_rebuild_job",
        lambda user_id, mode="full": {
            "success": True,
            "mode": mode,
        },
    )

    other_user = AuthService(test_db).create_user(
        username="otheruser",
        password=test_user_data["password"],
        email="other@example.com",
        name="Other User",
        is_email_verified=True,
    )
    test_db.commit()

    response = client.post("/api/import/rebuild-cache", headers=auth_headers)
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    other_headers = {"Authorization": f"Bearer {create_access_token({'sub': other_user.username})}"}
    status_response = client.get(f"/api/jobs/{job_id}", headers=other_headers)
    assert status_response.status_code == 404
