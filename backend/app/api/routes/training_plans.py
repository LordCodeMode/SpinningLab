"""
Training Plan API endpoints
Handles training plan templates and plan generation
"""

from datetime import date, datetime
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...database.connection import get_db
from ...database.models import PlannedWorkout, TrainingPlan, User
from ...services.training_plan_service import TrainingPlanService
from ..dependencies import get_current_user

router = APIRouter()


class TrainingPlanTemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    plan_type: str
    phase: Optional[str]
    weeks: int
    week_structure: Union[List[Optional[str]], List[List[Optional[str]]]]


class TrainingPlanCreate(BaseModel):
    template_id: str = Field(..., description="Template ID")
    start_date: date
    name: Optional[str] = None
    is_active: bool = True


class TrainingPlanUpdate(BaseModel):
    is_active: Optional[bool] = None


class TrainingPlanRegenerate(BaseModel):
    template_id: Optional[str] = None
    start_date: Optional[date] = None


class TrainingPlanResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    plan_type: Optional[str]
    phase: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TrainingPlanCreateResponse(BaseModel):
    plan: TrainingPlanResponse
    scheduled_workouts: int
    missing_workout_types: List[str]


@router.get("/templates", response_model=List[TrainingPlanTemplateResponse])
def get_training_plan_templates():
    templates = TrainingPlanService.get_templates()
    return [
        TrainingPlanTemplateResponse(
            id=template["id"],
            name=template["name"],
            description=template["description"],
            plan_type=template["plan_type"],
            phase=template.get("phase"),
            weeks=template["weeks"],
            week_structure=template["week_structure"]
        )
        for template in templates
    ]


@router.get("/", response_model=List[TrainingPlanResponse])
def get_training_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plans = db.query(TrainingPlan).filter(
        TrainingPlan.user_id == current_user.id
    ).order_by(TrainingPlan.created_at.desc()).all()

    return plans


@router.post("/", response_model=TrainingPlanCreateResponse, status_code=status.HTTP_201_CREATED)
def create_training_plan(
    payload: TrainingPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        plan, scheduled_count, missing_types = TrainingPlanService.create_plan_from_template(
            db=db,
            user_id=current_user.id,
            template_id=payload.template_id,
            start_date=payload.start_date,
            name=payload.name,
            is_active=payload.is_active
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error creating training plan: {exc}")

    return TrainingPlanCreateResponse(
        plan=plan,
        scheduled_workouts=scheduled_count,
        missing_workout_types=missing_types
    )


@router.put("/{plan_id}", response_model=TrainingPlanResponse)
def update_training_plan(
    plan_id: int,
    payload: TrainingPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id,
        TrainingPlan.user_id == current_user.id
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Training plan not found")

    if payload.is_active is not None:
        if payload.is_active:
            db.query(TrainingPlan).filter(
                TrainingPlan.user_id == current_user.id,
                TrainingPlan.is_active == True
            ).update({TrainingPlan.is_active: False})
        plan.is_active = payload.is_active

    db.commit()
    db.refresh(plan)

    return plan


@router.post("/{plan_id}/regenerate", response_model=TrainingPlanCreateResponse)
def regenerate_training_plan(
    plan_id: int,
    payload: TrainingPlanRegenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id,
        TrainingPlan.user_id == current_user.id
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Training plan not found")

    try:
        plan, scheduled_count, missing_types = TrainingPlanService.regenerate_plan(
            db=db,
            plan=plan,
            template_id=payload.template_id,
            start_date=payload.start_date
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error regenerating training plan: {exc}")

    return TrainingPlanCreateResponse(
        plan=plan,
        scheduled_workouts=scheduled_count,
        missing_workout_types=missing_types
    )


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_plan(
    plan_id: int,
    remove_workouts: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = db.query(TrainingPlan).filter(
        TrainingPlan.id == plan_id,
        TrainingPlan.user_id == current_user.id
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Training plan not found")

    if remove_workouts and plan.start_date and plan.end_date:
        plan_name = plan.name.lower()
        db.query(PlannedWorkout).filter(
            PlannedWorkout.user_id == current_user.id,
            PlannedWorkout.scheduled_date >= plan.start_date,
            PlannedWorkout.scheduled_date <= plan.end_date,
            func.lower(PlannedWorkout.notes).contains(plan_name)
        ).delete(synchronize_session=False)

    db.delete(plan)
    db.commit()

    return None
