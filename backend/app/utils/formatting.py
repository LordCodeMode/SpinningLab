"""
Response formatting utilities.

Common formatting functions to eliminate code duplication across API responses.
"""

from datetime import datetime
from typing import Any, Optional


def format_date(date_obj: Any) -> Optional[str]:
    """
    Format date object to ISO string.

    Handles datetime objects, dates, and already-formatted strings.
    Used throughout API responses to ensure consistent date formatting.

    Args:
        date_obj: datetime, date, or string to format

    Returns:
        ISO formatted string or None if date_obj is None

    Example:
        >>> format_date(datetime(2024, 1, 15, 10, 30))
        '2024-01-15T10:30:00'
    """
    if date_obj is None:
        return None
    if hasattr(date_obj, 'isoformat'):
        return date_obj.isoformat()
    return str(date_obj)


def format_float(value: Any, decimals: int = 2) -> Optional[float]:
    """
    Format numeric value to float with specified decimals.

    Handles None values and converts various numeric types to float.
    Used throughout API responses for consistent numeric formatting.

    Args:
        value: Numeric value to format
        decimals: Number of decimal places (default: 2)

    Returns:
        Formatted float or None if value is None

    Example:
        >>> format_float(123.456789, decimals=2)
        123.46
        >>> format_float(None)
        None
    """
    if value is None:
        return None
    try:
        return round(float(value), decimals)
    except (ValueError, TypeError):
        return None


def format_int(value: Any) -> Optional[int]:
    """
    Format numeric value to integer.

    Args:
        value: Numeric value to format

    Returns:
        Integer or None if value is None

    Example:
        >>> format_int(123.9)
        123
        >>> format_int(None)
        None
    """
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def format_duration(seconds: float) -> str:
    """
    Format seconds as HH:MM:SS.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted duration string

    Example:
        >>> format_duration(3665)
        '01:01:05'
    """
    try:
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    except:
        return "00:00:00"


def format_power(watts: float) -> str:
    """
    Format power with unit.

    Args:
        watts: Power in watts

    Returns:
        Formatted power string with unit

    Example:
        >>> format_power(250.5)
        '250 W'
    """
    try:
        return f"{int(watts)} W"
    except:
        return "0 W"


def format_distance(meters: float) -> str:
    """
    Format distance in kilometers.

    Args:
        meters: Distance in meters

    Returns:
        Formatted distance string in km

    Example:
        >>> format_distance(5000)
        '5.0 km'
    """
    try:
        return f"{meters/1000:.1f} km"
    except:
        return "0.0 km"


def format_activity_response(activity: Any) -> dict:
    """
    Format activity object for API response.

    Standardized formatter for activity responses used across multiple endpoints.
    Eliminates duplicate formatting logic in route handlers.

    Args:
        activity: Activity database model

    Returns:
        Dictionary with formatted activity data

    Example:
        >>> formatted = format_activity_response(activity)
        >>> formatted['start_time']  # ISO formatted string
        '2024-01-15T10:30:00'
    """
    return {
        "id": activity.id,
        "start_time": format_date(activity.start_time),
        "file_name": activity.file_name,
        "duration": format_float(activity.duration, decimals=1),
        "distance": format_float(activity.distance, decimals=2),
        "avg_power": format_float(activity.avg_power, decimals=1),
        "normalized_power": format_float(activity.normalized_power, decimals=1),
        "max_5sec_power": format_float(activity.max_5sec_power, decimals=0),
        "max_1min_power": format_float(activity.max_1min_power, decimals=0),
        "max_3min_power": format_float(activity.max_3min_power, decimals=0),
        "max_5min_power": format_float(activity.max_5min_power, decimals=0),
        "max_10min_power": format_float(activity.max_10min_power, decimals=0),
        "max_20min_power": format_float(activity.max_20min_power, decimals=0),
        "max_30min_power": format_float(activity.max_30min_power, decimals=0),
        "max_60min_power": format_float(activity.max_60min_power, decimals=0),
        "avg_heart_rate": format_float(activity.avg_heart_rate, decimals=0),
        "tss": format_float(activity.tss, decimals=1),
        "intensity_factor": format_float(activity.intensity_factor, decimals=2),
        "efficiency_factor": format_float(activity.efficiency_factor, decimals=2)
    }