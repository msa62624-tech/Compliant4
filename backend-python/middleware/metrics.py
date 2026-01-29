"""
Metrics middleware
Equivalent to middleware/metrics.js in Node.js backend
"""
from fastapi import FastAPI
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from config.logger_config import setup_logger

logger = setup_logger(__name__)

# Metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])


def setup_metrics(app: FastAPI):
    """Setup Prometheus metrics"""
    logger.info("Metrics collection configured")
    
    @app.middleware("http")
    async def metrics_middleware(request, call_next):
        # Track request
        import time
        start_time = time.time()
        
        response = await call_next(request)
        
        # Record metrics
        duration = time.time() - start_time
        request_count.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        request_duration.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        
        return response
