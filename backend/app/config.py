from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "ModdersOmni"
    debug: bool = False
    log_level: str = "INFO"

    # CORS
    cors_origins: str = "http://localhost:4200,http://localhost"

    # Database
    database_url: str = "postgresql+asyncpg://modify:modify@localhost:5432/modify"

    # Custom Mod Source
    custom_source_api_url: str = ""
    custom_source_api_key: str = ""

    # Auth
    secret_key: str = "change-me-in-production-use-a-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@moddersomni.com"
    smtp_from_name: str = "ModdersOmni"
    smtp_use_tls: bool = True
    email_verification_expire_hours: int = 24

    # OAuth - Google
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/oauth/google/callback"

    # OAuth - Discord
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = "http://localhost:8000/api/auth/oauth/discord/callback"

    # OAuth - Nexus Mods (for calling Nexus API on user's behalf — collections, downloads)
    # Awaiting client_id/secret assignment from Nexus Support.
    nexus_client_id: str = ""
    nexus_client_secret: str = ""
    nexus_redirect_uri: str = "http://localhost:8000/api/nexus/oauth/callback"
    nexus_oauth_scopes: str = ""  # populated from Nexus's scope list once confirmed

    # Server-side LLM keys — used for all free-tier generations
    gemini_api_key: str = ""          # Google AI Studio key (Gemini Flash, also fallback for Pro)
    gemini_pro_api_key: str = ""      # Dedicated Pro key; falls back to gemini_api_key if unset
    ollama_api_key: str = ""          # Ollama Cloud key — fallback if Gemini fails

    # Reviewer override: use a different provider instead of Gemini Pro
    reviewer_provider: str = ""
    reviewer_api_key: str = ""
    reviewer_base_url: str = ""
    reviewer_model: str = ""

    # Account cleanup
    account_inactive_days: int = 365
    account_deletion_grace_days: int = 30
    account_cleanup_interval_hours: int = 24

    # Frontend URL (for email links and OAuth redirects)
    frontend_url: str = "http://localhost:4200"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
