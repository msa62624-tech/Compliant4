"""
Health check router
Equivalent to health check endpoints in Node.js backend
"""
from fastapi import APIRouter
from datetime import datetime
import psutil
import os

router = APIRouter()


@router.get("/")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/live")
async def liveness_check():
    """Kubernetes liveness probe"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/ready")
async def readiness_check():
    """Kubernetes readiness probe"""
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/startup")
async def startup_check():
    """Kubernetes startup probe"""
    return {
        "status": "started",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/detailed")
async def detailed_health_check():
    """Detailed health check with system metrics"""
    
    # Get system metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": datetime.utcnow().isoformat(),
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
