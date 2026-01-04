"""
W' Balance analysis (anaerobic capacity).
Uses a simplified Skiba model with fixed recovery time constant.
"""

from __future__ import annotations

from typing import Dict, Optional, List
from sqlalchemy.orm import Session

from .power_curve import PowerCurveService
from .critical_power import CriticalPowerService
from ...database.models import Activity, User


class WPrimeBalanceService:
    def __init__(self, db: Session):
        self.db = db
        self.power_curve_service = PowerCurveService(db)
        self.critical_power_service = CriticalPowerService(db)

    def analyze_activity(self, user: User, activity_id: int) -> Optional[Dict]:
        activity = self.db.query(Activity).filter(Activity.id == activity_id).first()
        if not activity:
            return None

        series = self.power_curve_service.get_power_series(activity)
        if not series or len(series) < 300:
            return None

        cp_model = self.critical_power_service.estimate_critical_power(user)
        if not cp_model:
            return None

        cp = cp_model.critical_power
        w_prime = cp_model.w_prime
        if cp <= 0 or w_prime <= 0:
            return None

        w_bal = w_prime
        w_balances: List[float] = []
        tau = 300  # seconds, simplified recovery time constant

        for power in series:
            if power > cp:
                w_bal -= (power - cp)
            else:
                w_bal += (w_prime - w_bal) * (1 - pow(2.71828, -1 / tau))

            w_bal = max(0.0, min(w_prime, w_bal))
            w_balances.append(w_bal)

        min_w_bal = min(w_balances) if w_balances else w_prime
        end_w_bal = w_balances[-1] if w_balances else w_prime

        return {
            "activity_id": activity_id,
            "critical_power": round(cp, 1),
            "w_prime": round(w_prime, 1),
            "min_w_balance": round(min_w_bal, 1),
            "end_w_balance": round(end_w_bal, 1),
            "depletion_percent": round((1 - (min_w_bal / w_prime)) * 100, 2)
        }
