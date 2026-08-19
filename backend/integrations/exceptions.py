"""Standard External Provider Exceptions.

Ensures normalized exception handling across all external providers without leaking
raw third-party traceback details or API credentials to frontend clients.
"""


class ProviderError(Exception):
    """Base exception for all external provider errors."""

    def __init__(self, message: str, provider: str = "unknown", error_code: str = "PROVIDER_ERROR", status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.error_code = error_code
        self.status_code = status_code


class ProviderNotConfigured(ProviderError):
    """Raised when an external provider is enabled but missing required credentials."""

    def __init__(self, provider: str, details: str = "Missing API key or configuration"):
        super().__init__(
            message=f"Provider '{provider}' is not configured: {details}",
            provider=provider,
            error_code="PROVIDER_NOT_CONFIGURED",
            status_code=503,
        )


class ProviderTimeout(ProviderError):
    """Raised when an external provider call exceeds the configured timeout threshold."""

    def __init__(self, provider: str, timeout_seconds: float):
        super().__init__(
            message=f"Provider '{provider}' timed out after {timeout_seconds}s",
            provider=provider,
            error_code="PROVIDER_TIMEOUT",
            status_code=504,
        )


class ProviderRateLimited(ProviderError):
    """Raised when an external provider returns HTTP 429 Too Many Requests."""

    def __init__(self, provider: str, retry_after: float | None = None):
        msg = f"Provider '{provider}' rate limit exceeded"
        if retry_after:
            msg += f" (retry after {retry_after}s)"
        super().__init__(
            message=msg,
            provider=provider,
            error_code="PROVIDER_RATE_LIMITED",
            status_code=429,
        )
        self.retry_after = retry_after


class ProviderAuthenticationError(ProviderError):
    """Raised when an external provider returns HTTP 401 Unauthorized or 403 Forbidden."""

    def __init__(self, provider: str, details: str = "Invalid API credentials"):
        super().__init__(
            message=f"Authentication failed for provider '{provider}': {details}",
            provider=provider,
            error_code="PROVIDER_AUTH_FAILED",
            status_code=401,
        )


class ProviderBadResponse(ProviderError):
    """Raised when an external provider returns malformed, unparseable, or unexpected schema."""

    def __init__(self, provider: str, details: str = "Malformed response payload"):
        super().__init__(
            message=f"Bad response from provider '{provider}': {details}",
            provider=provider,
            error_code="PROVIDER_BAD_RESPONSE",
            status_code=502,
        )


class ProviderUnavailable(ProviderError):
    """Raised when an external provider circuit breaker is OPEN or 5xx outage is detected."""

    def __init__(self, provider: str, details: str = "Service is temporarily unavailable or circuit is OPEN"):
        super().__init__(
            message=f"Provider '{provider}' is unavailable: {details}",
            provider=provider,
            error_code="PROVIDER_UNAVAILABLE",
            status_code=503,
        )
