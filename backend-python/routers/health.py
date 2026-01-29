"""
Health check router
Equivalent to health check endpoints in Node.js backend
"""
from fastapi import APIRouter
from datetime import datetime, timezone
import psutil
import os
from utils.timestamps import get_timestamp

router = APIRouter()


def _create_health_response(status: str) -> dict:
    """
    Create a standardized health check response
    
    Args:
        status: Health status string (e.g., 'healthy', 'alive', 'ready')
    
    Returns:
        dict: Health response with status and timestamp
    """
    return {
        "status": status,
        "timestamp": get_timestamp()
    }


@router.get("/")
async def health_check():
    """Basic health check"""
    return _create_health_response("healthy")


@router.get("/live")
async def liveness_check():
    """Kubernetes liveness probe"""
    return _create_health_response("alive")


@router.get("/ready")
async def readiness_check():
    """Kubernetes readiness probe"""
    return _create_health_response("ready")


@router.get("/startup")
async def startup_check():
    """Kubernetes startup probe"""
    return _create_health_response("started")


@router.get("/detailed")
async def detailed_health_check():
    """Detailed health check with system metrics"""
    
    # Get system metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Calculate uptime in seconds
    import time
    process = psutil.Process()
    uptime_seconds = time.time() - process.create_time()
    
    return {
        "status": "healthy",
        "timestamp": get_timestamp(),
        "uptime": uptime_seconds,
        "system": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent
            }
        },
        "process": {
            "pid": os.getpid(),
            "memory_mb": psutil.Process().memory_info().rss / 1024 / 1024
        }
    }
