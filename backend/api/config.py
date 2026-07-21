"""Central config for FastAPI backend (env + .env)."""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    database_url: str = "postgresql+psycopg2://codebuster:codebuster_pass@localhost:5432/codebuster"
    redis_url: str = "redis://localhost:6379/0"
    github_webhook_secret: Optional[str] = None

    # S3-compatible (MinIO) or filesystem stub
    s3_endpoint_url: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket: str = "codebuster-artifacts"
    s3_use_path_style: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
