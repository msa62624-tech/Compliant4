"""
Authentication middleware
Equivalent to middleware/auth.js in Node.js backend
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from config.env import settings
from config.logger_config import setup_logger

logger = setup_logger(__name__)
security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return user data"""
    token = credentials.credentials
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
        return payload
    except JWTError as e:
        logger.warning(f"Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_admin(user: dict = Depends(verify_token)) -> dict:
    """Require admin role"""
    if user.get("role") not in ["super_admin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


def optional_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[dict]:
    """Optional authentication - returns None if no token provided"""
    if not credentials:
        return None
    
    try:
        return verify_token(credentials)
    except HTTPException:
        return None
