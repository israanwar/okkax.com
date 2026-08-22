"""Shadow-only SemanticExecutionPlan builder for OKKAX Copilot U1.

No I/O, provider call, tool execution, or response composition happens here.
The builder reuses existing language, state, router, context, and entitlement
contracts to describe a future execution path without affecting production.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from okkax_copilot_context import CopilotSurface, OkkaxSessionContext
from okkax_copilot_models import SemanticComplexity, SemanticExecutionPlan, SemanticTurnKind
from okkax_copilot_router import OkkaxRoutingDecision, OkkaxRoutingMode


_PUBLIC_TOOLS = {
    "calculate_event_budget", "calculate_workforce_ratios",
    "get_public_platform_context", "get_public_calendar_events",
    "get_public_event_catalog", "search_network_supply",
}
_PRIVATE_TOOLS = {
    "get_private_event_summary", "get_event_financial_status",
    "get_event_ticketing_health", "get_event_compliance_readiness",
    "get_event_operational_blockers",
}
_QUESTION_CUES = re.compile(
    r"\?|\b(?:apa|apakah|berapa|bagaimana|gimana|kenapa|mengapa|siapa|mana|"
    r"cocok|realistis|layak|aman|available|tersedia|cukup|mending|sebaiknya)\b",
    re.IGNORECASE,
)
_REFERENCE_CUES = re.compile(
    r"\b(?:yang ini|ini|itu|dia|mereka|yang tadi|yang kedua|event ini|blocker ini)\b",
    re.IGNORECASE,
)


def is_semantic_execution_plan_shadow_enabled() -> bool:
    value = os.environ.get("OKKAX_COPILOT_SEMANTIC_PLAN_SHADOW", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _canonical_state_delta(message: str, history: Optional[List[Dict[str, str]]]) -> Dict[str, Any]:
    from okkax_copilot import _MONEY_RE, _to_int_money  # noqa: PLC0415
    from okkax_copilot_state import extract_turn_delta, reconstruct_conversation_state  # noqa: PLC0415

    prior_state = reconstruct_conversation_state(history, "")
    raw = extract_turn_delta(message, prior_state)
    delta: Dict[str, Any] = {}
    for key, value in raw.items():
        if key == "event_budget":
            delta["budget"] = value
        elif key != "prior_budget":
            delta[key] = value

    # Existing typed extraction requires an explicit pax noun. In a turn that
    # already declares an event type, a bare "5k" is an unambiguous capacity
    # shorthand as long as it is not attached to a money/budget expression.
    q = message.lower()
    if "capacity" not in delta and re.search(r"\b(?:konser|festival|expo|event|acara)\b", q):
        bare_capacity = re.search(r"(?<!budget\s)(?<!rp)\b(\d+(?:[\.,]\d+)?)\s*k\b", q)
        if bare_capacity:
            delta["capacity"] = int(float(bare_capacity.group(1).replace(",", ".")) * 1000)

    # Reuse the canonical money tokenizer. For an explicit correction the last
    # monetary token is the accepted replacement, not the rejected old value.
    if "budget" in q and re.search(r"\b(?:bukan|koreksi|maksud saya)\b", q):
        money = list(_MONEY_RE.finditer(q))
        if money:
            replacement = money[-1]
            delta = {"budget": _to_int_money(replacement.group(1), replacement.group(2))}
    return delta


def _resolve_problem_type(message: str, decision: OkkaxRoutingDecision) -> str:
    q = message.lower()
    if re.search(r"\b\d+(?:[\.,]\d+)?\s*(?:%|persen)\s+(?:dari|of)\b", q):
        return "calculation"
    if re.search(r"\b(?:realistis|feasible|layak|cukup gak|cukup ga|cukup tidak)\b", q):
        return "feasibility"
    if re.search(r"\b(?:lebih cocok|bandingkan|\bvs\b|atau.+atau)\b", q):
        return "comparison"
    if re.search(r"\bcocok(?:\s+(?:gak|ga|tidak))?\b", q):
        return "recommendation"
    if re.search(r"\b(?:available|availability|tersedia|ketersediaan)\b", q):
        return "live_search_read"
    return decision.problem_type or "question"


def _resolve_turn_kind(
    message: str,
    problem_type: str,
    delta: Dict[str, Any],
    decision: OkkaxRoutingDecision,
) -> SemanticTurnKind:
    if problem_type == "action_request" or decision.mode == OkkaxRoutingMode.ACTION_PROPOSAL:
        return SemanticTurnKind.ACTION
    if problem_type == "correction" or re.search(r"\b(?:bukan|koreksi|maksud saya)\b", message, re.I):
        return SemanticTurnKind.CORRECTION
    asks = bool(_QUESTION_CUES.search(message)) or problem_type in {
        "calculation", "comparison", "recommendation", "feasibility",
        "knowledge_question", "live_search_read", "summary",
    }
    if delta and asks:
        return SemanticTurnKind.UPDATE_AND_QUESTION
    if delta:
        return SemanticTurnKind.UPDATE
    return SemanticTurnKind.QUESTION


def _response_shape(problem_type: str, turn_kind: SemanticTurnKind) -> str:
    if turn_kind == SemanticTurnKind.ACTION:
        return "action_confirmation"
    return {
        "calculation": "calculation", "comparison": "comparison",
        "recommendation": "recommendation", "feasibility": "recommendation",
        "live_search_read": "search_results", "summary": "summary",
    }.get(problem_type, "plain_answer")


def build_semantic_execution_plan(
    message: str,
    ctx: OkkaxSessionContext,
    decision: OkkaxRoutingDecision,
    history: Optional[List[Dict[str, str]]] = None,
) -> SemanticExecutionPlan:
    """Build an envelope-bounded, entitlement-safe plan without executing it."""
    from language_intelligence import normalize_user_language  # noqa: PLC0415
    from okkax_copilot_tools import get_entitled_tools_for_context  # noqa: PLC0415

    normalized = str(normalize_user_language(message).get("normalized_text") or message).strip()
    q = normalized.lower()
    problem_type = _resolve_problem_type(normalized, decision)
    state_delta = _canonical_state_delta(normalized, history)
    if problem_type == "calculation" and re.search(r"\b\d+(?:[\.,]\d+)?\s*%\s+dari\b", q):
        state_delta.pop("sold_target_pct", None)
    turn_kind = _resolve_turn_kind(normalized, problem_type, state_delta, decision)

    surface = ctx.surface.value.upper()
    max_complexity = {
        CopilotSurface.HOMEPAGE: SemanticComplexity.S3,
        CopilotSurface.CHATBOT: SemanticComplexity.S4,
        CopilotSurface.WORKSPACE: SemanticComplexity.S5,
    }[ctx.surface]
    max_tools = {
        CopilotSurface.HOMEPAGE: 2,
        CopilotSurface.CHATBOT: 3,
        CopilotSurface.WORKSPACE: 6,
    }[ctx.surface]

    referenced_entities: List[Dict[str, Any]] = []
    if ctx.active_entity and _REFERENCE_CUES.search(q):
        referenced_entities.append(dict(ctx.active_entity))
    elif ctx.event_id and re.search(r"\b(?:event ini|acara ini|blocker ini)\b", q):
        referenced_entities.append({
            "type": "event", "id": ctx.event_id,
            "authorized": ctx.can_access_private_event,
        })

    knowledge_queries = list(dict.fromkeys(decision.domains)) if problem_type in {
        "knowledge_question", "comparison", "recommendation", "feasibility", "planning",
    } else []
    live_requirements: List[str] = []
    deterministic = list(dict.fromkeys(decision.required_deterministic_operations))
    tools = list(dict.fromkeys(decision.required_tools))
    authorization: List[str] = []
    unknowns: List[str] = []

    if problem_type == "calculation" and not deterministic:
        deterministic.append("evaluate_pure_arithmetic")
    if problem_type == "live_search_read":
        if re.search(r"\b(?:talent|artis|noah|band|dj)\b", q):
            live_requirements.append("talent_availability")
            tools.append("search_network_supply")
            unknowns.append("verified_talent_availability")
        else:
            live_requirements.append("current_catalog_data")

    asks_private_finance = bool(
        re.search(r"\b(?:event saya|event gue|event ini|acara saya)\b", q)
        and re.search(r"\b(?:finance|keuangan|budget|cashflow|piutang)\b", q)
    )
    asks_blockers = bool(re.search(r"\bblocker(?: terbesar| utama)?\b", q))
    if ctx.surface == CopilotSurface.WORKSPACE and asks_blockers and ctx.can_access_private_event:
        tools.extend([
            "get_event_financial_status", "get_event_compliance_readiness",
            "get_event_ticketing_health", "get_event_operational_blockers",
        ])
        live_requirements.extend(["authorized_event_state", "cross_domain_blocker_state"])
        authorization.append("verified_private_event_access")
    elif (asks_private_finance or asks_blockers) and not ctx.can_access_private_event:
        authorization.extend(["authentication_required", "verified_private_event_access"])
        unknowns.append("authorized_event_context")
        tools = [tool for tool in tools if tool not in _PRIVATE_TOOLS]

    if turn_kind == SemanticTurnKind.ACTION:
        tools = []
        authorization.append("explicit_user_confirmation")
        if ctx.surface == CopilotSurface.WORKSPACE:
            authorization.extend(["authenticated_action_role", "domain_service_authorization"])
        else:
            authorization.append("workspace_required")

    entitled = set(get_entitled_tools_for_context(ctx))
    if ctx.surface == CopilotSurface.HOMEPAGE:
        tools = [tool for tool in tools if tool in _PUBLIC_TOOLS]
        if any(tool in _PRIVATE_TOOLS for tool in decision.required_tools):
            authorization.append("private_data_forbidden_on_homepage")
    else:
        tools = [tool for tool in tools if tool in entitled]
    tools = list(dict.fromkeys(tools))[:max_tools]

    if problem_type == "feasibility":
        if "capacity" not in state_delta:
            unknowns.append("capacity")
        if "budget" not in state_delta:
            unknowns.append("budget")
        if not re.search(r"\b(?:venue|indoor|outdoor)\b", q):
            unknowns.append("venue")
        if not re.search(r"\b(?:talent|artis|headliner|noah|band|dj)\b", q):
            unknowns.append("talent")
        if "budget" in state_delta and "capacity" in state_delta:
            deterministic.append("calculate_event_budget_supporting_projection")

    if ctx.surface == CopilotSurface.WORKSPACE and asks_blockers and ctx.can_access_private_event:
        complexity = SemanticComplexity.S5
    elif turn_kind == SemanticTurnKind.ACTION:
        complexity = SemanticComplexity.S4 if ctx.surface != CopilotSurface.HOMEPAGE else SemanticComplexity.S3
    elif problem_type == "calculation":
        complexity = SemanticComplexity.S2
    elif problem_type == "live_search_read":
        complexity = SemanticComplexity.S1
    elif problem_type in {"comparison", "recommendation", "feasibility", "planning"}:
        complexity = SemanticComplexity.S4 if ctx.surface == CopilotSurface.CHATBOT and referenced_entities else SemanticComplexity.S3
    elif turn_kind == SemanticTurnKind.UPDATE:
        complexity = SemanticComplexity.S0
    else:
        complexity = SemanticComplexity.S1
    if int(complexity.value[1]) > int(max_complexity.value[1]):
        complexity = max_complexity

    verification = ["relevance", "state_consistency", "grounding", "authorization", "no_internal_leakage"]
    if deterministic:
        verification.append("deterministic_arithmetic")
    if live_requirements:
        verification.append("live_claims_require_tool_evidence")
    if turn_kind == SemanticTurnKind.ACTION:
        verification.extend(["confirmation_required", "no_direct_write_execution"])

    return SemanticExecutionPlan(
        problem_type=problem_type,
        user_goal=decision.user_goal or normalized,
        turn_kind=turn_kind,
        surface=surface,
        complexity=complexity,
        state_delta=state_delta,
        referenced_entities=referenced_entities,
        material_unknowns=list(dict.fromkeys(unknowns)),
        knowledge_queries=knowledge_queries,
        live_data_requirements=list(dict.fromkeys(live_requirements)),
        deterministic_operations=list(dict.fromkeys(deterministic)),
        tool_plan=tools,
        authorization_requirements=list(dict.fromkeys(authorization)),
        response_shape=_response_shape(problem_type, turn_kind),
        verification_requirements=list(dict.fromkeys(verification)),
    )
