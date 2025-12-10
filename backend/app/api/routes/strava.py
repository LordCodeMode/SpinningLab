"""
Strava OAuth and Activity Sync API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import logging

from ...database.connection import get_db
from ...database.models import User
from ...services.strava_service import strava_service
from ..dependencies import get_current_user
from ...services.cache.cache_builder import CacheBuilder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strava", tags=["strava"])


@router.get("/connect")
async def get_strava_connect_url(
    state: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get Strava OAuth authorization URL

    Returns the URL to redirect the user to for Strava authorization
    """
    try:
        auth_url = strava_service.get_authorization_url(state=state)
        return {"authorization_url": auth_url}
    except Exception as e:
        logger.error(f"Error generating Strava auth URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate authorization URL"
        )


@router.post("/callback")
async def strava_oauth_callback(
    code: str = Query(..., description="Authorization code from Strava"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Handle Strava OAuth callback

    Exchange authorization code for access token and store in database
    """
    try:
        # Exchange code for token
        token_data = await strava_service.exchange_code_for_token(code)

        # Update user with Strava credentials
        current_user.strava_athlete_id = token_data["athlete"]["id"]
        current_user.strava_access_token = token_data["access_token"]
        current_user.strava_refresh_token = token_data["refresh_token"]
        current_user.strava_token_expires_at = token_data["expires_at"]

        db.commit()

        logger.info(f"User {current_user.id} connected to Strava athlete {token_data['athlete']['id']}")

        return {
            "success": True,
            "athlete": {
                "id": token_data["athlete"]["id"],
                "username": token_data["athlete"].get("username"),
                "firstname": token_data["athlete"].get("firstname"),
                "lastname": token_data["athlete"].get("lastname")
            }
        }

    except Exception as e:
        logger.error(f"Error in Strava OAuth callback: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to Strava: {str(e)}"
        )


@router.get("/status")
async def get_strava_connection_status(
    current_user: User = Depends(get_current_user)
):
    """
    Check if user is connected to Strava

    Returns connection status and athlete info if connected
    """
    if not current_user.strava_athlete_id:
        return {
            "connected": False,
            "athlete_id": None
        }

    return {
        "connected": True,
        "athlete_id": current_user.strava_athlete_id
    }


@router.post("/disconnect")
async def disconnect_strava(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Disconnect Strava account

    Removes Strava credentials from user account (does not delete imported activities)
    """
    if not current_user.strava_athlete_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not connected to Strava"
        )

    try:
        current_user.strava_athlete_id = None
        current_user.strava_access_token = None
        current_user.strava_refresh_token = None
        current_user.strava_token_expires_at = None

        db.commit()

        logger.info(f"User {current_user.id} disconnected from Strava")

        return {"success": True, "message": "Disconnected from Strava"}

    except Exception as e:
        logger.error(f"Error disconnecting from Strava: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect from Strava"
        )


@router.post("/sync")
async def sync_strava_activities(
    limit: Optional[int] = Query(None, description="Maximum number of activities to import"),
    after: Optional[str] = Query(None, description="Only import activities after this date (ISO format)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync activities from Strava

    Imports all activities from Strava, calculating power curves, zones, and training metrics
    """
    if not current_user.strava_athlete_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not connected to Strava. Connect your account first."
        )

    try:
        # Parse after date if provided
        after_date = None
        if after:
            try:
                after_date = datetime.fromisoformat(after)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use ISO format (YYYY-MM-DD)"
                )

        # Import activities
        logger.info(f"Starting Strava sync for user {current_user.id}")
        result = await strava_service.import_user_activities(
            user=current_user,
            db=db,
            after=after_date,
            limit=limit
        )

        # Rebuild caches if activities were imported
        if result["imported"] > 0:
            logger.info(f"Rebuilding caches after importing {result['imported']} activities")
            cache_builder = CacheBuilder(db)
            cache_builder.rebuild_after_import(current_user)

        return {
            "success": True,
            "message": f"Imported {result['imported']} activities from Strava",
            "stats": result
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error syncing Strava activities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync activities: {str(e)}"
        )
