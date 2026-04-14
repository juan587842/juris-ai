from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str

    # Evolution API
    evolution_api_url: str
    evolution_api_key: str
    evolution_instance: str = "juris-ai"
    evolution_webhook_secret: str = ""

    # LLM
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    llm_model: str = "google/gemma-4-26b-a4b-it:free"
    llm_base_url: str = "https://openrouter.ai/api/v1"

    # Workers
    redis_url: str = "redis://localhost:6379/0"

    # App
    app_env: str = "development"
    app_secret_key: str = "change_me"
    log_level: str = "INFO"

    # CORS — origens permitidas (separadas por vírgula no env)
    cors_origins: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
