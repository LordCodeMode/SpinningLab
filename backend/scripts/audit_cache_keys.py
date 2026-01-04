#!/usr/bin/env python3
"""Audit Redis cache keys for expected toggle ranges."""
import argparse
import math
from datetime import datetime, timedelta

from app.database.connection import SessionLocal
from app.database.models import User
from app.services.cache.cache_builder import (
    CacheBuilder,
    POWER_CURVE_RANGES,
    BEST_POWER_RANGES,
    EFFICIENCY_RANGES,
    TRAINING_LOAD_RANGES,
    ZONE_RANGES,
    VO2MAX_RANGES,
    POLARIZED_RANGES,
    ZONE_BALANCE_MODELS,
    ZONE_BALANCE_WEEKS,
)
from app.services.cache.cache_manager import CacheManager


def build_comparison_key(start_date, end_date, months, years):
    return "_".join([
        "comparisons_v2",
        start_date.isoformat(),
        end_date.isoformat(),
        "previous",
        str(end_date.year),
        str(end_date.year - 1),
        str(months),
        str(years),
        "yc0",
        "pr1",
        "ftp1",
        "sv1",
    ])


def expected_keys(user_id: int, builder: CacheBuilder, cache_manager: CacheManager):
    prefix = f"{cache_manager.key_prefix}:user:{user_id}:"
    expected = set()

    expected.add(prefix + "cache_built_at")
    expected.add(prefix + "critical_power")
    expected.add(prefix + "fitness_state")

    for days in [7, 30, 60, 90, 180, 365]:
        expected.add(prefix + f"activity_summary_{days}d")

    for days in TRAINING_LOAD_RANGES:
        expected.add(prefix + f"training_load_{days}d")

    for days in EFFICIENCY_RANGES:
        expected.add(prefix + f"efficiency_{days}d")

    for days in VO2MAX_RANGES:
        expected.add(prefix + f"vo2max_{days}d")

    expected.add(prefix + "power_zones_alld")
    expected.add(prefix + "hr_zones_alld")
    for days in ZONE_RANGES:
        expected.add(prefix + f"power_zones_{days}d")
        expected.add(prefix + f"hr_zones_{days}d")

    expected.add(prefix + "power_curve_absolute")
    expected.add(prefix + "power_curve_weighted")
    for days in POWER_CURVE_RANGES:
        start, end = builder._power_curve_dates(days)
        expected.add(prefix + f"power_curve_absolute_{start}_{end}")
        expected.add(prefix + f"power_curve_weighted_{start}_{end}")
        if days in (30, 90, 180, 365):
            expected.add(prefix + f"power_curve_absolute_range_{days}")
            expected.add(prefix + f"power_curve_weighted_range_{days}")
        if days == 365:
            expected.add(prefix + "power_curve_absolute_ytd")
            expected.add(prefix + "power_curve_weighted_ytd")

    # Power curve caches for comparison ranges (current + previous).
    today = datetime.now().date()
    comparison_days = [30, 60, 180, 365]
    comparison_ranges = []
    for days in comparison_days:
        current_start = today - timedelta(days=days - 1)
        current_end = today
        comparison_ranges.append((current_start, current_end))
        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=days - 1)
        comparison_ranges.append((previous_start, previous_end))

    mtd_start = datetime(today.year, today.month, 1).date()
    mtd_days = (today - mtd_start).days + 1
    comparison_ranges.append((mtd_start, today))
    mtd_prev_end = mtd_start - timedelta(days=1)
    mtd_prev_start = mtd_prev_end - timedelta(days=mtd_days - 1)
    comparison_ranges.append((mtd_prev_start, mtd_prev_end))

    for start_date, end_date in comparison_ranges:
        start_key = start_date.isoformat()
        end_key = end_date.isoformat()
        expected.add(prefix + f"power_curve_absolute_{start_key}_{end_key}")
        expected.add(prefix + f"power_curve_weighted_{start_key}_{end_key}")

    expected.add(prefix + "best_power_values_all")
    for days in BEST_POWER_RANGES:
        expected.add(prefix + f"best_power_values_days_{days}")

    for days in POLARIZED_RANGES:
        expected.add(prefix + f"polarized_distribution_{days}d")

    for model in ZONE_BALANCE_MODELS:
        for weeks in ZONE_BALANCE_WEEKS:
            expected.add(prefix + f"zone_balance_{model}_{weeks}w")

    # Comparisons presets: month-to-date + 30/60/180/365 days
    month_start = datetime(today.year, today.month, 1).date()
    presets = [(month_start, today)]
    for days in [30, 60, 180, 365]:
        presets.append((today - timedelta(days=days - 1), today))

    for start_date, end_date in presets:
        range_days = (end_date - start_date).days + 1
        months = min(60, max(6, math.ceil(range_days / 30)))
        years = min(10, max(2, math.ceil(range_days / 365)))
        expected.add(prefix + build_comparison_key(start_date, end_date, months, years))
        expected.add(prefix + f"comparisons_range_{range_days}_previous_yc0_pr1_ftp1_sv1")
        if start_date.day == 1 and start_date.month == end_date.month and start_date.year == end_date.year:
            expected.add(prefix + "comparisons_mtd_previous_yc0_pr1_ftp1_sv1")

    return expected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, default=1)
    args = parser.parse_args()

    cache_manager = CacheManager()
    if not cache_manager.redis:
        raise SystemExit("Redis is not available. Start Redis and try again.")

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == args.user_id).first()
        if not user:
            raise SystemExit(f"User {args.user_id} not found")

        builder = CacheBuilder(session)
        expected = expected_keys(user.id, builder, cache_manager)

        cursor = 0
        actual = set()
        pattern = f"{cache_manager.key_prefix}:user:{user.id}:*"
        while True:
            cursor, batch = cache_manager.redis.scan(cursor=cursor, match=pattern, count=1000)
            for key in batch:
                if isinstance(key, bytes):
                    actual.add(key.decode("utf-8", errors="ignore"))
                else:
                    actual.add(str(key))
            if cursor == 0:
                break

        missing = sorted(expected - actual)
        extra = sorted(actual - expected)

        print(f"Expected keys: {len(expected)}")
        print(f"Actual keys:   {len(actual)}")

        if missing:
            print("\nMissing keys:")
            for key in missing:
                print(f"  - {key}")
        else:
            print("\nNo missing keys found.")

        if extra:
            print(f"\nExtra keys (not in expected list): {len(extra)}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
