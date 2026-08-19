"""Spotify Web API Client for Verified Artist Profile Enrichment."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
import httpx

from ..base import BaseProvider, ProviderResult, current_iso
from ..cache import cache
from ..circuit_breaker import get_circuit_breaker
from ..config import settings
from ..exceptions import (
    ProviderAuthenticationError,
    ProviderBadResponse,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from ..registry import registry
from ..retry import execute_with_retry

logger = logging.getLogger(__name__)


class SpotifyClient(BaseProvider):
    """Provider adapter for Spotify Web API."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        super().__init__(
            name="spotify",
            enabled=enabled if enabled is not None else settings.SPOTIFY_ENABLED,
        )
        self.client_id = client_id if client_id is not None else settings.SPOTIFY_CLIENT_ID
        self.client_secret = client_secret if client_secret is not None else settings.SPOTIFY_CLIENT_SECRET
        self.circuit = get_circuit_breaker("spotify")
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def _get_app_token(self) -> str:
        """Fetch Client Credentials Access Token."""
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://accounts.spotify.com/api/token",
                data={"grant_type": "client_credentials"},
                auth=(self.client_id, self.client_secret),
            )
            if resp.status_code != 200:
                raise ProviderAuthenticationError("spotify", "Failed to retrieve Spotify access token")
            data = resp.json()
            self._access_token = data.get("access_token")
            self._token_expires_at = time.time() + float(data.get("expires_in", 3600))
            return self._access_token

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("spotify", "DISABLED", "Spotify provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("spotify", "NOT_CONFIGURED", "Spotify client credentials missing")
        try:
            token = await self._get_app_token()
            return ProviderResult.success("spotify", {"status": "authenticated", "token_type": "Bearer"})
        except Exception as e:
            return ProviderResult.failure("spotify", "AUTH_FAILED", str(e)[:150])

    async def search_artist(
        self,
        artist_name: str,
        timeout_seconds: float = 10.0,
    ) -> ProviderResult:
        """Search artist and return verified profile metadata with 7-day caching."""
        if not artist_name or not artist_name.strip():
            return ProviderResult.failure("spotify", "INVALID_ARTIST", "Artist name cannot be empty")

        clean_name = artist_name.strip()
        cache_key = cache.hash_key("spotify_artist", {"name": clean_name.lower()})

        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return ProviderResult.success("spotify", cached_val, cached=True)

        if not self.enabled or not self.is_configured():
            # Simulated verified metadata
            simulated = {
                "artist_name": clean_name,
                "spotify_id": f"sim_sp_{abs(hash(clean_name)) % 100000}",
                "spotify_uri": f"spotify:artist:sim_{abs(hash(clean_name)) % 100000}",
                "genres": ["Indie Pop", "Alternative", "Indonesian Indie"],
                "popularity_index": 78,
                "followers_count": 350000,
                "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7",
                "source": "simulated_profile",
                "fetched_at": current_iso(),
            }
            return ProviderResult.success("spotify", simulated, cached=False)

        if not self.circuit.can_execute():
            raise ProviderUnavailable("spotify", "Circuit is OPEN due to repeated errors")

        token = await self._get_app_token()
        url = f"https://api.spotify.com/v1/search?q={clean_name}&type=artist&limit=1"
        headers = {"Authorization": f"Bearer {token}"}
        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("spotify")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("spotify", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("spotify", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    data = resp.json()
                    artists = data.get("artists", {}).get("items", [])
                    if not artists:
                        return None

                    art = artists[0]
                    images = art.get("images", [])
                    img_url = images[0].get("url") if images else None

                    return {
                        "artist_name": art.get("name"),
                        "spotify_id": art.get("id"),
                        "spotify_uri": art.get("uri"),
                        "genres": art.get("genres", []),
                        "popularity_index": art.get("popularity", 0),
                        "followers_count": art.get("followers", {}).get("total", 0),
                        "image_url": img_url,
                        "source": "spotify_official_api",
                        "fetched_at": current_iso(),
                    }
                except httpx.TimeoutException:
                    raise ProviderTimeout("spotify", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("spotify", str(e)[:150])

        try:
            result = await execute_with_retry(_call, max_retries=1, provider_name="spotify")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000

            if result:
                # Cache for 7 days
                cache.set(cache_key, result, ttl_seconds=7 * 86400.0)

            res = ProviderResult.success("spotify", result or {"not_found": True}, latency_ms=latency)
            registry.record_call("spotify", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            res = ProviderResult.failure("spotify", "SEARCH_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("spotify", res)
            raise


spotify_client = SpotifyClient()
registry.register(spotify_client)
