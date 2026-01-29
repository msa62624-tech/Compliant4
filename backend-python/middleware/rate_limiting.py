"""
Rate limiting middleware
Equivalent to middleware/rateLimiting.js in Node.js backend
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request


# Create limiter
limiter = Limiter(key_func=get_remote_address)


def setup_rate_limiting(app: FastAPI):
    """Setup rate limiting for the application"""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Rate limit decorators for different tiers
def api_rate_limit():
    """Standard API rate limit: 100 requests per minute"""
    return limiter.limit("100/minute")


def auth_rate_limit():
    """Auth endpoints rate limit: 5 requests per minute"""
    return limiter.limit("5/minute")


def upload_rate_limit():
    """Upload endpoints rate limit: 10 requests per minute"""
    return limiter.limit("10/minute")
