"""
Logger configuration
Equivalent to config/logger.js in Node.js backend
"""
import logging
import sys
from datetime import datetime


def setup_logger(name: str) -> logging.Logger:
    """Setup and configure logger"""
    logger = logging.getLogger(name)
    
    # Only add handler if not already added (prevents duplicate logs)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # Console handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        
        # Format
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
    
    return logger


# Create default logger
logger = setup_logger(__name__)
