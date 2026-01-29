"""
Error handler middleware
Equivalent to middleware/errorHandler.js in Node.js backend
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from config.logger_config import setup_logger

logger = setup_logger(__name__)


class ValidationError(Exception):
    """Validation error exception"""
    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details
        super().__init__(self.message)


async def error_handler_middleware(request: Request, exc: Exception):
    """Global error handler"""
    
    # Log the error
    logger.error(f"Error processing request: {exc}", exc_info=True)
    
    # Handle different error types
    if isinstance(exc, ValidationError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "Validation Error",
                "message": exc.message,
                "details": exc.details,
                "status": 400
            }
        )
    
    # Default error response
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
            "status": 500
        }
    )
