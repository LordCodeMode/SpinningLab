"""
Analysis endpoints - modular structure.

This module aggregates all analysis-related endpoints into a single router.
Each functional area has its own file for better organization and maintainability.
"""

from fastapi import APIRouter

# Import all sub-routers
from .training_load import router as training_load_router
from .power_curve import router as power_curve_router
from .zones import router as zones_router
from .critical_power import router as critical_power_router
from .vo2max import router as vo2max_router
from .fitness_state import router as fitness_state_router
from .best_power import router as best_power_router
from .rider_profile import router as rider_profile_router
from .predict_ftp import router as predict_ftp_router
from .insights import router as insights_router
from .advanced_metrics import router as advanced_metrics_router
from .comparisons import router as comparisons_router

# Create main analysis router
router = APIRouter()

# Include all sub-routers with appropriate prefixes
router.include_router(training_load_router, prefix="/training-load", tags=["training-load"])
router.include_router(power_curve_router, prefix="/power-curve", tags=["power-curve"])
router.include_router(zones_router, prefix="/zones", tags=["zones"])
router.include_router(critical_power_router, prefix="/critical-power", tags=["critical-power"])
router.include_router(vo2max_router, prefix="/vo2max", tags=["vo2max"])
router.include_router(fitness_state_router, prefix="", tags=["fitness"])  # Provides /fitness-state and /efficiency
router.include_router(best_power_router, prefix="/best-power-values", tags=["best-power"])
router.include_router(rider_profile_router, prefix="/rider-profile", tags=["rider-profile"])
router.include_router(predict_ftp_router, prefix="/predict-ftp", tags=["predict-ftp"])
router.include_router(insights_router, prefix="/insights", tags=["insights"])
router.include_router(advanced_metrics_router, prefix="/metrics", tags=["metrics"])
router.include_router(comparisons_router, prefix="/comparisons", tags=["comparisons"])

# Note: The zone-balance endpoint is now at /zones/balance
# The old /zone-balance endpoint is maintained for backward compatibility
from .zones import get_zone_balance as _get_zone_balance
router.add_api_route("/zone-balance", _get_zone_balance, methods=["GET"], tags=["zones"])
