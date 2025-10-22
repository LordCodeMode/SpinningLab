from typing import Dict, Tuple

# Power Zone Definitions (Coggan, 2006)
POWER_ZONES: Dict[str, Tuple[float, float]] = {
    "Z1 (Recovery)": (0.0, 0.55),
    "Z2 (Endurance)": (0.55, 0.75),
    "Z3 (Tempo)": (0.75, 0.90),
    "Z4 (Threshold)": (0.90, 1.05),
    "Z5 (VO2max)": (1.05, 1.20),
    "Z6 (Anaerobic)": (1.20, 1.50),
    "Z7 (Sprint)": (1.50, 10.0)
}

# Heart Rate Zone Definitions (Seiler, 2010)
HEART_RATE_ZONES: Dict[str, Tuple[float, float]] = {
    "Z1 (Recovery)": (0.50, 0.60),
    "Z2 (Endurance)": (0.60, 0.70),
    "Z3 (GA2)": (0.70, 0.80),
    "Z4 (Threshold)": (0.80, 0.90),
    "Z5 (VO2max)": (0.90, 1.00),
}

# Zone Colors for UI
ZONE_COLORS: Dict[str, str] = {
    "Z1 (Recovery)": "#c7f6c1",
    "Z2 (Endurance)": "#9ce4a5", 
    "Z3 (Tempo)": "#ffe285",
    "Z3 (GA2)": "#ffe285",
    "Z4 (Threshold)": "#fab57e",
    "Z5 (VO2max)": "#f1998e",
    "Z6 (Anaerobic)": "#d67777",
    "Z7 (Sprint)": "#c9a0db"
}

# Training Load Constants
CTL_TIME_CONSTANT = 42  # Chronic Training Load (days)
ATL_TIME_CONSTANT = 7   # Acute Training Load (days)

# Default User Settings
DEFAULT_USER_SETTINGS = {
    "ftp": 250,
    "weight": 70.0,
    "hr_max": 190,
    "hr_rest": 60
}

# Training Intensity Factors
INTENSITY_FACTOR_RANGES = {
    "Recovery": (0.0, 0.55),
    "Endurance": (0.55, 0.75),
    "Tempo": (0.75, 0.90),
    "Threshold": (0.90, 1.05),
    "VO2max": (1.05, 1.20),
    "Anaerobic": (1.20, 1.50)
}