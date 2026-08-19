"""Google Routes API Client for Event Logistics and Travel Estimation."""

import asyncio
import logging
import time
from typing import Any, Dict, Optional
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


class GoogleRoutesClient(BaseProvider):
    """Provider adapter for Google Routes API."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        api_key: Optional[str] = None,
    ):
        super().__init__(
            name="google_routes",
            enabled=enabled if enabled is not None else settings.MAPS_ENABLED,
        )
        self.api_key = api_key if api_key is not None else settings.GOOGLE_MAPS_API_KEY
        self.circuit = get_circuit_breaker("google_routes")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("google_routes", "DISABLED", "Google Routes provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("google_routes", "NOT_CONFIGURED", "Google Maps API key is missing")

        start = time.time()
        try:
            res = await self.compute_route(
                origin={"latitude": -6.2088, "longitude": 106.8456},
                destination={"latitude": -6.2188, "longitude": 106.8026},
            )
            return res
        except Exception as e:
            return ProviderResult.failure("google_routes", "HEALTH_CHECK_FAILED", str(e)[:150], latency_ms=(time.time() - start) * 1000)

    async def compute_route(
        self,
        origin: Dict[str, float],
        destination: Dict[str, float],
        travel_mode: str = "DRIVE",
        timeout_seconds: float = 10.0,
    ) -> ProviderResult:
        """Calculate travel distance and duration between two coordinates."""
        orig_lat, orig_lng = origin.get("latitude"), origin.get("longitude")
        dest_lat, dest_lng = destination.get("latitude"), destination.get("longitude")

        if None in (orig_lat, orig_lng, dest_lat, dest_lng):
            return ProviderResult.failure("google_routes", "INVALID_COORDINATES", "Origin and destination coordinates required")

        cache_key = cache.hash_key("routes", {"o": f"{orig_lat},{orig_lng}", "d": f"{dest_lat},{dest_lng}", "m": travel_mode})
        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return ProviderResult.success("google_routes", cached_val, cached=True)

        if not self.enabled:
            # Deterministic estimation fallback based on Haversine distance
            import math
            R = 6371000  # meters
            phi1 = math.radians(orig_lat)
            phi2 = math.radians(dest_lat)
            delta_phi = math.radians(dest_lat - orig_lat)
            delta_lambda = math.radians(dest_lng - orig_lng)
            a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            dist_meters = int(R * c * 1.3)  # 1.3 road winding factor
            duration_sec = int(dist_meters / 8.33)  # ~30 km/h in city

            simulated = {
                "origin": origin,
                "destination": destination,
                "distance_meters": dist_meters,
                "duration_seconds": duration_sec,
                "travel_mode": travel_mode,
                "source": "simulated_haversine",
                "calculated_at": current_iso(),
            }
            return ProviderResult.success("google_routes", simulated, cached=False)

        if not self.is_configured():
            raise ProviderNotConfigured("google_routes", "API key missing")

        if not self.circuit.can_execute():
            raise ProviderUnavailable("google_routes", "Circuit is OPEN due to repeated errors")

        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        }
        payload = {
            "origin": {"location": {"latLng": {"latitude": orig_lat, "longitude": orig_lng}}},
            "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
            "travelMode": travel_mode,
            "routingPreference": "TRAFFIC_AWARE",
        }

        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("google_routes")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("google_routes", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("google_routes", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    data = resp.json()
                    route = data.get("routes", [{}])[0]
                    dist = route.get("distanceMeters", 0)
                    dur_str = route.get("duration", "0s")
                    dur_sec = int(dur_str.replace("s", "")) if dur_str.endswith("s") else 0

                    return {
                        "origin": origin,
                        "destination": destination,
                        "distance_meters": dist,
                        "duration_seconds": dur_sec,
                        "travel_mode": travel_mode,
                        "source": "google_routes",
                        "calculated_at": current_iso(),
                    }
                except httpx.TimeoutException:
                    raise ProviderTimeout("google_routes", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("google_routes", str(e)[:150])

        try:
            result = await execute_with_retry(_call, max_retries=1, provider_name="google_routes")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000

            # Cache routes for 30 minutes
            cache.set(cache_key, result, ttl_seconds=1800.0)

            res = ProviderResult.success("google_routes", result, latency_ms=latency)
            registry.record_call("google_routes", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            res = ProviderResult.failure("google_routes", "ROUTE_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("google_routes", res)
            raise


routes_client = GoogleRoutesClient()
registry.register(routes_client)
