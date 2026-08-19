"""External Integrations Health Diagnostic and Status Aggregator."""

from typing import Any, Dict
from .base import ProviderResult
from .registry import registry


async def get_all_integrations_status() -> Dict[str, Any]:
    """Return consolidated status of all external providers with zero credential exposure."""
    providers_status = registry.get_all_status()
    total = len(providers_status)
    configured = sum(1 for p in providers_status.values() if p.get("configured"))
    healthy = sum(1 for p in providers_status.values() if p.get("status") == "healthy")

    return {
        "status": "healthy" if total > 0 else "uninitialized",
        "total_providers": total,
        "configured_providers": configured,
        "healthy_providers": healthy,
        "providers": providers_status,
    }


async def run_provider_self_test(provider_name: str) -> ProviderResult:
    """Run low-cost self-test for a specified provider."""
    return await registry.run_self_test(provider_name)
