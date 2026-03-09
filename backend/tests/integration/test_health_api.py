import pytest


@pytest.mark.integration
def test_live_health(client):
    response = client.get("/api/health/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "version" in payload


@pytest.mark.integration
def test_ready_health(client):
    response = client.get("/api/health/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ok", "degraded"}
    assert "database" in payload["checks"]
    assert "storage" in payload["checks"]
