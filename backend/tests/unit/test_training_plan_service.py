from datetime import date, timedelta

import pytest

from app.database.models import Workout, PlannedWorkout
from app.services.training_plan_service import TrainingPlanService
from app.services.workout_service import WorkoutService


def _create_template_workouts(test_db, test_user):
    workouts = [
        Workout(
            user_id=test_user.id,
            name="Recovery Ride 30 min",
            workout_type="Recovery",
            total_duration=1800,
            estimated_tss=20.0,
            is_template=True,
        ),
        Workout(
            user_id=test_user.id,
            name="Endurance 60 min Z2",
            workout_type="Endurance",
            total_duration=3600,
            estimated_tss=45.0,
            is_template=True,
        ),
        Workout(
            user_id=test_user.id,
            name="Endurance 75 min Z2",
            workout_type="Endurance",
            total_duration=4500,
            estimated_tss=55.0,
            is_template=True,
        ),
    ]
    test_db.add_all(workouts)
    test_db.commit()


def test_parse_workout_entry():
    assert TrainingPlanService._parse_workout_entry(None) == (None, None)
    assert TrainingPlanService._parse_workout_entry("Sweet Spot|SS 3x10") == ("Sweet Spot", "SS 3x10")
    assert TrainingPlanService._parse_workout_entry({"workout_type": "VO2", "name": "VO2 Max 4x4"}) == ("VO2", "VO2 Max 4x4")


def test_resolve_week_entry():
    template = {
        "week_structure": [
            ["A", "B", "C"],
            ["D", "E", "F"],
        ]
    }
    assert TrainingPlanService._resolve_week_entry(template, 0, 1) == "B"
    assert TrainingPlanService._resolve_week_entry(template, 4, 2) == "F"

    flat = {"week_structure": [None, "R1", "R2"]}
    assert TrainingPlanService._resolve_week_entry(flat, 0, 1) == "R1"


def test_create_plan_from_template(test_db, test_user):
    _create_template_workouts(test_db, test_user)
    start = date.today()

    plan, scheduled_count, missing = TrainingPlanService.create_plan_from_template(
        db=test_db,
        user_id=test_user.id,
        template_id="rest-week",
        start_date=start,
        is_active=True,
    )

    assert plan.id is not None
    assert scheduled_count > 0
    assert missing == []

    planned = test_db.query(PlannedWorkout).filter(
        PlannedWorkout.user_id == test_user.id,
        PlannedWorkout.scheduled_date >= start,
        PlannedWorkout.scheduled_date <= start + timedelta(days=6),
    ).all()
    assert len(planned) == scheduled_count


def test_regenerate_plan_updates_dates(test_db, test_user):
    _create_template_workouts(test_db, test_user)
    start = date.today()

    plan, _, _ = TrainingPlanService.create_plan_from_template(
        db=test_db,
        user_id=test_user.id,
        template_id="rest-week",
        start_date=start,
        is_active=True,
    )

    new_start = start + timedelta(days=7)
    updated, scheduled_count, missing = TrainingPlanService.regenerate_plan(
        db=test_db,
        plan=plan,
        start_date=new_start,
    )

    assert updated.start_date == new_start
    assert scheduled_count > 0
    assert missing == []


def test_workout_service_crud(test_db, test_user):
    intervals = [
        {
            "duration": 600,
            "target_power_low": 90,
            "target_power_high": 95,
            "target_power_type": "percent_ftp",
            "interval_type": "work",
        },
        {
            "duration": 300,
            "target_power_low": 50,
            "target_power_high": 55,
            "target_power_type": "percent_ftp",
            "interval_type": "recovery",
        },
    ]

    workout = WorkoutService.create_workout(
        db=test_db,
        user_id=test_user.id,
        name="Test Workout",
        description="Test",
        workout_type="Sweet Spot",
        intervals_data=intervals,
    )

    assert workout.total_duration == 900
    assert workout.estimated_tss > 0

    updated = WorkoutService.update_workout(
        db=test_db,
        workout_id=workout.id,
        user_id=test_user.id,
        name="Updated Workout",
        intervals_data=intervals[:1],
    )
    assert updated.name == "Updated Workout"
    assert updated.total_duration == 600

    planned = WorkoutService.schedule_workout(
        db=test_db,
        user_id=test_user.id,
        workout_id=workout.id,
        scheduled_date=date.today(),
        notes="Plan",
    )
    assert planned.sort_order == 1

    planned2 = WorkoutService.schedule_workout(
        db=test_db,
        user_id=test_user.id,
        workout_id=workout.id,
        scheduled_date=date.today(),
        notes="Plan 2",
    )
    assert planned2.sort_order == 2

    workouts = WorkoutService.get_user_workouts(test_db, test_user.id)
    assert len(workouts) >= 1

    assert WorkoutService.delete_workout(test_db, workout.id, test_user.id) is True

