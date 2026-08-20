"""OpenRouter provider using its OpenAI-compatible API."""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional, Type

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
from .base import BaseLLMProvider


class OpenRouterProvider(BaseLLMProvider):
    """Minimal adapter for OpenRouter text, structured, and tool-capable requests."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "nvidia/nemotron-3-ultra-550b-a55b:free",
    ):
        super().__init__(
            name="openrouter",
            default_model=model,
            enabled=enabled if enabled is not None else settings.AI_ENABLED,
        )
        self.api_key = api_key if api_key is not None else os.environ.get("OPENROUTER_API_KEY", "").strip()
        self.base_url = base_url if base_url is not None else os.environ.get("OPENROUTER_BASE_URL", "").strip()
        self.circuit = get_circuit_breaker("openrouter")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5 and self.base_url)

    def _chat_completions_url(self) -> str:
        base_url = self.base_url.rstrip("/")
        if not base_url.startswith(("http://", "https://")):
            base_url = f"https://{base_url}"
        if not base_url.endswith(("/api/v1", "/v1")):
            base_url = f"{base_url}/api/v1"
        return f"{base_url}/chat/completions"

    @staticmethod
    def _build_payload(
        prompt: str,
        system_instruction: Optional[str],
        model: str,
        temperature: float,
        max_tokens: int,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        if response_format:
            payload["response_format"] = response_format
        return payload

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("openrouter", "DISABLED", "OpenRouter provider is disabled")
        if not self.is_configured():
            return ProviderResult.failure("openrouter", "NOT_CONFIGURED", "OpenRouter configuration is incomplete")
        start = time.time()
        try:
            return await self.generate_text("Respond only: PONG", max_tokens=10, timeout_seconds=10.0)
        except Exception as exc:
            return ProviderResult.failure(
                "openrouter",
                "HEALTH_CHECK_FAILED",
                str(exc)[:150],
                latency_ms=(time.time() - start) * 1000,
            )

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
        timeout_seconds: float = 30.0,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> ProviderResult:
        if not self.enabled:
            raise ProviderNotConfigured("openrouter", "Provider is disabled")
        if not self.is_configured():
            raise ProviderNotConfigured("openrouter", "OpenRouter configuration is incomplete")
        if not self.circuit.can_execute():
            raise ProviderUnavailable("openrouter", "Circuit is OPEN due to repeated errors")

        target_model = model or self.default_model
        payload = self._build_payload(
            prompt,
            system_instruction,
            target_model,
            temperature,
            max_tokens,
            tools,
            tool_choice,
            response_format,
        )
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(self._chat_completions_url(), headers=headers, json=payload)
        except (httpx.TimeoutException, asyncio.TimeoutError):
            self.circuit.record_failure()
            raise ProviderTimeout("openrouter", timeout_seconds)
        except httpx.RequestError as exc:
            self.circuit.record_failure()
            raise ProviderUnavailable("openrouter", str(exc)[:150])

        latency_ms = (time.time() - start) * 1000
        if response.status_code == 429:
            self.circuit.record_failure()
            raise ProviderRateLimited("openrouter")
        if response.status_code in (401, 403):
            self.circuit.record_failure()
            raise ProviderAuthenticationError("openrouter", f"HTTP {response.status_code}")
        if response.status_code >= 400:
            self.circuit.record_failure()
            raise ProviderBadResponse("openrouter", f"HTTP {response.status_code}: {response.text[:100]}")

        try:
            body = response.json()
            message = body["choices"][0]["message"]
            text = message.get("content") or ""
            actual_model = body.get("model") or target_model
            actual_provider = body.get("provider")
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            self.circuit.record_failure()
            raise ProviderBadResponse("openrouter", f"Malformed OpenAI-compatible response: {str(exc)[:100]}")

        self.circuit.record_success()
        return ProviderResult.success(
            provider="openrouter",
            data={
                "text": text,
                "model": actual_model,
                "routed_provider": actual_provider,
                "http_status": response.status_code,
                "tool_calls": message.get("tool_calls") or [],
            },
            latency_ms=latency_ms,
            provenance={
                "provider": "openrouter",
                "routed_provider": actual_provider,
                "model": actual_model,
                "generated_at": current_iso(),
                "schema_valid": True,
                "fallback_used": False,
                "confidence": 0.95,
            },
        )

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
        tool_name = "return_structured_result"
        tools = [{
            "type": "function",
            "function": {
                "name": tool_name,
                "description": "Return the requested structured result.",
                "parameters": schema_cls.model_json_schema(),
            },
        }]
        result = await self.generate_text(
            prompt=prompt,
            system_instruction=system_instruction,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_seconds=timeout_seconds,
            tools=tools,
            tool_choice={"type": "function", "function": {"name": tool_name}},
        )
        try:
            tool_calls = result.data.get("tool_calls") or []
            if not tool_calls:
                raise ValueError("No structured tool call returned")
            arguments = tool_calls[0].get("function", {}).get("arguments") or "{}"
            validated = schema_cls.model_validate(json.loads(arguments))
            result.data["structured"] = validated.model_dump()
            return result
        except (ValueError, json.JSONDecodeError, ValidationError) as exc:
            raise ProviderBadResponse("openrouter", f"Structured validation failed: {str(exc)[:150]}")
