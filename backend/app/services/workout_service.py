"""
Workout Service
Handles workout creation, TSS calculation, and workout management
"""

from typing import List, Dict, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database.models import Workout, WorkoutInterval, PlannedWorkout, User


class WorkoutService:
    """Service for managing workouts and calculating training metrics"""

    @staticmethod
    def calculate_interval_tss(
        duration_seconds: int,
        target_power_low: float,
        target_power_high: float,
        power_type: str,
        user_ftp: float
    ) -> float:
        """
        Calculate TSS for a single interval

        TSS ≈ duration_hours × IF² × 100
        For planned workouts, we use the average target power as NP approximation

        Args:
            duration_seconds: Duration of interval in seconds
            target_power_low: Lower power target
            target_power_high: Upper power target
            power_type: "percent_ftp" or "watts"
            user_ftp: User's FTP in watts

        Returns:
            TSS for this interval
        """
        if not target_power_low or not target_power_high or not user_ftp or user_ftp <= 0:
            return 0.0

        # Convert to watts if necessary
        if power_type == "percent_ftp":
            power_watts_low = (target_power_low / 100) * user_ftp
            power_watts_high = (target_power_high / 100) * user_ftp
        else:
            power_watts_low = target_power_low
            power_watts_high = target_power_high

        # Use average power as NP approximation for planned intervals
        avg_power = (power_watts_low + power_watts_high) / 2

        # Calculate intensity factor (IF)
        intensity_factor = avg_power / user_ftp

        # Calculate TSS: duration_hours * IF^2 * 100
        duration_hours = duration_seconds / 3600
        tss = duration_hours * (intensity_factor ** 2) * 100

        return max(tss, 0.0)

    @staticmethod
    def calculate_workout_tss(
        intervals: List[WorkoutInterval],
        user_ftp: float
    ) -> float:
        """
        Calculate total TSS for a workout by summing interval TSS

        Args:
            intervals: List of workout intervals
            user_ftp: User's FTP in watts

        Returns:
            Total estimated TSS
        """
        total_tss = 0.0

        for interval in intervals:
            if interval.target_power_low and interval.target_power_high:
                interval_tss = WorkoutService.calculate_interval_tss(
                    duration_seconds=interval.duration,
                    target_power_low=interval.target_power_low,
                    target_power_high=interval.target_power_high,
                    power_type=interval.target_power_type,
                    user_ftp=user_ftp
                )
                total_tss += interval_tss

        return round(total_tss, 1)

    @staticmethod
    def calculate_workout_duration(intervals: List[WorkoutInterval]) -> int:
        """
        Calculate total workout duration in seconds

        Args:
            intervals: List of workout intervals

        Returns:
            Total duration in seconds
        """
        return sum(interval.duration for interval in intervals)

    @staticmethod
    def create_workout(
        db: Session,
        user_id: int,
        name: str,
        description: Optional[str],
        workout_type: Optional[str],
        intervals_data: List[Dict],
        is_template: bool = False
    ) -> Workout:
        """
        Create a new workout with intervals

        Args:
            db: Database session
            user_id: ID of user creating workout
            name: Workout name
            description: Workout description
            workout_type: Type of workout (e.g., "Sweet Spot")
            intervals_data: List of interval dictionaries with structure:
                {
                    "duration": int (seconds),
                    "target_power_low": float,
                    "target_power_high": float,
                    "target_power_type": str,
                    "target_hr": int (optional),
                    "interval_type": str,
                    "description": str (optional)
                }
            is_template: Whether this is a template workout

        Returns:
            Created Workout object
        """
        # Get user's FTP for TSS calculation
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        # Create workout
        workout = Workout(
            user_id=user_id,
            name=name,
            description=description,
            workout_type=workout_type,
            total_duration=0,  # Will be calculated from intervals
            estimated_tss=0.0,  # Will be calculated from intervals
            is_template=is_template
        )

        db.add(workout)
        db.flush()  # Get the workout ID

        # Create intervals
        intervals = []
        for idx, interval_data in enumerate(intervals_data):
            interval = WorkoutInterval(
                workout_id=workout.id,
                order=idx,
                duration=interval_data["duration"],
                target_power_low=interval_data.get("target_power_low"),
                target_power_high=interval_data.get("target_power_high"),
                target_power_type=interval_data.get("target_power_type", "percent_ftp"),
                target_hr=interval_data.get("target_hr"),
                interval_type=interval_data["interval_type"],
                description=interval_data.get("description")
            )
            intervals.append(interval)
            db.add(interval)

        # Calculate total duration and TSS
        workout.total_duration = WorkoutService.calculate_workout_duration(intervals)
        workout.estimated_tss = WorkoutService.calculate_workout_tss(intervals, user.ftp)

        db.commit()
        db.refresh(workout)

        return workout

    @staticmethod
    def update_workout(
        db: Session,
        workout_id: int,
        user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        workout_type: Optional[str] = None,
        intervals_data: Optional[List[Dict]] = None
    ) -> Workout:
        """
        Update an existing workout

        Args:
            db: Database session
            workout_id: ID of workout to update
            user_id: ID of user (for authorization)
            name: New workout name
            description: New description
            workout_type: New workout type
            intervals_data: New intervals data (if provided, replaces all intervals)

        Returns:
            Updated Workout object
        """
        workout = db.query(Workout).filter(
            Workout.id == workout_id,
            Workout.user_id == user_id
        ).first()

        if not workout:
            raise ValueError(f"Workout {workout_id} not found for user {user_id}")

        # Update basic fields
        if name is not None:
            workout.name = name
        if description is not None:
            workout.description = description
        if workout_type is not None:
            workout.workout_type = workout_type

        # Update intervals if provided
        if intervals_data is not None:
            # Delete existing intervals
            db.query(WorkoutInterval).filter(
                WorkoutInterval.workout_id == workout_id
            ).delete()

            # Get user's FTP
            user = db.query(User).filter(User.id == user_id).first()

            # Create new intervals
            intervals = []
            for idx, interval_data in enumerate(intervals_data):
                interval = WorkoutInterval(
                    workout_id=workout.id,
                    order=idx,
                    duration=interval_data["duration"],
                    target_power_low=interval_data.get("target_power_low"),
                    target_power_high=interval_data.get("target_power_high"),
                    target_power_type=interval_data.get("target_power_type", "percent_ftp"),
                    target_hr=interval_data.get("target_hr"),
                    interval_type=interval_data["interval_type"],
                    description=interval_data.get("description")
                )
                intervals.append(interval)
                db.add(interval)

            # Recalculate duration and TSS
            workout.total_duration = WorkoutService.calculate_workout_duration(intervals)
            workout.estimated_tss = WorkoutService.calculate_workout_tss(intervals, user.ftp)

        workout.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(workout)

        return workout

    @staticmethod
    def delete_workout(db: Session, workout_id: int, user_id: int) -> bool:
        """
        Delete a workout

        Args:
            db: Database session
            workout_id: ID of workout to delete
            user_id: ID of user (for authorization)

        Returns:
            True if deleted, False if not found
        """
        workout = db.query(Workout).filter(
            Workout.id == workout_id,
            Workout.user_id == user_id
        ).first()

        if not workout:
            return False

        db.delete(workout)
        db.commit()

        return True

    @staticmethod
    def get_workout(db: Session, workout_id: int, user_id: int) -> Optional[Workout]:
        """
        Get a workout by ID

        Args:
            db: Database session
            workout_id: ID of workout
            user_id: ID of user (for authorization)

        Returns:
            Workout object or None
        """
        return db.query(Workout).filter(
            Workout.id == workout_id,
            Workout.user_id == user_id
        ).first()

    @staticmethod
    def get_user_workouts(
        db: Session,
        user_id: int,
        include_templates: bool = True,
        workout_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Workout]:
        """
        Get all workouts for a user

        Args:
            db: Database session
            user_id: ID of user
            include_templates: Whether to include template workouts
            workout_type: Filter by workout type
            limit: Maximum number of workouts to return
            offset: Offset for pagination

        Returns:
            List of Workout objects
        """
        query = db.query(Workout).filter(Workout.user_id == user_id)

        if not include_templates:
            query = query.filter(Workout.is_template == False)

        if workout_type:
            query = query.filter(Workout.workout_type == workout_type)

        query = query.order_by(Workout.created_at.desc())
        query = query.limit(limit).offset(offset)

        return query.all()

    @staticmethod
    def schedule_workout(
        db: Session,
        user_id: int,
        workout_id: int,
        scheduled_date: date,
        notes: Optional[str] = None
    ) -> PlannedWorkout:
        """
        Schedule a workout on a specific date

        Args:
            db: Database session
            user_id: ID of user
            workout_id: ID of workout to schedule
            scheduled_date: Date to schedule workout
            notes: Optional notes for this scheduled workout

        Returns:
            PlannedWorkout object
        """
        # Verify workout exists and belongs to user
        workout = db.query(Workout).filter(
            Workout.id == workout_id,
            Workout.user_id == user_id
        ).first()

        if not workout:
            raise ValueError(f"Workout {workout_id} not found for user {user_id}")

        existing_max = db.query(func.max(PlannedWorkout.sort_order)).filter(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.scheduled_date == scheduled_date
        ).scalar()
        next_order = (existing_max or 0) + 1

        # Create planned workout
        planned_workout = PlannedWorkout(
            user_id=user_id,
            workout_id=workout_id,
            scheduled_date=scheduled_date,
            sort_order=next_order,
            notes=notes,
            completed=False,
            skipped=False
        )

        db.add(planned_workout)
        db.commit()
        db.refresh(planned_workout)

        return planned_workout

    @staticmethod
    def get_planned_workouts(
        db: Session,
        user_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[PlannedWorkout]:
        """
        Get planned workouts for a user within a date range

        Args:
            db: Database session
            user_id: ID of user
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)

        Returns:
            List of PlannedWorkout objects
        """
        query = db.query(PlannedWorkout).filter(PlannedWorkout.user_id == user_id)

        if start_date:
            query = query.filter(PlannedWorkout.scheduled_date >= start_date)

        if end_date:
            query = query.filter(PlannedWorkout.scheduled_date <= end_date)

        query = query.order_by(PlannedWorkout.scheduled_date, PlannedWorkout.sort_order, PlannedWorkout.created_at)

        return query.all()
