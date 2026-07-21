import functools
import os
from typing import Optional

from pydantic import BaseSettings, AnyUrl, Field


class Settings(BaseSettings):
    """Shared configuration for CodeBuster microservices.

    Values are loaded from environment variables. This module is intentionally
    lightweight so it can be imported from FastAPI apps, Celery workers, and
    CLI tooling without side effects.
    """

    # Core service configuration
    environment: str = Field("development", env="ENVIRONMENT")
    service_name: str = Field("codebuster", env="SERVICE_NAME")

    # Database / cache
    database_url: AnyUrl = Field(
        "postgresql+psycopg2://codebuster:codebuster@localhost:5432/codebuster",
        env="DATABASE_URL",
    )
    redis_url: AnyUrl = Field(
        "redis://localhost:6379/0",
        env="REDIS_URL",
    )

    # Object storage (S3-compatible)
    s3_endpoint_url: Optional[AnyUrl] = Field(
        None,
        env="S3_ENDPOINT_URL",
    )
    s3_bucket_reviews: str = Field("codebuster-reviews", env="S3_BUCKET_REVIEWS")

    # GitHub App integration
    github_app_id: Optional[str] = Field(None, env="GITHUB_APP_ID")
    github_app_private_key: Optional[str] = Field(
        None,
        env="GITHUB_APP_PRIVATE_KEY",  # PEM value or path (resolved below)
    )
    github_app_private_key_path: Optional[str] = Field(
        None,
        env="GITHUB_APP_PRIVATE_KEY_PATH",
    )
    github_webhook_secret: Optional[str] = Field(
        None,
        env="GITHUB_WEBHOOK_SECRET",
    )

    # LLM / AI review
    llm_provider: str = Field("gemini", env="LLM_PROVIDER")
    llm_api_key: Optional[str] = Field(None, env="LLM_API_KEY")
    llm_model: str = Field("gemini-2.0-pro-exp", env="LLM_MODEL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def github_private_key_pem(self) -> Optional[str]:
        """Return the GitHub App private key PEM contents, if configured.

        Supports either:
        - GITHUB_APP_PRIVATE_KEY containing the PEM text directly
        - GITHUB_APP_PRIVATE_KEY_PATH pointing to a readable file
        """
        if self.github_app_private_key:
            return self.github_app_private_key
        if self.github_app_private_key_path:
            try:
                with open(self.github_app_private_key_path, "r", encoding="utf-8") as f:
                    return f.read()
            except OSError:
                return None
        return None


@functools.lru_cache()
def get_settings() -> Settings:
    """Return cached Settings instance.

    Using lru_cache keeps configuration lookups cheap and avoids repeated
    environment parsing across modules.
    """

    # Allow overriding env file path in tests/tools.
    env_file_override = os.getenv("CODEBUSTER_ENV_FILE")
    if env_file_override:
        Settings.Config.env_file = env_file_override

    return Settings()


settings = get_settings()

