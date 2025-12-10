import os
from sqlalchemy import Column, Integer, Float, String, DateTime, Text, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)  # Full name of the user
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Settings
    ftp = Column(Float, default=250)
    weight = Column(Float, default=70)
    hr_max = Column(Integer, default=190)
    hr_rest = Column(Integer, default=60)

    # Strava OAuth
    strava_athlete_id = Column(Integer, nullable=True, unique=True)
    strava_access_token = Column(String, nullable=True)
    strava_refresh_token = Column(String, nullable=True)
    strava_token_expires_at = Column(Integer, nullable=True)  # Unix timestamp

    # Relationships
    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    training_loads = relationship("TrainingLoad", back_populates="user", cascade="all, delete-orphan")

class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        Index('idx_activity_user_time', 'user_id', 'start_time'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Basic info
    start_time = Column(DateTime, index=True)
    file_name = Column(String)
    file_hash = Column(String, index=True)
    file_size = Column(Integer)
    duration = Column(Float)  # seconds
    distance = Column(Float)  # km
    strava_activity_id = Column(Integer, nullable=True, index=True)  # For Strava-imported activities
    
    # Power metrics
    avg_power = Column(Float)
    normalized_power = Column(Float)
    max_5sec_power = Column(Float)
    max_1min_power = Column(Float)
    max_3min_power = Column(Float)
    max_5min_power = Column(Float)
    max_10min_power = Column(Float)
    max_20min_power = Column(Float)
    max_30min_power = Column(Float)
    max_60min_power = Column(Float)
    
    # Heart rate
    avg_heart_rate = Column(Float)
    max_heart_rate = Column(Float)
    
    # Training metrics
    tss = Column(Float)
    intensity_factor = Column(Float)
    efficiency_factor = Column(Float)
    critical_power = Column(Float)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="activities")
    power_zones = relationship("PowerZone", back_populates="activity", cascade="all, delete-orphan")
    hr_zones = relationship("HrZone", back_populates="activity", cascade="all, delete-orphan")

    def get_fit_path(self):
        from ..core.config import settings  # Local import to avoid circular dependency
        if not self.file_hash:
            return None
        return os.path.join(settings.FIT_FILES_DIR, str(self.user_id), f"{self.file_hash}.fit")

class PowerZone(Base):
    __tablename__ = "power_zones"
    __table_args__ = (
        Index('idx_powerzone_activity_label', 'activity_id', 'zone_label'),
    )

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), nullable=False)
    zone_label = Column(String, nullable=False)
    seconds_in_zone = Column(Integer, nullable=False)

    activity = relationship("Activity", back_populates="power_zones")

class HrZone(Base):
    __tablename__ = "hr_zones"
    __table_args__ = (
        Index('idx_hrzone_activity_label', 'activity_id', 'zone_label'),
    )

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), nullable=False)
    zone_label = Column(String, nullable=False)
    seconds_in_zone = Column(Integer, nullable=False)

    activity = relationship("Activity", back_populates="hr_zones")

class TrainingLoad(Base):
    __tablename__ = "training_load"
    __table_args__ = (
        Index('idx_trainingload_user_date', 'user_id', 'date'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    ctl = Column(Float)  # Chronic Training Load
    atl = Column(Float)  # Acute Training Load
    tsb = Column(Float)  # Training Stress Balance

    user = relationship("User", back_populates="training_loads")
