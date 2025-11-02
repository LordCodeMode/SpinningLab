"""Best power values endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ....database.connection import get_db
from ....database.models import User, Activity
from ....api.dependencies import get_current_active_user

router = APIRouter()


@router.get("")
async def get_best_power_values(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get best power values for standard durations."""
    try:
        print("\n" + "="*80)
        print("[BEST POWER DEBUG] Starting endpoint")
        print("="*80)

        # 1. Check database connection
        db_url = str(db.get_bind().url)
        print(f"[DEBUG] Database URL: {db_url}")

        # 2. Check current user
        print(f"[DEBUG] Current user: {current_user.username} (ID: {current_user.id})")
        print(f"[DEBUG] User weight: {current_user.weight}")

        # 3. Count total activities
        total_activities = db.query(Activity).filter(Activity.user_id == current_user.id).count()
        print(f"[DEBUG] Total activities for user: {total_activities}")

        # 4. Check if activities have power data
        with_avg_power = db.query(Activity).filter(
            Activity.user_id == current_user.id,
            Activity.avg_power.isnot(None)
        ).count()
        print(f"[DEBUG] Activities with avg_power: {with_avg_power}")

        with_1min = db.query(Activity).filter(
            Activity.user_id == current_user.id,
            Activity.max_1min_power.isnot(None)
        ).count()
        print(f"[DEBUG] Activities with max_1min_power: {with_1min}")

        # 5. Sample one activity to check its values
        sample = db.query(Activity).filter(
            Activity.user_id == current_user.id
        ).first()

        if sample:
            print(f"\n[DEBUG] Sample activity:")
            print(f"  - ID: {sample.id}")
            print(f"  - File: {sample.file_name}")
            print(f"  - avg_power: {sample.avg_power}")
            print(f"  - max_1min_power: {sample.max_1min_power}")
            print(f"  - max_5min_power: {sample.max_5min_power}")
            print(f"  - max_20min_power: {sample.max_20min_power}")
        else:
            print("[DEBUG] No activities found!")

        # 6. Run the actual query
        print("\n[DEBUG] Running MAX query...")
        result = db.query(
            func.max(Activity.max_5sec_power).label('max_5sec'),
            func.max(Activity.max_1min_power).label('max_1min'),
            func.max(Activity.max_3min_power).label('max_3min'),
            func.max(Activity.max_5min_power).label('max_5min'),
            func.max(Activity.max_10min_power).label('max_10min'),
            func.max(Activity.max_20min_power).label('max_20min'),
            func.max(Activity.max_30min_power).label('max_30min'),
            func.max(Activity.max_60min_power).label('max_60min')
        ).filter(Activity.user_id == current_user.id).first()

        print(f"[DEBUG] Query returned: {result}")
        if result:
            print(f"[DEBUG] Individual max values:")
            print(f"  - max_5sec: {result.max_5sec}")
            print(f"  - max_1min: {result.max_1min}")
            print(f"  - max_3min: {result.max_3min}")
            print(f"  - max_5min: {result.max_5min}")
            print(f"  - max_10min: {result.max_10min}")
            print(f"  - max_20min: {result.max_20min}")
            print(f"  - max_30min: {result.max_30min}")
            print(f"  - max_60min: {result.max_60min}")

        # 7. Build response
        weight = current_user.weight or 70.0

        response = {
            "max_5sec_power": float(result.max_5sec) if result and result.max_5sec else None,
            "max_1min_power": float(result.max_1min) if result and result.max_1min else None,
            "max_3min_power": float(result.max_3min) if result and result.max_3min else None,
            "max_5min_power": float(result.max_5min) if result and result.max_5min else None,
            "max_10min_power": float(result.max_10min) if result and result.max_10min else None,
            "max_20min_power": float(result.max_20min) if result and result.max_20min else None,
            "max_30min_power": float(result.max_30min) if result and result.max_30min else None,
            "max_60min_power": float(result.max_60min) if result and result.max_60min else None,
            "weight": float(weight)
        }

        print(f"\n[DEBUG] Response being sent:")
        print(f"  {response}")
        print("="*80 + "\n")

        return response

    except Exception as e:
        print(f"\n[ERROR] Exception in best-power-values: {e}")
        import traceback
        traceback.print_exc()
        return {
            "max_5sec_power": None,
            "max_1min_power": None,
            "max_3min_power": None,
            "max_5min_power": None,
            "max_10min_power": None,
            "max_20min_power": None,
            "max_30min_power": None,
            "max_60min_power": None,
            "weight": 70.0
        }
