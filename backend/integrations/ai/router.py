"""OKKAX Multi-LLM Router with Ordered Fallback and Provenance Contract."""

import logging
import time
from typing import Any, Callable, Dict, List, Optional, Type
from pydantic import BaseModel

from ..base import ProviderResult, current_iso
from ..config import settings
from ..exceptions import ProviderError, ProviderNotConfigured
from ..registry import registry
from .anthropic_provider import AnthropicProvider
from .base import BaseLLMProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


class LLMRouter:
    """Orchestrates multi-model execution with automatic fallback and provenance tracking."""

    def __init__(
        self,
        primary: Optional[str] = None,
        fallback_list: Optional[List[str]] = None,
    ):
        self.primary_name = primary or settings.AI_PRIMARY
        self.fallback_names = fallback_list if fallback_list is not None else settings.AI_FALLBACK

        # Instantiate providers
        self.providers: Dict[str, BaseLLMProvider] = {
            "gemini": GeminiProvider(),
            "openai": OpenAIProvider(),
            "anthropic": AnthropicProvider(),
        }

        # Register in central registry
        for p in self.providers.values():
            registry.register(p)

    def get_execution_chain(self, requested_engine: Optional[str] = None) -> List[BaseLLMProvider]:
        """Build the ordered list of providers to try."""
        chain = []
        # If user explicitly requested an engine / provider
        if requested_engine:
            req_lower = requested_engine.lower()
            for name, prov in self.providers.items():
                if name in req_lower or req_lower in prov.default_model:
                    chain.append(prov)
                    break

        # Add primary provider
        primary_prov = self.providers.get(self.primary_name)
        if primary_prov and primary_prov not in chain:
            chain.append(primary_prov)

        # Add fallback providers
        for fb_name in self.fallback_names:
            prov = self.providers.get(fb_name)
            if prov and prov not in chain:
                chain.append(prov)

        return chain

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        preferred_engine: Optional[str] = None,
        fallback_deterministic_fn: Optional[Callable[[], str]] = None,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        """Execute text generation through the fallback chain."""
        chain = self.get_execution_chain(preferred_engine)
        errors = []

        start_time = time.time()
        for idx, provider in enumerate(chain):
            if not provider.enabled or not provider.is_configured():
                continue

            try:
                res = await provider.generate_text(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    timeout_seconds=timeout_seconds,
                )
                registry.record_call(provider.name, res)
                if res.provenance:
                    res.provenance["fallback_used"] = idx > 0
                return res
            except Exception as e:
                err_msg = f"{provider.name}: {type(e).__name__} ({str(e)[:100]})"
                errors.append(err_msg)
                logger.warning(f"AI Router: Provider '{provider.name}' failed: {err_msg}. Trying next in chain.")
                registry.record_call(provider.name, ProviderResult.failure(provider.name, "EXEC_FAILED", err_msg))

        # All LLM providers failed or unconfigured -> use deterministic fallback
        latency = (time.time() - start_time) * 1000
        fallback_text = fallback_deterministic_fn() if fallback_deterministic_fn else "Hasil analisis deterministik OKKAX."
        return ProviderResult.success(
            provider="deterministic_engine",
            data={"text": fallback_text, "model": "rule_based_fallback"},
            latency_ms=latency,
            provenance={
                "provider": "deterministic_engine",
                "model": "rule_based_fallback",
                "generated_at": current_iso(),
                "schema_valid": True,
                "fallback_used": True,
                "confidence": 0.85,
                "errors_encountered": errors,
            },
        )

    async def generate_structured(
        self,
        prompt: str,
        schema_cls: Type[BaseModel],
        system_instruction: Optional[str] = None,
        preferred_engine: Optional[str] = None,
        fallback_deterministic_fn: Optional[Callable[[], BaseModel]] = None,
        timeout_seconds: float = 30.0,
    ) -> ProviderResult:
        """Execute structured output generation through the fallback chain."""
        chain = self.get_execution_chain(preferred_engine)
        errors = []

        start_time = time.time()
        for idx, provider in enumerate(chain):
            if not provider.enabled or not provider.is_configured():
                continue

            try:
                res = await provider.generate_structured(
                    prompt=prompt,
                    schema_cls=schema_cls,
                    system_instruction=system_instruction,
                    timeout_seconds=timeout_seconds,
                )
                registry.record_call(provider.name, res)
                if res.provenance:
                    res.provenance["fallback_used"] = idx > 0
                return res
            except Exception as e:
                err_msg = f"{provider.name}: {type(e).__name__} ({str(e)[:100]})"
                errors.append(err_msg)
                logger.warning(f"AI Router: Provider '{provider.name}' structured call failed: {err_msg}. Trying next.")
                registry.record_call(provider.name, ProviderResult.failure(provider.name, "EXEC_FAILED", err_msg))

        # Fallback to deterministic function
        latency = (time.time() - start_time) * 1000
        fallback_obj = fallback_deterministic_fn() if fallback_deterministic_fn else schema_cls.model_validate({})
        return ProviderResult.success(
            provider="deterministic_engine",
            data={"structured": fallback_obj.model_dump() if hasattr(fallback_obj, "model_dump") else fallback_obj},
            latency_ms=latency,
            provenance={
                "provider": "deterministic_engine",
                "model": "rule_based_fallback",
                "generated_at": current_iso(),
                "schema_valid": True,
                "fallback_used": True,
                "confidence": 0.85,
                "errors_encountered": errors,
            },
        )


# Global AI Router singleton
ai_router = LLMRouter()
