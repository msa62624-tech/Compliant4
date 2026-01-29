"""
Timestamp utility functions
Provides consistent timestamp generation across the application
"""
from datetime import datetime, timezone


def get_timestamp() -> str:
    """
    Get current UTC timestamp in ISO format
    
    Returns:
        str: Current UTC timestamp in ISO 8601 format
    """
    return datetime.now(timezone.utc).isoformat()
