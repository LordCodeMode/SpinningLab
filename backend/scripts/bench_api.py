"""
Quick benchmark script for core API endpoints.

Usage:
  API_TOKEN=... python scripts/bench_api.py
  API_BASE_URL=http://localhost:8000 API_TOKEN=... python scripts/bench_api.py --runs 5
"""
from __future__ import annotations

import argparse
import statistics
import time
from datetime import date, timedelta
from typing import Dict, List, Tuple

import httpx
import os


def _iso(d: date) -> str:
    return d.isoformat()


def build_endpoints() -> List[Tuple[str, str, Dict[str, str]]]:
    today = date.today()
    start_30 = today - timedelta(days=29)
    start_90 = today - timedelta(days=89)
    week_start = today - timedelta(days=today.weekday())

    return [
        ("GET", "/api/activities", {"limit": "50"}),
        ("GET", "/api/activities/summary", {"days": "30"}),
        ("GET", "/api/calendar/week", {"week_start": _iso(week_start)}),
        ("GET", "/api/analysis/training-load", {"days": "90"}),
        ("GET", "/api/analysis/zones/power", {"days": "90"}),
        ("GET", "/api/analysis/zones/hr", {"days": "90"}),
        ("GET", "/api/analysis/best-power-values", {"days": "90"}),
        ("GET", "/api/analysis/power-curve", {"start": _iso(start_30), "end": _iso(today)}),
        ("GET", "/api/analysis/comparisons", {"start_date": _iso(start_90), "end_date": _iso(today)}),
    ]


def run_benchmarks(base_url: str, token: str, runs: int, warmup: int) -> None:
    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(base_url=base_url, headers=headers, timeout=60) as client:
        for method, path, params in build_endpoints():
            # warmup
            for _ in range(warmup):
                try:
                    client.request(method, path, params=params)
                except httpx.HTTPError:
                    break

            timings = []
            statuses = set()
            for _ in range(runs):
                try:
                    start = time.perf_counter()
                    response = client.request(method, path, params=params)
                    elapsed = time.perf_counter() - start
                    timings.append(elapsed)
                    statuses.add(response.status_code)
                except httpx.HTTPError as exc:
                    statuses.add("ERR")
                    print(f"{method} {path} {params} -> error={exc.__class__.__name__}: {exc}")
                    break

            if not timings:
                continue
            timings_ms = [t * 1000 for t in timings]
            p50 = statistics.median(timings_ms)
            p95 = statistics.quantiles(timings_ms, n=20)[18] if len(timings_ms) >= 2 else timings_ms[0]
            avg = statistics.mean(timings_ms)
            print(
                f"{method} {path} {params} -> "
                f"avg={avg:.1f}ms p50={p50:.1f}ms p95={p95:.1f}ms status={sorted(statuses)}"
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--warmup", type=int, default=1)
    args = parser.parse_args()

    base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    token = os.getenv("API_TOKEN")
    if not token:
        raise SystemExit("Missing API_TOKEN env var.")

    run_benchmarks(str(base_url), token, args.runs, args.warmup)


if __name__ == "__main__":
    main()
