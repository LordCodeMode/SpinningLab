"""
Seed workout templates
Creates pre-built workout templates for common training types
"""

from sqlalchemy.orm import Session
from ..database.connection import SessionLocal
from ..services.workout_service import WorkoutService


WORKOUT_TEMPLATES = [
    {
        "name": "Sweet Spot 3x10",
        "description": "Classic sweet spot workout: 3 sets of 10 minutes at 88-93% FTP with 5-minute recoveries",
        "workout_type": "Sweet Spot",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 65, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 600, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 1"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 600, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 2"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 600, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 3"},
            {"duration": 600, "target_power_low": 55, "target_power_high": 65, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "VO2 Max 5x3",
        "description": "High-intensity VO2 max intervals: 5 sets of 3 minutes at 110-120% FTP with 3-minute recoveries",
        "workout_type": "VO2max",
        "intervals": [
            {"duration": 900, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 180, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 1"},
            {"duration": 180, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 180, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 2"},
            {"duration": 180, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 180, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 3"},
            {"duration": 180, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 180, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 4"},
            {"duration": 180, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 180, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 5"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "FTP 2x20",
        "description": "Classic FTP test workout: 2 sets of 20 minutes at 95-105% FTP with 10-minute recovery",
        "workout_type": "Threshold",
        "intervals": [
            {"duration": 1200, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 1200, "target_power_low": 95, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "FTP interval 1"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 1200, "target_power_low": 95, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "FTP interval 2"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Endurance 90 min Z2",
        "description": "Long endurance ride: 90 minutes in Zone 2 (55-75% FTP)",
        "workout_type": "Endurance",
        "intervals": [
            {"duration": 900, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 4500, "target_power_low": 55, "target_power_high": 75, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Zone 2 endurance"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Endurance 60 min Z2",
        "description": "Steady endurance ride: 60 minutes in Zone 2 (55-75% FTP)",
        "workout_type": "Endurance",
        "intervals": [
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 2400, "target_power_low": 55, "target_power_high": 75, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Zone 2 endurance"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Endurance 75 min Z2",
        "description": "Steady endurance ride: 75 minutes in Zone 2 (55-75% FTP)",
        "workout_type": "Endurance",
        "intervals": [
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 3300, "target_power_low": 55, "target_power_high": 75, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Zone 2 endurance"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Recovery Ride 45 min",
        "description": "Active recovery: 45 minutes easy spinning at 45-55% FTP",
        "workout_type": "Recovery",
        "intervals": [
            {"duration": 2700, "target_power_low": 45, "target_power_high": 55, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Easy spinning"},
        ]
    },
    {
        "name": "Recovery Ride 30 min",
        "description": "Easy recovery spin: 30 minutes at 45-55% FTP",
        "workout_type": "Recovery",
        "intervals": [
            {"duration": 300, "target_power_low": 45, "target_power_high": 55, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 1200, "target_power_low": 45, "target_power_high": 55, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Easy spinning"},
            {"duration": 300, "target_power_low": 45, "target_power_high": 55, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Over-Unders 4x8",
        "description": "Threshold training: 4 sets of 8 minutes alternating between 95% and 105% FTP",
        "workout_type": "Threshold",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            # Interval 1
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            # Interval 2
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            # Interval 3
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            # Interval 4
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 120, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Under"},
            {"duration": 120, "target_power_low": 100, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Over"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "VO2 Max 4x4",
        "description": "Classic VO2max set: 4 x 4 minutes at 110-120% FTP with 4-minute recoveries",
        "workout_type": "VO2max",
        "intervals": [
            {"duration": 900, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 240, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 1"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 240, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 2"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 240, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 3"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 240, "target_power_low": 110, "target_power_high": 120, "target_power_type": "percent_ftp", "interval_type": "work", "description": "VO2 max interval 4"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Threshold 3x12",
        "description": "Threshold repeats: 3 x 12 minutes at 95-100% FTP with 6-minute recoveries",
        "workout_type": "Threshold",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 720, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 1"},
            {"duration": 360, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 720, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 2"},
            {"duration": 360, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 720, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 3"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Threshold 3x10",
        "description": "Threshold repeats: 3 x 10 minutes at 95-100% FTP with 5-minute recoveries",
        "workout_type": "Threshold",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 600, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 1"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 600, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 2"},
            {"duration": 300, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 600, "target_power_low": 95, "target_power_high": 100, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 3"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Threshold 4x8",
        "description": "Threshold repeats: 4 x 8 minutes at 95-105% FTP with 4-minute recoveries",
        "workout_type": "Threshold",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 480, "target_power_low": 95, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 1"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 480, "target_power_low": 95, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 2"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 480, "target_power_low": 95, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 3"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 480, "target_power_low": 95, "target_power_high": 105, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Threshold interval 4"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Sweet Spot 4x8",
        "description": "Sweet spot focus: 4 x 8 minutes at 88-93% FTP with 4-minute recoveries",
        "workout_type": "Sweet Spot",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 480, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 1"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 480, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 2"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 480, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 3"},
            {"duration": 240, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 480, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 4"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Sweet Spot 3x12",
        "description": "Sweet spot repeats: 3 x 12 minutes at 88-93% FTP with 6-minute recoveries",
        "workout_type": "Sweet Spot",
        "intervals": [
            {"duration": 600, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 720, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 1"},
            {"duration": 360, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 720, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 2"},
            {"duration": 360, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 720, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 3"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Sweet Spot 2x20",
        "description": "Sweet spot focus: 2 x 20 minutes at 88-93% FTP with 8-minute recoveries",
        "workout_type": "Sweet Spot",
        "intervals": [
            {"duration": 900, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
            {"duration": 1200, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 1"},
            {"duration": 480, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            {"duration": 1200, "target_power_low": 88, "target_power_high": 93, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Sweet Spot interval 2"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Endurance 2h Z2",
        "description": "Extended endurance ride: 2 hours in Zone 2 (55-75% FTP)",
        "workout_type": "Endurance",
        "intervals": [
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 6000, "target_power_low": 55, "target_power_high": 75, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Zone 2 endurance"},
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Endurance 2.5h Z2",
        "description": "Long endurance ride: 2.5 hours steady Zone 2 (55-75% FTP)",
        "workout_type": "Endurance",
        "intervals": [
            {"duration": 900, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 7200, "target_power_low": 55, "target_power_high": 75, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Zone 2 endurance"},
            {"duration": 900, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Endurance 3h Z2",
        "description": "Long endurance ride: 3 hours steady Zone 2 (55-75% FTP)",
        "workout_type": "Endurance",
        "intervals": [
            {"duration": 900, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Easy warmup"},
            {"duration": 9000, "target_power_low": 55, "target_power_high": 75, "target_power_type": "percent_ftp", "interval_type": "work", "description": "Zone 2 endurance"},
            {"duration": 900, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
    {
        "name": "Sprint Intervals 8x1min",
        "description": "Anaerobic sprints: 8 x 1 minute all-out with 2.5-minute recoveries",
        "workout_type": "Anaerobic",
        "intervals": [
            {"duration": 900, "target_power_low": 55, "target_power_high": 70, "target_power_type": "percent_ftp", "interval_type": "warmup", "description": "Warmup"},
        ] + [
            # 8 sprint intervals
            item for i in range(8) for item in [
                {"duration": 60, "target_power_low": 150, "target_power_high": 200, "target_power_type": "percent_ftp", "interval_type": "work", "description": f"Sprint {i+1}"},
                {"duration": 150, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "recovery", "description": "Recovery"},
            ]
        ] + [
            {"duration": 600, "target_power_low": 50, "target_power_high": 60, "target_power_type": "percent_ftp", "interval_type": "cooldown", "description": "Cooldown"},
        ]
    },
]


def seed_templates(user_id: int):
    """
    Seed workout templates for a specific user

    Args:
        user_id: The user ID to create templates for
    """
    db = SessionLocal()

    try:
        print(f"\nCreating {len(WORKOUT_TEMPLATES)} workout templates for user {user_id}...")

        for template_data in WORKOUT_TEMPLATES:
            try:
                workout = WorkoutService.create_workout(
                    db=db,
                    user_id=user_id,
                    name=template_data["name"],
                    description=template_data["description"],
                    workout_type=template_data["workout_type"],
                    intervals_data=template_data["intervals"],
                    is_template=True
                )

                print(f"✓ Created: {workout.name} ({workout.estimated_tss:.1f} TSS, {workout.total_duration//60} min)")

            except Exception as e:
                print(f"✗ Error creating {template_data['name']}: {str(e)}")

        print(f"\n✓ Successfully created workout templates!")

    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.seed_workout_templates <user_id>")
        print("\nExample: python -m app.scripts.seed_workout_templates 1")
        sys.exit(1)

    user_id = int(sys.argv[1])
    seed_templates(user_id)
