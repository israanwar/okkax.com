"""Google Places API (New) Client for Venue and Location Discovery."""

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


class GooglePlacesClient(BaseProvider):
    """Provider adapter for Google Places API (New)."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        api_key: Optional[str] = None,
    ):
        super().__init__(
            name="google_places",
            enabled=enabled if enabled is not None else settings.MAPS_ENABLED,
        )
        self.api_key = api_key if api_key is not None else settings.GOOGLE_MAPS_API_KEY
        self.circuit = get_circuit_breaker("google_places")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("google_places", "DISABLED", "Google Maps/Places provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("google_places", "NOT_CONFIGURED", "Google Maps API key is missing")

        start = time.time()
        try:
            res = await self.search_places("GBK Jakarta", limit=1)
            return res
        except Exception as e:
            return ProviderResult.failure("google_places", "HEALTH_CHECK_FAILED", str(e)[:150], latency_ms=(time.time() - start) * 1000)

    async def search_places(
        self,
        query: str,
        limit: int = 5,
        timeout_seconds: float = 10.0,
    ) -> ProviderResult:
        """Search places by text query with caching and normalized output."""
        if not query or not query.strip():
            return ProviderResult.failure("google_places", "INVALID_QUERY", "Query cannot be empty")

        cache_key = cache.hash_key("places_search", {"q": query.strip().lower(), "lim": limit})
        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return ProviderResult.success("google_places", cached_val, cached=True)

        if not self.enabled:
            # Fallback mock/simulated venues for development
            simulated = [
                {
                    "place_id": f"sim_place_{abs(hash(query)) % 1000}",
                    "name": query.strip().title(),
                    "formatted_address": f"Jl. {query.strip().title()} No. 1, Jakarta",
                    "latitude": -6.2088,
                    "longitude": 106.8456,
                    "google_maps_uri": "https://maps.google.com",
                    "types": ["establishment", "point_of_interest"],
                    "source": "simulated",
                }
            ]
            return ProviderResult.success("google_places", simulated, cached=False)

        if not self.is_configured():
            raise ProviderNotConfigured("google_places", "API key missing")

        if not self.circuit.can_execute():
            raise ProviderUnavailable("google_places", "Circuit is OPEN due to repeated errors")

        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.types",
        }
        payload = {"textQuery": query, "pageSize": limit}

        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("google_places")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("google_places", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("google_places", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    data = resp.json()
                    results = []
                    for p in data.get("places", []):
                        results.append({
                            "place_id": p.get("id"),
                            "name": p.get("displayName", {}).get("text", ""),
                            "formatted_address": p.get("formattedAddress", ""),
                            "latitude": p.get("location", {}).get("latitude"),
                            "longitude": p.get("location", {}).get("longitude"),
                            "google_maps_uri": p.get("googleMapsUri", ""),
                            "types": p.get("types", []),
                            "source": "google_places",
                        })
                    return results
                except httpx.TimeoutException:
                    raise ProviderTimeout("google_places", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("google_places", str(e)[:150])

        try:
            results = await execute_with_retry(_call, max_retries=1, provider_name="google_places")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000

            # Cache place search results for 1 hour
            cache.set(cache_key, results, ttl_seconds=3600.0)

            res = ProviderResult.success("google_places", results, latency_ms=latency)
            registry.record_call("google_places", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            res = ProviderResult.failure("google_places", "SEARCH_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("google_places", res)
            raise


places_client = GooglePlacesClient()
registry.register(places_client)
