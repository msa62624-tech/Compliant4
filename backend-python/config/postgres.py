"""
PostgreSQL database configuration using SQLAlchemy
Provides database session management and connection pooling
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Generator
import logging

from models.entities import Base

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Check if PostgreSQL is configured
USE_POSTGRES = bool(DATABASE_URL and DATABASE_URL.startswith("postgresql"))

if USE_POSTGRES:
    # Create SQLAlchemy engine with connection pooling
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Verify connections before using
        echo=False  # Set to True for SQL query logging
    )
    
    # Create session factory
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    logger.info("PostgreSQL database configured")
else:
    engine = None
    SessionLocal = None
    logger.info("PostgreSQL not configured - using in-memory storage")


def init_postgres_db():
    """Initialize PostgreSQL database - create all tables"""
    if not USE_POSTGRES:
        logger.warning("PostgreSQL not configured, skipping database initialization")
        return
    
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}", exc_info=True)
        raise


def get_db() -> Generator[Session, None, None]:
    """
    Get database session
    
    Dependency for FastAPI routes that need database access.
    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    if not USE_POSTGRES:
        raise RuntimeError("PostgreSQL not configured")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def close_postgres_db():
    """Close database connection pool"""
    if USE_POSTGRES and engine:
        engine.dispose()
        logger.info("Database connection pool closed")
