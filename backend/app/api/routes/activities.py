import math
import os
import json
from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fitparse import FitFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, selectinload

from ...api.dependencies import get_current_active_user
from ...core.config import settings
from ...database.connection import get_db
from ...database.models import Activity, ActivityTag, User
from ...services.fit_processing.power_metrics import rolling_best_powers
from ...services.fit_processing.heart_rate_metrics import compute_hr_zones

router = APIRouter()

@router.get("", include_in_schema=False)
@router.get("/")
async def get_activities(
    skip: int = Query(0, ge=0, description="Number of records to skip (for pagination)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    start_date: Optional[str] = Query(None, description="Filter activities after this date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter activities before this date (ISO format)"),
    tags: Optional[str] = Query(None, description="Comma-separated list of activity tags"),
    tss_min: Optional[float] = Query(None, description="Minimum TSS"),
    tss_max: Optional[float] = Query(None, description="Maximum TSS"),
    power_min: Optional[float] = Query(None, description="Minimum average power"),
    power_max: Optional[float] = Query(None, description="Maximum average power"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user activities with pagination.

    OPTIMIZED: Uses database indexes for fast queries, supports pagination.

    Returns:
        Dictionary with 'activities' array, 'total' count, and pagination info
    """
    query = db.query(Activity).options(selectinload(Activity.tags)).filter(Activity.user_id == current_user.id)

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

    if tags:
        tag_list = [t.strip().lstrip('#').lower() for t in tags.split(',') if t.strip()]
        if tag_list:
            query = query.filter(Activity.tags.any(ActivityTag.name.in_(tag_list)))

    if tss_min is not None:
        query = query.filter(Activity.tss >= tss_min)

    if tss_max is not None:
        query = query.filter(Activity.tss <= tss_max)

    if power_min is not None:
        query = query.filter(Activity.avg_power >= power_min)

    if power_max is not None:
        query = query.filter(Activity.avg_power <= power_max)

    # Get total count for pagination (avoid DISTINCT ON issues in Postgres)
    total = query.count()

    # Get paginated results
    activities = query.order_by(desc(Activity.start_time), desc(Activity.id)).offset(skip).limit(limit).all()

    return {
        "activities": [{
            "id": activity.id,
            "custom_name": activity.custom_name,
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
            "efficiency_factor": activity.efficiency_factor,
            "notes": activity.notes,
            "rpe": activity.rpe,
            "tags": [tag.name for tag in activity.tags]
        } for activity in activities],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(activities) < total
    }

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

@router.get("/{activity_id}")
async def get_activity_detail(
    activity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information for a single activity including zones.

    Returns:
        Detailed activity data with power zones and HR zones distribution
    """
    # Fetch activity with zones
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == current_user.id
    ).first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    hr_enrichment = _hydrate_hr_metrics(activity, current_user)

    # Format power zones
    power_zones_data = []
    for pz in activity.power_zones:
        power_zones_data.append({
            "zone_label": pz.zone_label,
            "seconds_in_zone": pz.seconds_in_zone
        })

    # Format HR zones
    hr_zones_data = hr_enrichment.get("hr_zones") or [
        {
            "zone_label": hrz.zone_label,
            "seconds_in_zone": hrz.seconds_in_zone
        }
        for hrz in activity.hr_zones
    ]

    return {
        "id": activity.id,
        "custom_name": activity.custom_name,
        "start_time": activity.start_time.isoformat() if activity.start_time else None,
        "file_name": activity.file_name,
        "duration": activity.duration,
        "distance": activity.distance,

        # Power metrics
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

        # Heart rate
        "avg_heart_rate": hr_enrichment.get("avg_hr", activity.avg_heart_rate),
        "max_heart_rate": hr_enrichment.get("max_hr", activity.max_heart_rate),

        # Training metrics
        "tss": activity.tss,
        "intensity_factor": activity.intensity_factor,
        "efficiency_factor": activity.efficiency_factor,
        "critical_power": activity.critical_power,
        "notes": activity.notes,
        "rpe": activity.rpe,
        "tags": [tag.name for tag in activity.tags],

        # Zone distributions
        "power_zones": power_zones_data,
        "hr_zones": hr_zones_data
    }


@router.get("/{activity_id}/streams")
async def get_activity_streams(
    activity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return power/heart-rate timeline data and per-activity power curve."""
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == current_user.id
    ).first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    file_path = activity.get_fit_path()
    stream_path = _get_stream_path(activity)

    if file_path and os.path.exists(file_path):
        source = "fit"
    elif stream_path and os.path.exists(stream_path):
        source = "stream_json"
    else:
        raise HTTPException(status_code=404, detail="Activity file not available")

    try:
        if source == "fit":
            stream_payload = _extract_activity_streams_from_fit(file_path)
        else:
            stream_payload = _extract_activity_streams_from_json(stream_path)
        return stream_payload
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=f"Failed to read activity file: {exc}") from exc


def _extract_activity_streams_from_fit(file_path: str) -> dict:
    fitfile = FitFile(file_path)
    time_stream: List[float] = []
    power_stream: List[Optional[float]] = []
    hr_stream: List[Optional[float]] = []

    start_timestamp = None
    for record in fitfile.get_messages("record"):
        data = {field.name: field.value for field in record if field.value is not None}
        timestamp = data.get("timestamp")
        if timestamp:
            if start_timestamp is None:
                start_timestamp = timestamp
            elapsed = (timestamp - start_timestamp).total_seconds()
        else:
            elapsed = time_stream[-1] + 1 if time_stream else 0

        time_stream.append(float(elapsed))
        power_stream.append(_coerce_numeric(data.get("power")))
        hr_stream.append(_coerce_numeric(data.get("heart_rate")))

    if not time_stream:
        return {
            "time": [],
            "power": [],
            "heart_rate": [],
            "power_curve": None,
            "metadata": {"sample_count": 0, "downsampled_count": 0}
        }

    downsampled_time, [downsampled_power, downsampled_hr] = _downsample_streams(
        time_stream,
        [power_stream, hr_stream]
    )

    power_curve = _build_power_curve(power_stream)

    return {
        "time": downsampled_time,
        "power": downsampled_power,
        "heart_rate": downsampled_hr,
        "power_curve": power_curve,
        "metadata": {
            "sample_count": len(time_stream),
            "downsampled_count": len(downsampled_time)
        }
    }


def _extract_activity_streams_from_json(stream_path: str) -> dict:
    with open(stream_path, "r") as f:
        raw = json.load(f)

    def get_stream(name):
        stream = raw.get(name, {})
        data = stream.get("data") if isinstance(stream, dict) else None
        return data if isinstance(data, list) else []

    time_stream = get_stream("time")
    power_stream = get_stream("watts") or get_stream("power")
    hr_stream = get_stream("heartrate")

    downsampled_time, [downsampled_power, downsampled_hr] = _downsample_streams(
        time_stream,
        [power_stream, hr_stream]
    ) if time_stream else _downsample_streams(list(range(len(power_stream) or len(hr_stream))), [power_stream, hr_stream])

    power_curve = _build_power_curve(power_stream)

    return {
        "time": downsampled_time,
        "power": downsampled_power,
        "heart_rate": downsampled_hr,
        "power_curve": power_curve,
        "metadata": {
            "sample_count": len(time_stream) if time_stream else len(power_stream),
            "downsampled_count": len(downsampled_time)
        }
    }


def _coerce_numeric(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _downsample_streams(time_stream: List[float], value_streams: List[List[Optional[float]]], max_points: int = 4000):
    if len(time_stream) <= max_points:
        return time_stream, value_streams

    step = math.ceil(len(time_stream) / max_points)
    indices = list(range(0, len(time_stream), step))
    if indices[-1] != len(time_stream) - 1:
        indices.append(len(time_stream) - 1)

    downsampled_time = [time_stream[i] for i in indices]
    downsampled_values = []
    for stream in value_streams:
        downsampled_values.append([stream[i] for i in indices])

    return downsampled_time, downsampled_values


def _build_power_curve(power_stream: List[Optional[float]]):
    if not power_stream:
        return None

    cleaned_stream = [value if value is not None else 0 for value in power_stream]
    best_powers = rolling_best_powers(cleaned_stream)
    if not best_powers:
        return None

    ride_seconds = len(cleaned_stream)
    duration_candidates = [
        5, 10, 15, 30,
        60, 90, 120, 180,
        240, 300, 450, 600,
        900, 1200, 1800, 2400, 3600, 5400, 7200
    ]
    duration_map = [
        ("max_5sec_power", 5),
        ("max_1min_power", 60),
        ("max_3min_power", 180),
        ("max_5min_power", 300),
        ("max_10min_power", 600),
        ("max_20min_power", 1200),
        ("max_30min_power", 1800),
        ("max_60min_power", 3600),
    ]

    durations = []
    powers = []

    def append_point(duration_seconds, value):
        if not value:
            return
        durations.append(duration_seconds)
        powers.append(value)

    for key, seconds in duration_map:
        if seconds <= ride_seconds:
            append_point(seconds, best_powers.get(key))

    for seconds in duration_candidates:
        if seconds <= ride_seconds and seconds not in durations:
            window_key = _get_duration_key(seconds)
            append_point(seconds, best_powers.get(window_key))

    if not durations:
        return None

    combined = sorted(zip(durations, powers), key=lambda item: item[0])
    filtered_durations = []
    filtered_powers = []
    last_duration = -1
    for duration, value in combined:
        if duration != last_duration:
            filtered_durations.append(duration)
            filtered_powers.append(value)
            last_duration = duration

    return {
        "durations": filtered_durations,
        "powers": filtered_powers
    }


def _get_stream_path(activity: Activity) -> Optional[str]:
    base_dir = os.path.join(settings.FIT_FILES_DIR, "streams")
    candidate = os.path.join(base_dir, f"{activity.strava_activity_id or activity.id}.json")
    return candidate


@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an activity and associated zones/streams."""
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == current_user.id
    ).first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    stream_path = _get_stream_path(activity)
    try:
        db.delete(activity)
        db.commit()
    except Exception as exc:  # pragma: no cover - safety net
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete activity: {exc}")

    # Clean up stored stream file if present
    if stream_path and os.path.exists(stream_path):
        try:
            os.remove(stream_path)
        except OSError:
            pass

    return {"success": True, "message": "Activity deleted"}


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    rpe: Optional[int] = Field(None, ge=1, le=10)
    tags: Optional[List[str]] = None


@router.patch("/{activity_id}")
async def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update activity metadata (name, notes, RPE, tags)."""
    if payload.name is not None and not str(payload.name).strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == current_user.id
    ).first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    if payload.name is not None:
        activity.custom_name = str(payload.name).strip()[:255]

    if payload.notes is not None:
        cleaned_notes = str(payload.notes).strip()
        activity.notes = cleaned_notes if cleaned_notes else None

    if payload.rpe is not None:
        activity.rpe = payload.rpe

    if payload.tags is not None:
        tag_names = []
        for tag in payload.tags:
            cleaned = str(tag).strip().lstrip('#').lower()
            if cleaned:
                tag_names.append(cleaned[:50])
        tag_names = sorted(set(tag_names))

        tag_models = []
        if tag_names:
            existing = db.query(ActivityTag).filter(
                ActivityTag.user_id == current_user.id,
                ActivityTag.name.in_(tag_names)
            ).all()
            existing_map = {tag.name: tag for tag in existing}

            for tag_name in tag_names:
                if tag_name in existing_map:
                    tag_models.append(existing_map[tag_name])
                else:
                    new_tag = ActivityTag(user_id=current_user.id, name=tag_name)
                    db.add(new_tag)
                    tag_models.append(new_tag)

        activity.tags = tag_models

    db.commit()

    return {
        "success": True,
        "activity": {
            "id": activity.id,
            "name": activity.custom_name,
            "notes": activity.notes,
            "rpe": activity.rpe,
            "tags": [tag.name for tag in activity.tags]
        }
    }


def _get_duration_key(seconds: int) -> str:
    mapping = {
        5: "max_5sec_power",
        10: "max_5sec_power",
        15: "max_5sec_power",
        30: "max_5sec_power",
        60: "max_1min_power",
        90: "max_1min_power",
        120: "max_3min_power",
        180: "max_3min_power",
        240: "max_5min_power",
        300: "max_5min_power",
        450: "max_5min_power",
        600: "max_10min_power",
        900: "max_15min_power",
        1200: "max_20min_power",
        1800: "max_30min_power",
        2400: "max_40min_power",
        3600: "max_60min_power",
        5400: "max_60min_power",
        7200: "max_60min_power",
    }
    return mapping.get(seconds, "max_60min_power")


def _hydrate_hr_metrics(activity: Activity, user: User) -> dict:
    needs_avg = activity.avg_heart_rate is None
    needs_max = activity.max_heart_rate is None
    needs_zones = not activity.hr_zones

    if not any([needs_avg, needs_max, needs_zones]):
        return {}

    file_path = activity.get_fit_path()
    if not file_path or not os.path.exists(file_path):
        return {}

    try:
        fitfile = FitFile(file_path)
        hr_values = []
        records = []

        for record in fitfile.get_messages("record"):
            data = {field.name: field.value for field in record if field.value is not None}
            hr = data.get("heart_rate")
            if hr is not None:
                try:
                    hr_float = float(hr)
                except (TypeError, ValueError):
                    continue
                hr_values.append(hr_float)
                records.append({"heart_rate": hr_float})

        if not hr_values:
            return {}

        enrichment = {}
        if needs_avg:
            enrichment["avg_hr"] = round(sum(hr_values) / len(hr_values))
        if needs_max:
            enrichment["max_hr"] = round(max(hr_values))

        if needs_zones and records:
            df = pd.DataFrame(records)
            zone_map = compute_hr_zones(df, user.hr_max or 190)
            if zone_map:
                enrichment["hr_zones"] = [
                    {"zone_label": label, "seconds_in_zone": seconds}
                    for label, seconds in zone_map.items()
                ]

        return enrichment

    except Exception:
        return {}
