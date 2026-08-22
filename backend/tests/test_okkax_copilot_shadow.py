"""OKKAX Copilot — Canonical Read Tool Catalog & Hardened Substrate Test Suite.

Combines:
  1. Complete restored Substrate-01 test suite (Context invariants, Response contract,
     Real Pydantic AI primitives, Mathematical determinism, Zero formula duplication).
  2. Canonical 12-Tool Catalog & Dynamic Entitlement Matrix.
  3. Strict Tenant & Object Authorization Negative Tests.
  4. Provenance Semantics (FACT, CALCULATED, ESTIMATE, UNAVAILABLE).
  5. Safe Missing-Data & Fallback Behavior.
"""

from __future__ import annotations

import asyncio
import importlib
import json
import os
import py_compile
import re
from pathlib import Path
from typing import Any, Dict, List

import pytest
from pydantic import ValidationError

BACKEND_DIR = Path(__file__).resolve().parents[1]


# ===========================================================================
# SECTION 1 — Compilation & Syntax Integrity
# ===========================================================================

@pytest.mark.parametrize("module_file", [
    "okkax_copilot_context.py",
    "okkax_copilot_models.py",
    "okkax_copilot_tools.py",
    "okkax_copilot_agent.py",
])
def test_py_compile(module_file: str):
    """All shadow modules must pass bytecode compilation with zero errors."""
    target = BACKEND_DIR / module_file
    assert target.exists(), f"Missing file: {target}"
    compiled = py_compile.compile(str(target), doraise=True)
    assert compiled is not None


# ===========================================================================
# SECTION 2 — Real Pydantic AI Primitives
# ===========================================================================

class TestRealPydanticAIPrimitives:

    def test_run_context_is_real_pydantic_ai(self):
        from okkax_copilot_context import RunContext
        import pydantic_ai._run_context as _rc
        assert RunContext is _rc.RunContext

    def test_agent_is_real_pydantic_ai(self):
        from pydantic_ai import Agent
        from pydantic_ai.models.test import TestModel
        from okkax_copilot_agent import build_shadow_agent
        agent = build_shadow_agent(model=TestModel())
        assert isinstance(agent, Agent)

    def test_agent_deps_type_is_okkax_session_context(self):
        from pydantic_ai.models.test import TestModel
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_context import OkkaxSessionContext
        agent = build_shadow_agent(model=TestModel())
        assert agent._deps_type is OkkaxSessionContext

    def test_agent_output_type_is_okkax_copilot_response(self):
        from pydantic_ai.models.test import TestModel
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_models import OkkaxCopilotResponse
        agent = build_shadow_agent(model=TestModel())
        assert agent._output_type is OkkaxCopilotResponse

    def test_build_shadow_agent_requires_model_explicitly(self):
        from okkax_copilot_agent import build_shadow_agent
        with pytest.raises((TypeError, ValueError)):
            build_shadow_agent()  # type: ignore[call-arg]
        with pytest.raises(ValueError, match="mandatory"):
            build_shadow_agent(model=None)

    def test_prepare_functions_are_real_tool_prepare_funcs(self):
        from okkax_copilot_tools import (
            _prepare_authenticated,
            _prepare_private_event,
            _prepare_public,
        )
        assert asyncio.iscoroutinefunction(_prepare_public)
        assert asyncio.iscoroutinefunction(_prepare_authenticated)
        assert asyncio.iscoroutinefunction(_prepare_private_event)

    def test_mock_run_context_class_is_gone(self):
        from pydantic_ai import RunContext
        from okkax_copilot_context import RunContext as ExportedRunContext
        assert ExportedRunContext is RunContext

    def test_mock_copilot_tool_class_is_gone(self):
        import okkax_copilot_tools as tools_mod
        assert not hasattr(tools_mod, "CopilotTool")

    def test_mock_shadow_copilot_agent_is_gone(self):
        import okkax_copilot_agent as agent_mod
        assert not hasattr(agent_mod, "ShadowCopilotAgent")

    def test_mock_all_tools_list_is_gone(self):
        import okkax_copilot_tools as tools_mod
        assert not hasattr(tools_mod, "ALL_COPILOT_TOOLS")

    def test_get_available_tools_mock_is_gone(self):
        import okkax_copilot_tools as tools_mod
        assert not hasattr(tools_mod, "get_available_tools")

    def test_pydantic_ai_slim_is_installed(self):
        import importlib.metadata as meta
        assert meta.version("pydantic-ai-slim") == "2.33.0"


# ===========================================================================
# SECTION 3 — Context Invariants & Server Ownership
# ===========================================================================

class TestContextInvariants:

    def test_guest_context_defaults(self):
        from okkax_copilot_context import (
            CopilotRole,
            CopilotSurface,
            make_guest_context,
        )
        ctx = make_guest_context(surface=CopilotSurface.HOMEPAGE)
        assert ctx.role == CopilotRole.GUEST
        assert ctx.is_authenticated is False
        assert ctx.user_id is None
        assert ctx.can_access_private_event is False
        assert ctx.public_tools_only is True

    def test_authenticated_organizer_context(self):
        from okkax_copilot_context import (
            CopilotRole,
            CopilotSurface,
            make_authenticated_context,
        )
        snap = {"available": True, "event": {"id": "evt-1", "name": "Jazz Night"}}
        ctx = make_authenticated_context(
            user={"id": "usr-1", "email": "org@okkax.id", "plan": "pro"},
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-1",
            event_snapshot=snap,
        )
        assert ctx.role == CopilotRole.ORGANIZER
        assert ctx.is_authenticated is True
        assert ctx.user_id == "usr-1"
        assert ctx.can_access_private_event is True
        assert ctx.public_tools_only is False

    def test_audience_cannot_access_private_event(self):
        from okkax_copilot_context import (
            CopilotRole,
            CopilotSurface,
            make_authenticated_context,
        )
        snap = {"available": True, "event": {"id": "evt-1"}}
        ctx = make_authenticated_context(
            user={"id": "usr-2", "email": "aud@okkax.id"},
            raw_role="audience",
            surface=CopilotSurface.CHATBOT,
            event_id="evt-1",
            event_snapshot=snap,
        )
        assert ctx.role == CopilotRole.AUDIENCE
        assert ctx.is_authenticated is True
        assert ctx.can_access_private_event is False

    def test_context_is_frozen(self):
        from okkax_copilot_context import CopilotSurface, make_guest_context
        ctx = make_guest_context(surface=CopilotSurface.HOMEPAGE)
        with pytest.raises((AttributeError, TypeError, Exception)):
            ctx.is_authenticated = True  # type: ignore[misc]

    def test_unknown_role_coerces_to_guest(self):
        from okkax_copilot_context import (
            CopilotRole,
            CopilotSurface,
            make_authenticated_context,
        )
        ctx = make_authenticated_context(
            user={"id": "usr-3"},
            raw_role="hacker_role",
            surface=CopilotSurface.CHATBOT,
        )
        assert ctx.role == CopilotRole.GUEST

    def test_event_snapshot_none_blocks_private_access(self):
        from okkax_copilot_context import (
            CopilotRole,
            CopilotSurface,
            make_authenticated_context,
        )
        ctx = make_authenticated_context(
            user={"id": "usr-4"},
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-2",
            event_snapshot=None,
        )
        assert ctx.can_access_private_event is False


# ===========================================================================
# SECTION 4 — Tenant & Object Authorization Matrix
# ===========================================================================

class TestTenantAuthorizationMatrix:

    def test_organizer_same_org_access_granted(self):
        """Organizer A + Event A (org_01 == org_01) -> PASS."""
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-01", "name": "Fest A", "organizer_org_id": "org_01"},
        }
        user = {"id": "usr-1", "email": "org@okkax.id", "org_id": "org_01"}
        ctx = make_authenticated_context(
            user=user,
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-01",
            event_snapshot=snap,
            organization_id="org_01",
        )
        assert ctx.can_access_private_event is True

    def test_organizer_different_org_access_denied(self):
        """Organizer A + Event B (org_01 != org_02) -> DENIED."""
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-02", "name": "Fest B", "organizer_org_id": "org_02"},
        }
        user = {"id": "usr-1", "email": "org@okkax.id", "org_id": "org_01"}
        ctx = make_authenticated_context(
            user=user,
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-02",
            event_snapshot=snap,
            organization_id="org_01",  # Active org is org_01, but event belongs to org_02
        )
        assert ctx.can_access_private_event is False

    def test_event_owner_direct_access_granted(self):
        """Event owner (owner_user_id == user.id) -> PASS."""
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-03", "name": "Solo Fest", "owner_user_id": "usr-owner-99"},
        }
        user = {"id": "usr-owner-99", "email": "owner@okkax.id"}
        ctx = make_authenticated_context(
            user=user,
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-03",
            event_snapshot=snap,
        )
        assert ctx.can_access_private_event is True

    def test_admin_superadmin_always_granted(self):
        """Admin / Superadmin always bypasses workspace scope."""
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-04", "organizer_org_id": "org_secret"},
        }
        admin_user = {"id": "admin-1", "email": "admin@okkax.id"}
        ctx = make_authenticated_context(
            user=admin_user,
            raw_role="admin",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-04",
            event_snapshot=snap,
            organization_id="org_different",
        )
        assert ctx.can_access_private_event is True

    def test_unrelated_authenticated_member_denied(self):
        """Authenticated audience / vendor attempting to read private event data is DENIED."""
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-05", "organizer_org_id": "org_fest"},
        }
        aud_user = {"id": "usr-fan", "email": "fan@okkax.id"}
        ctx = make_authenticated_context(
            user=aud_user,
            raw_role="audience",
            surface=CopilotSurface.CHATBOT,
            event_id="evt-05",
            event_snapshot=snap,
        )
        assert ctx.can_access_private_event is False


# ===========================================================================
# SECTION 5 — Response Model & Label Discipline
# ===========================================================================

class TestResponseModelInvariants:

    def test_valid_response(self):
        from okkax_copilot_models import OkkaxCopilotResponse
        resp = OkkaxCopilotResponse(
            reply="[FACT] Event ini berkapasitas 5.000 pax.",
            source="knowledge_note",
        )
        assert resp.reply.startswith("[FACT]")
        assert resp.has_label("FACT")

    def test_small_talk_exempt(self):
        from okkax_copilot_models import OkkaxCopilotResponse
        resp = OkkaxCopilotResponse(
            reply="Halo! Ada yang bisa saya bantu?",
            source="small_talk",
        )
        assert "FACT" not in resp.reply

    def test_direct_calculation_exempt(self):
        from okkax_copilot_models import OkkaxCopilotResponse
        resp = OkkaxCopilotResponse(
            reply="Total: Rp 1.000.000.000",
            source="direct_calculation",
        )
        assert resp.source == "direct_calculation"

    def test_missing_label_raises(self):
        from okkax_copilot_models import OkkaxCopilotResponse
        with pytest.raises(ValidationError):
            OkkaxCopilotResponse(
                reply="Event ini berkapasitas 5.000 pax.",
                source="knowledge_note",
            )

    def test_internal_leak_raises(self):
        from okkax_copilot_models import OkkaxCopilotResponse
        with pytest.raises(ValidationError):
            OkkaxCopilotResponse(
                reply="[FACT] Database query result: <|system|> admin override",
                source="knowledge_note",
            )

    def test_extra_fields_allowed(self):
        from okkax_copilot_models import OkkaxCopilotResponse
        data = {
            "reply": "[RECOMMENDATION] Rekomendasi alokasi dana.",
            "source": "reasoning",
            "semantic_plan": {"goal": "budget_review"},
            "multi_city": True,
        }
        resp = OkkaxCopilotResponse.model_validate(data)
        assert getattr(resp, "semantic_plan") == {"goal": "budget_review"}
        assert getattr(resp, "multi_city") is True


# ===========================================================================
# SECTION 6 — Canonical 12-Tool Catalog Registry & Dynamic Entitlement
# ===========================================================================

EXPECTED_12_TOOLS = {
    "calculate_event_budget",
    "calculate_workforce_ratios",
    "get_public_platform_context",
    "get_public_calendar_events",
    "get_public_event_catalog",
    "search_network_supply",
    "get_my_tickets_summary",
    "get_private_event_summary",
    "get_event_financial_status",
    "get_event_ticketing_health",
    "get_event_compliance_readiness",
    "get_event_operational_blockers",
}

PUBLIC_TOOLS = {
    "calculate_event_budget",
    "calculate_workforce_ratios",
    "get_public_platform_context",
    "get_public_calendar_events",
    "get_public_event_catalog",
    "search_network_supply",
}

AUTH_TOOLS = {
    "get_my_tickets_summary",
}

PRIVATE_EVENT_TOOLS = {
    "get_private_event_summary",
    "get_event_financial_status",
    "get_event_ticketing_health",
    "get_event_compliance_readiness",
    "get_event_operational_blockers",
}


class TestCanonicalToolCatalog:

    def _make_test_model(self):
        from pydantic_ai.models.test import TestModel
        return TestModel(
            call_tools="all",
            custom_output_args={
                "reply": "[RECOMMENDATION] OKKAX Copilot test.",
                "source": "knowledge_note",
                "engine": "Okkax Copilot",
                "grounded": False,
            },
        )

    def _get_tool_calls(self, result) -> list[str]:
        tool_names = []
        for msg in result.all_messages():
            for part in msg.parts:
                if hasattr(part, "tool_name") and part.tool_name != "final_result":
                    tool_names.append(part.tool_name)
        return tool_names

    def test_exact_12_tools_registered(self):
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_context import CopilotSurface, make_authenticated_context

        snap = {"available": True, "finance": {}, "ticketing": {}, "compliance": {}, "operational": {}}
        org_deps = make_authenticated_context(
            user={"id": "usr-1", "email": "org@okkax.id", "plan": "pro"},
            raw_role="organizer", surface=CopilotSurface.WORKSPACE,
            event_id="evt-001", event_snapshot=snap,
        )
        agent = build_shadow_agent(model=self._make_test_model())
        result = asyncio.run(agent.run("test", deps=org_deps))
        called = set(self._get_tool_calls(result))

        assert called == EXPECTED_12_TOOLS
        assert len(EXPECTED_12_TOOLS) == 12

    def test_no_duplicate_tool_names(self):
        assert len(EXPECTED_12_TOOLS) == len(PUBLIC_TOOLS) + len(AUTH_TOOLS) + len(PRIVATE_EVENT_TOOLS)

    def test_no_write_tools_in_catalog(self):
        for name in EXPECTED_12_TOOLS:
            assert "write" not in name
            assert "delete" not in name
            assert "update" not in name
            assert "create" not in name
            assert "submit" not in name

    def test_guest_sees_only_public_tools(self):
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_context import CopilotSurface, make_guest_context

        guest_deps = make_guest_context(surface=CopilotSurface.HOMEPAGE)
        agent = build_shadow_agent(model=self._make_test_model())
        result = asyncio.run(agent.run("test", deps=guest_deps))
        called = set(self._get_tool_calls(result))

        assert called == PUBLIC_TOOLS
        assert not (called & AUTH_TOOLS)
        assert not (called & PRIVATE_EVENT_TOOLS)

    def test_authenticated_user_without_event_sees_public_and_auth_tools(self):
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_context import CopilotSurface, make_authenticated_context

        user_deps = make_authenticated_context(
            user={"id": "usr-10", "email": "user@okkax.id"},
            raw_role="audience",
            surface=CopilotSurface.HOMEPAGE,
        )
        agent = build_shadow_agent(model=self._make_test_model())
        result = asyncio.run(agent.run("test", deps=user_deps))
        called = set(self._get_tool_calls(result))

        expected = PUBLIC_TOOLS | AUTH_TOOLS
        assert called == expected
        assert not (called & PRIVATE_EVENT_TOOLS)

    def test_audience_with_event_cannot_see_private_tools(self):
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_context import CopilotSurface, make_authenticated_context

        snap = {"available": True, "finance": {}, "ticketing": {}, "compliance": {}}
        aud_deps = make_authenticated_context(
            user={"id": "usr-20", "email": "aud@okkax.id"},
            raw_role="audience",
            surface=CopilotSurface.CHATBOT,
            event_id="evt-001",
            event_snapshot=snap,
        )
        agent = build_shadow_agent(model=self._make_test_model())
        result = asyncio.run(agent.run("test", deps=aud_deps))
        called = set(self._get_tool_calls(result))

        assert not (called & PRIVATE_EVENT_TOOLS)

    def test_organizer_without_snapshot_cannot_see_private_tools(self):
        from okkax_copilot_agent import build_shadow_agent
        from okkax_copilot_context import CopilotSurface, make_authenticated_context

        org_no_snap = make_authenticated_context(
            user={"id": "usr-1", "email": "org@okkax.id"},
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-001",
            event_snapshot=None,
        )
        agent = build_shadow_agent(model=self._make_test_model())
        result = asyncio.run(agent.run("test", deps=org_no_snap))
        called = set(self._get_tool_calls(result))

        assert not (called & PRIVATE_EVENT_TOOLS)


# ===========================================================================
# SECTION 7 — Tool Provenance & Safety Semantics
# ===========================================================================

class TestToolProvenanceAndSafety:

    @staticmethod
    def _get_ctx(deps):
        from pydantic_ai import Agent
        from pydantic_ai.models.test import TestModel
        from okkax_copilot_context import OkkaxSessionContext

        captured = {}
        cap_agent = Agent(model=TestModel(call_tools=["_cap"]), deps_type=OkkaxSessionContext)

        @cap_agent.tool
        def _cap(ctx):
            captured["ctx"] = ctx
            return "ok"

        asyncio.run(cap_agent.run("test", deps=deps))
        return captured["ctx"]

    def _guest_deps(self):
        from okkax_copilot_context import CopilotSurface, make_guest_context
        return make_guest_context(surface=CopilotSurface.HOMEPAGE)

    def _org_deps(self):
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-aruna", "name": "Aruna Fest", "city": "Jakarta", "capacity": 5000},
            "finance": {"total_cost": 1_000_000_000, "confirmed_funding": 800_000_000, "funding_gap": 200_000_000},
            "ticketing": {"sold": 3500, "capacity": 5000, "sell_through_pct": 70.0, "gmv_idr": 1_750_000_000, "tier_count": 3},
            "compliance": {"total": 7, "coverage_status": "ready", "by_status": {"approved": 7}, "blocked_items": []},
            "operational": {"high_severity_risks": 0, "open_incidents": 0, "talent_pending": 0, "vendor_pending": 0},
        }
        return make_authenticated_context(
            user={"id": "usr-1", "email": "org@okkax.id", "plan": "pro"},
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-aruna",
            event_snapshot=snap,
        )

    def test_public_tools_provenance_types(self):
        from okkax_copilot_tools import (
            calculate_event_budget_tool,
            calculate_workforce_ratios_tool,
            get_public_calendar_events_tool,
            get_public_event_catalog_tool,
            get_public_platform_context_tool,
            search_network_supply_tool,
        )
        ctx = self._get_ctx(self._guest_deps())

        r1 = calculate_event_budget_tool(ctx, budget=1_000_000_000, capacity=5_000)
        assert r1.provenance_type == "CALCULATED"
        assert r1.authoritative is True
        assert r1.available is True

        r2 = calculate_workforce_ratios_tool(ctx, capacity=5_000)
        assert r2.provenance_type == "CALCULATED"
        assert r2.authoritative is True

        r3 = asyncio.run(get_public_platform_context_tool(ctx))
        assert r3.provenance_type == "FACT"

        r4 = asyncio.run(get_public_calendar_events_tool(ctx))
        assert r4.provenance_type == "FACT"

        r5 = asyncio.run(get_public_event_catalog_tool(ctx))
        assert r5.provenance_type in ("FACT", "UNAVAILABLE")

        r6 = asyncio.run(search_network_supply_tool(ctx, kind="talent"))
        assert r6.provenance_type in ("FACT", "UNAVAILABLE")

    def test_my_tickets_unauthenticated_returns_unavailable(self):
        from okkax_copilot_tools import get_my_tickets_summary_tool
        ctx = self._get_ctx(self._guest_deps())
        res = asyncio.run(get_my_tickets_summary_tool(ctx))
        assert res.available is False
        assert res.provenance_type == "UNAVAILABLE"
        assert res.error == "unauthenticated"

    def test_private_tools_unauthorized_return_unavailable(self):
        from okkax_copilot_tools import (
            get_event_compliance_readiness_tool,
            get_event_financial_status_tool,
            get_event_operational_blockers_tool,
            get_event_ticketing_health_tool,
            get_private_event_summary_tool,
        )
        ctx = self._get_ctx(self._guest_deps())

        assert get_private_event_summary_tool(ctx).available is False
        assert asyncio.run(get_event_financial_status_tool(ctx)).available is False
        assert asyncio.run(get_event_ticketing_health_tool(ctx)).available is False
        assert asyncio.run(get_event_compliance_readiness_tool(ctx)).available is False
        assert asyncio.run(get_event_operational_blockers_tool(ctx)).available is False

    def test_private_tools_authorized_extraction(self):
        from okkax_copilot_tools import (
            get_event_compliance_readiness_tool,
            get_event_financial_status_tool,
            get_event_operational_blockers_tool,
            get_event_ticketing_health_tool,
            get_private_event_summary_tool,
        )
        ctx = self._get_ctx(self._org_deps())

        r1 = get_private_event_summary_tool(ctx)
        assert r1.available is True
        assert r1.name == "Aruna Fest"
        assert r1.provenance_type == "FACT"

        r2 = asyncio.run(get_event_financial_status_tool(ctx))
        assert r2.available is True
        assert r2.total_cost == 1_000_000_000
        assert r2.funding_gap == 200_000_000
        assert r2.provenance_type == "CALCULATED"

        r3 = asyncio.run(get_event_ticketing_health_tool(ctx))
        assert r3.available is True
        assert r3.sold_tickets == 3500
        assert r3.sell_through_pct == 70.0
        assert r3.provenance_type == "FACT"

        r4 = asyncio.run(get_event_compliance_readiness_tool(ctx))
        assert r4.available is True
        assert r4.coverage_status == "ready"
        assert r4.provenance_type == "CALCULATED"

        r5 = asyncio.run(get_event_operational_blockers_tool(ctx))
        assert r5.available is True
        assert r5.provenance_type == "ESTIMATE"


# ===========================================================================
# SECTION 8 — Mathematical & Financial Deterministic Authority
# ===========================================================================

class TestDeterministicAuthority:

    @staticmethod
    def _get_ctx(deps):
        from pydantic_ai import Agent
        from pydantic_ai.models.test import TestModel
        from okkax_copilot_context import OkkaxSessionContext

        captured = {}
        cap_agent = Agent(model=TestModel(call_tools=["_cap"]), deps_type=OkkaxSessionContext)

        @cap_agent.tool
        def _cap(ctx):
            captured["ctx"] = ctx
            return "ok"

        asyncio.run(cap_agent.run("test", deps=deps))
        return captured["ctx"]

    def _guest_deps(self):
        from okkax_copilot_context import CopilotSurface, make_guest_context
        return make_guest_context(surface=CopilotSurface.HOMEPAGE)

    def test_budget_calculation_is_deterministic(self):
        from okkax_copilot_tools import calculate_event_budget_tool
        ctx = self._get_ctx(self._guest_deps())
        r1 = calculate_event_budget_tool(ctx, budget=1_000_000_000, capacity=5_000)
        r2 = calculate_event_budget_tool(ctx, budget=1_000_000_000, capacity=5_000)
        assert r1.model_dump() == r2.model_dump()

    def test_budget_breakdown_sum_equals_budget(self):
        from okkax_copilot_tools import calculate_event_budget_tool
        ctx = self._get_ctx(self._guest_deps())
        budget = 2_000_000_000
        result = calculate_event_budget_tool(ctx, budget=budget, capacity=10_000)
        total = sum(v["amount"] for v in result.breakdown.values())
        assert total == budget

    def test_talent_allocation_28_percent(self):
        from okkax_copilot_tools import calculate_event_budget_tool
        ctx = self._get_ctx(self._guest_deps())
        budget = 1_000_000_000
        result = calculate_event_budget_tool(ctx, budget=budget, capacity=5_000)
        expected = int(budget * 0.28)
        actual = result.breakdown["Talent & Rider"]["amount"]
        assert actual == expected

    def test_workforce_ushers_1_per_80(self):
        from okkax_copilot_tools import calculate_workforce_ratios_tool
        ctx = self._get_ctx(self._guest_deps())
        result = calculate_workforce_ratios_tool(ctx, capacity=8_000)
        assert result.ushers == 8_000 // 80

    def test_security_1_per_100(self):
        from okkax_copilot_tools import calculate_workforce_ratios_tool
        ctx = self._get_ctx(self._guest_deps())
        result = calculate_workforce_ratios_tool(ctx, capacity=10_000)
        assert result.security == 10_000 // 100

    def test_sound_floor_10000_watt(self):
        from okkax_copilot_tools import calculate_workforce_ratios_tool
        ctx = self._get_ctx(self._guest_deps())
        result = calculate_workforce_ratios_tool(ctx, capacity=100)
        assert result.sound_watt_rms >= 10_000

    def test_negative_budget_raises(self):
        from okkax_copilot_tools import calculate_event_budget_tool
        ctx = self._get_ctx(self._guest_deps())
        with pytest.raises(ValueError, match="budget must be > 0"):
            calculate_event_budget_tool(ctx, budget=-1, capacity=1_000)

    def test_zero_capacity_raises(self):
        from okkax_copilot_tools import calculate_workforce_ratios_tool
        ctx = self._get_ctx(self._guest_deps())
        with pytest.raises(ValueError, match="capacity must be > 0"):
            calculate_workforce_ratios_tool(ctx, capacity=0)


# ===========================================================================
# SECTION 9 — Zero Duplicated Business Constants & Formulas
# ===========================================================================

class TestNoDuplicatedBusinessConstants:

    def test_no_duplicated_allocation_percentages_in_tools(self):
        tools_path = BACKEND_DIR / "okkax_copilot_tools.py"
        content = tools_path.read_text()
        forbidden_snippets = [
            "0.28", "0.22", "0.15", "0.12", "0.08", "0.05", "0.10",
            '"talent": 0.28', '"production": 0.22', '"venue": 0.15',
        ]
        for snippet in forbidden_snippets:
            assert snippet not in content

    def test_default_technical_ratios_only_in_tools_for_testability(self):
        import okkax_copilot_tools as tools_mod
        assert hasattr(tools_mod, "_DEFAULT_TECHNICAL_RATIOS")
        ratios = tools_mod._DEFAULT_TECHNICAL_RATIOS
        assert ratios["ushers_per_pax"] == 80
        assert ratios["security_per_pax"] == 100
        assert ratios["sound_watt_rms_per_pax"] == 18
        assert ratios["sound_watt_rms_floor"] == 10_000
        assert ratios["medical_pax_per_post"] == 2_500

    def test_calculate_advanced_event_model_is_still_authority(self):
        from okkax_copilot import calculate_advanced_event_model
        result = calculate_advanced_event_model(budget=1_000_000_000, capacity=5_000)
        assert result["budget"] == 1_000_000_000
        assert result["breakdown"]["Talent & Rider"]["amount"] == int(1_000_000_000 * 0.28)


# ===========================================================================
# SECTION 10 — Agent Configuration & Model Injection
# ===========================================================================

class TestAgentConfigInvariants:

    def test_shadow_agent_config_reads_env(self, monkeypatch):
        from okkax_copilot_agent import OkkaxAgentConfig
        monkeypatch.setenv("OKKAX_CHATGPT_MODEL", "gpt-test-model-2026")
        cfg = OkkaxAgentConfig()
        assert cfg.resolve_model() == "gpt-test-model-2026"

    def test_shadow_agent_config_accepts_injection(self):
        from okkax_copilot_agent import OkkaxAgentConfig
        cfg = OkkaxAgentConfig(model="injected-custom-model")
        assert cfg.resolve_model() == "injected-custom-model"

    def test_shadow_agent_config_accepts_engine_pref_override(self):
        from okkax_copilot_agent import OkkaxAgentConfig
        cfg = OkkaxAgentConfig(model="default-model")
        assert cfg.resolve_model(engine_pref="override-model") == "override-model"

    def test_no_hardcoded_model_in_agent_module(self):
        agent_path = BACKEND_DIR / "okkax_copilot_agent.py"
        source_lines = agent_path.read_text().splitlines()
        forbidden = ["gpt-5.4", "gpt-5.5", "gpt-4o", "claude-3", "gemini-2"]
        for line in source_lines:
            stripped = line.strip()
            if stripped.startswith("#") or not stripped:
                continue
            for model_name in forbidden:
                assert f'"{model_name}"' not in stripped and f"'{model_name}'" not in stripped


# ===========================================================================
# SECTION 11 — Validation Helper & Response Contract
# ===========================================================================

class TestValidateCopilotResponse:

    def test_valid_response_returns_true(self):
        from okkax_copilot_agent import validate_copilot_response
        raw = {"reply": "[FACT] Info valid.", "engine": "Okkax Copilot",
               "source": "knowledge_note", "grounded": False}
        valid, resp, err = validate_copilot_response(raw)
        assert valid is True
        assert resp is not None
        assert err is None

    def test_invalid_response_returns_false(self):
        from okkax_copilot_agent import validate_copilot_response
        raw = {"reply": "No label here.", "source": "semantic_reasoning",
               "engine": "Okkax Copilot"}
        valid, resp, err = validate_copilot_response(raw)
        assert valid is False
        assert err is not None
        assert resp is None


# ===========================================================================
# SECTION 12 — Regression: Existing Imports & Isolation
# ===========================================================================

class TestExistingCopilotRegressionImports:

    def test_sanitize_history_importable(self):
        from okkax_copilot import sanitize_history
        result = sanitize_history([
            {"role": "user", "content": "Halo"},
            {"role": "assistant", "content": "Selamat datang."},
        ])
        assert len(result) == 2

    def test_copilot_tools_registry_importable(self):
        from okkax_copilot import COPILOT_TOOLS
        names = {t["name"] for t in COPILOT_TOOLS}
        assert "get_event_ground_truth" in names

    def test_calculate_advanced_event_model_importable(self):
        from okkax_copilot import calculate_advanced_event_model
        result = calculate_advanced_event_model(budget=1_000_000_000, capacity=5_000)
        assert result["budget"] == 1_000_000_000

    def test_default_policy_accessible(self):
        from okkax_copilot import DEFAULT_COPILOT_CALCULATOR_POLICY_DOC
        assert "budget_allocation" in DEFAULT_COPILOT_CALCULATOR_POLICY_DOC

    def test_financial_state_importable(self):
        from financial_state import mirror_current_turn_constraints
        state = mirror_current_turn_constraints({}, {"budget": 500_000_000})
        assert hasattr(state, "to_dict")

    def test_language_intelligence_importable(self):
        from language_intelligence import normalize_user_language
        result = normalize_user_language("budget gua 1 jt pax 5rb")
        assert "normalized_text" in result

    def test_shadow_modules_do_not_break_core_copilot_import(self):
        import okkax_copilot_context  # noqa: F401
        import okkax_copilot_models   # noqa: F401
        import okkax_copilot_tools    # noqa: F401
        import okkax_copilot_agent    # noqa: F401
        from okkax_copilot import ask_okkax_copilot
        assert callable(ask_okkax_copilot)

    def test_pydantic_ai_slim_version(self):
        import importlib.metadata as meta
        assert meta.version("pydantic-ai-slim") == "2.33.0"


# ===========================================================================
# SECTION 13 — COPILOT-03 Tool Selection & Reasoning Router
# ===========================================================================

class TestOkkaxToolSelectionAndReasoningRouter:

    def _guest_ctx(self):
        from okkax_copilot_context import CopilotSurface, make_guest_context
        return make_guest_context(surface=CopilotSurface.HOMEPAGE)

    def _auth_user_ctx(self):
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        return make_authenticated_context(
            user={"id": "usr-10", "email": "user@okkax.id"},
            raw_role="audience",
            surface=CopilotSurface.CHATBOT,
        )

    def _org_ctx(self):
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        snap = {
            "available": True,
            "event": {"id": "evt-fest-1", "name": "Fest One", "organizer_org_id": "org-01"},
            "finance": {"total_cost": 1_000_000_000, "confirmed_funding": 800_000_000, "funding_gap": 200_000_000},
            "compliance": {"total": 5, "coverage_status": "ready"},
            "ticketing": {"sold": 4000, "capacity": 5000},
            "operational": {"high_severity_risks": 0},
        }
        return make_authenticated_context(
            user={"id": "org-1", "email": "org@okkax.id", "org_id": "org-01"},
            raw_role="organizer",
            surface=CopilotSurface.WORKSPACE,
            event_id="evt-fest-1",
            event_snapshot=snap,
            organization_id="org-01",
        )

    def test_router_direct_greeting(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("Halo selamat pagi", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.DIRECT
        assert decision.required_tools == []
        assert decision.reasoning_required is False

    def test_router_deterministic_pure_arithmetic(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("2,4 miliar dibagi 8", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.DETERMINISTIC
        assert decision.required_llm_tools == []
        assert decision.calculation_required is True
        assert decision.reasoning_required is False

    def test_router_deterministic_budget_calculator(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("budget gue 1M kapasitas 5000 orang", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.DETERMINISTIC
        assert decision.required_llm_tools == []  # Zero LLM tools
        assert "calculate_event_budget" in decision.required_deterministic_operations
        assert decision.calculation_required is True
        assert decision.reasoning_required is False

    def test_router_deterministic_workforce_ratios(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("hitung kebutuhan usher dan security untuk 8000 pax", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.DETERMINISTIC
        assert decision.required_llm_tools == []  # Zero LLM tools
        assert "calculate_workforce_ratios" in decision.required_deterministic_operations
        assert decision.calculation_required is True

    def test_router_internal_read_calendar(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("event apa di Jakarta minggu ini?", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.INTERNAL_READ
        assert decision.required_tools == ["get_public_calendar_events"]

    def test_router_internal_read_catalog(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("cari festival musik di Bandung", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.INTERNAL_READ
        assert decision.required_tools == ["get_public_event_catalog"]

    def test_router_internal_read_supply(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("cari vendor sound di Jakarta", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.INTERNAL_READ
        assert decision.required_tools == ["search_network_supply"]

    def test_router_internal_read_my_tickets_authenticated(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("tiket saya apa saja?", self._auth_user_ctx())
        assert decision.mode == OkkaxRoutingMode.INTERNAL_READ
        assert decision.required_tools == ["get_my_tickets_summary"]

    def test_router_multi_tool_reasoning(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("cek status compliance dan budget keuangan event saya", self._org_ctx())
        assert decision.mode == OkkaxRoutingMode.MULTI_TOOL_REASONING
        assert "get_event_financial_status" in decision.required_tools
        assert "get_event_compliance_readiness" in decision.required_tools
        assert decision.reasoning_required is True

    def test_router_decision_support(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query(
            "venue Bandung 5k atau Jakarta 8k untuk budget 1,2M, mana yang lebih aman?",
            self._org_ctx(),
        )
        assert decision.mode == OkkaxRoutingMode.DECISION_SUPPORT
        assert decision.reasoning_required is True
        assert decision.calculation_required is True
        assert len(decision.required_llm_tools) <= 2
        assert "calculate_event_budget" in decision.required_deterministic_operations

    def test_router_entertainment_conceptual_zero_tool(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query(
            "buat konsep festival electronic Jakarta dengan tema neon pantai dan 1 headliner 3 opener",
            self._guest_ctx(),
        )
        assert decision.mode == OkkaxRoutingMode.ENTERTAINMENT
        assert decision.required_llm_tools == []  # Conceptual: zero tool
        assert decision.reasoning_required is True

    def test_router_entertainment_with_talent_search(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query(
            "cari talent artis pop jazz untuk festival di Jakarta",
            self._guest_ctx(),
        )
        assert decision.mode in (OkkaxRoutingMode.ENTERTAINMENT, OkkaxRoutingMode.INTERNAL_READ)
        assert "search_network_supply" in decision.required_llm_tools

    def test_router_generic_planning_zero_tool(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query(
            "buat rencana tahapan persiapan event musik 3 hari",
            self._guest_ctx(),
        )
        assert decision.mode == OkkaxRoutingMode.PLANNING
        assert decision.required_llm_tools == []  # Zero unnecessary tool
        assert decision.reasoning_required is True

    def test_router_planning_with_active_event(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query(
            "buat rencana timeline jadwal event saya",
            self._org_ctx(),
        )
        assert decision.mode == OkkaxRoutingMode.PLANNING
        assert "get_private_event_summary" in decision.required_llm_tools

    def test_router_knowledge_domain_note(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("apa itu landed cost?", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.KNOWLEDGE
        assert decision.required_tools == []
        assert decision.reasoning_required is False

    def test_router_clarify_on_missing_event_context(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("berapa sisa budget event saya?", self._guest_ctx())
        assert decision.mode == OkkaxRoutingMode.CLARIFY
        assert decision.clarification_required is True

    def test_router_action_proposal(self):
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query
        decision = route_okkax_query("buatkan draft event baru untuk konser musik", self._org_ctx())
        assert decision.mode == OkkaxRoutingMode.ACTION_PROPOSAL
        assert decision.action_proposal is not None
        assert decision.action_proposal.domain == "event"
        assert decision.required_tools == []

    def test_router_no_duplicate_tools_in_decision(self):
        from okkax_copilot_router import route_okkax_query
        queries = [
            "cek status compliance dan budget keuangan event saya",
            "venue Bandung 5k atau Jakarta 8k untuk budget 1,2M, mana yang lebih aman?",
            "budget gue 1M kapasitas 5000",
            "cari vendor sound di Jakarta",
        ]
        for q in queries:
            d = route_okkax_query(q, self._org_ctx())
            assert len(d.required_llm_tools) == len(set(d.required_llm_tools))
            assert len(d.required_deterministic_operations) == len(set(d.required_deterministic_operations))

    def test_three_surfaces_one_brain_consistency(self):
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        from okkax_copilot_router import OkkaxRoutingMode, route_okkax_query

        user = {"id": "usr-1", "email": "u@okkax.id"}
        ctx_home = make_authenticated_context(user=user, raw_role="organizer", surface=CopilotSurface.HOMEPAGE)
        ctx_chat = make_authenticated_context(user=user, raw_role="organizer", surface=CopilotSurface.CHATBOT)
        ctx_work = make_authenticated_context(user=user, raw_role="organizer", surface=CopilotSurface.WORKSPACE)

        q = "2,4 miliar dibagi 8"
        assert route_okkax_query(q, ctx_home).mode == OkkaxRoutingMode.DETERMINISTIC
        assert route_okkax_query(q, ctx_chat).mode == OkkaxRoutingMode.DETERMINISTIC
        assert route_okkax_query(q, ctx_work).mode == OkkaxRoutingMode.DETERMINISTIC

    def test_shadow_comparison_harness(self):
        from okkax_copilot_router import compare_routing_decisions
        comp = compare_routing_decisions("budget gue 1M kapasitas 5000", self._guest_ctx())
        assert comp["message"] == "budget gue 1M kapasitas 5000"
        assert comp["shadow_mode"] == "DETERMINISTIC"


# ===========================================================================
# SECTION 14 — COPILOT-04: Knowledge Retrieval & Evidence Architecture
# ===========================================================================

class TestOkkaxKnowledgeAndEvidenceArchitecture:

    def test_authority_tier_hierarchy_precedence(self):
        from okkax_copilot_knowledge import _TIER_PRIORITY, AuthorityTier
        assert _TIER_PRIORITY[AuthorityTier.TIER_1_LIVE_DATA] > _TIER_PRIORITY[AuthorityTier.TIER_2_CANONICAL_SPEC]
        assert _TIER_PRIORITY[AuthorityTier.TIER_2_CANONICAL_SPEC] > _TIER_PRIORITY[AuthorityTier.TIER_3_CURATED_DOMAIN]
        assert _TIER_PRIORITY[AuthorityTier.TIER_3_CURATED_DOMAIN] > _TIER_PRIORITY[AuthorityTier.TIER_4_EXTERNAL_INTEL]
        assert _TIER_PRIORITY[AuthorityTier.TIER_4_EXTERNAL_INTEL] > _TIER_PRIORITY[AuthorityTier.TIER_5_MODEL_GENERAL]

    def test_tier1_overrides_tier3_conflict(self):
        from okkax_copilot_knowledge import (
            AuthorityTier,
            OkkaxEvidenceItem,
            ProvenanceType,
            resolve_evidence_conflicts,
        )

        item_live = OkkaxEvidenceItem(
            source_id="tool:get_event_financial_status",
            source_type="live_tool",
            authority_tier=AuthorityTier.TIER_1_LIVE_DATA,
            provenance_type=ProvenanceType.FACT,
            entity_domain="finance",
            title="Live Event Budget Status",
            content="Total cost riil: Rp1.250.000.000, funding gap: Rp250.000.000.",
        )
        item_curated = OkkaxEvidenceItem(
            source_id="domain:breakeven_formula",
            source_type="curated_domain",
            authority_tier=AuthorityTier.TIER_3_CURATED_DOMAIN,
            provenance_type=ProvenanceType.CALCULATED,
            entity_domain="finance",
            title="Standard BEP Estimate",
            content="Estimasi total budget konservatif: Rp1.000.000.000.",
        )

        resolved = resolve_evidence_conflicts([item_curated, item_live])
        assert len(resolved.items) == 1
        assert resolved.items[0].source_id == "tool:get_event_financial_status"
        assert resolved.items[0].authority_tier == AuthorityTier.TIER_1_LIVE_DATA
        assert len(resolved.conflicts_detected) == 1
        assert resolved.conflicts_detected[0].winner_source_id == "tool:get_event_financial_status"
        assert resolved.conflicts_detected[0].suppressed_source_id == "domain:breakeven_formula"

    def test_tier2_overrides_generic_model_knowledge(self):
        from okkax_copilot_knowledge import (
            AuthorityTier,
            OkkaxEvidenceItem,
            ProvenanceType,
            resolve_evidence_conflicts,
        )

        item_spec = OkkaxEvidenceItem(
            source_id="spec:ticketing",
            source_type="canonical_spec",
            authority_tier=AuthorityTier.TIER_2_CANONICAL_SPEC,
            provenance_type=ProvenanceType.FACT,
            entity_domain="ticketing",
            title="OKKAX Dynamic QR Spec",
            content="HMAC-SHA256 rotating QR dengan anti-screenshot gate.",
        )
        item_generic = OkkaxEvidenceItem(
            source_id="model:generic_reasoning",
            source_type="model_general",
            authority_tier=AuthorityTier.TIER_5_MODEL_GENERAL,
            provenance_type=ProvenanceType.RECOMMENDATION,
            entity_domain="ticketing",
            title="Generic Ticket Barcode",
            content="Gunakan barcode statis standar PDF.",
        )

        resolved = resolve_evidence_conflicts([item_generic, item_spec])
        assert len(resolved.items) == 1
        assert resolved.items[0].source_id == "spec:ticketing"
        assert len(resolved.conflicts_detected) == 1
        assert resolved.conflicts_detected[0].winner_tier == AuthorityTier.TIER_2_CANONICAL_SPEC

    def test_relevant_canonical_spec_retrieved(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("bagaimana tahapan status di event studio?")
        source_ids = {it.source_id for it in ev.items}
        assert "spec:event_studio" in source_ids

    def test_irrelevant_knowledge_excluded(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("bagaimana mitigasi cuaca hujan outdoor?")
        source_ids = {it.source_id for it in ev.items}
        assert "domain:outdoor_weather" in source_ids
        assert "spec:ticketing" not in source_ids

    def test_event_planning_promoter_vs_eo_retrieval(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("apa beda promotor dan event organizer?")
        source_ids = {it.source_id for it in ev.items}
        assert "domain:promoter_vs_eo" in source_ids

    def test_entertainment_opener_concept_retrieval(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("apa fungsi dan peran band opener dalam konser musik?")
        source_ids = {it.source_id for it in ev.items}
        assert "domain:entertainment_opener" in source_ids
        assert any(it.provenance_type.value == "RECOMMENDATION" for it in ev.items)

    def test_artist_availability_flags_live_data_required(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("siapa artis yang available minggu depan di Jakarta?")
        assert ev.live_data_required is True
        assert len(ev.items) == 1
        assert ev.items[0].live_data_required is True
        assert ev.items[0].available is False

    def test_duplicate_evidence_deduplicated(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("aturan perizinan izin keramaian event izin polisi")
        source_ids = [it.source_id for it in ev.items]
        assert len(source_ids) == len(set(source_ids))

    def test_evidence_prompt_bloat_prevention(self):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge
        ev = retrieve_okkax_knowledge("bagaimana struktur sponsorship tiering dan formula break even?")
        assert len(ev.items) <= 3
        assert ev.total_text_bytes < 1500  # Strict compact budget (< 1.5 KB)


# ===========================================================================
# SECTION 15 — COPILOT-05: Evidence-Grounded Planning & Decision Intelligence
# ===========================================================================

class TestOkkaxPlanningAndDecisionIntelligence:

    def test_typed_reasoning_input_structure(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput
        from okkax_copilot_knowledge import AuthorityTier, OkkaxEvidenceItem, ProvenanceType

        fact = OkkaxEvidenceItem(
            source_id="tool:get_event_financial_status",
            source_type="live_tool",
            authority_tier=AuthorityTier.TIER_1_LIVE_DATA,
            provenance_type=ProvenanceType.FACT,
            entity_domain="finance",
            title="Live Budget",
            content="Total cost: Rp1.000.000.000.",
        )
        inp = OkkaxReasoningInput(
            explicit_constraints={"budget": 1_000_000_000, "capacity": 5_000},
            live_facts=[fact],
            assumptions=["Target audiens 85% okupansi"],
            unknowns=["Rate card artis headliner belum final"],
        )
        assert inp.explicit_constraints["budget"] == 1_000_000_000
        assert len(inp.live_facts) == 1
        assert len(inp.unknowns) == 1

    def test_venue_comparison_with_capacity_constraint(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, compare_event_options

        options = [
            {"name": "Balai Kartini", "capacity": 3000, "cost": 150_000_000},
            {"name": "Tennis Indoor Senayan", "capacity": 8000, "cost": 250_000_000},
        ]
        constraints = {"capacity": 5000, "budget": 1_000_000_000}
        inp = OkkaxReasoningInput(explicit_constraints=constraints)

        decision = compare_event_options("Pilih venue konser 5000 pax", options, constraints, inp)
        assert decision.recommended_option == "Tennis Indoor Senayan"
        assert any(r.domain == "venue" and r.severity.value == "HIGH" for r in decision.risks)
        assert len(decision.next_steps) >= 2

    def test_sponsor_cancellation_what_if(self):
        from okkax_copilot_intelligence import run_what_if_analysis

        baseline = {"total_cost": 1_200_000_000, "confirmed_funding": 400_000_000, "funding_gap": 800_000_000}
        res = run_what_if_analysis("kalau sponsor batal?", baseline, {"budget": 1_200_000_000, "capacity": 5000})

        assert res["scenario"] == "sponsor_cancellation"
        assert res["recalculated_funding_gap"] == 1_200_000_000
        assert res["recalculated_sponsor_funding"] == 0.0
        assert res["bep_ticket_price_85pct"] > 0
        assert res["risk"]["severity"] in ("CRITICAL", "HIGH")
        assert res["provenance_type"] == "CALCULATED"

    def test_capacity_scaling_what_if(self):
        from okkax_copilot_intelligence import run_what_if_analysis

        baseline = {"total_cost": 1_000_000_000, "capacity": 5000}
        res = run_what_if_analysis("kalau kapasitas naik 20%?", baseline, {"budget": 1_000_000_000, "capacity": 5000})

        assert res["scenario"] == "capacity_scaling"
        assert res["recalculated_capacity"] == 6000
        assert res["ushers_needed"] >= 75  # 6000 // 80 = 75
        assert res["security_needed"] >= 60  # 6000 // 100 = 60
        assert res["provenance_type"] == "CALCULATED"

    def test_ticket_sell_through_sensitivity(self):
        from okkax_copilot_intelligence import run_what_if_analysis

        baseline = {"total_cost": 1_000_000_000, "capacity": 5000}
        res = run_what_if_analysis("kalau ticket sales cuma 60%?", baseline, {"budget": 1_000_000_000, "capacity": 5000, "ticket_price": 300_000})

        assert res["scenario"] == "ticket_shortfall"
        assert res["sell_through_pct"] == 60.0
        assert res["sold_tickets"] == 3000
        assert res["gross_sales"] == 900_000_000
        assert res["net_balance"] == -100_000_000  # 900M - 1000M = -100M
        assert res["risk"]["severity"] == "HIGH"

    def test_vendor_quote_comparison(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, compare_event_options

        options = [
            {"name": "Vendor Sound A", "cost": 150_000_000, "watt": 90000},
            {"name": "Vendor Sound B", "cost": 220_000_000, "watt": 100000},
        ]
        constraints = {"budget": 180_000_000}
        inp = OkkaxReasoningInput(explicit_constraints=constraints)

        decision = compare_event_options("Pilih vendor sound system", options, constraints, inp)
        assert decision.recommended_option == "Vendor Sound A"
        assert "Vendor Sound B: Biaya (Rp220,000,000) melebihi budget" in "\n".join(decision.tradeoffs)

    def test_missing_data_remains_explicit_unknown(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, compare_event_options

        options = [
            {"name": "Artis X"},  # Missing fee and schedule
            {"name": "Artis Y", "cost": 300_000_000},
        ]
        inp = OkkaxReasoningInput()
        decision = compare_event_options("Pilih headliner", options, {}, inp)

        assert any("Artis X" in u for u in decision.unknowns)
        assert decision.confidence < 0.9

    def test_evidence_grounded_plan_generation(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, generate_evidence_grounded_plan

        constraints = {"budget": 1_000_000_000, "capacity": 5000}
        inp = OkkaxReasoningInput(explicit_constraints=constraints)

        plan = generate_evidence_grounded_plan("Konser Musik Indie Jakarta 2027", constraints, inp)
        assert plan.goal == "Konser Musik Indie Jakarta 2027"
        assert len(plan.phases) == 5
        phase_codes = [p.phase_code for p in plan.phases]
        assert phase_codes == ["W-8", "W-4", "W-2", "W-0", "Post-Event"]
        assert plan.required_resources["ushers_count"] >= 62
        assert plan.required_resources["security_count"] >= 50
        assert plan.next_action is not None
        assert plan.next_action.requires_role == "organizer"
        # Without live database facts attached, evidence sufficiency score reflects moderate baseline support (~0.56)
        assert 0.40 <= plan.confidence <= 0.70

    def test_deterministic_confidence_completeness_matrix(self):
        from okkax_copilot_intelligence import compute_deterministic_confidence

        # Complete evidence with live facts and calculations
        c_complete = compute_deterministic_confidence(
            live_facts_count=2, calculations_count=1, assumptions_count=0, unknowns_count=0
        )
        assert c_complete >= 0.95

        # Partial evidence with unknowns
        c_unknowns = compute_deterministic_confidence(
            live_facts_count=0, calculations_count=0, assumptions_count=1, unknowns_count=2
        )
        assert c_unknowns < c_complete
        assert c_unknowns <= 0.80

        # Authority conflict reduces confidence
        c_conflict = compute_deterministic_confidence(
            live_facts_count=1, calculations_count=1, assumptions_count=0, unknowns_count=0, conflicts_count=1
        )
        assert c_conflict < c_complete

        # Missing live data reduces confidence significantly
        c_missing_live = compute_deterministic_confidence(
            live_facts_count=0, calculations_count=0, assumptions_count=0, unknowns_count=0, live_data_required_missing=True
        )
        assert c_missing_live <= 0.70

    def test_adaptive_planning_express_timeline(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, generate_evidence_grounded_plan

        constraints = {"budget": 500_000_000, "capacity": 2000, "days_before": 25}
        inp = OkkaxReasoningInput(explicit_constraints=constraints)

        plan = generate_evidence_grounded_plan("Konser Mini Express 25 Hari", constraints, inp)
        phase_codes = [p.phase_code for p in plan.phases]
        assert phase_codes == ["H-30", "H-14", "H-3", "H-0"]

    def test_adaptive_planning_large_festival_timeline(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, generate_evidence_grounded_plan

        constraints = {"budget": 5_000_000_000, "capacity": 15000}
        inp = OkkaxReasoningInput(explicit_constraints=constraints)

        plan = generate_evidence_grounded_plan("Grand Summer Music Festival 3 Hari", constraints, inp)
        phase_codes = [p.phase_code for p in plan.phases]
        assert phase_codes == ["W-12", "W-6", "W-2", "W-0", "Post-Event"]

    def test_domain_rule_grounding_classifications(self):
        from okkax_copilot_intelligence import OkkaxReasoningInput, RuleGroundingClassification, generate_evidence_grounded_plan

        constraints = {"budget": 1_000_000_000, "capacity": 5000}
        inp = OkkaxReasoningInput(explicit_constraints=constraints)

        plan = generate_evidence_grounded_plan("Konser Pop Jakarta", constraints, inp)
        classifications = {r.grounding_classification for r in plan.critical_risks}
        assert RuleGroundingClassification.CANONICAL_SPEC in classifications
        assert RuleGroundingClassification.CURATED_PRACTICE in classifications

    def test_no_evidence_low_sufficiency_score(self):
        from okkax_copilot_intelligence import compute_evidence_sufficiency_score
        score = compute_evidence_sufficiency_score(
            live_facts_count=0,
            calculations_count=0,
            canonical_evidence_count=0,
            curated_knowledge_count=0,
        )
        assert score <= 0.30

    def test_live_facts_and_calculation_increase_support(self):
        from okkax_copilot_intelligence import compute_evidence_sufficiency_score
        score_base = compute_evidence_sufficiency_score(0, 0, 0, 0)
        score_supported = compute_evidence_sufficiency_score(
            live_facts_count=2,
            calculations_count=1,
            canonical_evidence_count=1,
            curated_knowledge_count=1,
        )
        assert score_supported > score_base
        assert score_supported >= 0.85

    def test_unknowns_and_conflicts_reduce_sufficiency_score(self):
        from okkax_copilot_intelligence import compute_evidence_sufficiency_score
        score_good = compute_evidence_sufficiency_score(live_facts_count=1, calculations_count=1)
        score_with_unknowns = compute_evidence_sufficiency_score(
            live_facts_count=1, calculations_count=1, unknowns_count=3
        )
        score_with_conflict = compute_evidence_sufficiency_score(
            live_facts_count=1, calculations_count=1, conflicts_count=1
        )
        assert score_with_unknowns < score_good
        assert score_with_conflict < score_good

    def test_canonical_okkax_rule_distinct_from_verified_external_fact(self):
        from okkax_copilot_intelligence import RuleGroundingClassification
        assert RuleGroundingClassification.OKKAX_CANONICAL_RULE != RuleGroundingClassification.VERIFIED_EXTERNAL_FACT
        assert RuleGroundingClassification.OKKAX_CANONICAL_RULE.value == "OKKAX_CANONICAL_RULE"
        assert RuleGroundingClassification.VERIFIED_EXTERNAL_FACT.value == "VERIFIED_EXTERNAL_FACT"

    def test_local_regulation_remains_live_verification_required(self):
        from okkax_copilot_intelligence import OkkaxRiskItem, RiskSeverity, RuleGroundingClassification
        risk = OkkaxRiskItem(
            severity=RiskSeverity.MEDIUM,
            domain="compliance",
            title="Local Sound Decibel Limit & Curfew",
            reason="Batasan desibel dan jam malam lokal bergantung pada persetujuan izin Polres/Satpol PP setempat.",
            evidence_source="local_jurisdiction:unverified",
            impact="Potensi teguran petugas jika melebihi batas desibel malam hari.",
            mitigation="Lakukan konfirmasi batas desibel riil saat audiensi teknis izin keramaian.",
            grounding_classification=RuleGroundingClassification.UNKNOWN_LIVE_VERIFICATION,
        )
        assert risk.grounding_classification == RuleGroundingClassification.UNKNOWN_LIVE_VERIFICATION


# ===========================================================================
# SECTION 16 — COPILOT-06A: Safe Runtime Shadow Bridge
# ===========================================================================

class TestOkkaxCopilotShadowBridge:

    def test_shadow_bridge_feature_flag_default_off(self, monkeypatch):
        from okkax_copilot_bridge import is_shadow_runtime_enabled, run_shadow_observation
        monkeypatch.delenv("OKKAX_COPILOT_SHADOW_RUNTIME", raising=False)
        assert is_shadow_runtime_enabled() is False

        record = run_shadow_observation("halo", current_route="/")
        assert record is None

    def test_shadow_bridge_feature_flag_on_runs_observation(self, monkeypatch):
        from okkax_copilot_bridge import is_shadow_runtime_enabled, run_shadow_observation
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")
        assert is_shadow_runtime_enabled() is True

        prod_resp = {"reply": "Halo! Ada yang bisa dibantu?", "intents": ["small_talk"], "reasoning_mode": "conversational"}
        record = run_shadow_observation("halo", current_route="/", production_response=prod_resp)
        assert record is not None
        assert record.shadow_success is True
        assert record.shadow_mode == "DIRECT"
        assert record.surface == "homepage"
        assert record.auth_state == "guest"
        assert record.disagreement_type.value == "AGREE"
        assert record.latency_ms >= 0.0

    def test_production_response_identical_flag_off_vs_on(self, monkeypatch):
        """Proof that running the shadow bridge does NOT alter the production response in any way."""
        from okkax_copilot_bridge import run_shadow_observation

        prod_resp_orig = {
            "reply": "Anggaran telah dihitung.",
            "calculation": {"total_budget": 1_000_000_000},
            "intents": ["budget_calculation"],
            "grounded": True,
        }
        # Run with flag OFF
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "false")
        res_off = run_shadow_observation("budget 1M kapasitas 5000", production_response=prod_resp_orig)
        assert res_off is None

        # Run with flag ON
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")
        res_on = run_shadow_observation("budget 1M kapasitas 5000", production_response=prod_resp_orig)
        assert res_on is not None

        # Production response remains 100% byte-identical
        assert prod_resp_orig["reply"] == "Anggaran telah dihitung."
        assert prod_resp_orig["calculation"]["total_budget"] == 1_000_000_000

    def test_shadow_bridge_fail_open_on_exception(self, monkeypatch):
        import okkax_copilot_bridge
        from okkax_copilot_bridge import run_shadow_observation
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        def _exploding_router(*args, **kwargs):
            raise RuntimeError("Simulated router fault in shadow bridge")

        monkeypatch.setattr(okkax_copilot_bridge, "route_okkax_query", _exploding_router)

        record = run_shadow_observation("halo", production_response={"reply": "ok"})
        assert record is not None
        assert record.shadow_success is False
        assert record.disagreement_type.value == "SHADOW_ERROR"
        assert "Simulated router fault" in str(record.disagreement_notes)

    def test_three_surfaces_canonical_matrix(self):
        from okkax_copilot_bridge import derive_copilot_surface
        from okkax_copilot_context import CopilotSurface

        # Homepage
        assert derive_copilot_surface("/") == CopilotSurface.HOMEPAGE
        assert derive_copilot_surface("/home") == CopilotSurface.HOMEPAGE
        assert derive_copilot_surface("/beranda") == CopilotSurface.HOMEPAGE
        assert derive_copilot_surface("") == CopilotSurface.HOMEPAGE

        # Chatbot surfaces (any standard app route where floating bot is open)
        assert derive_copilot_surface("/discover") == CopilotSurface.CHATBOT
        assert derive_copilot_surface("/peta") == CopilotSurface.CHATBOT
        assert derive_copilot_surface("/events/abc") == CopilotSurface.CHATBOT
        assert derive_copilot_surface("/pricing") == CopilotSurface.CHATBOT
        assert derive_copilot_surface("/events/123/tickets") == CopilotSurface.CHATBOT

        # Workspace routes
        assert derive_copilot_surface("/copilot") == CopilotSurface.WORKSPACE
        assert derive_copilot_surface("/intelligence") == CopilotSurface.WORKSPACE
        assert derive_copilot_surface("/okkax") == CopilotSurface.WORKSPACE
        assert derive_copilot_surface("/app/copilot") == CopilotSurface.WORKSPACE
        assert derive_copilot_surface("/workspace/event-studio") == CopilotSurface.WORKSPACE

    def test_guest_on_workspace_route_keeps_guest_permissions(self, monkeypatch):
        """Surface WORKSPACE does NOT grant unauthorized role elevation to a guest."""
        from okkax_copilot_bridge import run_shadow_observation
        from okkax_copilot_context import CopilotRole
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        rec = run_shadow_observation("cek status event saya", current_route="/copilot", user=None, role="guest")
        assert rec.surface == "workspace"
        assert rec.auth_state == "guest"
        assert rec.user_role == "guest"
        # No private tools should be accessible
        assert "get_private_event_summary" not in rec.shadow_required_llm_tools

    def test_client_payload_reasoning_mode_or_route_cannot_grant_authority(self, monkeypatch):
        """Client-supplied reasoning_mode / route cannot elevate role or event ownership."""
        from okkax_copilot_bridge import run_shadow_observation
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        # Caller provides role='organizer' as payload hint but user is unauthenticated
        rec = run_shadow_observation(
            "sisa budget event saya",
            current_route="/workspace",
            role="anonymous",
            user=None,
            event_id="ev-private",
            event_snapshot=None,
            reasoning_mode="smarter",
        )
        assert rec.auth_state == "guest"
        assert rec.has_event_snapshot is False
        assert "get_private_event_summary" not in rec.shadow_required_llm_tools

    def test_shadow_bridge_timeout_handling(self, monkeypatch):
        """Simulate a slow shadow evaluation and verify soft latency budget exceeded is recorded safely."""
        import okkax_copilot_bridge
        from okkax_copilot_router import route_okkax_query as real_router
        from okkax_copilot_bridge import run_shadow_observation
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        def _slow_router(*args, **kwargs):
            import time
            time.sleep(0.005)  # 5ms
            return real_router(*args, **kwargs)

        monkeypatch.setattr(okkax_copilot_bridge, "route_okkax_query", _slow_router)

        # Set ultra-low latency budget threshold 0.1ms
        record = run_shadow_observation("halo", production_response={"reply": "ok"}, shadow_latency_budget_ms=0.1)
        assert record is not None
        assert record.shadow_success is False
        assert record.disagreement_type.value == "SOFT_BUDGET_EXCEEDED"
        assert "exceeded soft budget" in str(record.disagreement_notes)

    def test_guest_vs_authenticated_context_in_bridge(self, monkeypatch):
        from okkax_copilot_bridge import run_shadow_observation
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        # Guest
        rec_guest = run_shadow_observation("2,4 miliar dibagi 8", current_route="/")
        assert rec_guest.auth_state == "guest"
        assert rec_guest.user_role == "guest"
        assert rec_guest.has_event_snapshot is False

        # Authenticated organizer
        user = {"id": "usr-99", "email": "org@okkax.id", "organization_id": "org-1"}
        snapshot = {"id": "ev-1", "title": "Konser Jazz", "total_cost": 500_000_000}
        rec_auth = run_shadow_observation(
            "2,4 miliar dibagi 8",
            current_route="/workspace",
            role="organizer",
            event_snapshot=snapshot,
            user=user,
        )
        assert rec_auth.auth_state == "authenticated"
        assert rec_auth.user_role == "organizer"
        assert rec_auth.has_event_snapshot is True

    def test_telemetry_contains_no_sensitive_fields(self, monkeypatch):
        from okkax_copilot_bridge import get_latest_shadow_comparisons, run_shadow_observation
        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        user = {"id": "usr-1", "email": "secure@okkax.id", "password_hash": "secret123", "jwt_token": "bearer xyz"}
        run_shadow_observation("cek status event", user=user, role="organizer")

        recent = get_latest_shadow_comparisons(5)
        assert len(recent) > 0
        last_rec = recent[-1]

        # Verify no sensitive auth fields or raw tokens leak into telemetry records
        assert "password" not in str(last_rec)
        assert "jwt_token" not in str(last_rec)
        assert "secret123" not in str(last_rec)
        assert "bearer xyz" not in str(last_rec)

    @pytest.mark.anyio
    async def test_endpoint_schedules_background_task_when_flag_on(self, monkeypatch):
        """When OKKAX_COPILOT_SHADOW_RUNTIME=true, background_tasks.add_task is called exactly once."""
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks

        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")
        bg_tasks = BackgroundTasks()

        payload = OkkaxChatIn(message="2,4 miliar dibagi 8", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)

        assert resp is not None
        assert "reply" in resp
        # Exactly one background task scheduled
        assert len(bg_tasks.tasks) == 1
        assert bg_tasks.tasks[0].func.__name__ == "run_shadow_observation"

    @pytest.mark.anyio
    async def test_endpoint_does_not_schedule_background_task_when_flag_off(self, monkeypatch):
        """When OKKAX_COPILOT_SHADOW_RUNTIME=false, background_tasks.add_task is NOT called."""
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks

        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "false")
        bg_tasks = BackgroundTasks()

        payload = OkkaxChatIn(message="2,4 miliar dibagi 8", current_route="/")
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)

        assert resp is not None
        assert "reply" in resp
        # Zero background tasks scheduled
        assert len(bg_tasks.tasks) == 0

    @pytest.mark.anyio
    async def test_slow_shadow_does_not_delay_endpoint_response(self, monkeypatch):
        """Endpoint returns response immediately without executing or waiting for slow shadow work."""
        import okkax_copilot_bridge
        import server
        from server import okkax_copilot_chat_endpoint, OkkaxChatIn
        from fastapi import BackgroundTasks

        monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")

        # Mock production copilot to return instantly (isolating server/endpoint mechanics)
        async def _instant_copilot(*args, **kwargs):
            return {"reply": "300000000", "intents": ["budget_split"], "reasoning_mode": "deterministic"}

        monkeypatch.setattr(server, "ask_okkax_copilot", _instant_copilot)

        # Mock shadow observation to be slow if executed synchronously
        def _slow_shadow(*args, **kwargs):
            import time
            time.sleep(0.5)  # 500ms
            return None

        monkeypatch.setattr(okkax_copilot_bridge, "run_shadow_observation", _slow_shadow)

        bg_tasks = BackgroundTasks()
        payload = OkkaxChatIn(message="2,4 miliar dibagi 8", current_route="/")

        import time
        t0 = time.perf_counter()
        resp = await okkax_copilot_chat_endpoint(payload=payload, background_tasks=bg_tasks, user=None)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        # Endpoint execution must return in < 50ms without waiting for the 500ms shadow task
        assert resp is not None
        assert elapsed_ms < 50.0  # Far less than 500ms
        assert len(bg_tasks.tasks) == 1
        assert bg_tasks.tasks[0].func == _slow_shadow


# ===========================================================================
# SECTION 16 — Canonical Read Tool Individual Execution Invariants (12 Tools)
# ===========================================================================

class TestCanonicalReadToolIndividualExecution:
    """Individual execution invariants across all 12 canonical tools."""

    @staticmethod
    def _get_ctx(deps):
        return TestToolProvenanceAndSafety._get_ctx(deps)

    def _guest_deps(self, route="/"):
        from okkax_copilot_context import CopilotSurface, make_guest_context
        return make_guest_context(surface=CopilotSurface.HOMEPAGE, current_route=route)

    def _auth_deps(self, role="audience", route="/"):
        from okkax_copilot_context import CopilotSurface, make_authenticated_context
        return make_authenticated_context(
            user={"id": "usr-test-1", "email": "test@okkax.id"},
            raw_role=role,
            surface=CopilotSurface.HOMEPAGE,
            current_route=route,
        )

    def test_calculate_event_budget_tool_executes(self):
        from okkax_copilot_tools import calculate_event_budget_tool
        ctx = self._get_ctx(self._guest_deps())
        res = calculate_event_budget_tool(ctx, budget=1_000_000_000, capacity=5_000)
        assert res.available is True
        assert res.authoritative is True
        assert res.budget == 1_000_000_000

    def test_calculate_workforce_ratios_tool_executes(self):
        from okkax_copilot_tools import calculate_workforce_ratios_tool
        ctx = self._get_ctx(self._guest_deps())
        res = calculate_workforce_ratios_tool(ctx, capacity=8_000)
        assert res.available is True
        assert res.authoritative is True
        assert res.security >= 80

    def test_get_public_platform_context_tool_executes(self):
        from okkax_copilot_tools import get_public_platform_context_tool
        ctx = self._get_ctx(self._guest_deps())
        res = asyncio.run(get_public_platform_context_tool(ctx))
        assert res.authoritative is True

    def test_get_public_calendar_events_tool_executes(self):
        from okkax_copilot_tools import get_public_calendar_events_tool
        ctx = self._get_ctx(self._guest_deps("/discover"))
        res = asyncio.run(get_public_calendar_events_tool(ctx, city="Jakarta"))
        assert res.authoritative is True
        assert res.source == "calendar_engine"
        assert res.city == "Jakarta"

    def test_get_public_event_catalog_tool_executes(self):
        from okkax_copilot_tools import get_public_event_catalog_tool
        ctx = self._get_ctx(self._guest_deps("/discover"))
        res = asyncio.run(get_public_event_catalog_tool(ctx, city="Jakarta"))
        assert res.source in ("discover_catalog", "catalog_db")

    def test_search_network_supply_tool_executes(self):
        from okkax_copilot_tools import search_network_supply_tool
        ctx = self._get_ctx(self._guest_deps("/network"))
        res = asyncio.run(search_network_supply_tool(ctx, kind="talent", city="Jakarta"))
        assert res.source in ("network_supply", "network_catalog")

    def test_get_my_tickets_summary_tool_guest_unavailable(self):
        from okkax_copilot_tools import get_my_tickets_summary_tool
        ctx = self._get_ctx(self._guest_deps("/mytickets"))
        res = asyncio.run(get_my_tickets_summary_tool(ctx))
        assert res.available is False

    def test_get_my_tickets_summary_tool_authenticated(self):
        from okkax_copilot_tools import get_my_tickets_summary_tool
        ctx = self._get_ctx(self._auth_deps(role="audience", route="/mytickets"))
        res = asyncio.run(get_my_tickets_summary_tool(ctx))
        assert res.source == "ticketing_engine"

    def test_get_private_event_summary_tool_unauthorized(self):
        from okkax_copilot_tools import get_private_event_summary_tool
        ctx = self._get_ctx(self._guest_deps("/workspace"))
        res = get_private_event_summary_tool(ctx)
        assert res.available is False

    def test_get_event_financial_status_tool_unauthorized(self):
        from okkax_copilot_tools import get_event_financial_status_tool
        ctx = self._get_ctx(self._guest_deps("/workspace"))
        res = asyncio.run(get_event_financial_status_tool(ctx))
        assert res.available is False

    def test_get_event_ticketing_health_tool_unauthorized(self):
        from okkax_copilot_tools import get_event_ticketing_health_tool
        ctx = self._get_ctx(self._guest_deps("/workspace"))
        res = asyncio.run(get_event_ticketing_health_tool(ctx))
        assert res.available is False

    def test_get_event_compliance_readiness_tool_unauthorized(self):
        from okkax_copilot_tools import get_event_compliance_readiness_tool
        ctx = self._get_ctx(self._guest_deps("/workspace"))
        res = asyncio.run(get_event_compliance_readiness_tool(ctx))
        assert res.available is False

    def test_get_event_operational_blockers_tool_unauthorized(self):
        from okkax_copilot_tools import get_event_operational_blockers_tool
        ctx = self._get_ctx(self._guest_deps("/workspace"))
        res = asyncio.run(get_event_operational_blockers_tool(ctx))
        assert res.available is False


# ===========================================================================
# SECTION 17 — Temporal Calendar Invariants & Boundaries
# ===========================================================================

class TestTemporalCalendarInvariants:
    """Rigorous temporal filtering invariants for calendar tools."""

    @pytest.mark.parametrize("query,expected_label", [
        ("Event apa di Jakarta hari ini?", "hari ini"),
        ("Ada jadwal di Bali besok?", "besok"),
        ("Event apa di Jakarta minggu ini?", "minggu ini"),
        ("Ada konser di Surabaya akhir pekan ini?", "akhir pekan ini"),
        ("Agenda event di Bandung minggu depan?", "minggu depan"),
        ("Daftar event di Medan bulan ini?", "bulan ini"),
    ])
    def test_resolve_temporal_range_invariants(self, query, expected_label):
        from okkax_copilot_selector import resolve_temporal_range
        df, dt, label = resolve_temporal_range(query)
        assert label == expected_label
        assert df is not None
        assert dt is not None
        assert df <= dt

    def test_temporal_this_week_bounds(self):
        from datetime import datetime, timezone, timedelta
        from okkax_copilot_selector import resolve_temporal_range
        now = datetime.now(timezone(timedelta(hours=7)))
        today = now.date()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        df, dt, label = resolve_temporal_range("Event minggu ini")
        assert label == "minggu ini"
        assert df == start_of_week.isoformat()
        assert dt == end_of_week.isoformat()

    def test_temporal_next_week_bounds(self):
        from datetime import datetime, timezone, timedelta
        from okkax_copilot_selector import resolve_temporal_range
        now = datetime.now(timezone(timedelta(hours=7)))
        today = now.date()
        next_mon = today - timedelta(days=today.weekday()) + timedelta(days=7)
        next_sun = next_mon + timedelta(days=6)
        df, dt, label = resolve_temporal_range("Event minggu depan")
        assert label == "minggu depan"
        assert df == next_mon.isoformat()
        assert dt == next_sun.isoformat()

    def test_temporal_this_month_bounds(self):
        from datetime import datetime, timezone, timedelta
        from okkax_copilot_selector import resolve_temporal_range
        now = datetime.now(timezone(timedelta(hours=7)))
        today = now.date()
        first_day = today.replace(day=1)
        next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        last_day = next_month - timedelta(days=1)
        df, dt, label = resolve_temporal_range("Event bulan ini")
        assert label == "bulan ini"
        assert df == first_day.isoformat()
        assert dt == last_day.isoformat()

    def test_temporal_non_temporal_query_returns_none(self):
        from okkax_copilot_selector import resolve_temporal_range
        df, dt, label = resolve_temporal_range("Apa beda promotor dan EO?")
        assert label == ""
        assert df is None
        assert dt is None


# ===========================================================================
# SECTION 18 — Extended Mathematical & Deterministic Precision
# ===========================================================================

class TestExtendedMathAndFinancialDeterminism:
    """Pure arithmetic and financial ratio determinism."""

    @pytest.mark.parametrize("query,expected_str", [
        ("2,4 miliar dibagi 8", "Rp300.000.000"),
        ("1 miliar bagi 4", "Rp250.000.000"),
        ("500 juta / 5", "Rp100.000.000"),
        ("150 juta kali 4", "Rp600.000.000"),
        ("15% dari 800 juta", "Rp120.000.000"),
        ("20 persen dari 1 miliar", "Rp200.000.000"),
        ("30% dari 500jt", "Rp150.000.000"),
        ("800jt - 300jt", "500.000.000"),
    ])
    def test_pure_arithmetic_evaluator(self, query, expected_str):
        from okkax_copilot_selector import evaluate_pure_arithmetic
        res = evaluate_pure_arithmetic(query)
        assert res is not None
        assert expected_str in res
