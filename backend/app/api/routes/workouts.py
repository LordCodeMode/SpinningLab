"""
Workouts API endpoints
Handles CRUD operations for workouts
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from ...database.connection import get_db
from ...database.models import Workout, WorkoutInterval, User
from ...services.workout_service import WorkoutService
from ...scripts.seed_workout_templates import WORKOUT_TEMPLATES, TEMPLATE_NAME_ALIASES
from ..dependencies import get_current_user

router = APIRouter()


def _normalize_name(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _normalize_existing_workouts_for_user(db: Session, user_id: int) -> None:
    """
    Normalize existing workout intervals so each interval has one exact target
    value instead of a range.
    """
    user_ftp = db.query(User.ftp).filter(User.id == user_id).scalar() or 250.0
    workouts = db.query(Workout).options(joinedload(Workout.intervals)).filter(
        Workout.user_id == user_id
    ).all()

    changed = False
    for workout in workouts:
        workout_changed = False
        for interval in workout.intervals:
            interval_data = {
                "target_power_low": interval.target_power_low,
                "target_power_high": interval.target_power_high
            }
            normalized = WorkoutService.normalize_interval_target(interval_data)
            normalized_low = normalized.get("target_power_low")
            normalized_high = normalized.get("target_power_high")

            if interval.target_power_low != normalized_low:
                interval.target_power_low = normalized_low
                workout_changed = True
            if interval.target_power_high != normalized_high:
                interval.target_power_high = normalized_high
                workout_changed = True

        if workout_changed:
            workout.total_duration = WorkoutService.calculate_workout_duration(workout.intervals)
            workout.estimated_tss = WorkoutService.calculate_workout_tss(workout.intervals, float(user_ftp))
            changed = True

    if changed:
        db.commit()


def _canonical_interval_signature(interval: dict) -> tuple:
    return (
        int(interval.get("duration") or 0),
        interval.get("target_power_low"),
        interval.get("target_power_high"),
        interval.get("target_power_type") or "percent_ftp",
        interval.get("interval_type") or "work",
        interval.get("description"),
    )


def _db_interval_signature(interval: WorkoutInterval) -> tuple:
    return (
        int(interval.duration or 0),
        interval.target_power_low,
        interval.target_power_high,
        interval.target_power_type or "percent_ftp",
        interval.interval_type or "work",
        interval.description,
    )


def _reconcile_template_metadata_for_user(db: Session, user_id: int) -> None:
    """
    Keep already-seeded user templates aligned with current canonical definitions:
    - rename legacy non-English template names to English
    - sync workout_type + description with canonical template metadata
    """
    templates = db.query(Workout).filter(
        Workout.user_id == user_id,
        Workout.is_template == True
    ).all()

    if not templates:
        return

    alias_by_normalized = {
        _normalize_name(old_name): new_name
        for old_name, new_name in TEMPLATE_NAME_ALIASES.items()
    }
    canonical_by_name = {
        _normalize_name(template.get("name")): template
        for template in WORKOUT_TEMPLATES
        if template.get("name")
    }

    changed = False
    user_ftp = db.query(User.ftp).filter(User.id == user_id).scalar() or 250.0

    for workout in templates:
        normalized_name = _normalize_name(workout.name)
        renamed_to = alias_by_normalized.get(normalized_name)
        if renamed_to and workout.name != renamed_to:
            workout.name = renamed_to
            changed = True
            normalized_name = _normalize_name(renamed_to)

        canonical = canonical_by_name.get(normalized_name)
        if not canonical:
            continue

        canonical_type = canonical.get("workout_type")
        canonical_description = canonical.get("description")
        canonical_intervals = canonical.get("intervals", [])

        if canonical_type and workout.workout_type != canonical_type:
            workout.workout_type = canonical_type
            changed = True

        if canonical_description and workout.description != canonical_description:
            workout.description = canonical_description
            changed = True

        # Keep template interval structures aligned with canonical definitions.
        # This guarantees ramp test protocol replacements are applied for
        # existing users as well, not only for newly created templates.
        existing_intervals = sorted(workout.intervals or [], key=lambda item: item.order or 0)
        existing_signature = [_db_interval_signature(interval) for interval in existing_intervals]
        canonical_signature = [_canonical_interval_signature(interval) for interval in canonical_intervals]

        if existing_signature != canonical_signature:
            db.query(WorkoutInterval).filter(WorkoutInterval.workout_id == workout.id).delete()

            for idx, interval_data in enumerate(canonical_intervals):
                db.add(WorkoutInterval(
                    workout_id=workout.id,
                    order=idx,
                    duration=int(interval_data.get("duration") or 0),
                    target_power_low=interval_data.get("target_power_low"),
                    target_power_high=interval_data.get("target_power_high"),
                    target_power_type=interval_data.get("target_power_type", "percent_ftp"),
                    target_hr=interval_data.get("target_hr"),
                    interval_type=interval_data.get("interval_type", "work"),
                    description=interval_data.get("description"),
                ))

            workout.total_duration = sum(int(interval.get("duration") or 0) for interval in canonical_intervals)
            interval_tss_values = [
                WorkoutService.calculate_interval_tss(
                    duration_seconds=int(interval.get("duration") or 0),
                    target_power_low=interval.get("target_power_low"),
                    target_power_high=interval.get("target_power_high"),
                    power_type=interval.get("target_power_type", "percent_ftp"),
                    user_ftp=float(user_ftp),
                )
                for interval in canonical_intervals
                if interval.get("target_power_low") is not None and interval.get("target_power_high") is not None
            ]
            workout.estimated_tss = round(sum(interval_tss_values), 1)
            changed = True

    # Remove obsolete/duplicate ramp-test templates so only current canonical
    # ramp templates remain visible in the library.
    canonical_ramp_names = {
        _normalize_name(template.get("name"))
        for template in WORKOUT_TEMPLATES
        if template.get("workout_type") == "Ramp Test" and template.get("name")
    }
    kept_ramp_names = set()
    for workout in templates:
        if workout.workout_type != "Ramp Test":
            continue
        normalized_name = _normalize_name(workout.name)
        if normalized_name not in canonical_ramp_names:
            db.delete(workout)
            changed = True
            continue
        if normalized_name in kept_ramp_names:
            db.delete(workout)
            changed = True
            continue
        kept_ramp_names.add(normalized_name)

    if changed:
        db.commit()


def _ensure_templates_for_user(db: Session, user_id: int) -> None:
    """
    Ensure default workout templates exist for this user.
    This keeps workout library / live training selectors populated without
    requiring a separate manual seed command.
    """
    _reconcile_template_metadata_for_user(db, user_id)

    existing_template_names = {
        str(name).strip().lower()
        for (name,) in db.query(Workout.name).filter(
            Workout.user_id == user_id,
            Workout.is_template == True
        ).all()
    }

    for template in WORKOUT_TEMPLATES:
        name = str(template.get("name") or "").strip()
        if not name:
            continue
        normalized = name.lower()
        if normalized in existing_template_names:
            continue

        try:
            WorkoutService.create_workout(
                db=db,
                user_id=user_id,
                name=name,
                description=template.get("description"),
                workout_type=template.get("workout_type"),
                intervals_data=template.get("intervals", []),
                is_template=True
            )
            existing_template_names.add(normalized)
        except Exception:
            db.rollback()


# Pydantic schemas
class WorkoutIntervalCreate(BaseModel):
    duration: int = Field(..., description="Duration in seconds")
    target_power_low: Optional[float] = Field(None, description="Lower power target")
    target_power_high: Optional[float] = Field(None, description="Upper power target")
    target_power_type: str = Field("percent_ftp", description="percent_ftp or watts")
    target_hr: Optional[int] = Field(None, description="Target heart rate")
    interval_type: str = Field(..., description="warmup, work, recovery, or cooldown")
    description: Optional[str] = Field(None, description="Interval description")


class WorkoutIntervalResponse(BaseModel):
    id: int
    order: int
    duration: int
    target_power_low: Optional[float]
    target_power_high: Optional[float]
    target_power_type: str
    target_hr: Optional[int]
    interval_type: str
    description: Optional[str]

    class Config:
        from_attributes = True


class WorkoutCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    workout_type: Optional[str] = None
    intervals: List[WorkoutIntervalCreate]
    is_template: bool = False


class WorkoutUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    workout_type: Optional[str] = None
    intervals: Optional[List[WorkoutIntervalCreate]] = None


class WorkoutResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    workout_type: Optional[str]
    total_duration: int
    estimated_tss: float
    is_template: bool
    created_at: datetime
    updated_at: Optional[datetime]
    intervals: List[WorkoutIntervalResponse]

    class Config:
        from_attributes = True


class WorkoutListResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    workout_type: Optional[str]
    total_duration: int
    estimated_tss: float
    is_template: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def create_workout(
    workout_data: WorkoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new workout with intervals
    """
    try:
        # Convert Pydantic models to dicts
        intervals_data = [interval.model_dump() for interval in workout_data.intervals]

        workout = WorkoutService.create_workout(
            db=db,
            user_id=current_user.id,
            name=workout_data.name,
            description=workout_data.description,
            workout_type=workout_data.workout_type,
            intervals_data=intervals_data,
            is_template=workout_data.is_template
        )

        # Fetch with intervals loaded
        workout = db.query(Workout).options(
            joinedload(Workout.intervals)
        ).filter(Workout.id == workout.id).first()

        return workout

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating workout: {str(e)}")


@router.get("/", response_model=List[WorkoutListResponse])
def get_workouts(
    include_templates: bool = True,
    workout_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all workouts for the current user
    """
    _normalize_existing_workouts_for_user(db, current_user.id)

    if include_templates:
        _ensure_templates_for_user(db, current_user.id)

    workouts = WorkoutService.get_user_workouts(
        db=db,
        user_id=current_user.id,
        include_templates=include_templates,
        workout_type=workout_type,
        limit=limit,
        offset=offset
    )

    return workouts


@router.get("/{workout_id}", response_model=WorkoutResponse)
def get_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific workout by ID with all intervals
    """
    _normalize_existing_workouts_for_user(db, current_user.id)

    workout = db.query(Workout).options(
        joinedload(Workout.intervals)
    ).filter(
        Workout.id == workout_id,
        Workout.user_id == current_user.id
    ).first()

    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout {workout_id} not found"
        )

    return workout


@router.put("/{workout_id}", response_model=WorkoutResponse)
def update_workout(
    workout_id: int,
    workout_data: WorkoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing workout
    """
    try:
        # Convert intervals if provided
        intervals_data = None
        if workout_data.intervals is not None:
            intervals_data = [interval.model_dump() for interval in workout_data.intervals]

        workout = WorkoutService.update_workout(
            db=db,
            workout_id=workout_id,
            user_id=current_user.id,
            name=workout_data.name,
            description=workout_data.description,
            workout_type=workout_data.workout_type,
            intervals_data=intervals_data
        )

        # Fetch with intervals loaded
        workout = db.query(Workout).options(
            joinedload(Workout.intervals)
        ).filter(Workout.id == workout.id).first()

        return workout

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating workout: {str(e)}")


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a workout
    """
    success = WorkoutService.delete_workout(
        db=db,
        workout_id=workout_id,
        user_id=current_user.id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout {workout_id} not found"
        )

    return None


@router.post("/{workout_id}/duplicate", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def duplicate_workout(
    workout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Duplicate an existing workout
    """
    # Get original workout with intervals
    original_workout = db.query(Workout).options(
        joinedload(Workout.intervals)
    ).filter(
        Workout.id == workout_id,
        Workout.user_id == current_user.id
    ).first()

    if not original_workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout {workout_id} not found"
        )

    # Convert intervals to dict format
    intervals_data = [
        {
            "duration": interval.duration,
            "target_power_low": interval.target_power_low,
            "target_power_high": interval.target_power_high,
            "target_power_type": interval.target_power_type,
            "target_hr": interval.target_hr,
            "interval_type": interval.interval_type,
            "description": interval.description
        }
        for interval in original_workout.intervals
    ]

    # Create duplicate
    new_workout = WorkoutService.create_workout(
        db=db,
        user_id=current_user.id,
        name=f"{original_workout.name} (Copy)",
        description=original_workout.description,
        workout_type=original_workout.workout_type,
        intervals_data=intervals_data,
        is_template=False  # Duplicates are not templates
    )

    # Fetch with intervals loaded
    new_workout = db.query(Workout).options(
        joinedload(Workout.intervals)
    ).filter(Workout.id == new_workout.id).first()

    return new_workout
