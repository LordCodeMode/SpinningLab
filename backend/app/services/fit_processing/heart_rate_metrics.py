import pandas as pd
from fitparse import FitFile

HR_ZONES = {
    "Z1 (Recovery)": (0.50, 0.60),
    "Z2 (Endurance)": (0.60, 0.70),
    "Z3 (GA2)": (0.70, 0.80),
    "Z4 (Threshold)": (0.80, 0.90),
    "Z5 (VO2max)": (0.90, 1.00),
}

def extract_hr_series(df):
    """Extract heart rate series from DataFrame."""
    try:
        if not isinstance(df, pd.DataFrame) or df.empty or "heart_rate" not in df.columns:
            return None
        
        df = df.dropna(subset=["heart_rate"])
        return df["heart_rate"].astype(int)
    except Exception as e:
        print(f"Error extracting HR series: {e}")
        return None

def compute_avg_hr(hr_series):
    """Compute average heart rate."""
    if hr_series is None or hr_series.empty:
        return None
    return round(hr_series.mean(), 2)

def compute_hr_zones(filepath, max_hr=190):
    """Compute time spent in heart rate zones."""
    try:
        fitfile = FitFile(filepath)
        records = [
            {field.name: field.value for field in record if field.value is not None}
            for record in fitfile.get_messages("record")
        ]
        df = pd.DataFrame(records)
        
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
        print(f"Error computing HR zones: {e}")
        return None