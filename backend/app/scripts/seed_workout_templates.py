"""
Seed workout templates
Creates pre-built workout templates for common training types.
"""

from typing import Dict, List

from sqlalchemy.orm import Session

from ..database.connection import SessionLocal
from ..database.models import Workout
from ..services.workout_service import WorkoutService


def _interval(
    duration: int,
    low: float,
    high: float,
    interval_type: str,
    description: str,
    power_type: str = "percent_ftp",
) -> Dict:
    return {
        "duration": int(duration),
        "target_power_low": float(low),
        "target_power_high": float(high),
        "target_power_type": power_type,
        "interval_type": interval_type,
        "description": description,
    }


def _pct(duration: int, low: float, high: float, interval_type: str, description: str) -> Dict:
    return _interval(duration, low, high, interval_type, description, "percent_ftp")


def _watts(duration: int, low: float, high: float, interval_type: str, description: str) -> Dict:
    return _interval(duration, low, high, interval_type, description, "watts")


def _repeat(
    count: int,
    work_duration: int,
    work_low: float,
    work_high: float,
    recovery_duration: int,
    recovery_low: float,
    recovery_high: float,
    work_desc: str = "Work",
    recovery_desc: str = "Recovery",
) -> List[Dict]:
    blocks: List[Dict] = []
    for idx in range(count):
        label = f"{work_desc} {idx + 1}" if count > 1 else work_desc
        blocks.append(_pct(work_duration, work_low, work_high, "work", label))
        if idx < count - 1 and recovery_duration > 0:
            blocks.append(_pct(recovery_duration, recovery_low, recovery_high, "recovery", recovery_desc))
    return blocks


def _legacy_compat_templates() -> List[Dict]:
    """
    Legacy templates referenced by training plan presets.
    Keep these names stable for compatibility.
    """
    return [
        {
            "name": "Sweet Spot 3x10",
            "description": "Classic sweet spot workout: 3x10min at 88-93% FTP.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(600, 55, 65, "warmup", "Warmup"),
                *_repeat(3, 600, 88, 93, 300, 50, 60, "Sweet Spot", "Recovery"),
                _pct(600, 55, 65, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "VO2 Max 5x3",
            "description": "VO2max intervals: 5x3min at 110-120% FTP.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(900, 55, 70, "warmup", "Warmup"),
                *_repeat(5, 180, 110, 120, 180, 50, 60, "VO2", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "FTP 2x20",
            "description": "Classic threshold set: 2x20min at 95-105% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(1200, 55, 70, "warmup", "Warmup"),
                *_repeat(2, 1200, 95, 105, 600, 50, 60, "Threshold", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Endurance 90 min Z2",
            "description": "Long endurance ride: 90 minutes in Zone 2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(900, 50, 60, "warmup", "Warmup"),
                _pct(4500, 56, 75, "work", "Zone 2 endurance"),
                _pct(300, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Endurance 60 min Z2",
            "description": "Steady endurance ride: 60 minutes in Zone 2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(2400, 56, 75, "work", "Zone 2 endurance"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Endurance 75 min Z2",
            "description": "Steady endurance ride: 75 minutes in Zone 2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(3300, 56, 75, "work", "Zone 2 endurance"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Recovery Ride 45 min",
            "description": "Active recovery: easy spinning at 45-55% FTP.",
            "workout_type": "Recovery",
            "intervals": [_pct(2700, 45, 55, "recovery", "Easy spinning")],
        },
        {
            "name": "Recovery Ride 30 min",
            "description": "Easy recovery spin: 30 minutes at 45-55% FTP.",
            "workout_type": "Recovery",
            "intervals": [
                _pct(300, 45, 55, "warmup", "Warmup"),
                _pct(1200, 45, 55, "recovery", "Easy spinning"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Over-Unders 4x8",
            "description": "Threshold over-unders: 4x8min alternating 95%/105% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(600, 55, 70, "warmup", "Warmup"),
                *[
                    item
                    for i in range(4)
                    for item in [
                        _pct(120, 95, 100, "work", f"Under {i + 1}"),
                        _pct(120, 100, 105, "work", f"Over {i + 1}"),
                        _pct(120, 95, 100, "work", f"Under {i + 1}"),
                        _pct(120, 100, 105, "work", f"Over {i + 1}"),
                        _pct(300, 50, 60, "recovery", "Recovery") if i < 3 else _pct(600, 50, 60, "cooldown", "Cooldown"),
                    ]
                ],
            ],
        },
        {
            "name": "VO2 Max 4x4",
            "description": "Classic VO2 set: 4x4min at 110-120% FTP.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(900, 55, 70, "warmup", "Warmup"),
                *_repeat(4, 240, 110, 120, 240, 50, 60, "VO2", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Threshold 3x12",
            "description": "Threshold repeats: 3x12min at 95-100% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(600, 55, 70, "warmup", "Warmup"),
                *_repeat(3, 720, 95, 100, 360, 50, 60, "Threshold", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Threshold 3x10",
            "description": "Threshold repeats: 3x10min at 95-100% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(600, 55, 70, "warmup", "Warmup"),
                *_repeat(3, 600, 95, 100, 300, 50, 60, "Threshold", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Threshold 4x8",
            "description": "Threshold repeats: 4x8min at 95-105% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(600, 55, 70, "warmup", "Warmup"),
                *_repeat(4, 480, 95, 105, 240, 50, 60, "Threshold", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Sweet Spot 4x8",
            "description": "Sweet Spot focus: 4x8min at 88-93% FTP.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(600, 55, 70, "warmup", "Warmup"),
                *_repeat(4, 480, 88, 93, 240, 50, 60, "Sweet Spot", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Sweet Spot 3x12",
            "description": "Sweet Spot repeats: 3x12min at 88-93% FTP.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(600, 55, 70, "warmup", "Warmup"),
                *_repeat(3, 720, 88, 93, 360, 50, 60, "Sweet Spot", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Sweet Spot 2x20",
            "description": "Sweet Spot focus: 2x20min at 88-93% FTP.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(900, 55, 70, "warmup", "Warmup"),
                *_repeat(2, 1200, 88, 93, 480, 50, 60, "Sweet Spot", "Recovery"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Endurance 2h Z2",
            "description": "Extended endurance ride: 2h in Zone 2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(6000, 56, 75, "work", "Zone 2 endurance"),
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Endurance 2.5h Z2",
            "description": "Long endurance ride: 2.5h in Zone 2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(900, 50, 60, "warmup", "Warmup"),
                _pct(7200, 56, 75, "work", "Zone 2 endurance"),
                _pct(900, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Endurance 3h Z2",
            "description": "Long endurance ride: 3h in Zone 2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(900, 50, 60, "warmup", "Warmup"),
                _pct(9000, 56, 75, "work", "Zone 2 endurance"),
                _pct(900, 50, 60, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Sprint Intervals 8x1min",
            "description": "Anaerobic sprints: 8x1min all-out with recoveries.",
            "workout_type": "Sprint",
            "intervals": [
                _pct(900, 55, 70, "warmup", "Warmup"),
                *[
                    item
                    for i in range(8)
                    for item in [
                        _pct(60, 150, 200, "work", f"Sprint {i + 1}"),
                        _pct(150, 50, 60, "recovery", "Recovery"),
                    ]
                ],
                _pct(600, 50, 60, "cooldown", "Cooldown"),
            ],
        },
    ]


def _new_extended_templates() -> List[Dict]:
    templates: List[Dict] = []

    # VO2max Workouts
    templates.extend([
        {
            "name": "VO2 Classic 5x3",
            "description": "VO2max: 5x3min at 115-120% FTP with full recoveries.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup ramp"),
                *[item for _ in range(3) for item in [_pct(30, 110, 110, "work", "Opener"), _pct(60, 50, 50, "recovery", "Easy")]],
                *_repeat(5, 180, 115, 120, 180, 50, 55, "VO2", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "VO2 6x3 (Short and Hard)",
            "description": "VO2max: 6x3min at 112-118% FTP.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(600, 50, 70, "warmup", "Warmup"),
                *_repeat(6, 180, 112, 118, 180, 50, 55, "VO2", "Recovery"),
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "VO2 4x4 (Highly Effective)",
            "description": "VO2max: 4x4min at 110-115% FTP.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(900, 50, 70, "warmup", "Warmup ramp"),
                *[item for _ in range(3) for item in [_pct(20, 115, 115, "work", "Opener"), _pct(40, 50, 55, "recovery", "Easy")]],
                *_repeat(4, 240, 110, 115, 240, 50, 55, "VO2", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "30/30 Microbursts VO2",
            "description": "VO2 microbursts in long blocks.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *[
                    item
                    for block in range(3)
                    for item in ([
                        item2
                        for _ in range(10)
                        for item2 in [
                            _pct(30, 120, 120, "work", "Burst"),
                            _pct(30, 50, 55, "recovery", "Float"),
                        ]
                    ] + ([_pct(300, 50, 55, "recovery", "Block recovery")] if block < 2 else []))
                ],
                _pct(360, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "40/20 Microbursts Intense",
            "description": "High-intensity VO2 microbursts.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *[
                    item
                    for block in range(2)
                    for item in ([
                        item2
                        for _ in range(18)
                        for item2 in [
                            _pct(40, 120, 120, "work", "Burst"),
                            _pct(20, 50, 55, "recovery", "Float"),
                        ]
                    ] + ([_pct(360, 50, 55, "recovery", "Set recovery")] if block == 0 else []))
                ],
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "VO2 Pyramid 1-2-3-4-3-2-1",
            "description": "VO2max pyramid with variable interval lengths.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *[item for _ in range(2) for item in [_pct(30, 115, 115, "work", "Opener"), _pct(60, 50, 55, "recovery", "Easy")]],
                _pct(60, 120, 120, "work", "1 min"),
                _pct(120, 50, 55, "recovery", "Easy"),
                _pct(120, 118, 118, "work", "2 min"),
                _pct(120, 50, 55, "recovery", "Easy"),
                _pct(180, 115, 115, "work", "3 min"),
                _pct(180, 50, 55, "recovery", "Easy"),
                _pct(240, 110, 115, "work", "4 min"),
                _pct(240, 50, 55, "recovery", "Easy"),
                _pct(180, 115, 115, "work", "3 min"),
                _pct(180, 50, 55, "recovery", "Easy"),
                _pct(120, 118, 118, "work", "2 min"),
                _pct(120, 50, 55, "recovery", "Easy"),
                _pct(60, 120, 120, "work", "1 min"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Threshold Workouts
    templates.extend([
        {
            "name": "2x20 Threshold Classic",
            "description": "Threshold classic: 2x20min at 95-100% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup ramp"),
                *[item for _ in range(3) for item in [_pct(20, 110, 110, "work", "Opener"), _pct(40, 50, 55, "recovery", "Easy")]],
                *_repeat(2, 1200, 95, 100, 480, 55, 60, "Threshold", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "4x10 Threshold",
            "description": "Threshold build: 4x10min at 98-102% FTP.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *_repeat(4, 600, 98, 102, 300, 55, 55, "Threshold", "Recovery"),
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "3x15 Threshold",
            "description": "High-volume threshold repeats.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *_repeat(3, 900, 95, 100, 360, 55, 55, "Threshold", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Cruise Intervals 6x6",
            "description": "6x6min threshold cruise intervals.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *_repeat(6, 360, 100, 105, 180, 55, 55, "Cruise", "Recovery"),
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Over-Unders 3x12",
            "description": "Threshold lactate-management over-unders.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *[
                    item
                    for block in range(3)
                    for item in ([
                        item2
                        for _ in range(3)
                        for item2 in [
                            _pct(120, 105, 105, "work", "Over"),
                            _pct(120, 95, 95, "work", "Under"),
                        ]
                    ] + ([_pct(360, 50, 55, "recovery", "Block recovery")] if block < 2 else []))
                ],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Sweet Spot Workouts
    templates.extend([
        {
            "name": "3x12 Sweet Spot Efficient",
            "description": "Efficient sweet spot workout.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *_repeat(3, 720, 88, 92, 300, 55, 60, "Sweet Spot", "Recovery"),
                _pct(420, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "2x25 Sweet Spot Fatigue Builder",
            "description": "Long sweet spot blocks for durable power.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *_repeat(2, 1500, 88, 92, 480, 55, 55, "Sweet Spot", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "1x45 Sweet Spot Steady Grind",
            "description": "Single steady sweet spot effort.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                _pct(2700, 88, 92, "work", "Steady sweet spot"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Sweet Spot Progressive Steps",
            "description": "Progressive sweet spot stepping blocks.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *[
                    item
                    for block in range(3)
                    for item in [
                        _pct(180, 88, 88, "work", "Step 1"),
                        _pct(240, 90, 90, "work", "Step 2"),
                        _pct(180, 92, 94, "work", "Step 3"),
                    ] + ([_pct(300, 50, 60, "recovery", "Recovery")] if block < 2 else [])
                ],
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Endurance / Base Workouts
    templates.extend([
        {
            "name": "60min Z2 with 6x10s Spin-Ups",
            "description": "Zone 2 endurance with cadence spin-up drills.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 70, "warmup", "Warmup"),
                _pct(720, 60, 72, "work", "Settle into Z2"),
                *[
                    item
                    for i in range(6)
                    for item in [
                        _pct(10, 65, 75, "work", f"Spin-up {i + 1}"),
                        _pct(120 if i < 5 else 0, 60, 72, "recovery", "Z2") if i < 5 else None,
                    ]
                    if item is not None
                ],
                _pct(1370, 60, 72, "work", "Steady Z2"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "90min Z2 Steady",
            "description": "Continuous Zone 2 aerobic ride.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 65, "warmup", "Warmup"),
                _pct(4500, 60, 72, "work", "Steady Z2"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "2h Z2 with Tempo Surges",
            "description": "Endurance ride with embedded tempo sections.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                *[item for _ in range(3) for item in [_pct(1200, 60, 72, "work", "Endurance"), _pct(600, 80, 85, "work", "Tempo")]],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "75 Endurance Progression",
            "description": "Progressive endurance from low Z2 to upper Z2.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(900, 60, 60, "work", "Progression 1"),
                _pct(900, 65, 65, "work", "Progression 2"),
                _pct(900, 72, 75, "work", "Progression 3"),
                _pct(1200, 55, 60, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Recovery Workouts
    templates.extend([
        {
            "name": "30 Super Easy",
            "description": "Very easy recovery spin.",
            "workout_type": "Recovery",
            "intervals": [
                _pct(300, 45, 55, "warmup", "Warmup"),
                _pct(1200, 45, 55, "recovery", "Easy spin"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "45min Recovery with 5x30s Openers",
            "description": "Recovery ride with short activation surges.",
            "workout_type": "Recovery",
            "intervals": [
                _pct(600, 45, 55, "warmup", "Warmup"),
                *[item for _ in range(5) for item in [_pct(30, 90, 100, "work", "Opener"), _pct(120, 45, 55, "recovery", "Easy")]],
                _pct(900, 45, 55, "recovery", "Easy spin"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Lactate Shuttle / Over-Under / Tolerance
    templates.extend([
        {
            "name": "Over-Under 3x10 Short and Sharp",
            "description": "Short over-under lactate shuttle blocks.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *[
                    item
                    for block in range(3)
                    for item in ([
                        item2
                        for _ in range(5)
                        for item2 in [
                            _pct(60, 105, 110, "work", "Over"),
                            _pct(60, 88, 92, "work", "Under"),
                        ]
                    ] + ([_pct(360, 50, 55, "recovery", "Block recovery")] if block < 2 else []))
                ],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Over-Under 2x20 Race Like",
            "description": "Race-like over-under threshold intervals.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *[
                    item
                    for block in range(2)
                    for item in ([
                        item2
                        for _ in range(5)
                        for item2 in [
                            _pct(180, 95, 95, "work", "Under"),
                            _pct(60, 110, 110, "work", "Over"),
                        ]
                    ] + ([_pct(480, 50, 55, "recovery", "Block recovery")] if block == 0 else []))
                ],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Threshold Stutter 12x2/1",
            "description": "Threshold on/off repetitions for tolerance.",
            "workout_type": "Threshold",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *[
                    item
                    for block in range(3)
                    for item in ([
                        item2
                        for _ in range(3)
                        for item2 in [
                            _pct(120, 100, 105, "work", "Threshold"),
                            _pct(60, 60, 60, "recovery", "Reset"),
                        ]
                    ] + ([_pct(300, 50, 55, "recovery", "Block recovery")] if block < 2 else []))
                ],
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Fatigue Resistance
    templates.extend([
        {
            "name": "75 Z2 to Sweet Spot Finish",
            "description": "Fatigue resistance: Z2 first, sweet spot finish.",
            "workout_type": "Endurance",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(2400, 60, 72, "work", "Endurance"),
                _pct(600, 88, 92, "work", "Sweet Spot 1"),
                _pct(300, 60, 60, "recovery", "Reset"),
                _pct(600, 88, 92, "work", "Sweet Spot 2"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "90 Tempo Sweet Spot Late",
            "description": "Late-session tempo/sweet spot fatigue work.",
            "workout_type": "Tempo",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(2700, 60, 72, "work", "Endurance"),
                *_repeat(3, 480, 90, 94, 240, 60, 60, "Late tempo", "Reset"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "2h Endurance with 3x15 Late Tempo",
            "description": "Long ride with late tempo blocks.",
            "workout_type": "Tempo",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                _pct(3600, 60, 72, "work", "Endurance"),
                *_repeat(3, 900, 80, 87, 300, 60, 60, "Late tempo", "Reset"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Sprint Workouts
    templates.extend([
        {
            "name": "Neuromuscular Sprints 10x10s",
            "description": "Short maximal neuromuscular sprint training.",
            "workout_type": "Sprint",
            "intervals": [
                _pct(900, 50, 70, "warmup", "Warmup"),
                *[item for _ in range(3) for item in [_pct(20, 100, 110, "work", "Activation"), _pct(40, 50, 55, "recovery", "Easy")]],
                *[item for i in range(10) for item in [_pct(10, 160, 200, "work", f"Sprint {i + 1}"), _pct(170, 50, 60, "recovery", "Recovery")]],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "Two Sprint Sets 6x12s",
            "description": "Two sets of quality sprint efforts.",
            "workout_type": "Sprint",
            "intervals": [
                _pct(900, 50, 70, "warmup", "Warmup"),
                *[item for _ in range(4) for item in [_pct(10, 120, 120, "work", "Activation"), _pct(50, 50, 55, "recovery", "Easy")]],
                *[item for i in range(6) for item in [_pct(12, 165, 200, "work", f"Set 1 sprint {i + 1}"), _pct(168, 50, 60, "recovery", "Recovery")]],
                _pct(480, 55, 60, "recovery", "Set recovery"),
                *[item for i in range(6) for item in [_pct(12, 165, 200, "work", f"Set 2 sprint {i + 1}"), _pct(168, 50, 60, "recovery", "Recovery")]],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Anaerobic Capacity Workouts
    templates.extend([
        {
            "name": "10x1 Anaerobic Classic",
            "description": "Classic anaerobic capacity 1-minute repeats.",
            "workout_type": "Anaerobic Capacity",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *_repeat(10, 60, 130, 150, 120, 50, 55, "Anaerobic", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "6x2 Anaerobic 125-140",
            "description": "Longer anaerobic-capacity repeats.",
            "workout_type": "Anaerobic Capacity",
            "intervals": [
                _pct(900, 50, 75, "warmup", "Warmup"),
                *_repeat(6, 120, 125, 140, 240, 50, 55, "Anaerobic", "Recovery"),
                _pct(540, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "3x(4x30/30) Anaerobic",
            "description": "Anaerobic 30/30 sets with long set recoveries.",
            "workout_type": "Anaerobic Capacity",
            "intervals": [
                _pct(720, 50, 70, "warmup", "Warmup"),
                *[
                    item
                    for block in range(3)
                    for item in ([
                        item2
                        for _ in range(4)
                        for item2 in [
                            _pct(30, 140, 150, "work", "Anaerobic"),
                            _pct(30, 50, 50, "recovery", "Float"),
                        ]
                    ] + ([_pct(360, 50, 55, "recovery", "Set recovery")] if block < 2 else []))
                ],
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Race Prep / Mixed
    templates.extend([
        {
            "name": "Pre-Race Openers 40",
            "description": "Pre-race opener set with VO2 and sprint activations.",
            "workout_type": "Race Prep",
            "intervals": [
                _pct(900, 50, 70, "warmup", "Warmup"),
                *[item for _ in range(3) for item in [_pct(60, 110, 115, "work", "VO2 opener"), _pct(180, 50, 55, "recovery", "Easy")]],
                *[item for _ in range(3) for item in [_pct(20, 150, 150, "work", "Sprint opener"), _pct(160, 50, 55, "recovery", "Easy")]],
                _pct(540, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "60 Polarized Z2 Plus VO2",
            "description": "Polarized blend of VO2 and endurance.",
            "workout_type": "Race Prep",
            "intervals": [
                _pct(720, 50, 60, "warmup", "Warmup"),
                *_repeat(6, 120, 115, 120, 180, 55, 55, "VO2", "Recovery"),
                _pct(900, 60, 70, "work", "Endurance finish"),
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "90 Sweet Spot Plus VO2 Touch",
            "description": "Mixed race-prep with sweet spot and VO2 touches.",
            "workout_type": "Race Prep",
            "intervals": [
                _pct(900, 50, 60, "warmup", "Warmup"),
                *_repeat(2, 900, 88, 92, 360, 50, 55, "Sweet Spot", "Recovery"),
                *_repeat(4, 120, 115, 115, 180, 50, 55, "VO2 touch", "Recovery"),
                _pct(600, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Mini workouts
    templates.extend([
        {
            "name": "25 Sweet Spot Crunch",
            "description": "Time-crunched sweet spot session.",
            "workout_type": "Sweet Spot",
            "intervals": [
                _pct(360, 50, 70, "warmup", "Warmup"),
                *_repeat(2, 360, 90, 94, 120, 50, 55, "Sweet Spot", "Recovery"),
                _pct(300, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "30 VO2 Touch",
            "description": "Short VO2 touch session.",
            "workout_type": "VO2max",
            "intervals": [
                _pct(480, 50, 60, "warmup", "Warmup"),
                *_repeat(5, 60, 115, 120, 60, 50, 55, "VO2", "Recovery"),
                _pct(720, 60, 70, "work", "Z2 finish"),
            ],
        },
        {
            "name": "30min Anaerobic Bite",
            "description": "Short anaerobic capacity stimulus.",
            "workout_type": "Anaerobic Capacity",
            "intervals": [
                _pct(600, 50, 60, "warmup", "Warmup"),
                *_repeat(6, 30, 140, 150, 120, 50, 55, "Anaerobic", "Recovery"),
                _pct(480, 45, 55, "cooldown", "Cooldown"),
            ],
        },
        {
            "name": "20 Recovery Reset",
            "description": "Very light recovery reset ride.",
            "workout_type": "Recovery",
            "intervals": [
                _pct(180, 45, 55, "warmup", "Warmup"),
                _pct(840, 45, 55, "recovery", "Easy spin"),
                _pct(180, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    # Ramp tests
    templates.extend([
        {
            "name": "Ramp Test",
            "description": "Classic ramp test to exhaustion: 12min warm-up, 1min steps with +20W each minute, stop the test when cadence drops below 40 rpm, maximum ramp step is 560W, then 10-15min easy cooldown.",
            "workout_type": "Ramp Test",
            "intervals": [
                _pct(300, 50, 60, "warmup", "Warm-up block 1"),
                _pct(300, 60, 70, "warmup", "Warm-up block 2"),
                _pct(120, 70, 75, "warmup", "Warm-up block 3"),
                *[_watts(60, 100 + i * 20, 100 + i * 20, "work", f"Ramp step {i + 1}") for i in range(24)],
                _pct(720, 45, 55, "cooldown", "Cooldown"),
            ],
        },
    ])

    return templates


def _dedupe_templates(templates: List[Dict]) -> List[Dict]:
    seen = set()
    deduped: List[Dict] = []
    for template in templates:
        key = str(template.get("name", "")).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(template)
    return deduped


def _collapse_template_ranges_to_exact_targets(templates: List[Dict]) -> List[Dict]:
    normalized_templates: List[Dict] = []
    for template in templates:
        normalized_intervals: List[Dict] = []
        for interval in template.get("intervals", []):
            normalized_interval = WorkoutService.normalize_interval_target(interval)
            normalized_intervals.append(normalized_interval)

        template_copy = dict(template)
        template_copy["intervals"] = normalized_intervals
        normalized_templates.append(template_copy)

    return normalized_templates


WORKOUT_TEMPLATES = _collapse_template_ranges_to_exact_targets(
    _dedupe_templates(_legacy_compat_templates() + _new_extended_templates())
)

# Legacy non-English template names mapped to current English names.
TEMPLATE_NAME_ALIASES = {
    "VO2 Klassiker 5x3": "VO2 Classic 5x3",
    "VO2 6x3 (Kurz und Hart)": "VO2 6x3 (Short and Hard)",
    "VO2 4x4 (Sehr Effektiv)": "VO2 4x4 (Highly Effective)",
    "40/20 Microbursts Intensiv": "40/20 Microbursts Intense",
    "VO2 Pyramide 1-2-3-4-3-2-1": "VO2 Pyramid 1-2-3-4-3-2-1",
    "2x20 Schwelle Klassiker": "2x20 Threshold Classic",
    "4x10 Schwelle": "4x10 Threshold",
    "3x15 Schwelle": "3x15 Threshold",
    "3x12 Sweet Spot Effizient": "3x12 Sweet Spot Efficient",
    "Sweet Spot Stufen Progressiv": "Sweet Spot Progressive Steps",
    "60 Z2 mit 6x10s Spin-Ups": "60min Z2 with 6x10s Spin-Ups",
    "90 Z2 Konstant": "90min Z2 Steady",
    "2h Z2 mit Tempo-Einschueben": "2h Z2 with Tempo Surges",
    "45 Recovery mit 5x30s Openers": "45min Recovery with 5x30s Openers",
    "Over-Under 3x10 Kurz und Giftig": "Over-Under 3x10 Short and Sharp",
    "Schwellen Stottern 12x2/1": "Threshold Stutter 12x2/1",
    "2h Endurance mit 3x15 Tempo Spaet": "2h Endurance with 3x15 Late Tempo",
    "3x(4x30/30) Anaerob": "3x(4x30/30) Anaerobic",
    "30 Anaerob Bite": "30min Anaerobic Bite",
    "Ramp Test R1 1min +20W": "Ramp Test",
    "Ramp Test R2 1min +15W": "Ramp Test",
    "Ramp Test R3 1min +25W": "Ramp Test",
    "Ramp Test R4 2min +25W": "Ramp Test",
    "Ramp Test R5 3min +30W": "Ramp Test",
    "Ramp Test R6 Warm Ramp": "Ramp Test",
    "Ramp Test R7 Reverse Ramp": "Ramp Test",
    "Ramp Test R8 Ramp + 5min All-Out": "Ramp Test",
    "Ramp Test R8 Ramp plus 5min All-Out": "Ramp Test",
    "RT1 Standard Ramp 1min +20W (to Exhaustion)": "Ramp Test",
    "RT2 Ramp 1min +15W (to Exhaustion)": "Ramp Test",
    "RT3 Aggressive Ramp 1min +25W (to Exhaustion)": "Ramp Test",
    "RT4 Smooth Ramp 30s +10W (to Exhaustion)": "Ramp Test",
    "RT5 Step Test 2min +25W (to Exhaustion)": "Ramp Test",
    "RT6 Step Test 3min +30W (to Exhaustion)": "Ramp Test",
    "RT7 Short Warm-Up Ramp 1min +20W (to Exhaustion)": "Ramp Test",
    "RT8 Long Warm-Up Ramp 1min +20W (to Exhaustion)": "Ramp Test",
    "Ramp Test +20W/min (to Exhaustion, stop if cadence < 40 rpm)": "Ramp Test",
}


def seed_templates(user_id: int):
    """
    Seed workout templates for a specific user.

    Existing templates with the same name are skipped.
    """
    db: Session = SessionLocal()

    try:
        print(f"\nEnsuring {len(WORKOUT_TEMPLATES)} workout templates for user {user_id}...")

        existing_names = {
            str(name).strip().lower()
            for (name,) in db.query(Workout.name).filter(
                Workout.user_id == user_id,
                Workout.is_template == True,
            ).all()
        }

        created_count = 0
        skipped_count = 0

        for template_data in WORKOUT_TEMPLATES:
            key = template_data["name"].strip().lower()
            if key in existing_names:
                skipped_count += 1
                continue

            try:
                workout = WorkoutService.create_workout(
                    db=db,
                    user_id=user_id,
                    name=template_data["name"],
                    description=template_data.get("description"),
                    workout_type=template_data.get("workout_type"),
                    intervals_data=template_data.get("intervals", []),
                    is_template=True,
                )
                created_count += 1
                existing_names.add(key)
                print(
                    f"+ Created: {workout.name} "
                    f"({workout.estimated_tss:.1f} TSS, {workout.total_duration // 60} min)"
                )
            except Exception as exc:
                db.rollback()
                print(f"! Error creating {template_data['name']}: {exc}")

        print(
            f"\nDone. Created {created_count}, skipped existing {skipped_count}, "
            f"total template definitions {len(WORKOUT_TEMPLATES)}."
        )

    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.seed_workout_templates <user_id>")
        print("\nExample: python -m app.scripts.seed_workout_templates 1")
        sys.exit(1)

    seed_templates(int(sys.argv[1]))
