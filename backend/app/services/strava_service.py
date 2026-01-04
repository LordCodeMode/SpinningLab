"""
Strava API Integration Service
Handles OAuth authentication and activity synchronization with Strava
"""
import httpx
import time
import json
import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

import pandas as pd
from sqlalchemy.orm import Session

from ..database.models import User, Activity, PowerZone, HrZone
from ..core.config import settings
from ..services.fit_processing.power_metrics import extract_power_metrics
from ..services.fit_processing.heart_rate_metrics import compute_hr_zones
from ..services.fit_processing.zones import compute_power_zones

logger = logging.getLogger(__name__)

class StravaService:
    """Service for interacting with Strava API v3"""

    OAUTH_URL = "https://www.strava.com/oauth/authorize"
    TOKEN_URL = "https://www.strava.com/oauth/token"
    API_BASE = "https://www.strava.com/api/v3"

    def __init__(self):
        self.client_id = settings.STRAVA_CLIENT_ID
        self.client_secret = settings.STRAVA_CLIENT_SECRET
        self.redirect_uri = settings.STRAVA_REDIRECT_URI

    def get_authorization_url(self, state: str = None) -> str:
        """
        Generate Strava OAuth authorization URL

        Args:
            state: Optional state parameter for CSRF protection

        Returns:
            Authorization URL to redirect user to
        """
        from urllib.parse import urlencode, quote

        # IMPORTANT: Strava requires the redirect_uri WITHOUT the hash fragment
        # The hash (#/settings) is only used client-side after redirect
        redirect_uri_without_hash = self.redirect_uri.split('#')[0]

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri_without_hash,
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": "activity:read_all,activity:read"
        }

        if state:
            params["state"] = state

        query_string = urlencode(params)
        return f"{self.OAUTH_URL}?{query_string}"

    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Token response containing access_token, refresh_token, expires_at, athlete info
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code"
                }
            )
            response.raise_for_status()
            return response.json()

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an expired access token

        Args:
            refresh_token: The refresh token from previous OAuth exchange

        Returns:
            New token response with fresh access_token
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token"
                }
            )
            response.raise_for_status()
            return response.json()

    async def get_valid_token(self, user: User, db: Session) -> str:
        """
        Get a valid access token, refreshing if necessary

        Args:
            user: User object with Strava credentials
            db: Database session

        Returns:
            Valid access token
        """
        current_time = int(time.time())

        # Check if token is expired or about to expire (within 5 minutes)
        if user.strava_token_expires_at and user.strava_token_expires_at < (current_time + 300):
            logger.info(f"Refreshing expired Strava token for user {user.id}")
            token_data = await self.refresh_access_token(user.strava_refresh_token)

            # Update user with new tokens
            user.strava_access_token = token_data["access_token"]
            user.strava_refresh_token = token_data["refresh_token"]
            user.strava_token_expires_at = token_data["expires_at"]
            db.commit()

            return token_data["access_token"]

        return user.strava_access_token

    async def fetch_athlete_activities(
        self,
        access_token: str,
        after: Optional[int] = None,
        per_page: int = 200,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Fetch athlete's activities from Strava with pagination."""
        headers = {"Authorization": f"Bearer {access_token}"}
        page = 1
        all_activities: List[Dict[str, Any]] = []

        async with httpx.AsyncClient() as client:
            while True:
                params = {"per_page": per_page, "page": page}
                if after:
                    params["after"] = after

                response = await client.get(
                    f"{self.API_BASE}/athlete/activities",
                    headers=headers,
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                batch = response.json()

                if not batch:
                    break

                all_activities.extend(batch)

                if limit and len(all_activities) >= limit:
                    all_activities = all_activities[:limit]
                    break

                if len(batch) < per_page:
                    break

                page += 1

        return all_activities

    async def fetch_activity_streams(
        self,
        access_token: str,
        activity_id: int,
        stream_types: List[str] = None
    ) -> Dict[str, Any]:
        """Fetch detailed streams for a specific activity."""
        if stream_types is None:
            stream_types = [
                "time",
                "watts",
                "heartrate",
                "cadence",
                "temp",
                "moving",
                "distance",
                "velocity_smooth"
            ]

        headers = {"Authorization": f"Bearer {access_token}"}
        stream_keys = ",".join(stream_types)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE}/activities/{activity_id}/streams",
                headers=headers,
                params={
                    "keys": stream_keys,
                    "key_by_type": "true",
                    "resolution": "high",
                    "series_type": "time"
                },
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    def parse_strava_activity(self, activity_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Strava activity summary into our internal format

        Args:
            activity_data: Strava activity summary object

        Returns:
            Dictionary with parsed activity data
        """
        return {
            "strava_activity_id": activity_data["id"],
            "start_time": datetime.fromisoformat(activity_data["start_date"].replace("Z", "+00:00")),
            "file_name": f"strava_{activity_data['id']}",
            "custom_name": activity_data.get("name"),
            # Prefer Strava moving time if present, fall back to elapsed
            "duration": activity_data.get("moving_time") or activity_data.get("elapsed_time"),
            "distance": activity_data.get("distance", 0) / 1000 if activity_data.get("distance") else None,  # Convert m to km
            "avg_power": activity_data.get("average_watts"),
            "max_heart_rate": activity_data.get("max_heartrate"),
            "avg_heart_rate": activity_data.get("average_heartrate"),
        }

    async def import_user_activities(
        self,
        user: User,
        db: Session,
        after: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Import all activities from Strava for a user

        Args:
            user: User object with Strava credentials
            db: Database session
            after: Only import activities after this datetime (optional)
            limit: Maximum number of activities to import (optional)

        Returns:
            Dictionary with import statistics
        """
        if not user.strava_access_token:
            raise ValueError("User is not connected to Strava")

        # Get valid access token (will refresh if needed)
        access_token = await self.get_valid_token(user, db)

        # Convert after datetime to Unix timestamp
        after_timestamp = int(after.timestamp()) if after else None

        # Fetch activities from Strava
        logger.info(f"Fetching Strava activities for user {user.id}")
        activities = await self.fetch_athlete_activities(access_token, after=after_timestamp, limit=limit)

        logger.info(f"Found {len(activities)} activities from Strava")

        imported_count = 0
        skipped_count = 0
        error_count = 0

        allowed_types = {"Ride", "VirtualRide", "EBikeRide"}
        allowed_sport_types = {"Ride", "MountainBikeRide", "GravelRide", "EBikeRide", "VirtualRide", "Velomobile"}

        for activity_data in activities:
            try:
                # Skip non-cycling activities
                act_type = activity_data.get("type")
                sport_type = activity_data.get("sport_type")
                # Require at least one of the labels to be a cycling type; otherwise skip (filters runs/walks/etc)
                if (act_type not in allowed_types) and (sport_type not in allowed_sport_types):
                    skipped_count += 1
                    continue

                # Check if activity already exists
                existing = db.query(Activity).filter(
                    Activity.user_id == user.id,
                    Activity.strava_activity_id == activity_data["id"]
                ).first()

                if existing:
                    if not existing.custom_name and activity_data.get("name"):
                        existing.custom_name = activity_data["name"]
                        db.commit()
                    logger.debug(f"Activity {activity_data['id']} already exists, skipping")
                    skipped_count += 1
                    continue

                # Parse basic activity data
                parsed_data = self.parse_strava_activity(activity_data)
                parsed_data["user_id"] = user.id

                # Fetch detailed streams for power/HR analysis
                power_zones = []
                hr_zones = []
                try:
                    streams = await self.fetch_activity_streams(access_token, activity_data["id"])

                    # Save raw streams for timeline rendering
                    self._store_streams(activity_data["id"], streams)

                    # Process streams to calculate metrics and zones
                    stream_metrics = self._process_streams(streams, user)
                    power_zones = stream_metrics.pop("power_zones", [])
                    hr_zones = stream_metrics.pop("hr_zones", [])
                    parsed_data.update(stream_metrics)

                except Exception as stream_error:
                    logger.warning(f"Could not fetch streams for activity {activity_data['id']}: {stream_error}")
                    # Continue with basic data even if streams fail

                # Fallback: derive avg_power/duration from Strava summary if streams empty
                if not parsed_data.get("avg_power") and activity_data.get("average_watts"):
                    parsed_data["avg_power"] = activity_data.get("average_watts")
                if not parsed_data.get("duration") and activity_data.get("elapsed_time"):
                    parsed_data["duration"] = activity_data.get("elapsed_time")

                # Only keep fields that exist on the Activity model
                parsed_data = self._filter_activity_fields(parsed_data)

                # Create activity in database
                activity = Activity(**parsed_data)
                db.add(activity)
                db.flush()

                # Attach zones if available
                for zone in power_zones:
                    db.add(PowerZone(
                        activity_id=activity.id,
                        zone_label=zone["zone_label"],
                        seconds_in_zone=zone["seconds_in_zone"]
                    ))
                for zone in hr_zones:
                    db.add(HrZone(
                        activity_id=activity.id,
                        zone_label=zone["zone_label"],
                        seconds_in_zone=zone["seconds_in_zone"]
                    ))

                db.commit()

                logger.info(f"Imported Strava activity {activity_data['id']}")
                imported_count += 1

            except Exception as e:
                logger.error(f"Error importing activity {activity_data.get('id')}: {e}")
                error_count += 1
                db.rollback()
                continue

        return {
            "total_found": len(activities),
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": error_count
        }

    def _filter_activity_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        allowed = {
            "user_id",
            "strava_activity_id",
            "start_time",
            "file_name",
            "custom_name",
            "file_hash",
            "file_size",
            "file_hash",
            "file_size",
            "duration",
            "distance",
            "avg_power",
            "normalized_power",
            "max_5sec_power",
            "max_1min_power",
            "max_3min_power",
            "max_5min_power",
            "max_10min_power",
            "max_20min_power",
            "max_30min_power",
            "max_60min_power",
            "avg_heart_rate",
            "max_heart_rate",
            "tss",
            "intensity_factor",
            "efficiency_factor",
            "critical_power"
        }
        return {k: v for k, v in data.items() if k in allowed}

    def _process_streams(self, streams: Dict[str, Any], user: User) -> Dict[str, Any]:
        """Process Strava streams into activity metrics and zones."""
        metrics: Dict[str, Any] = {}

        # Build a DataFrame from available streams
        df, moving_seconds, elapsed_seconds = self._streams_to_dataframe(streams)
        if df is None or df.empty:
            return metrics

        # Heart rate metrics
        hr_avg = None
        if "heart_rate" in df.columns and df["heart_rate"].notna().any():
            hr_avg = df["heart_rate"].mean()
            metrics["avg_heart_rate"] = round(hr_avg, 2)
            metrics["max_heart_rate"] = int(df["heart_rate"].max()) if not df["heart_rate"].empty else None

        # Power metrics (NP, TSS, IF, best powers)
        power_metrics = extract_power_metrics(df, hr_avg, user)
        metrics.update(power_metrics)

        # Duration (seconds) preferring moving time, else elapsed time, else stream length or existing metric
        duration_candidates = [
            moving_seconds if moving_seconds and moving_seconds > 0 else None,
            elapsed_seconds if elapsed_seconds and elapsed_seconds > 0 else None,
            metrics.get("duration"),
            len(df) if len(df) else None
        ]
        metrics["duration"] = next((d for d in duration_candidates if d), None)

        # Zones
        power_zones = compute_power_zones(df, user.ftp or 250) if "power" in df.columns else {}
        hr_zones = compute_hr_zones(df, user.hr_max or 190) if "heart_rate" in df.columns else {}

        metrics["power_zones"] = [
            {"zone_label": label, "seconds_in_zone": seconds}
            for label, seconds in power_zones.items()
            if seconds > 0
        ] if power_zones else []

        metrics["hr_zones"] = [
            {"zone_label": label, "seconds_in_zone": seconds}
            for label, seconds in hr_zones.items()
            if seconds > 0
        ] if hr_zones else []

        return metrics

    def _streams_to_dataframe(self, streams: Dict[str, Any]) -> tuple[Optional[pd.DataFrame], Optional[float], Optional[float]]:
        if not streams:
            return None, None, None

        def extract(stream_name):
            stream = streams.get(stream_name, {})
            return stream.get("data") if isinstance(stream, dict) else None

        time_data = extract("time")
        power_data = extract("watts")
        hr_data = extract("heartrate")
        distance_data = extract("distance")
        moving_data = extract("moving")
        velocity_data = extract("velocity_smooth")

        lengths = [len(arr) for arr in [time_data, power_data, hr_data, distance_data, moving_data, velocity_data] if arr is not None]
        if not lengths:
            return None, None, None

        length = min(lengths)

        def align(arr):
            if arr is None:
                return [None] * length
            return arr[:length] if len(arr) >= length else arr + [None] * (length - len(arr))

        df = pd.DataFrame({
            "time": align(time_data),
            "power": align(power_data),
            "heart_rate": align(hr_data),
            "distance": align(distance_data),
            "moving": align(moving_data),
            "velocity": align(velocity_data)
        })

        # Derive speed if distance & time are present and velocity missing
        if df["velocity"].isna().all():
            if df["distance"].notna().any() and df["time"].notna().any():
                dist = df["distance"].astype(float)
                time_sec = df["time"].astype(float)
                delta_dist = dist.diff().fillna(0)
                delta_time = time_sec.diff().replace({0: pd.NA}).fillna(1)
                speed_ms = (delta_dist / delta_time).clip(lower=0)
                df["velocity"] = speed_ms

        # Compute moving seconds if moving stream exists (use time deltas for accuracy)
        moving_seconds = None
        if df["moving"].notna().any():
            try:
                time_values = df["time"].astype(float).tolist()
                time_deltas = [max(time_values[i] - time_values[i - 1], 0) if i > 0 else 0 for i in range(len(time_values))]
                moving_flags = [bool(v) if v is not None else False for v in df["moving"].tolist()]
                moving_seconds = float(sum(delta for delta, is_moving in zip(time_deltas, moving_flags) if is_moving))
            except Exception:
                moving_seconds = int(sum(1 for v in df["moving"] if v))

        # Elapsed seconds from time stream
        elapsed_seconds = None
        if df["time"].notna().any():
            try:
                time_vals = df["time"].astype(float)
                elapsed_seconds = float(time_vals.max() - time_vals.min())
            except Exception:
                elapsed_seconds = None

        # Ensure time column exists
        if df["time"].isna().all():
            df["time"] = range(length)

        # Drop rows with no usable metrics
        df = df.dropna(subset=["power", "heart_rate"], how="all")

        return df, moving_seconds, elapsed_seconds

    def _store_streams(self, activity_id: int, streams: Dict[str, Any]) -> None:
        """Persist Strava streams to disk for later timeline rendering."""
        streams_dir = os.path.join(settings.FIT_FILES_DIR, "streams")
        os.makedirs(streams_dir, exist_ok=True)

        stream_path = os.path.join(streams_dir, f"{activity_id}.json")
        try:
            with open(stream_path, "w") as f:
                json.dump(streams, f)
        except Exception as exc:
            logger.warning(f"Failed to store streams for activity {activity_id}: {exc}")


# Singleton instance
strava_service = StravaService()
