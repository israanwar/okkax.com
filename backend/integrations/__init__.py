"""OKKAX External Integrations Package.

Provides production-grade, fault-tolerant, modular adapters for third-party services.
Following the Provider Interface / Adapter pattern with zero crashing guarantee.
"""

from .base import BaseProvider, ProviderResult
from .exceptions import (
    ProviderError,
    ProviderNotConfigured,
    ProviderTimeout,
    ProviderRateLimited,
    ProviderAuthenticationError,
    ProviderBadResponse,
    ProviderUnavailable,
)
from .registry import registry

# Import all adapters to ensure they register with registry
from .ai.router import ai_router
from .messaging.resend_client import resend_client
from .messaging.whatsapp_client import whatsapp_client
from .messaging.fcm_client import fcm_client
from .location.google_places_client import places_client
from .location.google_routes_client import routes_client
from .location.bmkg_client import weather_client
from .storage.r2_client import storage_client
from .media.spotify_client import spotify_client
from .media.youtube_client import youtube_client
from .signatures.esign_client import privy_client

__all__ = [
    "BaseProvider",
    "ProviderResult",
    "ProviderError",
    "ProviderNotConfigured",
    "ProviderTimeout",
    "ProviderRateLimited",
    "ProviderAuthenticationError",
    "ProviderBadResponse",
    "ProviderUnavailable",
    "registry",
    "ai_router",
    "resend_client",
    "whatsapp_client",
    "fcm_client",
    "places_client",
    "routes_client",
    "weather_client",
    "storage_client",
    "spotify_client",
    "youtube_client",
    "privy_client",
]
