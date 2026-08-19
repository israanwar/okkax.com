"""Unit and failure matrix tests for OKKAX Multi-LLM Router and AI Providers."""

import asyncio
import json
from pathlib import Path
import sys
import pytest
from pydantic import BaseModel, Field

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from integrations.ai.base import BaseLLMProvider
from integrations.ai.gemini_provider import GeminiProvider
from integrations.ai.openai_provider import OpenAIProvider
from integrations.ai.anthropic_provider import AnthropicProvider
from integrations.ai.router import LLMRouter
from integrations.base import ProviderResult
from integrations.exceptions import (
    ProviderBadResponse,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
)


class MockEventAnalysis(BaseModel):
    summary: str = Field(default="Ringkasan event")
    target_capacity: int = Field(default=1000)
    risk_level: str = Field(default="Medium")


class MockFailingProvider(BaseLLMProvider):
    def __init__(self, name: str, fail_mode: str = "timeout"):
        super().__init__(name=name, default_model=f"{name}-mock", enabled=True)
        self.fail_mode = fail_mode

    def is_configured(self) -> bool:
        return True

    async def health_check(self) -> ProviderResult:
        return ProviderResult.failure(self.name, "MOCK_FAIL", "Failed")

    async def generate_text(self, prompt: str, **kwargs) -> ProviderResult:
        if self.fail_mode == "timeout":
            raise ProviderTimeout(self.name, 5.0)
        elif self.fail_mode == "rate_limit":
            raise ProviderRateLimited(self.name, retry_after=0.01)
        elif self.fail_mode == "bad_json":
            return ProviderResult.success(self.name, {"text": "NOT_JSON_AT_ALL!!!"})
        elif self.fail_mode == "500":
            raise ProviderBadResponse(self.name, "Server error 500")
        raise ProviderBadResponse(self.name, "Generic error")

    async def generate_structured(self, prompt: str, schema_cls, **kwargs) -> ProviderResult:
        if self.fail_mode == "bad_json":
            raise ProviderBadResponse(self.name, "Malformed JSON")
        return await self.generate_text(prompt, **kwargs)


class MockSuccessProvider(BaseLLMProvider):
    def __init__(self, name: str):
        super().__init__(name=name, default_model=f"{name}-mock", enabled=True)

    def is_configured(self) -> bool:
        return True

    async def health_check(self) -> ProviderResult:
        return ProviderResult.success(self.name, {"status": "ok"})

    async def generate_text(self, prompt: str, **kwargs) -> ProviderResult:
        return ProviderResult.success(
            self.name,
            {"text": "Sukses analisis event AI.", "model": self.default_model},
            provenance={"provider": self.name, "model": self.default_model, "confidence": 0.95},
        )

    async def generate_structured(self, prompt: str, schema_cls, **kwargs) -> ProviderResult:
        mock_obj = MockEventAnalysis(summary="Konser Musik Jakarta", target_capacity=5000, risk_level="Low")
        return ProviderResult.success(
            self.name,
            {"structured": mock_obj.model_dump(), "model": self.default_model},
            provenance={"provider": self.name, "model": self.default_model, "confidence": 0.95},
        )


class TestAIRouterFailureMatrix:
    def test_a1_ai_disabled_returns_deterministic_fallback(self):
        async def _test():
            router = LLMRouter(primary="gemini", fallback_list=["openai", "anthropic"])
            for p in router.providers.values():
                p.enabled = False

            res = await router.generate_text(
                prompt="Brief konser",
                fallback_deterministic_fn=lambda: "Deterministic Brief Result",
            )
            assert res.ok is True
            assert res.provider == "deterministic_engine"
            assert res.data["text"] == "Deterministic Brief Result"
            assert res.provenance["fallback_used"] is True

        asyncio.run(_test())

    def test_a2_unconfigured_credentials_returns_fallback_cleanly(self):
        async def _test():
            router = LLMRouter()
            # Providers enabled but unconfigured
            for p in router.providers.values():
                p.enabled = True
                p.api_key = ""  # Not configured

            res = await router.generate_structured(
                prompt="Generate analysis",
                schema_cls=MockEventAnalysis,
                fallback_deterministic_fn=lambda: MockEventAnalysis(summary="Default Fallback", target_capacity=2000),
            )
            assert res.ok is True
            assert res.provider == "deterministic_engine"
            assert res.data["structured"]["summary"] == "Default Fallback"
            assert res.provenance["fallback_used"] is True

        asyncio.run(_test())

    def test_a3_valid_structured_mock_success(self):
        async def _test():
            router = LLMRouter()
            router.providers["gemini"] = MockSuccessProvider("gemini")

            res = await router.generate_structured(
                prompt="Analisis konser",
                schema_cls=MockEventAnalysis,
            )
            assert res.ok is True
            assert res.provider == "gemini"
            assert res.data["structured"]["summary"] == "Konser Musik Jakarta"
            assert res.data["structured"]["target_capacity"] == 5000
            assert res.provenance["fallback_used"] is False

        asyncio.run(_test())

    def test_a4_malformed_json_triggers_fallback(self):
        async def _test():
            router = LLMRouter(primary="gemini", fallback_list=["openai"])
            router.providers["gemini"] = MockFailingProvider("gemini", fail_mode="bad_json")
            router.providers["openai"] = MockSuccessProvider("openai")

            res = await router.generate_structured(
                prompt="Analisis",
                schema_cls=MockEventAnalysis,
            )
            assert res.ok is True
            assert res.provider == "openai"  # Fell back to openai
            assert res.provenance["fallback_used"] is True

        asyncio.run(_test())

    def test_a5_timeout_triggers_next_provider(self):
        async def _test():
            router = LLMRouter(primary="gemini", fallback_list=["anthropic"])
            router.providers["gemini"] = MockFailingProvider("gemini", fail_mode="timeout")
            router.providers["anthropic"] = MockSuccessProvider("anthropic")

            res = await router.generate_text(prompt="Analisis")
            assert res.ok is True
            assert res.provider == "anthropic"
            assert res.provenance["fallback_used"] is True

        asyncio.run(_test())

    def test_a6_rate_limit_429_triggers_next_provider(self):
        async def _test():
            router = LLMRouter(primary="gemini", fallback_list=["openai"])
            router.providers["gemini"] = MockFailingProvider("gemini", fail_mode="rate_limit")
            router.providers["openai"] = MockSuccessProvider("openai")

            res = await router.generate_text(prompt="Analisis")
            assert res.ok is True
            assert res.provider == "openai"
            assert res.provenance["fallback_used"] is True

        asyncio.run(_test())

    def test_a7_all_providers_fail_returns_deterministic_engine(self):
        async def _test():
            router = LLMRouter(primary="gemini", fallback_list=["openai", "anthropic"])
            router.providers["gemini"] = MockFailingProvider("gemini", fail_mode="timeout")
            router.providers["openai"] = MockFailingProvider("openai", fail_mode="rate_limit")
            router.providers["anthropic"] = MockFailingProvider("anthropic", fail_mode="500")

            res = await router.generate_text(
                prompt="Analisis",
                fallback_deterministic_fn=lambda: "Reliable Baseline",
            )
            assert res.ok is True
            assert res.provider == "deterministic_engine"
            assert res.data["text"] == "Reliable Baseline"
            assert res.provenance["fallback_used"] is True
            assert len(res.provenance["errors_encountered"]) == 3

        asyncio.run(_test())

    def test_a8_provenance_schema_compliance(self):
        async def _test():
            router = LLMRouter()
            router.providers["gemini"] = MockSuccessProvider("gemini")

            res = await router.generate_text(prompt="Halo")
            prov = res.provenance
            assert "provider" in prov
            assert "model" in prov
            assert "confidence" in prov
            assert "fallback_used" in prov

        asyncio.run(_test())

    def test_a9_compiler_domain_deterministic_fallback(self):
        async def _test():
            from compiler import compile_blueprint
            brief = {
                "event_id": "evt-live-fest-2026",
                "title": "Festival Musik Nusantara",
                "city": "Bandung",
                "expected_attendance": 10000,
                "budget_idr": 750000000,
                "genre": "Pop / Indie",
            }
            # When external providers are unconfigured or down, compile_blueprint must return valid blueprint
            bp = await compile_blueprint(brief, engine="gemini-2.5-flash")
            assert bp is not None
            assert "budget_categories" in bp
            assert "funding_model" in bp
            assert "risks" in bp
            assert bp["source"] in ("rule_based_fallback", "gemini-2.5-flash")

        asyncio.run(_test())
