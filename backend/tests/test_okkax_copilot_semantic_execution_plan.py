from __future__ import annotations

from copy import deepcopy

import pytest

from okkax_copilot_bridge import run_shadow_observation
from okkax_copilot_context import CopilotSurface, make_authenticated_context, make_guest_context
from okkax_copilot_models import SemanticComplexity, SemanticTurnKind
from okkax_copilot_router import route_okkax_query
from okkax_copilot_semantic_plan import build_semantic_execution_plan


def _plan(message, ctx, history=None):
    decision = route_okkax_query(message, ctx, history=history)
    return build_semantic_execution_plan(message, ctx, decision, history)


def _workspace_context():
    user = {"id": "user-1", "roles": ["organizer"], "organization_id": "org-1"}
    snapshot = {
        "available": True,
        "event": {"id": "event-1", "owner_user_id": "user-1", "organizer_org_id": "org-1"},
    }
    return make_authenticated_context(
        user=user,
        raw_role="organizer",
        surface=CopilotSurface.WORKSPACE,
        current_route="/app/copilot",
        event_id="event-1",
        event_snapshot=snapshot,
    )


def test_homepage_feasibility_plan_uses_goal_not_numbers():
    plan = _plan(
        "Bro gue mau bikin konser 5k di Makassar budget 900jt, premium production. Realistis gak?",
        make_guest_context(surface=CopilotSurface.HOMEPAGE),
    )
    assert plan.problem_type == "feasibility"
    assert plan.turn_kind == SemanticTurnKind.UPDATE_AND_QUESTION
    assert plan.complexity == SemanticComplexity.S3
    assert plan.state_delta["capacity"] == 5000
    assert plan.state_delta["budget"] == 900_000_000
    assert plan.state_delta["city"] == "Makassar"
    assert not plan.live_data_requirements
    assert "venue" in plan.material_unknowns
    assert "talent" in plan.material_unknowns
    assert len(plan.tool_plan) <= 2


def test_pure_percentage_is_deterministic_s2():
    plan = _plan("15% dari Rp800 juta berapa?", make_guest_context())
    assert plan.problem_type == "calculation"
    assert plan.complexity == SemanticComplexity.S2
    assert plan.deterministic_operations
    assert "sold_target_pct" not in plan.state_delta


def test_talent_availability_requires_public_live_read():
    plan = _plan("NOAH available November?", make_guest_context())
    assert plan.problem_type == "live_search_read"
    assert "talent_availability" in plan.live_data_requirements
    assert plan.tool_plan == ["search_network_supply"]
    assert "verified_talent_availability" in plan.material_unknowns


def test_venue_comparison_does_not_become_calculator():
    plan = _plan("Venue 2.500 pax lebih cocok konser, expo, atau corporate?", make_guest_context())
    assert plan.problem_type == "comparison"
    assert plan.response_shape == "comparison"
    assert not plan.deterministic_operations


def test_floating_resolves_active_entity_reference():
    ctx = make_guest_context(
        surface=CopilotSurface.CHATBOT,
        current_route="/talents/noah",
        active_entity={"type": "talent", "id": "talent-noah", "name": "NOAH"},
    )
    plan = _plan("yang ini cocok gak?", ctx)
    assert plan.problem_type == "recommendation"
    assert plan.referenced_entities[0]["id"] == "talent-noah"
    assert plan.complexity in {SemanticComplexity.S3, SemanticComplexity.S4}


def test_workspace_blocker_plan_is_authorized_s5_multi_domain_read():
    plan = _plan("Blocker terbesar event ini apa?", _workspace_context())
    assert plan.complexity == SemanticComplexity.S5
    assert set(plan.tool_plan) >= {
        "get_event_financial_status", "get_event_compliance_readiness",
        "get_event_ticketing_health", "get_event_operational_blockers",
    }
    assert "verified_private_event_access" in plan.authorization_requirements
    assert len(plan.tool_plan) <= 6


def test_workspace_action_is_confirmation_only():
    plan = _plan("Selesaikan blocker ini.", _workspace_context())
    assert plan.turn_kind == SemanticTurnKind.ACTION
    assert plan.response_shape == "action_confirmation"
    assert plan.tool_plan == []
    assert "explicit_user_confirmation" in plan.authorization_requirements
    assert "no_direct_write_execution" in plan.verification_requirements


def test_guest_private_finance_has_no_private_executable_tool():
    plan = _plan("Tampilkan keuangan event saya sekarang.", make_guest_context())
    assert "verified_private_event_access" in plan.authorization_requirements
    assert "authorized_event_context" in plan.material_unknowns
    assert not set(plan.tool_plan).intersection({
        "get_private_event_summary", "get_event_financial_status",
        "get_event_ticketing_health", "get_event_compliance_readiness",
        "get_event_operational_blockers",
    })


def test_budget_correction_supersedes_only_budget():
    history = [{"role": "user", "content": "Budget event 1,2 miliar."}]
    plan = _plan("Budget bukan 1,2 miliar, jadi 950 juta.", make_guest_context(), history)
    assert plan.turn_kind == SemanticTurnKind.CORRECTION
    assert plan.state_delta == {"budget": 950_000_000}


def test_ticket_price_update_is_not_budget_or_bep():
    plan = _plan("Tiket 175k.", make_guest_context())
    assert plan.turn_kind == SemanticTurnKind.UPDATE
    assert plan.state_delta == {"ticket_price": 175_000}
    assert not plan.deterministic_operations


def test_bridge_attaches_plan_only_when_both_shadow_flags_enabled(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")
    monkeypatch.setenv("OKKAX_COPILOT_SEMANTIC_PLAN_SHADOW", "true")
    production = {"reply": "jawaban-produksi", "intents": ["test"]}
    before = deepcopy(production)
    record = run_shadow_observation("15% dari Rp800 juta berapa?", production_response=production)
    assert production == before
    assert record is not None
    assert record.semantic_execution_plan is not None
    assert record.semantic_execution_plan.complexity == SemanticComplexity.S2


def test_semantic_plan_flag_defaults_off_without_touching_production(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")
    monkeypatch.delenv("OKKAX_COPILOT_SEMANTIC_PLAN_SHADOW", raising=False)
    production = {"reply": "production-authoritative", "intents": []}
    before = deepcopy(production)
    record = run_shadow_observation("halo", production_response=production)
    assert production == before
    assert record is not None
    assert record.semantic_execution_plan is None
    assert record.semantic_plan_error is None


def test_planner_failure_is_fail_open_and_does_not_mutate_reply(monkeypatch):
    monkeypatch.setenv("OKKAX_COPILOT_SHADOW_RUNTIME", "true")
    monkeypatch.setenv("OKKAX_COPILOT_SEMANTIC_PLAN_SHADOW", "true")
    monkeypatch.setattr(
        "okkax_copilot_semantic_plan.build_semantic_execution_plan",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("planned failure")),
    )
    production = {"reply": "tetap-sama", "intents": []}
    record = run_shadow_observation("halo", production_response=production)
    assert production["reply"] == "tetap-sama"
    assert record is not None
    assert record.semantic_execution_plan is None
    assert record.semantic_plan_error == "RuntimeError"
