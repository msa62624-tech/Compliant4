"""
Environment configuration management
Equivalent to config/env.js in Node.js backend
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server configuration
    PORT: int = 3001
    NODE_ENV: str = "development"
    
    # JWT Configuration
    JWT_SECRET: str = "compliant-dev-secret-change-in-production"
    JWT_EXPIRATION: str = "1h"
    JWT_REFRESH_EXPIRATION: str = "7d"
    
    # Frontend URL for CORS
    FRONTEND_URL: str = "http://localhost:5175"
    
    # CORS Origins (parsed from comma-separated string)
    @property
    def CORS_ORIGINS(self) -> List[str]:
        origins = [self.FRONTEND_URL]
        # Add additional origins from environment if specified
        if os.getenv("CORS_ORIGINS"):
            origins.extend(os.getenv("CORS_ORIGINS").split(","))
        return origins
    
    # Database configuration (PostgreSQL)
    DATABASE_URL: str = ""
    
    # Email configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_PASS: str = ""  # Alias for SMTP_PASSWORD
    SMTP_FROM: str = "noreply@compliant.team"
    SMTP_SECURE: bool = True  # Use TLS
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Use SMTP_PASSWORD if SMTP_PASS not provided
        if not self.SMTP_PASS and self.SMTP_PASSWORD:
            self.SMTP_PASS = self.SMTP_PASSWORD
    
    # Adobe PDF Service (optional)
    ADOBE_API_KEY: str = ""
    ADOBE_CLIENT_ID: str = ""
    
    # AI Analysis Service (optional)
    AI_PROVIDER: str = "openai"
    AI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4-turbo-preview"
    
    # Admin configuration
    DEFAULT_ADMIN_EMAILS: str = "admin@compliant.team"
    ADMIN_PASSWORD_HASH: str = ""
    
    # Insurance configuration
    RENEWAL_LOOKAHEAD_DAYS: int = 60
    BINDER_WINDOW_DAYS: int = 60
    
    # File upload configuration
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_EXTENSIONS: List[str] = [".pdf", ".jpg", ".jpeg", ".png"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Create global settings instance
settings = Settings()


def get_jwt_secret() -> str:
    """Get JWT secret key"""
    return settings.JWT_SECRET


def get_admin_password_hash() -> str:
    """
    Get admin password hash from environment with production validation.
    
    Returns the admin password hash, requiring it in production but providing
    a development fallback with warning for local development.
    
    Returns:
        str: The bcrypt password hash
        
    Raises:
        ValueError: If in production and ADMIN_PASSWORD_HASH is not set
    """
    if settings.ADMIN_PASSWORD_HASH:
        return settings.ADMIN_PASSWORD_HASH
    
    # Check if we're in production
    is_production = settings.NODE_ENV.lower() in ["production", "prod", "live"]
    
    if is_production:
        raise ValueError(
            "ADMIN_PASSWORD_HASH environment variable is required in production"
        )
    
    # Development fallback with warning
    import warnings
    warnings.warn(
        "⚠️ WARNING: Using default admin password hash for development. "
        "Set ADMIN_PASSWORD_HASH in production!",
        UserWarning
    )
    # Default development password hash for "INsure2026!" - DO NOT use in production
    return "$2b$12$5EeUXqaODR9fBs5KayB43egoQ6eajmIm3MqZ0UgS/7LTCxvyg/L3m"


def validate_production_environment():
    """Validate that production environment has required settings"""
    if settings.NODE_ENV == "production":
        required_settings = [
            ("JWT_SECRET", settings.JWT_SECRET),
            ("FRONTEND_URL", settings.FRONTEND_URL),
            ("ADMIN_PASSWORD_HASH", settings.ADMIN_PASSWORD_HASH),
        ]
        
        missing = []
        for name, value in required_settings:
            if not value or value == "compliant-dev-secret-change-in-production":
                missing.append(name)
        
        if missing:
            raise ValueError(
                f"Production environment missing required settings: {', '.join(missing)}"
            )
