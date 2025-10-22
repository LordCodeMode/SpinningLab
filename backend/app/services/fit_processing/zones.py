import pandas as pd
from fitparse import FitFile
from typing import Dict

POWER_ZONE_RANGES = {
    "Z1 (Recovery)": (0.0, 0.55),
    "Z2 (Endurance)": (0.55, 0.75),
    "Z3 (Tempo)": (0.75, 0.90),
    "Z4 (Threshold)": (0.90, 1.05),
    "Z5 (VO2max)": (1.05, 1.20),
    "Z6 (Anaerobic)": (1.20, 1.50),
    "Z7 (Sprint)": (1.50, 10.0)
}

def compute_power_zones(filepath: str, ftp: float) -> Dict[str, int]:
    """Compute time spent in power zones."""
    try:
        fitfile = FitFile(filepath)
        records = [{field.name: field.value for field in rec} for rec in fitfile.get_messages('record')]
        df = pd.DataFrame(records)

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
        print(f"Error computing power zones for {filepath}: {e}")
        return {}