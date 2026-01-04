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
from ..dependencies import get_current_user

router = APIRouter()


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
