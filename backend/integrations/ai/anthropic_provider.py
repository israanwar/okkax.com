"""Anthropic Claude Provider for OKKAX Intelligence."""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional, Type
import httpx
from pydantic import BaseModel, ValidationError

from ..base import ProviderResult, current_iso
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
from ..retry import execute_with_retry
from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseLLMProvider):
    """Provider adapter for Anthropic Claude Models."""

    def __init__(self, enabled: Optional[bool] = None, api_key: Optional[str] = None):
        super().__init__(
            name="anthropic",
            default_model="claude-sonnet-4-6",
            enabled=enabled if enabled is not None else settings.AI_ENABLED,
        )
        self.api_key = api_key if api_key is not None else settings.ANTHROPIC_API_KEY
        self.circuit = get_circuit_breaker("anthropic")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("anthropic", "DISABLED", "Anthropic provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("anthropic", "NOT_CONFIGURED", "Anthropic API key is missing")

        start = time.time()
        try:
            res = await self.generate_text("Ping! Respond with 'PONG' only.", max_tokens=10, timeout_seconds=5.0)
            return res
        except Exception as e:
            return ProviderResult.failure("anthropic", "HEALTH_CHECK_FAILED", str(e)[:150], latency_ms=(time.time() - start) * 1000)

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        if not self.enabled:
            raise ProviderNotConfigured("anthropic", "Provider is disabled")
        if not self.is_configured():
            raise ProviderNotConfigured("anthropic", "API key missing")
        if not self.circuit.can_execute():
            raise ProviderUnavailable("anthropic", "Circuit is OPEN due to repeated errors")

        target_model = model or self.default_model
        start_time = time.time()

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": target_model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_instruction:
            payload["system"] = system_instruction

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
                    if resp.status_code == 429:
                        raise ProviderRateLimited("anthropic")
                    if resp.status_code in (401, 403):
                        raise ProviderAuthenticationError("anthropic", resp.text[:100])
                    if resp.status_code >= 400:
                        raise ProviderBadResponse("anthropic", f"HTTP {resp.status_code}: {resp.text[:100]}")

                    data = resp.json()
                    content_blocks = data.get("content", [])
                    text = "".join([b.get("text", "") for b in content_blocks if b.get("type") == "text"])
                    return text
                except httpx.TimeoutException:
                    raise ProviderTimeout("anthropic", timeout_seconds)
                except httpx.RequestError as e:
                    raise ProviderBadResponse("anthropic", str(e)[:150])

        try:
            text = await execute_with_retry(_call, max_retries=1, provider_name="anthropic")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000
            return ProviderResult.success(
                provider="anthropic",
                data={"text": text, "model": target_model},
                latency_ms=latency,
                provenance={
                    "provider": "anthropic",
                    "model": target_model,
                    "generated_at": current_iso(),
                    "schema_valid": True,
                    "fallback_used": False,
                    "confidence": 0.95,
                },
            )
        except Exception:
            self.circuit.record_failure()
            raise

    async def generate_structured(
        self,
        prompt: str,
        schema_cls: Type[BaseModel],
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        json_prompt = (
            f"{prompt}\n\n"
            f"IMPORTANT: Respond ONLY with a valid JSON object matching this schema:\n"
            f"{json.dumps(schema_cls.model_json_schema(), ensure_ascii=False)}"
        )
        res = await self.generate_text(
            prompt=json_prompt,
            system_instruction=system_instruction,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
        )
        raw_text = res.data.get("text", "").strip() if res.data else ""
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        start, end = raw_text.find("{"), raw_text.rfind("}")
        if start == -1 or end == -1:
            raise ProviderBadResponse("anthropic", "No JSON object found in response")

        try:
            parsed = json.loads(raw_text[start : end + 1])
            validated = schema_cls.model_validate(parsed)
            res.data["structured"] = validated.model_dump()
            return res
        except (json.JSONDecodeError, ValidationError) as e:
            raise ProviderBadResponse("anthropic", f"Structured validation failed: {str(e)[:150]}")
