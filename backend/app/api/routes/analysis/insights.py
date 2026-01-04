"""Insights endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.insights.insight_generator import InsightGenerator
from ....services.insights.coaching_advisor import CoachingAdvisor

router = APIRouter()


@router.get("")
def get_insights(
    days: int = Query(14, ge=7, le=180),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    generator = InsightGenerator(db)
    insights = generator.generate_insights(current_user, days=days)
    advisor = CoachingAdvisor()
    recommendations = advisor.build_recommendations(insights)
    return {
        "insights": insights,
        "recommendations": recommendations
    }


@router.get("/weekly-summary")
def weekly_summary(
    days: int = Query(7, ge=7, le=28),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    generator = InsightGenerator(db)
    summary = generator.weekly_summary(current_user, days=days)
    return summary
