import numpy as np
import pandas as pd
from typing import List, Dict, Optional

SMART_RECORDING_MAX_GAP_SECONDS = 3

def extract_power_metrics(df: pd.DataFrame, hr_avg: Optional[float] = None, user = None) -> Dict:
    """Extract power metrics from DataFrame."""
    if df.empty or "power" not in df.columns:
        return {}

    power_col = df["power"]
    time_col = df["time"] if "time" in df.columns else None

    power_series, duration_s = _prepare_power_series(power_col, time_col, df.get("moving"))
    if not power_series:
        return {}

    # Basic metrics
    avg_power = round(np.mean(power_series), 2)

    # Normalized Power (30-second rolling average)
    np_val = calculate_np(power_series)
    
    # Get user settings
    ftp_val = getattr(user, 'ftp', 250) if user else 250
    
    # Derived metrics
    tss = calculate_tss(np_val, duration_s, ftp_val)
    intensity_factor = calculate_if(np_val, ftp_val)
    efficiency_factor = calculate_ef(np_val, hr_avg)
    
    # Best power values
    best_powers = rolling_best_powers(power_series)
    
    result = {
        "avg_power": avg_power,
        "normalized_power": np_val,
        "tss": tss,
        "intensity_factor": intensity_factor,
        "efficiency_factor": efficiency_factor,
        "duration": duration_s,
        **best_powers
    }

    return result

def _prepare_power_series(power_col: pd.Series, time_col: Optional[pd.Series], moving_col: Optional[pd.Series]) -> tuple[list, Optional[float]]:
    """
    Build a 1 Hz power series aligned to elapsed time so rolling windows reflect real duration.

    Small smart-recording gaps are forward-filled with the last observed power.
    Larger gaps are treated as zero-power idle time to avoid interpolating phantom work
    across pauses or sparse recording segments.

    Returns (power_series, duration_seconds)
    """
    if power_col.isna().all():
        return [], None

    # If we have a time axis, expand to a conservative 1 Hz series.
    if time_col is not None and time_col.notna().any():
        try:
            expanded_power, moving_seconds = _expand_time_series(
                value_col=power_col,
                time_col=time_col,
                moving_col=moving_col,
                fill_value=0.0,
                apply_moving_mask=True,
            )
            if expanded_power.empty:
                return [], None

            duration_s = moving_seconds or float(len(expanded_power))
            return expanded_power.tolist(), duration_s
        except Exception:
            pass

    # Fallback: assume roughly 1Hz sampling
    clean_series = power_col.dropna().astype(float)
    if clean_series.empty:
        return [], None

    duration_s = len(clean_series)
    return clean_series.tolist(), duration_s

def _estimate_moving_seconds(time_series: pd.Series, moving_col: Optional[pd.Series]) -> Optional[float]:
    if moving_col is None or moving_col.isna().all():
        return None
    try:
        times = time_series.astype(float).tolist()
        deltas = [max(times[i] - times[i - 1], 0) if i > 0 else 0 for i in range(len(times))]
        moving_flags = [bool(v) if v is not None else False for v in moving_col.tolist()]
        return float(sum(delta for delta, is_moving in zip(deltas, moving_flags) if is_moving))
    except Exception:
        return None

def _expand_time_series(
    value_col: pd.Series,
    time_col: pd.Series,
    moving_col: Optional[pd.Series] = None,
    *,
    fill_value: float | None = 0.0,
    apply_moving_mask: bool = False,
    smart_recording_gap_seconds: int = SMART_RECORDING_MAX_GAP_SECONDS,
) -> tuple[pd.Series, Optional[float]]:
    """
    Expand smart-recorded stream samples to a conservative 1 Hz time series.

    Short gaps are forward-filled to preserve realistic workload during smart recording.
    Longer gaps are left empty and then filled with ``fill_value`` (typically zero for power)
    so pauses do not become interpolated efforts.
    """
    if value_col is None or time_col is None:
        return pd.Series(dtype="float64"), None

    frame = pd.DataFrame({
        "value": value_col,
        "time": time_col,
    })

    if moving_col is not None:
        frame["moving"] = moving_col

    frame = frame.dropna(subset=["value", "time"])
    if frame.empty:
        return pd.Series(dtype="float64"), None

    frame["time"] = frame["time"].astype(float)
    frame["elapsed_second"] = (frame["time"] - frame["time"].min()).round().astype(int)
    frame["value"] = frame["value"].astype(float)

    group_columns = {"value": "mean"}
    if "moving" in frame.columns:
        frame["moving_flag"] = frame["moving"].apply(
            lambda value: 1 if pd.notna(value) and bool(value) else 0 if pd.notna(value) else pd.NA
        )
        group_columns["moving_flag"] = "max"

    grouped = frame.groupby("elapsed_second", as_index=True).agg(group_columns).sort_index()
    if grouped.empty:
        return pd.Series(dtype="float64"), None

    full_index = pd.RangeIndex(start=0, stop=int(grouped.index.max()) + 1)
    forward_fill_limit = max(int(smart_recording_gap_seconds) - 1, 0)

    expanded = grouped["value"].reindex(full_index)
    if forward_fill_limit > 0:
        expanded = expanded.ffill(limit=forward_fill_limit)
    if fill_value is not None:
        expanded = expanded.fillna(fill_value)

    moving_seconds = None
    if "moving_flag" in grouped.columns:
        expanded_moving = grouped["moving_flag"].reindex(full_index)
        if forward_fill_limit > 0:
            expanded_moving = expanded_moving.ffill(limit=forward_fill_limit)
        expanded_moving = expanded_moving.fillna(0).astype(bool)
        moving_seconds = float(expanded_moving.sum())

        if apply_moving_mask:
            inactive_fill = fill_value if fill_value is not None else np.nan
            expanded = expanded.where(expanded_moving, inactive_fill)

    return expanded.astype(float), moving_seconds

def calculate_np(power_series: List[float]) -> Optional[float]:
    """Calculate Normalized Power."""
    if len(power_series) < 30:
        return None
    
    s = pd.Series(power_series, dtype='float64')
    rolled = s.rolling(window=30, min_periods=30).mean()
    mean_4th = (rolled.dropna() ** 4).mean()
    return round(mean_4th ** 0.25, 2) if pd.notna(mean_4th) else None

def calculate_tss(np: Optional[float], duration_s: float, ftp: float) -> Optional[float]:
    """Calculate Training Stress Score."""
    if not np or not duration_s or ftp <= 0:
        return None
    return round(((duration_s / 3600) * (np / ftp) ** 2) * 100, 2)

def calculate_if(np: Optional[float], ftp: float) -> Optional[float]:
    """Calculate Intensity Factor."""
    if not np or ftp <= 0:
        return None
    val = np / ftp
    return round(val, 3) if val < 1.5 else None

def calculate_ef(np: Optional[float], hr_avg: Optional[float]) -> Optional[float]:
    """Calculate Efficiency Factor."""
    if np and hr_avg and hr_avg > 60:
        val = np / hr_avg
        return round(val, 3) if val < 3.0 else None
    return None

def rolling_best_powers(power_series: List[float]) -> Dict[str, Optional[float]]:
    """Calculate best power values for different durations."""
    s = pd.Series(power_series)
    windows = {
        "max_5sec_power": 5,
        "max_1min_power": 60,
        "max_3min_power": 180,
        "max_5min_power": 300,
        "max_10min_power": 600,
        "max_15min_power": 900,
        "max_20min_power": 1200,
        "max_30min_power": 1800,
        "max_40min_power": 2400,
        "max_60min_power": 3600,
    }
    
    return {
        key: round(s.rolling(w, min_periods=w).mean().max(), 2) if len(s) >= w else None
        for key, w in windows.items()
    }
