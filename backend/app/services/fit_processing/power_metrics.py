import numpy as np
import pandas as pd
from typing import List, Dict, Optional

def extract_power_metrics(df: pd.DataFrame, hr_avg: Optional[float] = None, user = None) -> Dict:
    """Extract power metrics from DataFrame."""
    if df.empty or "power" not in df.columns:
        return {}
    
    power_series = df["power"].dropna().astype(float).tolist()
    if not power_series:
        return {}
    
    # Duration calculation - handle moving time
    duration_s = len(df)  # 1Hz data
    if "speed" in df.columns:
        moving_mask = df["speed"].fillna(0) > 0.5
        duration_s = moving_mask.sum()
    
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
        "max_20min_power": 1200,
        "max_30min_power": 1800,
        "max_60min_power": 3600,
    }
    
    return {
        key: round(s.rolling(w, min_periods=w).mean().max(), 2) if len(s) >= w else None
        for key, w in windows.items()
    }