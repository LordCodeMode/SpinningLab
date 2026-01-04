import pandas as pd
from typing import Dict

# Import canonical zone definitions
from shared.constants.training_zones import POWER_ZONES as POWER_ZONE_RANGES

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

        df = df.dropna(subset=["power"])
        df["power"] = df["power"].astype(float)

        zone_seconds = {}
        for label, (low_factor, high_factor) in POWER_ZONE_RANGES.items():
            low_watt = low_factor * ftp
            high_watt = high_factor * ftp
            in_zone = df["power"].between(low_watt, high_watt, inclusive="left")
            zone_seconds[label] = int(in_zone.sum())

        return zone_seconds

    except Exception as e:
        return {}