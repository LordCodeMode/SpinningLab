from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from datetime import datetime, timedelta

from ...database.connection import get_db
from ...database.models import User, Activity
from ...api.dependencies import get_current_active_user

router = APIRouter()

@router.get("/")
async def get_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user activities."""
    query = db.query(Activity).filter(Activity.user_id == current_user.id)
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(Activity.start_time >= start_dt)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(Activity.start_time <= end_dt)
        except ValueError:
            pass
    
    activities = query.order_by(desc(Activity.start_time)).offset(skip).limit(limit).all()
    
    return [{
        "id": activity.id,
        "start_time": activity.start_time.isoformat() if activity.start_time else None,
        "file_name": activity.file_name,
        "duration": activity.duration,
        "distance": activity.distance,
        "avg_power": activity.avg_power,
        "normalized_power": activity.normalized_power,
        "max_5sec_power": activity.max_5sec_power,
        "max_1min_power": activity.max_1min_power,
        "max_3min_power": activity.max_3min_power,
        "max_5min_power": activity.max_5min_power,
        "max_10min_power": activity.max_10min_power,
        "max_20min_power": activity.max_20min_power,
        "max_30min_power": activity.max_30min_power,
        "max_60min_power": activity.max_60min_power,
        "avg_heart_rate": activity.avg_heart_rate,
        "tss": activity.tss,
        "intensity_factor": activity.intensity_factor,
        "efficiency_factor": activity.efficiency_factor
    } for activity in activities]

@router.get("/summary")
async def get_activities_summary(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get activity summary for the specified period."""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    result = db.query(
        func.count(Activity.id).label('count'),
        func.sum(Activity.duration).label('total_duration'),
        func.sum(Activity.distance).label('total_distance'),
        func.sum(Activity.tss).label('total_tss'),
        func.avg(Activity.avg_power).label('avg_power'),
        func.max(Activity.max_20min_power).label('max_20min_power')
    ).filter(
        Activity.user_id == current_user.id,
        Activity.start_time >= start_date
    ).first()
    
    return {
        "count": result.count or 0,
        "total_duration": result.total_duration or 0,
        "total_distance": result.total_distance or 0,
        "total_tss": result.total_tss or 0,
        "avg_power": result.avg_power or 0,
        "max_20min_power": result.max_20min_power or 0,
        "period_days": days
    }