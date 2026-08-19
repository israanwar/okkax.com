"""Central Registry for all External Providers and Health Tracking."""

import logging
from typing import Any, Dict, List, Optional
from .base import BaseProvider, ProviderResult

logger = logging.getLogger(__name__)


class ProviderRegistry:
    """Registry maintaining references to all instantiated external providers."""

    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}
        self._telemetry: Dict[str, Dict[str, Any]] = {}

    def register(self, provider: BaseProvider):
        """Register a provider instance."""
        self._providers[provider.name] = provider
        if provider.name not in self._telemetry:
            self._telemetry[provider.name] = {
                "last_success_at": None,
                "last_failure_at": None,
                "last_latency_ms": 0.0,
                "total_calls": 0,
                "total_errors": 0,
            }
        logger.info(f"Registered external provider: {provider.name} (enabled={provider.enabled}, configured={provider.is_configured()})")

    def get(self, name: str) -> Optional[BaseProvider]:
        """Get provider by canonical name."""
        return self._providers.get(name)

    def record_call(self, provider_name: str, result: ProviderResult):
        """Record operational telemetry for a provider call."""
        if provider_name not in self._telemetry:
            self._telemetry[provider_name] = {
                "last_success_at": None,
                "last_failure_at": None,
                "last_latency_ms": 0.0,
                "total_calls": 0,
                "total_errors": 0,
            }
        telem = self._telemetry[provider_name]
        telem["total_calls"] += 1
        telem["last_latency_ms"] = result.latency_ms

        if result.ok:
            telem["last_success_at"] = result.timestamp
        else:
            telem["total_errors"] += 1
            telem["last_failure_at"] = result.timestamp

    def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        """Return non-sensitive status report of all registered providers."""
        status_report = {}
        for name, provider in self._providers.items():
            telem = self._telemetry.get(name, {})
            status_report[name] = {
                "enabled": provider.enabled,
                "configured": provider.is_configured(),
                "status": provider.get_status(),
                "last_success_at": telem.get("last_success_at"),
                "last_failure_at": telem.get("last_failure_at"),
                "last_latency_ms": telem.get("last_latency_ms", 0.0),
                "total_calls": telem.get("total_calls", 0),
                "total_errors": telem.get("total_errors", 0),
            }
        return status_report

    async def run_self_test(self, provider_name: str) -> ProviderResult:
        """Run non-destructive self-test for a registered provider."""
        provider = self.get(provider_name)
        if not provider:
            return ProviderResult.failure(
                provider=provider_name,
                error_code="PROVIDER_NOT_FOUND",
                error_message=f"Provider '{provider_name}' is not registered",
            )
        result = await provider.health_check()
        self.record_call(provider_name, result)
        return result


registry = ProviderRegistry()
