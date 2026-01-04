"""
Coaching Advisor Service
Transforms insights into actionable recommendations.
"""

from __future__ import annotations

from typing import List, Dict


class CoachingAdvisor:
    def build_recommendations(self, insights: List[Dict]) -> List[Dict]:
        recommendations: List[Dict] = []

        for insight in insights:
            if insight["type"] == "fatigue":
                recommendations.append({
                    "title": "Prioritize recovery",
                    "message": "Add an easy Z1/Z2 session or a rest day to lower fatigue.",
                    "severity": "high" if insight["severity"] == "high" else "moderate"
                })
            elif insight["type"] == "ramp":
                recommendations.append({
                    "title": "Ease the ramp",
                    "message": "Consider a deload week or reduce intensity to protect consistency.",
                    "severity": "warning"
                })
            elif insight["type"] == "breakthrough":
                recommendations.append({
                    "title": "Capitalize on momentum",
                    "message": "Schedule a focused quality session this week to build on gains.",
                    "severity": "positive"
                })
            elif insight["type"] == "pattern":
                recommendations.append({
                    "title": "Plan key workouts",
                    "message": "Use your strongest day for intense sessions and stack easier days before.",
                    "severity": "info"
                })

        return recommendations
