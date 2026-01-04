import os
from sqlalchemy import Column, Integer, Float, String, DateTime, Text, ForeignKey, Boolean, Index, JSON, Date, Table, UniqueConstraint, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .connection import Base

activity_tag_associations = Table(
    "activity_tag_associations",
    Base.metadata,
    Column("activity_id", Integer, ForeignKey("activities.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("activity_tags.id"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now())
)

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
    strava_athlete_id = Column(BigInteger, nullable=True, unique=True)
    strava_access_token = Column(String, nullable=True)
    strava_refresh_token = Column(String, nullable=True)
    strava_token_expires_at = Column(Integer, nullable=True)  # Unix timestamp
    strava_last_sync = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    training_loads = relationship("TrainingLoad", back_populates="user", cascade="all, delete-orphan")
    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    planned_workouts = relationship("PlannedWorkout", back_populates="user", cascade="all, delete-orphan")
    training_plans = relationship("TrainingPlan", back_populates="user", cascade="all, delete-orphan")
    activity_tags = relationship("ActivityTag", cascade="all, delete-orphan")

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
    custom_name = Column(String, nullable=True)  # User-defined title, overrides file/Strava name
    file_hash = Column(String, index=True)
    file_size = Column(Integer)
    duration = Column(Float)  # seconds
    distance = Column(Float)  # km
    strava_activity_id = Column(BigInteger, nullable=True, index=True)  # For Strava-imported activities
    
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

    # User annotations
    notes = Column(Text, nullable=True)
    rpe = Column(Integer, nullable=True)  # 1-10 subjective effort

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="activities")
    power_zones = relationship("PowerZone", back_populates="activity", cascade="all, delete-orphan")
    hr_zones = relationship("HrZone", back_populates="activity", cascade="all, delete-orphan")
    tags = relationship("ActivityTag", secondary=activity_tag_associations, back_populates="activities")

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

class ActivityTag(Base):
    __tablename__ = "activity_tags"
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_activity_tags_user_name'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="activity_tags")
    activities = relationship("Activity", secondary=activity_tag_associations, back_populates="tags")

class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    workout_type = Column(String, nullable=True)  # e.g., "Sweet Spot", "VO2max", "Threshold", "Recovery", "Custom"
    total_duration = Column(Integer, nullable=False)  # Total duration in seconds
    estimated_tss = Column(Float, nullable=True)  # Estimated TSS based on intervals
    is_template = Column(Boolean, default=False)  # Is this a pre-built template?
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="workouts")
    intervals = relationship("WorkoutInterval", back_populates="workout", cascade="all, delete-orphan", order_by="WorkoutInterval.order")
    planned_workouts = relationship("PlannedWorkout", back_populates="workout", cascade="all, delete-orphan")

class WorkoutInterval(Base):
    __tablename__ = "workout_intervals"

    id = Column(Integer, primary_key=True, index=True)
    workout_id = Column(Integer, ForeignKey("workouts.id"), nullable=False)
    order = Column(Integer, nullable=False)  # Order of interval in workout
    duration = Column(Integer, nullable=False)  # Duration in seconds
    target_power_low = Column(Float, nullable=True)  # Lower power target (watts or % FTP)
    target_power_high = Column(Float, nullable=True)  # Upper power target (watts or % FTP)
    target_power_type = Column(String, default="percent_ftp")  # "percent_ftp" or "watts"
    target_hr = Column(Integer, nullable=True)  # Target heart rate
    interval_type = Column(String, nullable=False)  # e.g., "warmup", "work", "recovery", "cooldown"
    description = Column(String, nullable=True)  # e.g., "5x 3min @ 110% FTP"

    # Relationships
    workout = relationship("Workout", back_populates="intervals")

class PlannedWorkout(Base):
    __tablename__ = "planned_workouts"
    __table_args__ = (
        Index('idx_plannedworkout_user_date', 'user_id', 'scheduled_date'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workout_id = Column(Integer, ForeignKey("workouts.id"), nullable=True)  # Null if workout was deleted
    scheduled_date = Column(Date, nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    completed_activity_id = Column(Integer, ForeignKey("activities.id"), nullable=True)  # Link to completed activity
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, default=False)
    skipped = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="planned_workouts")
    workout = relationship("Workout", back_populates="planned_workouts")
    completed_activity = relationship("Activity")

class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    template_id = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    plan_type = Column(String, nullable=True)  # e.g., "Base Building", "Century Prep", "FTP Builder"
    phase = Column(String, nullable=True)  # e.g., "Base", "Build", "Peak", "Recovery"
    is_active = Column(Boolean, default=False)  # Is this the currently active plan?
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="training_plans")
