"""SerpApi Google Maps adapter for live venue discovery only."""

import time
from typing import Optional

import httpx

from ..base import BaseProvider, ProviderResult
from ..circuit_breaker import get_circuit_breaker
from ..config import settings
from ..registry import registry


class SerpApiMapsClient(BaseProvider):
    """Minimal Google Maps search adapter; no other SerpApi engine is enabled."""

    def __init__(self, enabled: Optional[bool] = None, api_key: Optional[str] = None):
        super().__init__(
            name="serpapi_maps",
            enabled=settings.SERPAPI_MAPS_ENABLED if enabled is None else enabled,
        )
        self.api_key = settings.SERPAPI_API_KEY if api_key is None else api_key
        self.circuit = get_circuit_breaker("serpapi_maps")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("serpapi_maps", "DISABLED", "SerpApi Maps provider is disabled")
        if not self.is_configured():
            return ProviderResult.failure("serpapi_maps", "NOT_CONFIGURED", "SerpApi credential is missing")
        return ProviderResult.success("serpapi_maps", {"configured": True, "engine": "google_maps"})

    async def search_venues(
        self,
        query: str,
        limit: int = 3,
        timeout_seconds: float = 12.0,
    ) -> ProviderResult:
        """Run one Google Maps search and return normalized venue facts."""
        if not query or not query.strip():
            return ProviderResult.failure("serpapi_maps", "INVALID_QUERY", "Venue query cannot be empty")
        if not self.enabled:
            return ProviderResult.failure("serpapi_maps", "DISABLED", "SerpApi Maps provider is disabled")
        if not self.is_configured():
            return ProviderResult.failure("serpapi_maps", "NOT_CONFIGURED", "SerpApi credential is missing")
        if not self.circuit.can_execute():
            return ProviderResult.failure("serpapi_maps", "UNAVAILABLE", "SerpApi Maps is temporarily unavailable")

        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.get(
                    "https://serpapi.com/search.json",
                    params={
                        "engine": "google_maps",
                        "type": "search",
                        "q": query.strip(),
                        "api_key": self.api_key,
                    },
                )
            latency_ms = (time.perf_counter() - started) * 1000
            if response.status_code == 429:
                self.circuit.record_failure()
                result = ProviderResult.failure("serpapi_maps", "RATE_LIMITED", "SerpApi quota or rate limit reached", latency_ms=latency_ms)
            elif response.status_code in (401, 403):
                self.circuit.record_failure()
                result = ProviderResult.failure("serpapi_maps", "AUTH_FAILED", "SerpApi credential was rejected", latency_ms=latency_ms)
            elif response.status_code != 200:
                self.circuit.record_failure()
                result = ProviderResult.failure("serpapi_maps", "BAD_RESPONSE", f"SerpApi returned HTTP {response.status_code}", latency_ms=latency_ms)
            else:
                try:
                    payload = response.json()
                except ValueError:
                    payload = None
                if not isinstance(payload, dict):
                    self.circuit.record_failure()
                    result = ProviderResult.failure("serpapi_maps", "BAD_RESPONSE", "SerpApi returned invalid JSON", latency_ms=latency_ms)
                elif payload.get("error"):
                    self.circuit.record_failure()
                    result = ProviderResult.failure("serpapi_maps", "SEARCH_FAILED", "SerpApi Google Maps search failed", latency_ms=latency_ms)
                else:
                    venues = []
                    for place in (payload.get("local_results") or [])[:max(1, min(limit, 3))]:
                        if not isinstance(place, dict) or not place.get("title"):
                            continue
                        venues.append({
                            "name": str(place["title"]),
                            "address": str(place.get("address") or place.get("neighborhood") or ""),
                            "area": str(place.get("neighborhood") or ""),
                            "rating": place.get("rating") if isinstance(place.get("rating"), (int, float)) else None,
                            "source": "SerpApi",
                        })
                    self.circuit.record_success()
                    result = ProviderResult.success(
                        "serpapi_maps",
                        venues,
                        latency_ms=latency_ms,
                        provenance={"source": "SerpApi", "engine": "google_maps", "query": query.strip()},
                    )
        except httpx.TimeoutException:
            self.circuit.record_failure()
            result = ProviderResult.failure("serpapi_maps", "TIMEOUT", "SerpApi Maps request timed out", latency_ms=(time.perf_counter() - started) * 1000)
        except httpx.RequestError:
            self.circuit.record_failure()
            result = ProviderResult.failure("serpapi_maps", "UNAVAILABLE", "SerpApi Maps request failed", latency_ms=(time.perf_counter() - started) * 1000)

        registry.record_call("serpapi_maps", result)
        return result


serpapi_maps_client = SerpApiMapsClient()
registry.register(serpapi_maps_client)
