"""Unit tests for core utils and exceptions."""

from datetime import datetime, date

from app.core import exceptions
from app.utils import formatting, file_operations


def test_create_http_exception():
    exc = exceptions.create_http_exception(400, "bad request")
    assert exc.status_code == 400
    assert exc.detail == "bad request"


def test_exception_constants():
    assert exceptions.USER_NOT_FOUND.status_code == 404
    assert exceptions.INVALID_CREDENTIALS.status_code == 401
    assert exceptions.UNAUTHORIZED.status_code == 401


def test_custom_exception_classes():
    assert issubclass(exceptions.UserNotFound, exceptions.TrainingDashboardException)
    assert issubclass(exceptions.InvalidCredentials, exceptions.TrainingDashboardException)


def test_formatting_helpers():
    now = datetime(2025, 1, 15, 10, 30)
    today = date(2025, 1, 15)

    assert formatting.format_date(now) == now.isoformat()
    assert formatting.format_date(today) == today.isoformat()
    assert formatting.format_date("2025-01-15") == "2025-01-15"
    assert formatting.format_date(None) is None

    assert formatting.format_float(12.3456, decimals=2) == 12.35
    assert formatting.format_float("bad") is None
    assert formatting.format_float(None) is None

    assert formatting.format_int(123.9) == 123
    assert formatting.format_int("bad") is None

    assert formatting.format_duration(3665) == "01:01:05"
    assert formatting.format_duration("bad") == "00:00:00"

    assert formatting.format_power(250.5) == "250 W"
    assert formatting.format_power("bad") == "0 W"

    assert formatting.format_distance(5000) == "5.0 km"
    assert formatting.format_distance("bad") == "0.0 km"


def test_format_activity_response():
    class DummyActivity:
        id = 1
        start_time = datetime(2025, 1, 15, 10, 30)
        file_name = "ride.fit"
        duration = 3600.2
        distance = 40250.7
        avg_power = 210.4
        normalized_power = 225.8
        max_5sec_power = 800.9
        max_1min_power = 500.1
        max_3min_power = 420.2
        max_5min_power = 380.3
        max_10min_power = 340.4
        max_20min_power = 300.5
        max_30min_power = 280.6
        max_60min_power = 260.7
        avg_heart_rate = 152.9
        tss = 85.4
        intensity_factor = 0.82
        efficiency_factor = 1.45

    payload = formatting.format_activity_response(DummyActivity())
    assert payload["id"] == 1
    assert payload["file_name"] == "ride.fit"
    assert payload["duration"] == 3600.2
    assert payload["distance"] == 40250.7
    assert payload["avg_power"] == 210.4
    assert payload["normalized_power"] == 225.8
    assert payload["max_5sec_power"] == 801.0
    assert payload["avg_heart_rate"] == 153.0
    assert payload["tss"] == 85.4


def test_file_operations(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_text("hello")

    hash_value = file_operations.compute_file_hash(str(file_path))
    assert hash_value is not None

    size = file_operations.get_file_size(str(file_path))
    assert size == len("hello")

    new_dir = tmp_path / "nested"
    file_operations.ensure_directory_exists(str(new_dir))
    assert new_dir.exists()

    assert file_operations.compute_file_hash(str(tmp_path / "missing.txt")) is None
    assert file_operations.get_file_size(str(tmp_path / "missing.txt")) is None
