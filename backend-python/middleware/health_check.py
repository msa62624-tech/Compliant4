"""
Health check middleware
Equivalent to middleware/healthCheck.js in Node.js backend
"""
from fastapi import FastAPI
from config.logger_config import setup_logger

logger = setup_logger(__name__)


def setup_health_checks(app: FastAPI):
    """Setup health check endpoints"""
    # Health checks are implemented in routers/health.py
    logger.info("Health check endpoints configured")
