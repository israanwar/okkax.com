"""YouTube Data API v3 Client for Live Showreel and Video Discovery."""

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


class YouTubeClient(BaseProvider):
    """Provider adapter for YouTube Data API v3."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        api_key: Optional[str] = None,
    ):
        super().__init__(
            name="youtube",
            enabled=enabled if enabled is not None else settings.YOUTUBE_ENABLED,
        )
        self.api_key = api_key if api_key is not None else settings.YOUTUBE_API_KEY
        self.circuit = get_circuit_breaker("youtube")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("youtube", "DISABLED", "YouTube provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("youtube", "NOT_CONFIGURED", "YouTube API key missing")
        try:
            res = await self.search_showreels("Aruna Live", limit=1)
            return res
        except Exception as e:
            return ProviderResult.failure("youtube", "HEALTH_CHECK_FAILED", str(e)[:150])

    async def search_showreels(
        self,
        query: str,
        limit: int = 3,
        timeout_seconds: float = 10.0,
    ) -> ProviderResult:
        """Search live showreel videos for artists/venues with aggressive caching."""
        if not query or not query.strip():
            return ProviderResult.failure("youtube", "INVALID_QUERY", "Query cannot be empty")

        clean_q = query.strip()
        cache_key = cache.hash_key("youtube_search", {"q": clean_q.lower(), "lim": limit})

        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return ProviderResult.success("youtube", cached_val, cached=True)

        if not self.enabled or not self.is_configured():
            # Simulated showreel
            simulated = [
                {
                    "video_id": f"sim_yt_{abs(hash(clean_q)) % 10000}",
                    "title": f"{clean_q} — Live Concert Experience 2026",
                    "channel_title": f"{clean_q} Official",
                    "thumbnail_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745",
                    "embed_url": f"https://www.youtube.com/embed/sim_{abs(hash(clean_q)) % 10000}",
                    "source": "simulated",
                    "fetched_at": current_iso(),
                }
            ]
            return ProviderResult.success("youtube", simulated, cached=False)

        if not self.circuit.can_execute():
            raise ProviderUnavailable("youtube", "Circuit is OPEN due to repeated errors")

        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "key": self.api_key,
            "part": "snippet",
            "q": f"{clean_q} live",
            "type": "video",
            "maxResults": limit,
        }
        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("youtube")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("youtube", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("youtube", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    data = resp.json()
                    items = data.get("items", [])
                    results = []
                    for it in items:
                        vid_id = it.get("id", {}).get("videoId")
                        snip = it.get("snippet", {})
                        if vid_id:
                            results.append({
                                "video_id": vid_id,
                                "title": snip.get("title"),
                                "channel_title": snip.get("channelTitle"),
                                "thumbnail_url": snip.get("thumbnails", {}).get("high", {}).get("url"),
                                "embed_url": f"https://www.youtube.com/embed/{vid_id}",
                                "source": "youtube_data_api",
                                "fetched_at": current_iso(),
                            })
                    return results
                except httpx.TimeoutException:
                    raise ProviderTimeout("youtube", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("youtube", str(e)[:150])

        try:
            results = await execute_with_retry(_call, max_retries=1, provider_name="youtube")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000

            # Cache for 3 days
            cache.set(cache_key, results, ttl_seconds=3 * 86400.0)

            res = ProviderResult.success("youtube", results, latency_ms=latency)
            registry.record_call("youtube", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            res = ProviderResult.failure("youtube", "SEARCH_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("youtube", res)
            raise


youtube_client = YouTubeClient()
registry.register(youtube_client)
