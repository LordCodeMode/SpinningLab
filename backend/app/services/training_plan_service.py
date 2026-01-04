"""
Training Plan Service
Creates training plans and schedules workouts from templates.
"""

from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple, Union

from sqlalchemy.orm import Session

from ..database.models import PlannedWorkout, TrainingPlan, Workout
from ..services.workout_service import WorkoutService
from ..scripts.seed_workout_templates import WORKOUT_TEMPLATES


TRAINING_PLAN_TEMPLATES: List[Dict[str, Union[str, int, List]]] = [
    {
        "id": "base-8",
        "name": "8-Week Base Builder",
        "description": "Build aerobic base with steady endurance and sweet spot work.",
        "plan_type": "Base Building",
        "phase": "Base",
        "weeks": 8,
        "week_structure": [
            [None, "Sweet Spot|Sweet Spot 3x10", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 4x8", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 90 min Z2", "Endurance|Endurance 60 min Z2"],
            [None, "Sweet Spot|Sweet Spot 3x12", "Endurance|Endurance 75 min Z2", "Sweet Spot|Sweet Spot 2x20", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2h Z2", "Endurance|Endurance 75 min Z2"],
            [None, "Sweet Spot|Sweet Spot 2x20", "Endurance|Endurance 90 min Z2", "Sweet Spot|Sweet Spot 3x12", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None],
            [None, "Sweet Spot|Sweet Spot 4x8", "Endurance|Endurance 90 min Z2", "Sweet Spot|Sweet Spot 3x12", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Sweet Spot|Sweet Spot 2x20", "Endurance|Endurance 90 min Z2", "Sweet Spot|Sweet Spot 3x12", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Sweet Spot|Sweet Spot 4x8", "Endurance|Endurance 90 min Z2", "Sweet Spot|Sweet Spot 2x20", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None]
        ]
    },
    {
        "id": "century-12",
        "name": "12-Week Century Prep",
        "description": "Progressive endurance focus with threshold and VO2 work.",
        "plan_type": "Century Prep",
        "phase": "Build",
        "weeks": 12,
        "week_structure": [
            [None, "Sweet Spot|Sweet Spot 3x10", "Endurance|Endurance 75 min Z2", "Sweet Spot|Sweet Spot 4x8", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Sweet Spot|Sweet Spot 3x12", "Endurance|Endurance 90 min Z2", "Threshold|Threshold 3x12", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Sweet Spot|Sweet Spot 2x20", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 4x4", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None],
            [None, "Threshold|Threshold 3x12", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 5x3", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Threshold|Threshold 4x8", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 4x4", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 3h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Threshold|Over-Unders 4x8", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 5x3", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 3h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None],
            [None, "Threshold|Threshold 3x10", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 4x4", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 3h Z2", "Endurance|Endurance 2h Z2"],
            [None, "Threshold|Threshold 4x8", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 5x3", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 3h Z2", "Endurance|Endurance 2.5h Z2"],
            [None, "Threshold|Over-Unders 4x8", "Endurance|Endurance 90 min Z2", "VO2max|VO2 Max 4x4", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 3h Z2", "Endurance|Endurance 2h Z2"],
            [None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None]
        ]
    },
    {
        "id": "ftp-3",
        "name": "FTP Builder (3-Week Block)",
        "description": "Short block targeting sustained power improvements.",
        "plan_type": "FTP Builder",
        "phase": "Build",
        "weeks": 3,
        "week_structure": [
            [None, "Threshold|Threshold 3x12", "Sweet Spot|Sweet Spot 4x8", "VO2max|VO2 Max 4x4", "Recovery|Recovery Ride 45 min", "Threshold|FTP 2x20", "Recovery|Recovery Ride 30 min"],
            [None, "Threshold|Threshold 4x8", "Sweet Spot|Sweet Spot 2x20", "VO2max|VO2 Max 5x3", "Recovery|Recovery Ride 45 min", "Threshold|Over-Unders 4x8", "Recovery|Recovery Ride 30 min"],
            [None, "Threshold|Threshold 3x10", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None]
        ]
    },
    {
        "id": "rest-week",
        "name": "Rest & Reset Week",
        "description": "Low stress week with light endurance and recovery rides.",
        "plan_type": "Recovery",
        "phase": "Recovery",
        "weeks": 1,
        "week_structure": [
            None,
            "Recovery|Recovery Ride 30 min",
            "Endurance|Endurance 60 min Z2",
            None,
            "Recovery|Recovery Ride 30 min",
            "Endurance|Endurance 75 min Z2",
            None
        ]
    },
    {
        "id": "polarized-6",
        "name": "Polarized Base Builder (6-Week)",
        "description": "Polarized 80/20 plan with two high-intensity sessions plus aerobic volume. ~6-8 hours/week.",
        "plan_type": "Base Building",
        "phase": "Base",
        "weeks": 6,
        "week_structure": [
            [None, "VO2max|VO2 Max 4x4", "Endurance|Endurance 90 min Z2", None, "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "VO2max|VO2 Max 5x3", "Endurance|Endurance 90 min Z2", None, "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "VO2max|VO2 Max 4x4", "Endurance|Endurance 60 min Z2", None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None],
            [None, "VO2max|VO2 Max 5x3", "Endurance|Endurance 90 min Z2", "Anaerobic|Sprint Intervals 8x1min", "Recovery|Recovery Ride 45 min", "Endurance|Endurance 2.5h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "VO2max|VO2 Max 4x4", "Endurance|Endurance 90 min Z2", None, "Recovery|Recovery Ride 45 min", "Endurance|Endurance 3h Z2", "Endurance|Endurance 90 min Z2"],
            [None, "VO2max|VO2 Max 4x4", "Endurance|Endurance 60 min Z2", None, "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None]
        ]
    },
    {
        "id": "sweet-spot-4",
        "name": "Time-Crunched Sweet Spot (4-Week)",
        "description": "High-density sweet spot and threshold focus for time-crunched athletes. ~4-6 hours/week.",
        "plan_type": "Build",
        "phase": "Build",
        "weeks": 4,
        "week_structure": [
            [None, "Sweet Spot|Sweet Spot 3x10", "Endurance|Endurance 60 min Z2", "Sweet Spot|Sweet Spot 4x8", None, "Endurance|Endurance 90 min Z2", "Recovery|Recovery Ride 30 min"],
            [None, "Sweet Spot|Sweet Spot 3x12", "Endurance|Endurance 60 min Z2", "Threshold|Threshold 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", "Sweet Spot|Sweet Spot 2x20"],
            [None, "Sweet Spot|Sweet Spot 4x8", "Endurance|Endurance 60 min Z2", "Threshold|Threshold 4x8", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", "Sweet Spot|Sweet Spot 2x20"],
            [None, "Sweet Spot|Sweet Spot 3x10", "Endurance|Endurance 60 min Z2", "Threshold|Threshold 3x10", "Recovery|Recovery Ride 30 min", "Endurance|Endurance 90 min Z2", None]
        ]
    }
]


class TrainingPlanService:
    """Service for creating training plans and scheduling workouts."""

    @staticmethod
    def get_template(template_id: str) -> Optional[Dict]:
        return next((t for t in TRAINING_PLAN_TEMPLATES if t["id"] == template_id), None)

    @staticmethod
    def get_templates() -> List[Dict]:
        return TRAINING_PLAN_TEMPLATES

    @staticmethod
    def _parse_workout_entry(entry) -> Tuple[Optional[str], Optional[str]]:
        if not entry:
            return None, None

        if isinstance(entry, dict):
            workout_type = entry.get("workout_type") or entry.get("type")
            workout_name = entry.get("workout_name") or entry.get("name")
            return (workout_type.strip() if isinstance(workout_type, str) else workout_type,
                    workout_name.strip() if isinstance(workout_name, str) else workout_name)

        if isinstance(entry, str) and "|" in entry:
            workout_type, workout_name = entry.split("|", 1)
            return workout_type.strip(), workout_name.strip()

        return entry, None

    @staticmethod
    def _find_workout(db: Session, user_id: int, workout_type: Optional[str], workout_name: Optional[str]) -> Optional[Workout]:
        query = db.query(Workout).filter(Workout.user_id == user_id)

        if workout_name:
            workout = query.filter(Workout.name.ilike(workout_name)).order_by(
                Workout.is_template.desc(), Workout.created_at.desc()
            ).first()
            if workout:
                return workout

        if workout_type:
            return query.filter(
                Workout.workout_type == workout_type
            ).order_by(Workout.is_template.desc(), Workout.created_at.desc()).first()

        return None

    @staticmethod
    def _resolve_week_entry(template: Dict, week_index: int, day_index: int):
        week_structure = template.get("week_structure", [])
        if not week_structure:
            return None

        first = week_structure[0]
        if isinstance(first, list):
            if week_index < len(week_structure):
                week = week_structure[week_index]
            else:
                week = week_structure[-1]
            return week[day_index] if day_index < len(week) else None

        return week_structure[day_index] if day_index < len(week_structure) else None

    @staticmethod
    def _match_seed_template(workout_type: Optional[str], workout_name: Optional[str]) -> Optional[Dict]:
        if workout_name:
            for template in WORKOUT_TEMPLATES:
                if template["name"].lower() == workout_name.lower():
                    return template

        if workout_type:
            for template in WORKOUT_TEMPLATES:
                if template["workout_type"].lower() == workout_type.lower():
                    return template

        return None

    @staticmethod
    def _infer_template_id(plan: TrainingPlan) -> Optional[str]:
        if not plan:
            return None

        for template in TRAINING_PLAN_TEMPLATES:
            if plan.name and plan.name == template["name"]:
                return template["id"]
            if plan.description and plan.description == template["description"]:
                return template["id"]

        if plan.start_date and plan.end_date:
            total_days = (plan.end_date - plan.start_date).days + 1
            weeks = total_days // 7 if total_days > 0 else None
        else:
            weeks = None

        for template in TRAINING_PLAN_TEMPLATES:
            if plan.plan_type and plan.plan_type == template["plan_type"]:
                if plan.phase and plan.phase != template.get("phase"):
                    continue
                if weeks and weeks != template["weeks"]:
                    continue
                return template["id"]

        return None

    @staticmethod
    def _ensure_workout_template(
        db: Session,
        user_id: int,
        workout_type: Optional[str],
        workout_name: Optional[str]
    ) -> Optional[Workout]:
        template = TrainingPlanService._match_seed_template(workout_type, workout_name)
        if not template:
            return None

        try:
            return WorkoutService.create_workout(
                db=db,
                user_id=user_id,
                name=template["name"],
                description=template.get("description"),
                workout_type=template.get("workout_type"),
                intervals_data=template.get("intervals", []),
                is_template=True
            )
        except Exception:
            return None

    @staticmethod
    def create_plan_from_template(
        db: Session,
        user_id: int,
        template_id: str,
        start_date: date,
        name: Optional[str] = None,
        is_active: bool = True
    ) -> Tuple[TrainingPlan, int, List[str]]:
        template = TrainingPlanService.get_template(template_id)
        if not template:
            raise ValueError("Template not found")

        plan_name = name or template["name"]
        total_days = template["weeks"] * 7
        end_date = start_date + timedelta(days=total_days - 1)

        if is_active:
            db.query(TrainingPlan).filter(
                TrainingPlan.user_id == user_id,
                TrainingPlan.is_active == True
            ).update({TrainingPlan.is_active: False})

        plan = TrainingPlan(
            user_id=user_id,
            name=plan_name,
            description=template["description"],
            template_id=template_id,
            start_date=start_date,
            end_date=end_date,
            plan_type=template["plan_type"],
            phase=template.get("phase"),
            is_active=is_active
        )
        db.add(plan)
        db.flush()

        scheduled_count = 0
        missing_types: List[str] = []

        for day_offset in range(total_days):
            week_index = day_offset // 7
            day_index = day_offset % 7
            workout_entry = TrainingPlanService._resolve_week_entry(template, week_index, day_index)
            workout_type, workout_name = TrainingPlanService._parse_workout_entry(workout_entry)
            if not workout_type and not workout_name:
                continue

            workout = TrainingPlanService._find_workout(db, user_id, workout_type, workout_name)
            if not workout:
                workout = TrainingPlanService._ensure_workout_template(db, user_id, workout_type, workout_name)

            if not workout:
                missing_key = workout_name or workout_type
                if missing_key and missing_key not in missing_types:
                    missing_types.append(missing_key)
                continue

            scheduled_date = start_date + timedelta(days=day_offset)
            planned = PlannedWorkout(
                user_id=user_id,
                workout_id=workout.id,
                scheduled_date=scheduled_date,
                notes=f"{plan_name} plan"
            )
            db.add(planned)
            scheduled_count += 1

        db.commit()
        db.refresh(plan)

        return plan, scheduled_count, missing_types

    @staticmethod
    def regenerate_plan(
        db: Session,
        plan: TrainingPlan,
        template_id: Optional[str] = None,
        start_date: Optional[date] = None
    ) -> Tuple[TrainingPlan, int, List[str]]:
        resolved_template_id = template_id or plan.template_id or TrainingPlanService._infer_template_id(plan)
        if not resolved_template_id:
            raise ValueError("Template not found for this plan")

        template = TrainingPlanService.get_template(resolved_template_id)
        if not template:
            raise ValueError("Template not found for this plan")

        # Delete existing scheduled workouts for this plan
        if plan.start_date and plan.end_date:
            db.query(PlannedWorkout).filter(
                PlannedWorkout.user_id == plan.user_id,
                PlannedWorkout.scheduled_date >= plan.start_date,
                PlannedWorkout.scheduled_date <= plan.end_date,
                PlannedWorkout.notes.ilike(f"%{plan.name}%")
            ).delete(synchronize_session=False)
        else:
            db.query(PlannedWorkout).filter(
                PlannedWorkout.user_id == plan.user_id,
                PlannedWorkout.notes.ilike(f"%{plan.name}%")
            ).delete(synchronize_session=False)

        new_start_date = start_date or plan.start_date
        if not new_start_date:
            raise ValueError("Start date required to regenerate plan")

        total_days = template["weeks"] * 7
        new_end_date = new_start_date + timedelta(days=total_days - 1)

        plan.start_date = new_start_date
        plan.end_date = new_end_date
        plan.description = template["description"]
        plan.plan_type = template["plan_type"]
        plan.phase = template.get("phase")
        plan.template_id = resolved_template_id

        scheduled_count = 0
        missing_types: List[str] = []

        for day_offset in range(total_days):
            week_index = day_offset // 7
            day_index = day_offset % 7
            workout_entry = TrainingPlanService._resolve_week_entry(template, week_index, day_index)
            workout_type, workout_name = TrainingPlanService._parse_workout_entry(workout_entry)
            if not workout_type and not workout_name:
                continue

            workout = TrainingPlanService._find_workout(db, plan.user_id, workout_type, workout_name)
            if not workout:
                workout = TrainingPlanService._ensure_workout_template(db, plan.user_id, workout_type, workout_name)

            if not workout:
                missing_key = workout_name or workout_type
                if missing_key and missing_key not in missing_types:
                    missing_types.append(missing_key)
                continue

            scheduled_date = new_start_date + timedelta(days=day_offset)
            planned = PlannedWorkout(
                user_id=plan.user_id,
                workout_id=workout.id,
                scheduled_date=scheduled_date,
                notes=f"{plan.name} plan"
            )
            db.add(planned)
            scheduled_count += 1

        db.commit()
        db.refresh(plan)

        return plan, scheduled_count, missing_types
