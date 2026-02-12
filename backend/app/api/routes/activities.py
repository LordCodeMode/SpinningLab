import math
import os
import json
from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fitparse import FitFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, selectinload

from ...api.dependencies import get_current_active_user
from ...core.config import settings
from ...database.connection import get_db
from ...database.models import Activity, ActivityTag, User, PowerZone, HrZone
from ...services.fit_processing.power_metrics import extract_power_metrics, rolling_best_powers
from ...services.fit_processing.heart_rate_metrics import compute_hr_zones, extract_hr_series, compute_avg_hr
from ...services.fit_processing.zones import compute_power_zones

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
            "route_polyline": activity.route_polyline,
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
        "route_polyline": activity.route_polyline,

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
    latlng_stream: List[Optional[List[float]]] = []
    moving_stream: List[bool] = []

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
        power_value = _coerce_numeric(data.get("power"))
        hr_value = _coerce_numeric(data.get("heart_rate"))
        speed_value = _coerce_numeric(data.get("enhanced_speed") or data.get("speed"))
        cadence_value = _coerce_numeric(data.get("cadence"))

        power_stream.append(power_value)
        hr_stream.append(hr_value)

        if speed_value is not None:
            moving_stream.append(speed_value > 0.5)
        elif cadence_value is not None:
            moving_stream.append(cadence_value > 0)
        elif power_value is not None:
            moving_stream.append(power_value > 0)
        else:
            moving_stream.append(False)

        lat_val = data.get("position_lat")
        lon_val = data.get("position_long")
        if lat_val is not None and lon_val is not None:
            latlng_stream.append([
                _semicircle_to_degrees(lat_val),
                _semicircle_to_degrees(lon_val)
            ])
        else:
            latlng_stream.append(None)

    if not time_stream:
        return {
            "time": [],
            "power": [],
            "heart_rate": [],
            "power_curve": None,
            "metadata": {"sample_count": 0, "downsampled_count": 0}
        }

    filtered = _filter_moving_samples(
        time_stream,
        moving_stream,
        power_stream,
        hr_stream,
        latlng_stream
    )

    if filtered:
        time_stream, power_stream, hr_stream, latlng_stream = filtered

    downsampled_time, [downsampled_power, downsampled_hr], indices = _downsample_streams_with_indices(
        time_stream,
        [power_stream, hr_stream]
    )

    power_curve = _build_power_curve(power_stream)

    return {
        "time": downsampled_time,
        "power": downsampled_power,
        "heart_rate": downsampled_hr,
        "latlng": _downsample_latlng(latlng_stream, indices),
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
    latlng_stream = get_stream("latlng")
    moving_stream = get_stream("moving")

    if not time_stream:
        time_stream = list(range(len(power_stream) or len(hr_stream) or len(moving_stream)))

    filtered = _filter_moving_samples(
        time_stream,
        moving_stream,
        power_stream,
        hr_stream,
        latlng_stream
    )

    if filtered:
        time_stream, power_stream, hr_stream, latlng_stream = filtered

    downsampled_time, [downsampled_power, downsampled_hr], indices = _downsample_streams_with_indices(
        time_stream,
        [power_stream, hr_stream]
    )

    power_curve = _build_power_curve(power_stream)

    return {
        "time": downsampled_time,
        "power": downsampled_power,
        "heart_rate": downsampled_hr,
        "latlng": _downsample_latlng(latlng_stream, indices),
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


def _filter_moving_samples(
    time_stream: List[float],
    moving_stream: List[bool],
    power_stream: List[Optional[float]],
    hr_stream: List[Optional[float]],
    latlng_stream: List[Optional[List[float]]]
):
    if not time_stream or not moving_stream:
        return None

    max_len = min(len(time_stream), len(moving_stream))
    if max_len == 0:
        return None

    moving_indices = [idx for idx in range(max_len) if moving_stream[idx]]
    if not moving_indices:
        return None

    moving_time = []
    running = 0.0
    previous_time = time_stream[0]
    for idx in range(max_len):
        current_time = time_stream[idx]
        delta = current_time - previous_time
        if delta < 0:
            delta = 0.0
        if moving_stream[idx]:
            running += delta
            moving_time.append(running)
        previous_time = current_time

    if moving_time and moving_time[0] > 0:
        offset = moving_time[0]
        moving_time = [value - offset for value in moving_time]

    def pick(stream: List, idx: int):
        return stream[idx] if idx < len(stream) else None

    moving_power = [pick(power_stream, idx) for idx in moving_indices]
    moving_hr = [pick(hr_stream, idx) for idx in moving_indices]
    moving_latlng = [pick(latlng_stream, idx) for idx in moving_indices]

    return moving_time, moving_power, moving_hr, moving_latlng


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


def _downsample_streams_with_indices(
    time_stream: List[float],
    value_streams: List[List[Optional[float]]],
    max_points: int = 4000
):
    if len(time_stream) <= max_points:
        indices = list(range(len(time_stream)))
    else:
        step = math.ceil(len(time_stream) / max_points)
        indices = list(range(0, len(time_stream), step))
        if indices[-1] != len(time_stream) - 1:
            indices.append(len(time_stream) - 1)

    downsampled_time = [time_stream[i] for i in indices]
    downsampled_values = []
    for stream in value_streams:
        downsampled_values.append([stream[i] if i < len(stream) else None for i in indices])

    return downsampled_time, downsampled_values, indices


def _downsample_latlng(latlng_stream: List[Optional[List[float]]], indices: List[int]):
    if not latlng_stream:
        return []
    return [latlng_stream[i] if i < len(latlng_stream) else None for i in indices]


def _semicircle_to_degrees(value):
    try:
        return float(value) * (180.0 / 2147483648.0)
    except (TypeError, ValueError):
        return None


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
    background_tasks: BackgroundTasks,
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

    try:
        from ...services.cache.cache_tasks import rebuild_user_caches_two_stage
        background_tasks.add_task(rebuild_user_caches_two_stage, current_user.id)
    except Exception:
        pass

    return {"success": True, "message": "Activity deleted"}


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    rpe: Optional[int] = Field(None, ge=1, le=10)
    tags: Optional[List[str]] = None


class LiveTrainingSample(BaseModel):
    timestamp: Optional[float] = None
    elapsedSec: Optional[float] = None
    power: Optional[float] = None
    heartRate: Optional[float] = None
    cadence: Optional[float] = None
    speed: Optional[float] = None
    distanceMeters: Optional[float] = None


class LiveTrainingSaveRequest(BaseModel):
    name: Optional[str] = None
    startedAt: Optional[str] = None
    description: Optional[str] = None
    samples: List[LiveTrainingSample]


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


@router.post("/live-session")
async def save_live_training_session(
    payload: LiveTrainingSaveRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not payload.samples:
        raise HTTPException(status_code=400, detail="No samples provided.")

    start_time = None
    if payload.startedAt:
        try:
            start_time = datetime.fromisoformat(payload.startedAt.replace("Z", "+00:00"))
        except ValueError:
            start_time = None
    if start_time is None:
        start_time = datetime.utcnow()

    time_stream: List[float] = []
    power_stream: List[Optional[float]] = []
    hr_stream: List[Optional[float]] = []
    cadence_stream: List[Optional[float]] = []
    speed_stream: List[Optional[float]] = []
    distance_stream: List[Optional[float]] = []
    moving_stream: List[bool] = []

    fallback_distance = 0.0
    last_time = None
    for idx, sample in enumerate(payload.samples):
        elapsed = sample.elapsedSec
        if not isinstance(elapsed, (int, float)):
            elapsed = idx
        time_stream.append(float(elapsed))

        power_val = sample.power if isinstance(sample.power, (int, float)) else None
        hr_val = sample.heartRate if isinstance(sample.heartRate, (int, float)) else None
        cadence_val = sample.cadence if isinstance(sample.cadence, (int, float)) else None
        speed_val = sample.speed if isinstance(sample.speed, (int, float)) else None
        distance_val = sample.distanceMeters if isinstance(sample.distanceMeters, (int, float)) else None

        if distance_val is None and speed_val is not None:
            if last_time is None:
                last_time = float(elapsed)
            delta = max(float(elapsed) - last_time, 0)
            fallback_distance += (speed_val * 1000 / 3600) * delta
            distance_val = fallback_distance
            last_time = float(elapsed)
        elif distance_val is not None:
            last_time = float(elapsed)

        power_stream.append(power_val)
        hr_stream.append(hr_val)
        cadence_stream.append(cadence_val)
        speed_stream.append(speed_val)
        distance_stream.append(distance_val)

        is_moving = False
        if speed_val is not None:
            is_moving = speed_val > 1.0
        elif cadence_val is not None:
            is_moving = cadence_val > 0
        elif power_val is not None:
            is_moving = power_val > 0
        moving_stream.append(is_moving)

    duration_sec = None
    if time_stream:
        duration_sec = max(time_stream) - min(time_stream)
    if not duration_sec or duration_sec <= 0:
        duration_sec = float(len(payload.samples))

    distance_meters = next(
        (val for val in reversed(distance_stream) if isinstance(val, (int, float))),
        None
    )
    distance_km = distance_meters / 1000 if distance_meters is not None else None

    df = pd.DataFrame({
        "time": time_stream,
        "power": power_stream,
        "heart_rate": hr_stream,
        "cadence": cadence_stream,
        "speed": speed_stream,
        "moving": moving_stream
    })

    hr_series = extract_hr_series(df) if not df.empty else None
    hr_avg = compute_avg_hr(hr_series)
    power_metrics = extract_power_metrics(df, hr_avg, current_user) if not df.empty else {}

    activity = Activity(
        user_id=current_user.id,
        start_time=start_time,
        file_name="Live Training Session",
        custom_name=payload.name.strip()[:255] if payload.name else None,
        duration=duration_sec,
        distance=distance_km,
        avg_power=power_metrics.get("avg_power"),
        normalized_power=power_metrics.get("normalized_power"),
        max_5sec_power=power_metrics.get("max_5sec_power"),
        max_1min_power=power_metrics.get("max_1min_power"),
        max_3min_power=power_metrics.get("max_3min_power"),
        max_5min_power=power_metrics.get("max_5min_power"),
        max_10min_power=power_metrics.get("max_10min_power"),
        max_20min_power=power_metrics.get("max_20min_power"),
        max_30min_power=power_metrics.get("max_30min_power"),
        max_60min_power=power_metrics.get("max_60min_power"),
        avg_heart_rate=hr_avg,
        max_heart_rate=float(hr_series.max()) if hr_series is not None and not hr_series.empty else None,
        tss=power_metrics.get("tss"),
        intensity_factor=power_metrics.get("intensity_factor"),
        efficiency_factor=power_metrics.get("efficiency_factor"),
        notes=payload.description.strip() if payload.description else None
    )

    db.add(activity)
    db.flush()

    try:
        stream_path = _get_stream_path(activity)
        if stream_path:
            os.makedirs(os.path.dirname(stream_path), exist_ok=True)
            stream_payload = {
                "time": {"data": time_stream},
                "watts": {"data": power_stream},
                "heartrate": {"data": hr_stream},
                "cadence": {"data": cadence_stream},
                "moving": {"data": moving_stream},
                "distance": {"data": distance_stream},
                "speed": {"data": speed_stream}
            }
            with open(stream_path, "w") as f:
                json.dump(stream_payload, f)
    except Exception:
        pass

    if power_metrics.get("avg_power") and not df.empty:
        try:
            power_zones = compute_power_zones(df, current_user.ftp or 250)
            for zone_label, seconds in power_zones.items():
                if seconds > 0:
                    db.add(PowerZone(
                        activity_id=activity.id,
                        zone_label=zone_label,
                        seconds_in_zone=seconds
                    ))
        except Exception:
            pass

    if hr_series is not None and not hr_series.empty and not df.empty:
        try:
            hr_zones = compute_hr_zones(df, current_user.hr_max or 190)
            if hr_zones:
                for zone_label, seconds in hr_zones.items():
                    if seconds > 0:
                        db.add(HrZone(
                            activity_id=activity.id,
                            zone_label=zone_label,
                            seconds_in_zone=seconds
                        ))
        except Exception:
            pass

    db.commit()

    try:
        from ...services.cache.cache_manager import CacheManager
        cache_manager = CacheManager()
        cache_manager.clear_user_cache_by_prefixes(
            current_user.id,
            [
                "training_load",
                "power_curve",
                "critical_power",
                "efficiency",
                "power_zones",
                "hr_zones",
                "fitness_state",
                "vo2max",
                "best_power",
                "rider_profile",
                "zone_balance",
                "comparisons",
                "ftp_prediction",
                "insights",
                "weekly_summary",
                "polarized_distribution",
                "advanced_metrics",
            ],
        )
    except Exception:
        pass

    try:
        from ...services.cache.cache_tasks import rebuild_user_caches_two_stage
        background_tasks.add_task(rebuild_user_caches_two_stage, current_user.id)
    except Exception:
        pass

    return {"success": True, "activity_id": activity.id}


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
