from typing import NamedTuple, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .training_load import TrainingLoadService
from .efficiency_service import EfficiencyService
from ...database.models import User

class FitnessState(NamedTuple):
    status: str
    status_description: str
    ctl: float
    atl: float
    tsb: float
    ef_trend: float
    recommendations: List[str]

class FitnessStateService:
    def __init__(self, db: Session):
        self.db = db

    def analyze_fitness_state(self, user: User) -> FitnessState:
        """Analyze current fitness state based on training load and efficiency."""
        # Get latest training load
        tl_service = TrainingLoadService(self.db)
        training_load = tl_service.calculate_training_load(user, days=30)
        
        if not training_load:
            return FitnessState(
                status="unknown",
                status_description="Not enough training data available",
                ctl=0, atl=0, tsb=0, ef_trend=0,
                recommendations=["Start tracking your training data"]
            )

        latest = training_load[-1]
        ctl, atl, tsb = latest.ctl, latest.atl, latest.tsb

        # Get efficiency trend
        ef_service = EfficiencyService(self.db)
        ef_analysis = ef_service.get_efficiency_trend(user, days=60)
        ef_trend = ef_analysis.get("trend_percentage", 0)

        # Determine fitness state
        status, description, recommendations = self._classify_state(tsb, ef_trend, ctl, atl)

        return FitnessState(
            status=status,
            status_description=description,
            ctl=ctl,
            atl=atl,
            tsb=tsb,
            ef_trend=ef_trend,
            recommendations=recommendations
        )

    def _classify_state(self, tsb: float, ef_trend: float, ctl: float, atl: float) -> tuple:
        """Classify fitness state based on metrics."""
        if tsb > 10 and ef_trend >= 0:
            return (
                "fresh",
                "Fresh & Ready - Good for hard training",
                [
                    "Perfect time for high-intensity workouts",
                    "Consider threshold or VO2max sessions",
                    "Your body is well-recovered"
                ]
            )
        elif tsb < -20:
            return (
                "fatigued",
                "Fatigued - Rest recommended",
                [
                    "Prioritize recovery and easy sessions", 
                    "Consider a rest day or active recovery",
                    "Focus on sleep and nutrition"
                ]
            )
        elif -10 <= tsb <= 10 and ef_trend > 5:
            return (
                "building",
                "Building Fitness - Efficiency improving despite load",
                [
                    "Continue current training approach",
                    "Monitor recovery closely",
                    "Your fitness is adapting well"
                ]
            )
        elif tsb > 5 and ef_trend > 5:
            return (
                "peaking",
                "Peak Form - High fitness with good recovery",
                [
                    "Perfect for competitions or goal events",
                    "Maintain current form with lighter training",
                    "Focus on race-specific efforts"
                ]
            )
        elif -5 <= tsb <= 5:
            return (
                "balanced",
                "Balanced - Continue current approach",
                [
                    "Good training/recovery balance",
                    "Monitor trends over next week",
                    "Adjust intensity based on how you feel"
                ]
            )
        else:
            return (
                "loaded",
                "Moderately Loaded - Monitor recovery",
                [
                    "Consider easier sessions this week",
                    "Focus on sleep and nutrition",
                    "Listen to your body for fatigue signs"
                ]
            )