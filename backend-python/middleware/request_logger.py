"""
Request logger middleware
Equivalent to middleware/requestLogger.js in Node.js backend
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import time
import uuid
from config.logger_config import setup_logger

logger = setup_logger(__name__)


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Log all incoming requests"""
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timer
        start_time = time.time()
        
        # Log incoming request
        logger.info(f"[{request_id}] {request.method} {request.url.path}")
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log response
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"- {response.status_code} - {duration:.3f}s"
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
