"""Configuration and Feature Flags for OKKAX External Integrations."""

import os
from typing import List


def _to_bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on")


class IntegrationSettings:
    """Central configuration for external API integrations with zero-credential safety."""

    # AI Configuration
    AI_ENABLED: bool = _to_bool(os.environ.get("OKKAX_AI_ENABLED"), default=False)
    AI_PRIMARY: str = os.environ.get("OKKAX_AI_PRIMARY", "gemini").strip().lower()
    AI_FALLBACK: List[str] = [
        s.strip().lower()
        for s in os.environ.get("OKKAX_AI_FALLBACK", "openai,anthropic").split(",")
        if s.strip()
    ]
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip()
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "").strip()
    ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "").strip()

    # Email (Resend)
    EMAIL_ENABLED: bool = _to_bool(os.environ.get("OKKAX_EMAIL_ENABLED"), default=False)
    RESEND_API_KEY: str = os.environ.get("RESEND_API_KEY", "").strip()
    RESEND_FROM_EMAIL: str = os.environ.get("RESEND_FROM_EMAIL", "OKKAX <no-reply@okkax.com>").strip()

    # WhatsApp
    WHATSAPP_ENABLED: bool = _to_bool(os.environ.get("OKKAX_WHATSAPP_ENABLED"), default=False)
    WHATSAPP_ACCESS_TOKEN: str = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    WHATSAPP_PHONE_NUMBER_ID: str = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    WHATSAPP_VERIFY_TOKEN: str = os.environ.get("WHATSAPP_VERIFY_TOKEN", "").strip()

    # FCM / Push
    FCM_ENABLED: bool = _to_bool(os.environ.get("OKKAX_FCM_ENABLED"), default=False)
    FIREBASE_PROJECT_ID: str = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    FIREBASE_CREDENTIALS_JSON: str = os.environ.get("FIREBASE_CREDENTIALS_JSON", "").strip()

    # Location (Google Maps / Places / Routes)
    MAPS_ENABLED: bool = _to_bool(os.environ.get("OKKAX_MAPS_ENABLED"), default=False)
    GOOGLE_MAPS_API_KEY: str = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    SERPAPI_API_KEY: str = os.environ.get("SERPAPI_API_KEY", "").strip()
    SERPAPI_MAPS_ENABLED: bool = _to_bool(
        os.environ.get("OKKAX_SERPAPI_MAPS_ENABLED"),
        default=bool(SERPAPI_API_KEY),
    )

    # Weather (BMKG) - enabled by default as open data
    WEATHER_ENABLED: bool = _to_bool(os.environ.get("OKKAX_WEATHER_ENABLED"), default=True)

    # Storage (Cloudflare R2 / S3)
    STORAGE_ENABLED: bool = _to_bool(os.environ.get("OKKAX_STORAGE_ENABLED"), default=False)
    R2_ACCOUNT_ID: str = os.environ.get("R2_ACCOUNT_ID", "").strip()
    R2_ACCESS_KEY_ID: str = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    R2_SECRET_ACCESS_KEY: str = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    R2_BUCKET: str = os.environ.get("R2_BUCKET", "okkax-production").strip()
    R2_ENDPOINT: str = os.environ.get("R2_ENDPOINT", "").strip()

    # Media (Spotify & YouTube)
    SPOTIFY_ENABLED: bool = _to_bool(os.environ.get("OKKAX_SPOTIFY_ENABLED"), default=False)
    SPOTIFY_CLIENT_ID: str = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    SPOTIFY_CLIENT_SECRET: str = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()

    YOUTUBE_ENABLED: bool = _to_bool(os.environ.get("OKKAX_YOUTUBE_ENABLED"), default=False)
    YOUTUBE_API_KEY: str = os.environ.get("YOUTUBE_API_KEY", "").strip()


settings = IntegrationSettings()
