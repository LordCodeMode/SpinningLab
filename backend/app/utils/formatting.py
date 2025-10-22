def format_duration(seconds: float) -> str:
    """Format seconds as HH:MM:SS."""
    try:
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    except:
        return "00:00:00"

def format_power(watts: float) -> str:
    """Format power with unit."""
    try:
        return f"{int(watts)} W"
    except:
        return "0 W"

def format_distance(meters: float) -> str:
    """Format distance in km."""
    try:
        return f"{meters/1000:.1f} km"
    except:
        return "0.0 km"