"""
Main FastAPI application entry point
Python backend for Compliant.team - Insurance tracking application
Migrated from Node.js/Express.js
"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import uvicorn
import logging
import os

# Import configuration
from config.env import settings
from config.database import init_db, close_db
from config.logger_config import setup_logger
from config.security import setup_security_middleware

# Import middleware
from middleware.rate_limiting import setup_rate_limiting
from middleware.request_logger import RequestLoggerMiddleware
from middleware.error_handler import error_handler_middleware
from middleware.health_check import setup_health_checks
from middleware.metrics import setup_metrics

# Import routers
from routers import auth, entities, health, metrics as metrics_router, coi, ai, adobe

# Setup logger
logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events"""
    # Startup
    logger.info("Starting Compliant4 Python Backend")
    logger.info(f"Environment: {settings.NODE_ENV}")
    logger.info(f"Port: {settings.PORT}")
    
    # Initialize database
    await init_db()
    
    # Validate production environment
    if settings.NODE_ENV == "production":
        logger.info("Running in production mode - validating configuration")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Compliant4 Python Backend")
    await close_db()


# Create FastAPI application
app = FastAPI(
    title="Compliant4 API",
    description="Backend API for Compliant.team Insurance Tracking Application (Python/FastAPI)",
    version="2.0.0",
    docs_url="/api-docs",  # Swagger UI
    redoc_url="/api-redoc",  # ReDoc
    lifespan=lifespan
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup compression (equivalent to Express compression)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Setup security middleware
setup_security_middleware(app)

# Setup request logging
app.add_middleware(RequestLoggerMiddleware)

# Setup rate limiting
setup_rate_limiting(app)

# Setup metrics
setup_metrics(app)

# Setup health checks
setup_health_checks(app)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(entities.router, prefix="/entities", tags=["Entities"])
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(metrics_router.router, prefix="/metrics", tags=["Metrics"])
app.include_router(coi.router, tags=["COI Generation"])
app.include_router(ai.router, tags=["AI Analysis"])
app.include_router(adobe.router, tags=["Adobe PDF Services"])

# Serve static files (uploads)
uploads_dir = os.environ.get("UPLOADS_DIR", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return await error_handler_middleware(request, exc)

# Root endpoint
@app.get("/")
async def root():
    return {
        "name": "Compliant4 API",
        "version": "2.0.0",
        "language": "Python",
        "framework": "FastAPI",
        "status": "running",
        "migrated_from": "Node.js/Express.js"
    }

# Not found handler
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "Not Found",
            "message": f"The requested resource {request.url.path} was not found",
            "status": 404
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.NODE_ENV == "development",
        log_level="info"
    )
