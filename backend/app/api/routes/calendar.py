"""
Calendar API endpoints
Handles planned workout scheduling and calendar management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date, datetime, timedelta

from ...database.connection import get_db
from ...database.models import PlannedWorkout, Workout, Activity, User
from ...services.workout_service import WorkoutService
from ..dependencies import get_current_user

router = APIRouter()


# Pydantic schemas
class PlannedWorkoutCreate(BaseModel):
    workout_id: int
    scheduled_date: date
    notes: Optional[str] = None


class PlannedWorkoutUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    sort_order: Optional[int] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None
    skipped: Optional[bool] = None
    completed_activity_id: Optional[int] = None


class PlannedWorkoutSwap(BaseModel):
    source_id: int = Field(..., ge=1)
    target_id: int = Field(..., ge=1)


class PlannedWorkoutSwap(BaseModel):
    source_id: int = Field(..., ge=1)
    target_id: int = Field(..., ge=1)


class WorkoutSummary(BaseModel):
    id: int
    name: str
    workout_type: Optional[str]
    total_duration: int
    estimated_tss: float

    class Config:
        from_attributes = True


class PlannedWorkoutResponse(BaseModel):
    id: int
    workout_id: Optional[int]
    scheduled_date: date
    sort_order: int
    notes: Optional[str]
    completed: bool
    skipped: bool
    completed_activity_id: Optional[int]
    created_at: datetime
    workout: Optional[WorkoutSummary]

    class Config:
        from_attributes = True


class CalendarDayResponse(BaseModel):
    date: date
    planned_workouts: List[PlannedWorkoutResponse]
    completed_activities: List[dict] = []  # Activities completed on this day
    planned_tss: float = 0.0
    actual_tss: float = 0.0


class CalendarWeekResponse(BaseModel):
    week_start: date
    week_end: date
    days: List[CalendarDayResponse]
    total_planned_tss: float
    total_actual_tss: float


@router.post("/", response_model=PlannedWorkoutResponse, status_code=status.HTTP_201_CREATED)
def schedule_workout(
    planned_workout_data: PlannedWorkoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Schedule a workout on a specific date
    """
    try:
        planned_workout = WorkoutService.schedule_workout(
            db=db,
            user_id=current_user.id,
            workout_id=planned_workout_data.workout_id,
            scheduled_date=planned_workout_data.scheduled_date,
            notes=planned_workout_data.notes
        )

        # Load workout relationship
        planned_workout = db.query(PlannedWorkout).options(
            joinedload(PlannedWorkout.workout)
        ).filter(PlannedWorkout.id == planned_workout.id).first()

        return planned_workout

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scheduling workout: {str(e)}")


@router.get("/", response_model=List[PlannedWorkoutResponse])
def get_planned_workouts(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all planned workouts for a date range
    If no dates provided, returns next 30 days
    """
    if not start_date:
        start_date = date.today()

    if not end_date:
        end_date = start_date + timedelta(days=30)

    planned_workouts = WorkoutService.get_planned_workouts(
        db=db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date
    )

    # Load workout relationships
    for pw in planned_workouts:
        if pw.workout:
            # Trigger lazy loading
            _ = pw.workout.name

    return planned_workouts


@router.get("/week", response_model=CalendarWeekResponse)
def get_calendar_week(
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get calendar data for a specific week
    Returns 7 days starting from week_start (defaults to this week's Monday)
    """
    # Default to current week's Monday
    if not week_start:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)

    # Get planned workouts for the week
    planned_workouts = db.query(PlannedWorkout).options(
        joinedload(PlannedWorkout.workout)
    ).filter(
        PlannedWorkout.user_id == current_user.id,
        PlannedWorkout.scheduled_date >= week_start,
        PlannedWorkout.scheduled_date <= week_end
    ).order_by(
        PlannedWorkout.scheduled_date,
        PlannedWorkout.sort_order,
        PlannedWorkout.created_at
    ).all()

    # Get activities for the week
    activities = db.query(Activity).filter(
        Activity.user_id == current_user.id,
        Activity.start_time >= datetime.combine(week_start, datetime.min.time()),
        Activity.start_time <= datetime.combine(week_end, datetime.max.time())
    ).all()

    # Organize by day
    days_data = []
    total_planned_tss = 0.0
    total_actual_tss = 0.0

    for i in range(7):
        current_date = week_start + timedelta(days=i)

        # Filter planned workouts for this day
        day_planned_workouts = [
            pw for pw in planned_workouts
            if pw.scheduled_date == current_date
        ]
        day_planned_workouts.sort(key=lambda pw: (pw.sort_order or 0, pw.created_at))

        # Filter activities for this day
        day_activities = [
            {
                "id": activity.id,
                "start_time": activity.start_time,
                "custom_name": activity.custom_name,
                "file_name": activity.file_name,
                "duration": activity.duration,
                "distance": activity.distance,
                "tss": activity.tss,
                "normalized_power": activity.normalized_power
            }
            for activity in activities
            if activity.start_time.date() == current_date
        ]

        # Calculate TSS
        day_planned_tss = sum(
            pw.workout.estimated_tss
            for pw in day_planned_workouts
            if pw.workout
        )
        day_actual_tss = sum(
            activity.tss or 0
            for activity in activities
            if activity.start_time.date() == current_date
        )

        total_planned_tss += day_planned_tss
        total_actual_tss += day_actual_tss

        days_data.append(CalendarDayResponse(
            date=current_date,
            planned_workouts=day_planned_workouts,
            completed_activities=day_activities,
            planned_tss=day_planned_tss,
            actual_tss=day_actual_tss
        ))

    return CalendarWeekResponse(
        week_start=week_start,
        week_end=week_end,
        days=days_data,
        total_planned_tss=total_planned_tss,
        total_actual_tss=total_actual_tss
    )


@router.get("/{planned_workout_id}", response_model=PlannedWorkoutResponse)
def get_planned_workout(
    planned_workout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific planned workout by ID
    """
    planned_workout = db.query(PlannedWorkout).options(
        joinedload(PlannedWorkout.workout)
    ).filter(
        PlannedWorkout.id == planned_workout_id,
        PlannedWorkout.user_id == current_user.id
    ).first()

    if not planned_workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned workout {planned_workout_id} not found"
        )

    return planned_workout


@router.put("/{planned_workout_id}", response_model=PlannedWorkoutResponse)
def update_planned_workout(
    planned_workout_id: int,
    update_data: PlannedWorkoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a planned workout (reschedule, mark completed, add notes, etc.)
    """
    planned_workout = db.query(PlannedWorkout).filter(
        PlannedWorkout.id == planned_workout_id,
        PlannedWorkout.user_id == current_user.id
    ).first()

    if not planned_workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned workout {planned_workout_id} not found"
        )

    # Update fields
    if update_data.scheduled_date is not None:
        planned_workout.scheduled_date = update_data.scheduled_date
        if update_data.sort_order is None:
            max_order = db.query(func.max(PlannedWorkout.sort_order)).filter(
                PlannedWorkout.user_id == current_user.id,
                PlannedWorkout.scheduled_date == update_data.scheduled_date
            ).scalar()
            planned_workout.sort_order = (max_order or 0) + 1

    if update_data.sort_order is not None:
        planned_workout.sort_order = update_data.sort_order

    if update_data.notes is not None:
        planned_workout.notes = update_data.notes

    if update_data.completed is not None:
        planned_workout.completed = update_data.completed

    if update_data.skipped is not None:
        planned_workout.skipped = update_data.skipped

    if update_data.completed_activity_id is not None:
        # Verify activity exists and belongs to user
        activity = db.query(Activity).filter(
            Activity.id == update_data.completed_activity_id,
            Activity.user_id == current_user.id
        ).first()

        if not activity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity {update_data.completed_activity_id} not found"
            )

        planned_workout.completed_activity_id = update_data.completed_activity_id
        planned_workout.completed = True

    db.commit()
    db.refresh(planned_workout)

    # Load workout relationship
    planned_workout = db.query(PlannedWorkout).options(
        joinedload(PlannedWorkout.workout)
    ).filter(PlannedWorkout.id == planned_workout.id).first()

    return planned_workout


@router.delete("/{planned_workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_planned_workout(
    planned_workout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a planned workout
    """
    planned_workout = db.query(PlannedWorkout).filter(
        PlannedWorkout.id == planned_workout_id,
        PlannedWorkout.user_id == current_user.id
    ).first()

    if not planned_workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned workout {planned_workout_id} not found"
        )

    db.delete(planned_workout)
    db.commit()

    return None


@router.post("/swap", response_model=List[PlannedWorkoutResponse])
def swap_planned_workouts(
    payload: PlannedWorkoutSwap,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Swap two planned workouts across days (or within the same day).
    """
    if payload.source_id == payload.target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target planned workouts must be different"
        )

    source = db.query(PlannedWorkout).filter(
        PlannedWorkout.id == payload.source_id,
        PlannedWorkout.user_id == current_user.id
    ).first()
    target = db.query(PlannedWorkout).filter(
        PlannedWorkout.id == payload.target_id,
        PlannedWorkout.user_id == current_user.id
    ).first()

    if not source or not target:
        missing = payload.source_id if not source else payload.target_id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned workout {missing} not found"
        )

    source_date = source.scheduled_date
    source_order = source.sort_order or 0
    target_date = target.scheduled_date
    target_order = target.sort_order or 0

    source.scheduled_date = target_date
    source.sort_order = target_order
    target.scheduled_date = source_date
    target.sort_order = source_order

    db.commit()

    swapped = db.query(PlannedWorkout).options(
        joinedload(PlannedWorkout.workout)
    ).filter(
        PlannedWorkout.id.in_([source.id, target.id]),
        PlannedWorkout.user_id == current_user.id
    ).all()

    return swapped


@router.post("/{planned_workout_id}/move", response_model=PlannedWorkoutResponse)
def move_planned_workout(
    planned_workout_id: int,
    new_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Move a planned workout to a new date (convenience endpoint)
    """
    planned_workout = db.query(PlannedWorkout).filter(
        PlannedWorkout.id == planned_workout_id,
        PlannedWorkout.user_id == current_user.id
    ).first()

    if not planned_workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned workout {planned_workout_id} not found"
        )

    planned_workout.scheduled_date = new_date
    db.commit()
    db.refresh(planned_workout)

    # Load workout relationship
    planned_workout = db.query(PlannedWorkout).options(
        joinedload(PlannedWorkout.workout)
    ).filter(PlannedWorkout.id == planned_workout.id).first()

    return planned_workout
