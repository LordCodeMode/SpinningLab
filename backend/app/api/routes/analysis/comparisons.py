"""Comparative analytics endpoints."""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ....database.connection import get_db
from ....database.models import User
from ....api.dependencies import get_current_active_user
from ....services.analysis.comparisons import ComparisonsService
from ....core.config import settings

router = APIRouter()

POWER_CURVE_SAMPLE_DURATIONS = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600]


@router.get("")
def get_comparisons(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    compare_mode: str = Query("previous", description="previous|year"),
    year_current: Optional[int] = Query(None, ge=2000, le=2100),
    year_previous: Optional[int] = Query(None, ge=2000, le=2100),
    months: int = Query(24, ge=3, le=60),
    years: int = Query(2, ge=1, le=10),
    include_year_curve: bool = Query(True, description="Include year-over-year power curve"),
    include_pr_timeline: bool = Query(True, description="Include PR timeline data"),
    include_ftp_progression: bool = Query(True, description="Include FTP progression data"),
    include_seasonal_volume: bool = Query(True, description="Include seasonal volume data"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    compare_mode = compare_mode if compare_mode in ("previous", "year") else "previous"
    service = ComparisonsService(db)
    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    if end_dt:
        end_dt = end_dt + timedelta(days=1) - timedelta(seconds=1)

    if start_dt and end_dt and start_dt > end_dt:
        start_dt, end_dt = end_dt, start_dt

    current_year = year_current or (end_dt.year if end_dt else datetime.utcnow().year)
    previous_year = year_previous or (current_year - 1)
    ranges = service.get_period_ranges(start_dt, end_dt, compare_mode)

    # Cache comparisons response to avoid heavy recomputation.
    from ....services.cache.cache_manager import CacheManager
    cache_manager = CacheManager()

    if start_dt and end_dt:
        range_days = (end_dt.date() - start_dt.date()).days + 1
        alt_keys = [
            f"comparisons_range_{range_days}_{compare_mode}_yc{int(include_year_curve)}_pr{int(include_pr_timeline)}_ftp{int(include_ftp_progression)}_sv{int(include_seasonal_volume)}"
        ]
        if start_dt.day == 1 and start_dt.month == end_dt.month and start_dt.year == end_dt.year:
            alt_keys.append(
                f"comparisons_mtd_{compare_mode}_yc{int(include_year_curve)}_pr{int(include_pr_timeline)}_ftp{int(include_ftp_progression)}_sv{int(include_seasonal_volume)}"
            )
        for alt_key in alt_keys:
            cached = cache_manager.get(
                alt_key,
                current_user.id,
                max_age_hours=settings.CACHE_WARMUP_MAX_AGE_HOURS
            )
            if cached:
                if "power_curve_comparison" not in cached:
                    cached["power_curve_comparison"] = _build_power_curve_comparison(
                        cache_manager,
                        service,
                        current_user,
                        ranges["current_start"],
                        ranges["current_end"],
                        ranges["previous_start"],
                        ranges["previous_end"]
                    )
                    cache_manager.set(alt_key, current_user.id, cached)
                return cached

    start_key = start_dt.date().isoformat() if start_dt else "default"
    end_key = end_dt.date().isoformat() if end_dt else "default"
    cache_key = "_".join([
        "comparisons_v2",
        start_key,
        end_key,
        compare_mode,
        str(current_year),
        str(previous_year),
        str(months),
        str(years),
        f"yc{int(include_year_curve)}",
        f"pr{int(include_pr_timeline)}",
        f"ftp{int(include_ftp_progression)}",
        f"sv{int(include_seasonal_volume)}"
    ])

    cached = cache_manager.get(
        cache_key,
        current_user.id,
        max_age_hours=settings.CACHE_WARMUP_MAX_AGE_HOURS
    )
    if cached:
        if "power_curve_comparison" not in cached:
            cached["power_curve_comparison"] = _build_power_curve_comparison(
                cache_manager,
                service,
                current_user,
                ranges["current_start"],
                ranges["current_end"],
                ranges["previous_start"],
                ranges["previous_end"]
            )
            cache_manager.set(cache_key, current_user.id, cached)
        return cached

    period_comparison = {
        "current": service.get_period_summary(current_user, ranges["current_start"], ranges["current_end"]),
        "previous": service.get_period_summary(current_user, ranges["previous_start"], ranges["previous_end"])
    }

    pr_current = service.get_pr_timeline(
        current_user,
        ranges["current_start"],
        ranges["current_end"],
        only_changes=True
    ) if include_pr_timeline else []

    pr_previous = service.get_pr_timeline(
        current_user,
        ranges["previous_start"],
        ranges["previous_end"],
        only_changes=True
    ) if include_pr_timeline else []

    current_bests = service.get_period_power_bests(current_user, ranges["current_start"], ranges["current_end"])
    previous_bests = service.get_period_power_bests(current_user, ranges["previous_start"], ranges["previous_end"])
    pr_summary = {
        "current": current_bests,
        "previous": previous_bests,
        "delta": {
            "best_5min": (
                (current_bests.get("best_5min") or 0) - (previous_bests.get("best_5min") or 0)
            ),
            "best_20min": (
                (current_bests.get("best_20min") or 0) - (previous_bests.get("best_20min") or 0)
            )
        }
    }

    response = {
        "period_comparison": period_comparison,
        "pr_timeline": pr_current,
        "pr_timeline_previous": pr_previous,
        "pr_summary": pr_summary,
        "power_curve_comparison": {},
        "year_over_year_power_curve": {},
        "ftp_progression": [],
        "ftp_progression_previous": [],
        "seasonal_volume": [],
        "seasonal_volume_previous": []
    }

    if include_year_curve:
        response["year_over_year_power_curve"] = {
            "current_year": current_year,
            "previous_year": previous_year,
            "current": service.get_year_power_curve(current_user, current_year) or [],
            "previous": service.get_year_power_curve(current_user, previous_year) or []
        }

    if include_ftp_progression:
        response["ftp_progression"] = service.get_ftp_progression(
            current_user,
            ranges["current_start"],
            ranges["current_end"],
            months=months
        )
        response["ftp_progression_previous"] = service.get_ftp_progression(
            current_user,
            ranges["previous_start"],
            ranges["previous_end"],
            months=months
        )

    if include_seasonal_volume:
        response["seasonal_volume"] = _aggregate_seasonal_by_season(
            service.get_seasonal_volume(
                current_user,
                ranges["current_start"],
                ranges["current_end"],
                years=years
            )
        )
        response["seasonal_volume_previous"] = _aggregate_seasonal_by_season(
            service.get_seasonal_volume(
                current_user,
                ranges["previous_start"],
                ranges["previous_end"],
                years=years
            )
        )

    response["power_curve_comparison"] = _build_power_curve_comparison(
        cache_manager,
        service,
        current_user,
        ranges["current_start"],
        ranges["current_end"],
        ranges["previous_start"],
        ranges["previous_end"]
    )

    cache_manager.set(cache_key, current_user.id, response)
    return response


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def _build_power_curve_comparison(cache_manager, service, user, current_start, current_end, previous_start, previous_end):
    current_curve = _get_power_curve(cache_manager, service, user, current_start, current_end)
    previous_curve = _get_power_curve(cache_manager, service, user, previous_start, previous_end)

    return {
        "current": _sample_curve_payload(current_curve, weighted=False),
        "previous": _sample_curve_payload(previous_curve, weighted=False)
    }


def _get_power_curve(cache_manager, service, user, start_dt, end_dt):
    start_key = start_dt.date().isoformat()
    end_key = end_dt.date().isoformat()
    cached = _get_cached_curve(cache_manager, user.id, start_key, end_key)
    if cached:
        return cached

    curve_list = service.power_curve_service.get_user_power_curve(
        user,
        weighted=False,
        start_date=start_key,
        end_date=end_key
    )
    payload = _prepare_curve_payload(curve_list, False)
    cache_manager.set(f"power_curve_absolute_{start_key}_{end_key}", user.id, payload)
    return payload


def _get_cached_curve(cache_manager, user_id, start_key, end_key):
    cache_prefix = "power_curve_absolute"
    cache_candidates = []

    try:
        start_dt = datetime.strptime(start_key, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_key, "%Y-%m-%d").date()
        today = datetime.now().date()
        range_days = (end_dt - start_dt).days + 1

        if end_dt == today and range_days in (30, 90, 180, 365):
            expected_start = today - timedelta(days=range_days - 1)
            if start_dt == expected_start:
                cache_candidates.append(f"{cache_prefix}_range_{range_days}")

        if end_dt == today and start_dt == datetime(end_dt.year, 1, 1).date():
            cache_candidates.append(f"{cache_prefix}_ytd")
    except Exception:
        cache_candidates = []

    cache_candidates.append(f"{cache_prefix}_{start_key}_{end_key}")

    for candidate in cache_candidates:
        cached = cache_manager.get(
            candidate,
            user_id,
            max_age_hours=settings.POWER_CURVE_CACHE_MAX_AGE_HOURS
        )
        if cached:
            return cached

    return None


def _prepare_curve_payload(curve_list, weighted: bool) -> dict:
    if not curve_list:
        return {"durations": [], "powers": [], "weighted": weighted}
    return {
        "durations": list(range(1, len(curve_list) + 1)),
        "powers": curve_list,
        "weighted": weighted
    }


def _sample_curve_payload(curve, weighted: bool) -> dict:
    lookup = _curve_to_lookup(curve)
    powers = [lookup.get(duration, 0.0) for duration in POWER_CURVE_SAMPLE_DURATIONS]
    return {
        "durations": POWER_CURVE_SAMPLE_DURATIONS,
        "powers": powers,
        "weighted": weighted
    }


def _curve_to_lookup(curve):
    if isinstance(curve, dict):
        durations = curve.get("durations") or []
        powers = curve.get("powers") or []
    elif isinstance(curve, list):
        durations = range(1, len(curve) + 1)
        powers = curve
    else:
        return {}

    lookup = {}
    for duration, power in zip(durations, powers):
        if duration is None or power is None:
            continue
        try:
            duration_val = int(round(float(duration)))
            power_val = float(power)
        except (TypeError, ValueError):
            continue
        if duration_val <= 0:
            continue
        lookup[duration_val] = power_val
    return lookup


def _aggregate_seasonal_by_season(items):
    if not items:
        return []
    season_order = ["Winter", "Spring", "Summer", "Fall"]
    buckets = {season: {"label": season, "duration_hours": 0.0, "total_tss": 0.0} for season in season_order}
    for item in items:
        label = str(item.get("label", ""))
        season = label.split(" ")[0] if label else ""
        if season not in buckets:
            continue
        buckets[season]["duration_hours"] += float(item.get("duration_hours") or 0)
        buckets[season]["total_tss"] += float(item.get("total_tss") or 0)
    result = []
    for season in season_order:
        entry = buckets[season]
        result.append({
            "label": entry["label"],
            "duration_hours": round(entry["duration_hours"], 2),
            "total_tss": round(entry["total_tss"], 1)
        })
    return result
