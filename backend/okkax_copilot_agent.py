"""OKKAX Copilot — Shadow Orchestration Agent (real pydantic-ai-slim 2.33.0).

SHADOW MODE — this module is NOT wired to ``/okkax/chat``.
The production pipeline in ``okkax_copilot.py`` remains AUTHORITATIVE and
unchanged.

Architecture
------------
This module instantiates a real ``pydantic_ai.Agent[OkkaxSessionContext,
OkkaxCopilotResponse]`` wired with typed, RBAC-gated tools from
``okkax_copilot_tools.py``.  It serves as the testable shadow execution
substrate:

  1. All tool schemas use the real ``prepare=`` mechanism — unauthorized tool
     schemas are NEVER sent to the LLM.
  2. Structured output uses ``OkkaxCopilotResponse`` from ``okkax_copilot_models.py``.
  3. In tests ``TestModel`` (no provider calls) verifies tool routing,
     entitlement, and type correctness.
  4. No production provider is wired here.  Model is injected — never hardcoded.

DO NOT wire ``okkax_shadow_agent.run()`` to ``/okkax/chat``.  The shadow layer
remains isolated from the production semantic router.

Provider / Model policy
-----------------------
``OkkaxAgentConfig`` resolves the model from the environment or via injection.
No model name string is hardcoded in this module.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

from pydantic import ValidationError
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model

from okkax_copilot_context import (
    CopilotSurface,
    OkkaxSessionContext,
    make_authenticated_context,
    make_guest_context,
)
from okkax_copilot_models import OkkaxCopilotResponse
from okkax_copilot_tools import (
    _prepare_authenticated,
    _prepare_private_event,
    _prepare_public,
    calculate_event_budget_tool,
    calculate_workforce_ratios_tool,
    get_event_compliance_readiness_tool,
    get_event_financial_status_tool,
    get_event_operational_blockers_tool,
    get_event_ticketing_health_tool,
    get_my_tickets_summary_tool,
    get_private_event_summary_tool,
    get_public_calendar_events_tool,
    get_public_event_catalog_tool,
    get_public_platform_context_tool,
    search_network_supply_tool,
)

logger = logging.getLogger("okkax.copilot.agent")


# ---------------------------------------------------------------------------
# Agent configuration — no hardcoded provider / model strings
# ---------------------------------------------------------------------------

@dataclass
class OkkaxAgentConfig:
    """Injected model configuration for the shadow agent.

    Model identity is read from environment variables or explicit injection.
    There is NO hardcoded provider or model string in this class.

    Attributes
    ----------
    model:       A pydantic_ai.models.Model instance or KnownModelName str.
                 When None, defaults to resolving from env vars.
    max_retries: Maximum output-validation retries (passed to Agent).
    """
    model: Optional[Any] = None
    max_retries: int = 2

    def resolve_model(self, engine_pref: Optional[str] = None) -> Any:
        """Return a Model or model-name string without hardcoding any model.

        Priority: explicit engine_pref > self.model > env > existing constants.
        """
        if engine_pref and str(engine_pref).strip():
            return engine_pref.strip()
        if self.model is not None:
            return self.model
        env_model = os.environ.get("OKKAX_CHATGPT_MODEL")
        if env_model and env_model.strip():
            return env_model.strip()
        # Fallback: read from existing provider constants — never hardcode here
        try:
            from integrations.ai.chatgpt_provider import DEFAULT_CHATGPT_MODEL  # noqa: PLC0415
            return DEFAULT_CHATGPT_MODEL
        except ImportError:
            return "test"  # safe sentinel for test environments


# ---------------------------------------------------------------------------
# Shadow Agent factory
# ---------------------------------------------------------------------------

def build_shadow_agent(
    model: Any,
    system_prompt: str = "",
) -> Agent[OkkaxSessionContext, OkkaxCopilotResponse]:
    """Build a real pydantic_ai Agent with the 12 canonical OKKAX read tools.

    Args:
        model:         Mandatory ``pydantic_ai.models.Model`` instance or a
                       model-name string. Must be provided explicitly.
                       ``TestModel`` is allowed only in test suites.
        system_prompt: Optional system-prompt string injected into the agent.

    Returns:
        A configured ``Agent[OkkaxSessionContext, OkkaxCopilotResponse]``.
        DO NOT pass this agent to ``/okkax/chat``; it is a shadow/test substrate.
    """
    if model is None:
        raise ValueError(
            "model argument is mandatory for build_shadow_agent. "
            "Pass an explicit Model instance or model name string (TestModel is for tests only)."
        )

    agent: Agent[OkkaxSessionContext, OkkaxCopilotResponse] = Agent(
        model=model,
        deps_type=OkkaxSessionContext,
        output_type=OkkaxCopilotResponse,
        system_prompt=system_prompt or (
            "Kamu adalah OKKAX Copilot — asisten domain live event Indonesia. "
            "Jawab selalu dalam Bahasa Indonesia. Jangan pernah membocorkan data internal. "
            "Gunakan tool yang tersedia untuk memberikan fakta aktual."
        ),
        retries=2,
        name="okkax_shadow_copilot",
    )

    # -----------------------------------------------------------------------
    # Register 12 Canonical Read Tools with real prepare= dynamic entitlement
    # -----------------------------------------------------------------------

    # ---- 1. PUBLIC_READ: calculate_event_budget ----
    @agent.tool(prepare=_prepare_public)
    def calculate_event_budget(
        ctx: RunContext[OkkaxSessionContext],
        budget: int = 1_000_000_000,
        capacity: int = 5_000,
        event_type: str = "Konser Musik",
    ) -> str:
        """Hitung alokasi anggaran event secara deterministik."""
        safe_budget = budget if budget > 0 else 1_000_000_000
        safe_capacity = capacity if capacity > 0 else 5_000
        result = calculate_event_budget_tool(
            ctx,
            budget=safe_budget,
            capacity=safe_capacity,
            event_type=event_type or "Konser Musik",
        )
        return result.model_dump_json()

    # ---- 2. PUBLIC_READ: calculate_workforce_ratios ----
    @agent.tool(prepare=_prepare_public)
    def calculate_workforce_ratios(
        ctx: RunContext[OkkaxSessionContext],
        capacity: int = 1_000,
    ) -> str:
        """Hitung kebutuhan workforce (Usher, Security, Medis, Sound Watt RMS)."""
        safe_capacity = capacity if capacity > 0 else 1_000
        result = calculate_workforce_ratios_tool(ctx, capacity=safe_capacity)
        return result.model_dump_json()

    # ---- 3. PUBLIC_READ: get_public_platform_context ----
    @agent.tool(prepare=_prepare_public)
    async def get_public_platform_context(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Ambil ringkasan real-time platform OKKAX: jumlah event, venue, artis, vendor."""
        result = await get_public_platform_context_tool(ctx)
        return result.model_dump_json()

    # ---- 4. PUBLIC_READ: get_public_calendar_events ----
    @agent.tool(prepare=_prepare_public)
    async def get_public_calendar_events(
        ctx: RunContext[OkkaxSessionContext],
        city: str = "",
        date_from: str = "",
        date_to: str = "",
        category: str = "",
    ) -> str:
        """Ambil jadwal dan entri kalender event publik OKKAX."""
        result = await get_public_calendar_events_tool(
            ctx,
            city=city or None,
            date_from=date_from or None,
            date_to=date_to or None,
            category=category or None,
        )
        return result.model_dump_json()

    # ---- 5. PUBLIC_READ: get_public_event_catalog ----
    @agent.tool(prepare=_prepare_public)
    async def get_public_event_catalog(
        ctx: RunContext[OkkaxSessionContext],
        city: str = "",
        category: str = "",
        limit: int = 10,
    ) -> str:
        """Cari event publik yang terbit di platform OKKAX berdasarkan kota dan kategori."""
        result = await get_public_event_catalog_tool(
            ctx,
            city=city or None,
            category=category or None,
            limit=limit or 10,
        )
        return result.model_dump_json()

    # ---- 6. PUBLIC_READ: search_network_supply ----
    @agent.tool(prepare=_prepare_public)
    async def search_network_supply(
        ctx: RunContext[OkkaxSessionContext],
        kind: str = "talent",
        city: str = "",
        keyword: str = "",
        limit: int = 10,
    ) -> str:
        """Cari talent, venue, vendor, atau workforce di jaringan OKKAX."""
        result = await search_network_supply_tool(
            ctx,
            kind=kind or "talent",
            city=city or None,
            keyword=keyword or None,
            limit=limit or 10,
        )
        return result.model_dump_json()

    # ---- 7. AUTH_READ: get_my_tickets_summary ----
    @agent.tool(prepare=_prepare_authenticated)
    async def get_my_tickets_summary(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Ambil ringkasan portofolio tiket milik akun yang sedang login."""
        result = await get_my_tickets_summary_tool(ctx)
        return result.model_dump_json()

    # ---- 8. EVENT_CONTEXT_READ: get_private_event_summary ----
    @agent.tool(prepare=_prepare_private_event)
    def get_private_event_summary(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Baca ringkasan operasional event lengkap yang sudah diverifikasi server."""
        result = get_private_event_summary_tool(ctx)
        return result.model_dump_json()

    # ---- 9. EVENT_CONTEXT_READ: get_event_financial_status ----
    @agent.tool(prepare=_prepare_private_event)
    async def get_event_financial_status(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Ambil rincian biaya, pendanaan terkonfirmasi, dan funding gap event."""
        result = await get_event_financial_status_tool(ctx)
        return result.model_dump_json()

    # ---- 10. EVENT_CONTEXT_READ: get_event_ticketing_health ----
    @agent.tool(prepare=_prepare_private_event)
    async def get_event_ticketing_health(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Ambil status penjualan tiket event, kapasitas, GMV, dan sell-through rate."""
        result = await get_event_ticketing_health_tool(ctx)
        return result.model_dump_json()

    # ---- 11. EVENT_CONTEXT_READ: get_event_compliance_readiness ----
    @agent.tool(prepare=_prepare_private_event)
    async def get_event_compliance_readiness(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Ambil status kelayakan perizinan legal dan compliance event."""
        result = await get_event_compliance_readiness_tool(ctx)
        return result.model_dump_json()

    # ---- 12. EVENT_CONTEXT_READ: get_event_operational_blockers ----
    @agent.tool(prepare=_prepare_private_event)
    async def get_event_operational_blockers(
        ctx: RunContext[OkkaxSessionContext],
    ) -> str:
        """Ambil risiko operasional kritis, insiden terbuka, dan kontrak pending event."""
        result = await get_event_operational_blockers_tool(ctx)
        return result.model_dump_json()

    return agent


# ---------------------------------------------------------------------------
# Validation helper — validate production responses against typed contract
# ---------------------------------------------------------------------------

def validate_copilot_response(
    raw_response: Dict[str, Any],
) -> tuple[bool, Optional[OkkaxCopilotResponse], Optional[ValidationError]]:
    """Validate a dict from ``ask_okkax_copilot()`` against the typed contract.

    Returns:
        (valid, response, error)  — ``response`` is None on failure,
        ``error`` is None on success.
    """
    try:
        validated = OkkaxCopilotResponse.from_dict(raw_response)
        return True, validated, None
    except ValidationError as exc:
        logger.warning("validate_copilot_response failed: %s", exc)
        return False, None, exc


# ---------------------------------------------------------------------------
# Context factories (convenience wrappers, delegate to okkax_copilot_context)
# ---------------------------------------------------------------------------

def build_guest_context(
    current_route: str = "/",
    surface_str: str = "homepage",
    calculator_policy: Optional[Dict[str, Any]] = None,
    db: Any = None,
) -> OkkaxSessionContext:
    """Build a guest OkkaxSessionContext for public queries."""
    try:
        surface = CopilotSurface(surface_str.lower())
    except ValueError:
        surface = CopilotSurface.CHATBOT
    return make_guest_context(
        current_route=current_route,
        surface=surface,
        calculator_policy=calculator_policy,
        db=db,
    )


def build_authenticated_context(
    user: Dict[str, Any],
    raw_role: str,
    surface_str: str = "workspace",
    current_route: str = "",
    event_id: Optional[str] = None,
    event_snapshot: Optional[Dict[str, Any]] = None,
    calculator_policy: Optional[Dict[str, Any]] = None,
    reasoning_mode: str = "advanced",
    db: Any = None,
) -> OkkaxSessionContext:
    """Build an authenticated OkkaxSessionContext from server-verified JWT payload."""
    try:
        surface = CopilotSurface(surface_str.lower())
    except ValueError:
        surface = CopilotSurface.CHATBOT
    return make_authenticated_context(
        user=user,
        raw_role=raw_role,
        surface=surface,
        current_route=current_route,
        event_id=event_id,
        event_snapshot=event_snapshot,
        calculator_policy=calculator_policy,
        reasoning_mode=reasoning_mode,
        db=db,
    )
