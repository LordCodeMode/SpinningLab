from datetime import datetime

import pandas as pd

from app.services.fit_processing import power_metrics
from app.services.fit_processing.heart_rate_metrics import compute_avg_hr, compute_hr_zones, extract_hr_series
from app.services.fit_processing.zones import compute_power_zones


def test_extract_power_metrics_from_dataframe():
    df = pd.DataFrame({
        "time": list(range(0, 120)),
        "power": [200 + (i % 20) for i in range(120)],
        "heart_rate": [140 + (i % 5) for i in range(120)],
        "moving": [1] * 120,
    })

    metrics = power_metrics.extract_power_metrics(df, hr_avg=145.0)
    assert metrics["avg_power"] > 0
    assert metrics["normalized_power"] is not None
    assert metrics["duration"] is not None
    assert "max_5sec_power" in metrics


def test_prepare_power_series_resamples():
    df = pd.DataFrame({
        "time": [0, 2, 4, 6, 8],
        "power": [100, 150, 200, 250, 300],
        "moving": [1, 1, 1, 1, 1],
    })
    series, duration = power_metrics._prepare_power_series(df["power"], df["time"], df["moving"])
    assert series
    assert duration is not None


def test_calculate_np_and_ef():
    series = [200.0] * 60
    np_val = power_metrics.calculate_np(series)
    assert np_val is not None
    ef = power_metrics.calculate_ef(np_val, 150.0)
    assert ef is not None


def test_compute_hr_and_power_zones():
    df = pd.DataFrame({
        "power": [100, 150, 200, 250, 300],
        "heart_rate": [110, 130, 150, 170, 180],
    })

    hr_series = extract_hr_series(df)
    assert hr_series is not None
    assert compute_avg_hr(hr_series) > 0

    hr_zones = compute_hr_zones(df, max_hr=190)
    assert hr_zones

    power_zones = compute_power_zones(df, ftp=250)
    assert power_zones

