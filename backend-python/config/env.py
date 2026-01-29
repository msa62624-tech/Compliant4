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
    SMTP_FROM: str = "noreply@compliant.team"
    
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


def validate_production_environment():
    """Validate that production environment has required settings"""
    if settings.NODE_ENV == "production":
        required_settings = [
            ("JWT_SECRET", settings.JWT_SECRET),
            ("FRONTEND_URL", settings.FRONTEND_URL),
        ]
        
        missing = []
        for name, value in required_settings:
            if not value or value == "compliant-dev-secret-change-in-production":
                missing.append(name)
        
        if missing:
            raise ValueError(
                f"Production environment missing required settings: {', '.join(missing)}"
            )
