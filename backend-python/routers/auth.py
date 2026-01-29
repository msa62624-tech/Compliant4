"""
Authentication router
Equivalent to auth routes in server.js
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from config.env import settings
from config.logger_config import setup_logger
from middleware.rate_limiting import auth_rate_limit, limiter
from middleware.auth import verify_token
from typing import Optional

logger = setup_logger(__name__)
router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Mock users database (equivalent to utils/users.js)
users_db = {
    "admin": {
        "id": "1",
        "username": "admin",
        "password_hash": pwd_context.hash("INsure2026!"),
        "email": "admin@compliant.team",
        "role": "super_admin",
        "full_name": "System Administrator"
    }
}


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    refreshToken: str
    user: dict


class RefreshRequest(BaseModel):
    refreshToken: str


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=1)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(data: dict):
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(req: Request, request: LoginRequest):
    """User login endpoint"""
    
    # Find user
    user = users_db.get(request.username)
    
    if not user:
        logger.warning(f"Login attempt for unknown user: {request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Verify password
    if not pwd_context.verify(request.password, user["password_hash"]):
        logger.warning(f"Failed login attempt for user: {request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create tokens
    token_data = {
        "sub": user["username"],
        "id": user["id"],
        "role": user["role"],
        "email": user["email"]
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Remove password hash from response
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    logger.info(f"Successful login for user: {request.username}")
    
    return {
        "token": access_token,
        "refreshToken": refresh_token,
        "user": user_response
    }


@router.post("/refresh")
async def refresh_token(request: RefreshRequest):
    """Refresh access token"""
    try:
        payload = jwt.decode(
            request.refreshToken,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Create new access token
        token_data = {
            "sub": payload.get("sub"),
            "id": payload.get("id"),
            "role": payload.get("role"),
            "email": payload.get("email")
        }
        
        access_token = create_access_token(token_data)
        
        return {"token": access_token}
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/logout")
async def logout():
    """User logout endpoint (client-side token removal)"""
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user(user: dict = Depends(verify_token)):
    """Get current user information"""
    # Find user in database
    username = user.get("sub")
    user_data = users_db.get(username)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Remove password hash from response
    user_response = {k: v for k, v in user_data.items() if k != "password_hash"}
    return user_response
