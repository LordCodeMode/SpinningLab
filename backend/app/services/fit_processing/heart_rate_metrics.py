import pandas as pd

# Import canonical zone definitions
from shared.constants.training_zones import HEART_RATE_ZONES as HR_ZONES

def extract_hr_series(df):
    """Extract heart rate series from DataFrame."""
    try:
        if not isinstance(df, pd.DataFrame) or df.empty or "heart_rate" not in df.columns:
            return None
        
        df = df.dropna(subset=["heart_rate"])
        return df["heart_rate"].astype(int)
    except Exception as e:
        return None

def compute_avg_hr(hr_series):
    """Compute average heart rate."""
    if hr_series is None or hr_series.empty:
        return None
    return round(hr_series.mean(), 2)

def compute_hr_zones(df: pd.DataFrame, max_hr=190):
    """
    Compute time spent in heart rate zones.

    OPTIMIZED: Now accepts DataFrame instead of filepath to avoid re-parsing FIT files.

    Args:
        df: DataFrame with heart rate data from FIT file records
        max_hr: Maximum heart rate

    Returns:
        Dictionary mapping zone labels to seconds spent in each zone, or None if no HR data
    """
    try:
        hr_series = extract_hr_series(df)
        if hr_series is None or hr_series.empty:
            return None

        zone_times = {}
        for label, (low, high) in HR_ZONES.items():
            lower = int(low * max_hr)
            upper = int(high * max_hr)
            in_zone = (hr_series >= lower) & (hr_series < upper)
            zone_times[label] = int(in_zone.sum())

        return zone_times

    except Exception as e:
        return None