from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional
import os

class Settings(BaseSettings):
    # Flask settings
    FLASK_SECRET_KEY: str = "codebuster-secret-key-change-in-production"
    PORT: int = 5000
    DEBUG: bool = True
    
    # CORS settings
    FRONTEND_URL: str = "http://localhost:5174"
    
    # Database settings
    DATABASE_URL: str = "postgresql://codebuster:codebuster_pass@localhost:5432/codebuster"
    
    # Redis/Celery settings
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # GitHub App settings
    GITHUB_APP_ID: str
    GITHUB_APP_PRIVATE_KEY: Optional[str] = None
    GITHUB_APP_PRIVATE_KEY_PATH: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: str
    
    # OAuth settings
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development"}:
                return True
        return value
    
    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore",
        env_file_encoding='utf-8'
    )

    def get_private_key(self) -> str:
        """Get the private key either from string or path."""
        if self.GITHUB_APP_PRIVATE_KEY:
            return self.GITHUB_APP_PRIVATE_KEY
        
        if self.GITHUB_APP_PRIVATE_KEY_PATH and os.path.exists(self.GITHUB_APP_PRIVATE_KEY_PATH):
            with open(self.GITHUB_APP_PRIVATE_KEY_PATH, 'r') as f:
                return f.read()
        
        raise ValueError("Neither GITHUB_APP_PRIVATE_KEY nor valid GITHUB_APP_PRIVATE_KEY_PATH provided")

settings = Settings()
