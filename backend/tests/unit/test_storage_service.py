from app.services.storage_service import StorageService


def test_local_storage_roundtrip(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.storage_service.settings.STORAGE_BACKEND", "local")
    monkeypatch.setattr("app.services.storage_service.settings.FIT_FILES_DIR", str(tmp_path / "fit-files"))

    service = StorageService()
    service.put_json("streams/test.json", {"value": 42})

    assert service.exists("streams/test.json")
    assert service.get_json("streams/test.json") == {"value": 42}


def test_local_storage_readiness_creates_root(monkeypatch, tmp_path):
    storage_root = tmp_path / "storage-root"
    monkeypatch.setattr("app.services.storage_service.settings.STORAGE_BACKEND", "local")
    monkeypatch.setattr("app.services.storage_service.settings.FIT_FILES_DIR", str(storage_root))

    service = StorageService()
    status = service.readiness()

    assert status["status"] == "ok"
    assert storage_root.exists()
