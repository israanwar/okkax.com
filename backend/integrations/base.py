"""Base Provider Interfaces and Result Models for OKKAX Integrations."""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import time
from typing import Any, Dict, Optional
import uuid
from pydantic import BaseModel, Field


def generate_request_id() -> str:
    """Generate a unique correlation request ID."""
    return f"req_{uuid.uuid4().hex[:12]}"


def current_iso() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


class ProviderResult(BaseModel):
    """Normalized response envelope for all external integration calls."""

    ok: bool = Field(default=True, description="Whether the integration call succeeded")
    provider: str = Field(..., description="Canonical provider identifier (e.g. gemini, resend, bmkg)")
    data: Optional[Any] = Field(default=None, description="Payload data returned by provider")
    error_code: Optional[str] = Field(default=None, description="Normalized error code if failed")
    error_message: Optional[str] = Field(default=None, description="Safe error message for debugging/logging")
    latency_ms: float = Field(default=0.0, description="Execution round-trip latency in milliseconds")
    cached: bool = Field(default=False, description="Whether the response was served from cache")
    request_id: str = Field(default_factory=generate_request_id, description="Correlation tracking ID")
    timestamp: str = Field(default_factory=current_iso, description="ISO-8601 execution timestamp")
    provenance: Optional[Dict[str, Any]] = Field(default=None, description="Audit provenance metadata")

    @classmethod
    def success(
        cls,
        provider: str,
        data: Any,
        latency_ms: float = 0.0,
        cached: bool = False,
        request_id: Optional[str] = None,
        provenance: Optional[Dict[str, Any]] = None,
    ) -> "ProviderResult":
        return cls(
            ok=True,
            provider=provider,
            data=data,
            latency_ms=latency_ms,
            cached=cached,
            request_id=request_id or generate_request_id(),
            provenance=provenance,
        )

    @classmethod
    def failure(
        cls,
        provider: str,
        error_code: str,
        error_message: str,
        latency_ms: float = 0.0,
        request_id: Optional[str] = None,
        data: Optional[Any] = None,
    ) -> "ProviderResult":
        return cls(
            ok=False,
            provider=provider,
            data=data,
            error_code=error_code,
            error_message=error_message,
            latency_ms=latency_ms,
            cached=False,
            request_id=request_id or generate_request_id(),
        )


class BaseProvider(ABC):
    """Abstract Base Class for all OKKAX External Providers."""

    def __init__(self, name: str, enabled: bool = False):
        self.name = name
        self.enabled = enabled

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if required API credentials or configurations are present."""
        pass

    @abstractmethod
    async def health_check(self) -> ProviderResult:
        """Perform a safe, low-cost health verification."""
        pass

    def get_status(self) -> str:
        """Return provider status: 'disabled', 'not_configured', 'healthy', 'degraded', or 'unavailable'."""
        if not self.enabled:
            return "disabled"
        if not self.is_configured():
            return "not_configured"
        return "healthy"
