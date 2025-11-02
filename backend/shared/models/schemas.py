from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional, Literal

# User schemas
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    name: Optional[str] = None  # Full name

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    ftp: Optional[float] = 250
    weight: Optional[float] = 70
    hr_max: Optional[int] = 190
    hr_rest: Optional[int] = 60

    class Config:
        from_attributes = True

class UserSettings(BaseModel):
    ftp: Optional[float] = None
    weight: Optional[float] = None
    hr_max: Optional[int] = None
    hr_rest: Optional[int] = None

# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str

# Activity schemas
class ActivityBase(BaseModel):
    start_time: Optional[datetime]
    duration: Optional[float]
    distance: Optional[float]

class ActivityResponse(ActivityBase):
    id: int
    file_name: Optional[str]
    avg_power: Optional[float]
    normalized_power: Optional[float]
    avg_heart_rate: Optional[float]
    tss: Optional[float]
    intensity_factor: Optional[float]
    efficiency_factor: Optional[float]
    max_5min_power: Optional[float]
    max_20min_power: Optional[float]

    class Config:
        from_attributes = True

class ActivitySummary(BaseModel):
    count: int
    total_duration: float
    total_distance: float
    total_tss: float
    avg_power: float
    avg_heart_rate: float
    period_days: int

# Import schemas
class ImportResult(BaseModel):
    filename: str
    success: bool
    message: str
    activity_id: Optional[int] = None

# Analysis schemas
class PowerCurveResponse(BaseModel):
    durations: List[int]
    powers: List[float]
    weighted: bool = False

class ZoneData(BaseModel):
    zone_label: str                  # z.B. "Z2 (Endurance)"
    seconds_in_zone: int             # Gesamtdauer in Sekunden
    percentage: float                # Anteil in %
    watt_range: Optional[str] = None # z.B. "150–210 W" (nur Power)
    hr_range: Optional[str] = None   # z.B. "128–144 bpm" (nur HR)

    class Config:
        from_attributes = True

class ZoneDistributionResponse(BaseModel):
    zone_data: List[ZoneData]        # Liste aller Zonen (in definierter Reihenfolge)
    total_time: int                  # Summe aller Sekunden
    period_days: Optional[int] = None# Zeitraum der Abfrage (Tage), None = alle

    class Config:
        from_attributes = True

class VO2MaxResponse(BaseModel):
    vo2max: float                        # geschätzte VO₂max in ml/kg/min
    method: Optional[str] = None         # z. B. "HR-based", "CP-based", "Garmin Estimation"
    activity_id: Optional[int] = None    # falls aus einer Aktivität berechnet
    date: Optional[datetime] = None      # Zeitpunkt der Berechnung
    weight: Optional[float] = None       # verwendetes Körpergewicht (kg)
    source: Optional[str] = None         # Herkunft der Daten (z. B. "fit_file", "manual")

    class Config:
        from_attributes = True

class CriticalPowerResponse(BaseModel):
    # Kernwerte
    critical_power: float           # CP in Watt
    w_prime: float                  # W′ in Joule (bei 2-Parameter-Modell)

    # Modell & Güte
    model: Literal["2p"] = "2p"     # 2-Parameter-Modell P(t) = W′/t + CP
    r2: Optional[float] = None
    rmse: Optional[float] = None

    # Datenbasis
    n_points: int
    min_duration: int               # Sekunden
    max_duration: int               # Sekunden

    # Kurven
    durations: List[int]            # t in s (min_duration..max_duration)
    actual: List[float]             # gemessene Power(t)
    predicted: List[float]          # vorhergesagte Power(t)

    class Config:
        from_attributes = True

class TrainingLoadResponse(BaseModel):
    date: datetime
    ctl: float
    atl: float
    tsb: float
    tss: float = 0.0
