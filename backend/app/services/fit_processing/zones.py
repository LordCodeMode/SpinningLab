import pandas as pd
from typing import Dict

# Import canonical zone definitions
from shared.constants.training_zones import POWER_ZONES as POWER_ZONE_RANGES
from .power_metrics import _expand_time_series

def compute_power_zones(df: pd.DataFrame, ftp: float) -> Dict[str, int]:
    """
    Compute time spent in power zones.

    OPTIMIZED: Now accepts DataFrame instead of filepath to avoid re-parsing FIT files.

    Args:
        df: DataFrame with power data from FIT file records
        ftp: Functional Threshold Power

    Returns:
        Dictionary mapping zone labels to seconds spent in each zone
    """
    try:
        if df.empty or "power" not in df.columns:
            return {}

        power_series = None
        if "time" in df.columns and df["time"].notna().any():
            expanded_power, _ = _expand_time_series(
                value_col=df["power"],
                time_col=df["time"],
                moving_col=df["moving"] if "moving" in df.columns else None,
                fill_value=0.0,
                apply_moving_mask=True,
            )
            power_series = expanded_power if not expanded_power.empty else None

        if power_series is None:
            power_series = df["power"].dropna().astype(float)

        if power_series is None or power_series.empty:
            return {}

        zone_seconds = {}
        for label, (low_factor, high_factor) in POWER_ZONE_RANGES.items():
            low_watt = low_factor * ftp
            high_watt = high_factor * ftp
            in_zone = power_series.between(low_watt, high_watt, inclusive="left")
            zone_seconds[label] = int(in_zone.sum())

        return zone_seconds

    except Exception as e:
        return {}
