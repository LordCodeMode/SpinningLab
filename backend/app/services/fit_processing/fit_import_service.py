import os
from typing import NamedTuple
from sqlalchemy.orm import Session
from fitparse import FitFile
import pandas as pd
import numpy as np

from ...database.models import User, Activity, PowerZone, HrZone
from .core_metrics import extract_core_metrics
from .power_metrics import extract_power_metrics
from .heart_rate_metrics import extract_hr_series, compute_hr_zones, compute_avg_hr
from .zones import compute_power_zones

class ImportResult(NamedTuple):
    success: bool
    message: str
    activity_id: int = None

class FitImportService:
    def __init__(self, db: Session):
        self.db = db

    def process_fit_file(self, file_path: str, user: User, file_hash: str, file_size: int, original_filename: str) -> ImportResult:
        """Process a FIT file and create an activity record."""
        try:
            # Extract core metrics
            core_metrics = extract_core_metrics(file_path)
            if not core_metrics:
                return ImportResult(False, "Could not extract core metrics from file")

            # Extract power and HR data
            fitfile = FitFile(file_path)
            records = []
            for record in fitfile.get_messages("record"):
                data = {field.name: field.value for field in record if field.value is not None}
                records.append(data)

            df = pd.DataFrame(records)
            
            # Process power metrics
            hr_series = extract_hr_series(df) if not df.empty else None
            hr_avg = compute_avg_hr(hr_series)

            power_metrics = extract_power_metrics(df, hr_avg, user) if not df.empty else {}

            # Create activity record
            activity = Activity(
                user_id=user.id,
                start_time=core_metrics.get("start_time"),
                file_name=original_filename,
                file_hash=file_hash,
                file_size=file_size,
                duration=core_metrics.get("duration"),
                distance=core_metrics.get("distance"),
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
                tss=power_metrics.get("tss"),
                intensity_factor=power_metrics.get("intensity_factor"),
                efficiency_factor=power_metrics.get("efficiency_factor")
            )

            self.db.add(activity)
            self.db.flush()  # Get the activity ID

            # Process power zones
            # OPTIMIZED: Pass DataFrame instead of re-parsing file
            if power_metrics.get("avg_power") and not df.empty:
                try:
                    power_zones = compute_power_zones(df, user.ftp or 250)
                    for zone_label, seconds in power_zones.items():
                        if seconds > 0:
                            power_zone = PowerZone(
                                activity_id=activity.id,
                                zone_label=zone_label,
                                seconds_in_zone=seconds
                            )
                            self.db.add(power_zone)
                except Exception as e:
                    pass  # Error computing power zones, skip

            # Process HR zones
            # OPTIMIZED: Pass DataFrame instead of re-parsing file
            if hr_series is not None and not hr_series.empty and not df.empty:
                try:
                    hr_zones = compute_hr_zones(df, user.hr_max or 190)
                    if hr_zones:
                        for zone_label, seconds in hr_zones.items():
                            if seconds > 0:
                                hr_zone = HrZone(
                                    activity_id=activity.id,
                                    zone_label=zone_label,
                                    seconds_in_zone=seconds
                                )
                                self.db.add(hr_zone)
                except Exception as e:
                    pass  # Error computing HR zones, skip

            self.db.commit()

            message = "Successfully imported"
            if not power_metrics.get("avg_power") and hr_series is None:
                message += " - No power or HR data"
            elif not power_metrics.get("avg_power"):
                message += " - No power data"
            elif hr_series is None:
                message += " - No HR data"

            return ImportResult(True, message, activity.id)

        except Exception as e:
            self.db.rollback()
            return ImportResult(False, f"Error processing file: {str(e)}")