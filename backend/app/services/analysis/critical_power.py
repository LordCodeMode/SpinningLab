import numpy as np
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from ...database.models import User, Activity

class CriticalPowerModel:
    def __init__(self, critical_power: float, w_prime: float, durations: List[int], 
                 actual: List[float], predicted: List[float]):
        self.critical_power = critical_power
        self.w_prime = w_prime
        self.durations = durations
        self.actual = actual
        self.predicted = predicted

class CriticalPowerService:
    def __init__(self, db: Session):
        self.db = db

    # ADD THIS METHOD - this is what the API is calling
    def calculate_critical_power(self, user: User) -> Dict:
        """Calculate Critical Power model - API endpoint method"""
        model = self.estimate_critical_power(user)
        if not model:
            return {}
        
        return {
            "critical_power": model.critical_power,
            "w_prime": model.w_prime,
            "durations": model.durations,
            "actual": model.actual,
            "predicted": model.predicted
        }

    def estimate_critical_power(self, user: User) -> Optional[CriticalPowerModel]:
        """Estimate critical power model using 2-parameter model."""
        # Get activities with power data
        activities = self.db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.max_20min_power.isnot(None)
        ).order_by(Activity.max_20min_power.desc()).limit(10).all()
        
        if len(activities) < 3:
            return None
        
        # Get best power values for different durations
        best_powers = {}
        for activity in activities:
            power_data = {
                300: activity.max_5min_power,    # 5 min
                600: activity.max_10min_power,   # 10 min  
                1200: activity.max_20min_power,  # 20 min
                1800: activity.max_30min_power   # 30 min
            }
            
            for duration, power in power_data.items():
                if power and (duration not in best_powers or power > best_powers[duration]):
                    best_powers[duration] = power

        if len(best_powers) < 3:
            return None
            
        try:
            # Convert to arrays for regression
            durations = np.array(list(best_powers.keys()))
            powers = np.array(list(best_powers.values()))
            
            # CP model: P = W'/t + CP  
            # Rearrange: P*t = W' + CP*t
            x = durations  # t
            y = powers * durations  # P*t
            
            # Linear regression: y = W' + CP*x
            A = np.vstack([np.ones(len(x)), x]).T
            coeffs = np.linalg.lstsq(A, y, rcond=None)[0]
            w_prime, cp = max(0, coeffs[0]), max(0, coeffs[1])
            
            # Generate predicted curve
            predicted = w_prime / durations + cp
            
            return CriticalPowerModel(
                critical_power=round(cp, 1),
                w_prime=round(w_prime, 1), 
                durations=durations.tolist(),
                actual=powers.tolist(),
                predicted=predicted.tolist()
            )
            
        except Exception as e:
            print(f"Error in CP calculation: {e}")
            return None