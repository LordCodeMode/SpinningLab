from fitparse import FitFile
import pandas as pd
from datetime import datetime

def extract_core_metrics(filepath):
    try:
        fitfile = FitFile(filepath)
        records = []

        for record in fitfile.get_messages("record"):
            fields = {f.name: f.value for f in record}
            records.append(fields)

        df = pd.DataFrame(records)
        if df.empty or "timestamp" not in df.columns:
            return None

        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp")

        # Calculate duration
        time_diffs = df["timestamp"].diff().dt.total_seconds().dropna()
        sampling_rate = time_diffs.median() if not time_diffs.empty else 1.0
        duration = sampling_rate * len(df)

        distance = df["distance"].dropna().max() if "distance" in df.columns else None

        return {
            "start_time": df["timestamp"].iloc[0],
            "duration": duration,
            "distance": distance / 1000 if distance else None  # Convert to km
        }

    except Exception as e:
        return None