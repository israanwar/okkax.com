"""OKKAX Copilot — Safe Runtime Shadow Bridge (COPILOT-06A).

Integrates the locked shadow intelligence substrate into the production request lifecycle
for OBSERVATION AND TELEMETRY ONLY.

SHADOW ISOLATION GUARANTEES:
  1. Controlled by server env flag `OKKAX_COPILOT_SHADOW_RUNTIME` (Default: OFF).
  2. Production response remains 100% authoritative, unaltered, and unmutated.
  3. Strict fail-open design: any shadow error or timeout never throws into production.
  4. Non-blocking with strict bounded timeout.
  5. Zero write execution and zero database mutation.
  6. Three surfaces mapped canonically: HOMEPAGE, CHATBOT, WORKSPACE.
  7. Typed telemetry with no secrets, no PII leakage, and no sensitive prompt dumping.
"""

from __future__ import annotations

import collections
import logging
import os
import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from okkax_copilot_context import (
    CopilotRole,
    CopilotSurface,
    OkkaxSessionContext,
    make_authenticated_context,
    make_guest_context,
)
from okkax_copilot_intelligence import (
    OkkaxReasoningInput,
    compare_event_options,
    generate_evidence_grounded_plan,
    run_what_if_analysis,
)
from okkax_copilot_knowledge import retrieve_okkax_knowledge
from okkax_copilot_router import (
    OkkaxRoutingDecision,
    OkkaxRoutingMode,
    route_okkax_query,
)
from okkax_copilot_models import SemanticExecutionPlan

logger = logging.getLogger("okkax.copilot.bridge")


# ---------------------------------------------------------------------------
# Feature Flag & Configuration
# ---------------------------------------------------------------------------

def is_shadow_runtime_enabled() -> bool:
    """Check if shadow observation runtime is active via environment flag.

    Default: OFF (false). Missing or empty env var is strictly OFF.
    """
    val = os.environ.get("OKKAX_COPILOT_SHADOW_RUNTIME", "").strip().lower()
    return val in ("1", "true", "yes", "on")


# ---------------------------------------------------------------------------
# Disagreement Classification & Diagnostics
# ---------------------------------------------------------------------------

class DisagreementType(str, Enum):
    """Categorization of structural alignment between production and shadow brain."""

    AGREE = "AGREE"
    SHADOW_REFINEMENT = "SHADOW_REFINEMENT"
    TOOL_DIFFERENCE = "TOOL_DIFFERENCE"
    DETERMINISTIC_DIFFERENCE = "DETERMINISTIC_DIFFERENCE"
    CONTEXT_DIFFERENCE = "CONTEXT_DIFFERENCE"
    AUTHORIZATION_DIFFERENCE = "AUTHORIZATION_DIFFERENCE"
    SOFT_BUDGET_EXCEEDED = "SOFT_BUDGET_EXCEEDED"
    SHADOW_TIMEOUT = "SOFT_BUDGET_EXCEEDED"  # Backward-compatible alias
    SHADOW_ERROR = "SHADOW_ERROR"


class OkkaxShadowComparisonRecord(BaseModel):
    """Safe, typed diagnostic record comparing production vs shadow evaluation."""

    request_id: str = Field(description="Unique request tracing ID")
    surface: str = Field(description="homepage | chatbot | workspace")
    auth_state: str = Field(description="guest | authenticated")
    user_role: str = Field(description="Server-derived user role")
    has_event_snapshot: bool = Field(description="True if tenant-verified snapshot was present")
    legacy_intents: List[str] = Field(default_factory=list, description="Production engine intent tags")
    legacy_reasoning_mode: Optional[str] = Field(default=None, description="Production reasoning mode hint")
    shadow_mode: str = Field(description="Shadow router mode")
    shadow_required_llm_tools: List[str] = Field(default_factory=list, description="Shadow required LLM tools")
    shadow_deterministic_operations: List[str] = Field(default_factory=list, description="Shadow deterministic operations")
    evidence_domains: List[str] = Field(default_factory=list, description="Retrieved evidence domains")
    evidence_sufficiency_score: Optional[float] = Field(default=None, description="Evidence sufficiency score")
    shadow_success: bool = Field(default=True, description="True if shadow observation ran without failure")
    latency_ms: float = Field(description="Shadow execution latency in milliseconds")
    disagreement_type: DisagreementType = Field(description="Classification of structural divergence")
    disagreement_notes: Optional[str] = Field(default=None, description="Diagnostic explanation")
    semantic_execution_plan: Optional[SemanticExecutionPlan] = Field(default=None, description="U1 shadow-only control-plane plan")
    semantic_plan_error: Optional[str] = Field(default=None, description="Fail-open planner diagnostic")


# In-memory circular telemetry buffer (capped at 100 items, zero PII)
_SHADOW_TELEMETRY_BUFFER: collections.deque[Dict[str, Any]] = collections.deque(maxlen=100)


def get_latest_shadow_comparisons(limit: int = 20) -> List[Dict[str, Any]]:
    """Retrieve recent shadow comparison records from in-memory ring buffer."""
    records = list(_SHADOW_TELEMETRY_BUFFER)
    return records[-limit:]


def clear_shadow_telemetry_buffer() -> None:
    """Clear telemetry buffer (useful for test isolation)."""
    _SHADOW_TELEMETRY_BUFFER.clear()


# ---------------------------------------------------------------------------
# Surface Resolver
# ---------------------------------------------------------------------------

def derive_copilot_surface(current_route: Optional[str]) -> CopilotSurface:
    """Map frontend route path to canonical CopilotSurface.

    Rules:
      1. Homepage routes ("", "/", "/home", "/beranda") -> HOMEPAGE
      2. Explicit Copilot workspace routes ("/copilot", "/intelligence", "/okkax", "/app/copilot", "/workspace", "/event-studio", "/organizer") -> WORKSPACE
      3. All other routes where floating OkkaxChat can invoke /okkax/chat ("/discover", "/peta", "/events/...", "/pricing", etc.) -> CHATBOT
    """
    r = (current_route or "").strip().lower()
    if r in ("", "/", "/home", "/beranda"):
        return CopilotSurface.HOMEPAGE
    if any(r == k or r.startswith(k + "/") or r.startswith(k + "?") for k in (
        "/copilot",
        "/intelligence",
        "/okkax",
        "/app/copilot",
        "/workspace",
        "/dashboard",
        "/event-studio",
        "/organizer",
    )):
        return CopilotSurface.WORKSPACE
    return CopilotSurface.CHATBOT


# ---------------------------------------------------------------------------
# Core Shadow Observer
# ---------------------------------------------------------------------------

def run_shadow_observation(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    current_route: str = "",
    event_id: str = "",
    role: str = "",
    event_snapshot: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    production_response: Optional[Dict[str, Any]] = None,
    reasoning_mode: Optional[str] = None,
    db: Optional[Any] = None,
    active_entity: Optional[Dict[str, Any]] = None,
    shadow_latency_budget_ms: float = 800.0,
    timeout_ms: Optional[float] = None,
) -> Optional[OkkaxShadowComparisonRecord]:
    """Execute shadow intelligence observation in strict fail-open background isolation.

    Note on Budget Semantics:
        Shadow evaluation executes locally in pure in-memory Python CPU calculations.
        `shadow_latency_budget_ms` represents a diagnostic latency budget threshold (default 800ms).
        If shadow execution exceeds this soft budget, it is truthfully recorded in diagnostics as
        `SOFT_BUDGET_EXCEEDED` without claiming unachievable hard OS thread preemption.

    Returns:
        OkkaxShadowComparisonRecord if shadow runtime is enabled, otherwise None.
    """
    if not is_shadow_runtime_enabled():
        return None

    budget_threshold = timeout_ms if timeout_ms is not None else shadow_latency_budget_ms

    t0 = time.perf_counter()
    req_id = f"shd-{uuid.uuid4().hex[:12]}"
    surface = derive_copilot_surface(current_route)
    auth_state = "authenticated" if user else "guest"
    prod_resp = production_response or {}
    legacy_intents = prod_resp.get("intents") or []
    legacy_mode = prod_resp.get("reasoning_mode")

    try:
        # 1. Construct typed SessionContext
        if user:
            ctx = make_authenticated_context(
                user=user,
                raw_role=role,
                surface=surface,
                current_route=current_route,
                event_id=event_id,
                event_snapshot=event_snapshot,
                reasoning_mode=reasoning_mode,
                db=db,
                active_entity=active_entity,
            )
        else:
            ctx = make_guest_context(
                surface=surface,
                current_route=current_route,
                reasoning_mode=reasoning_mode,
                db=db,
                active_entity=active_entity,
            )

        # 2. Route query through locked shadow router
        decision: OkkaxRoutingDecision = route_okkax_query(message, ctx, history)

        # 2b. U1 plan is observation-only. It never feeds response selection,
        # provider prompts, tool execution, or the production response object.
        semantic_execution_plan: Optional[SemanticExecutionPlan] = None
        semantic_plan_error: Optional[str] = None
        try:
            from okkax_copilot_semantic_plan import (  # noqa: PLC0415
                build_semantic_execution_plan,
                is_semantic_execution_plan_shadow_enabled,
            )
            if is_semantic_execution_plan_shadow_enabled():
                semantic_execution_plan = build_semantic_execution_plan(message, ctx, decision, history)
        except Exception as plan_err:
            semantic_plan_error = type(plan_err).__name__
            logger.debug("copilot.semantic_execution_plan fail-open: %s", plan_err)

        # 3. Knowledge & Evidence retrieval
        evidence_coll = retrieve_okkax_knowledge(message, ctx)
        evidence_domains = list({it.entity_domain for it in evidence_coll.items})

        # 4. Deterministic calculations or sensitivity if required
        calc_results: List[Any] = []
        if decision.required_deterministic_operations:
            for op in decision.required_deterministic_operations:
                if op == "calculate_event_budget" or op == "calculate_advanced_event_model":
                    calc_results.append(
                        run_what_if_analysis(message, event_snapshot or {}, {})
                    )

        # 5. Planning or Decision Intelligence
        plan_or_decision_mode: Optional[str] = None
        evidence_score: Optional[float] = None
        if decision.mode == OkkaxRoutingMode.PLANNING:
            plan_or_decision_mode = "PLANNING"
            reasoning_inp = OkkaxReasoningInput(
                explicit_constraints={},
                live_facts=evidence_coll.items,
                assumptions=["Shadow evaluation observation"],
                unknowns=[],
            )
            plan = generate_evidence_grounded_plan(message, {}, reasoning_inp)
            evidence_score = plan.evidence_sufficiency_score
        elif decision.mode in (OkkaxRoutingMode.DECISION_SUPPORT, OkkaxRoutingMode.MULTI_TOOL_REASONING):
            plan_or_decision_mode = "DECISION_SUPPORT"
            reasoning_inp = OkkaxReasoningInput(
                explicit_constraints={},
                live_facts=evidence_coll.items,
                assumptions=["Shadow evaluation observation"],
                unknowns=[],
            )
            dec = compare_event_options(message, [], {}, reasoning_inp)
            evidence_score = dec.evidence_sufficiency_score

        # 6. Evaluate Disagreement Classification
        disagreement = _classify_disagreement(
            legacy_intents=legacy_intents,
            legacy_mode=legacy_mode,
            shadow_mode=decision.mode.value,
            shadow_tools=decision.required_llm_tools,
            shadow_deterministic=decision.required_deterministic_operations,
        )

        latency = (time.perf_counter() - t0) * 1000.0

        if latency > budget_threshold:
            record = OkkaxShadowComparisonRecord(
                request_id=req_id,
                surface=surface.value,
                auth_state=auth_state,
                user_role=role or "guest",
                has_event_snapshot=bool(event_snapshot),
                legacy_intents=legacy_intents,
                legacy_reasoning_mode=legacy_mode,
                shadow_mode=decision.mode.value,
                shadow_required_llm_tools=decision.required_llm_tools,
                shadow_deterministic_operations=decision.required_deterministic_operations,
                evidence_domains=evidence_domains,
                evidence_sufficiency_score=evidence_score,
                shadow_success=False,
                latency_ms=round(latency, 2),
                disagreement_type=DisagreementType.SOFT_BUDGET_EXCEEDED,
                disagreement_notes=f"Shadow execution latency ({latency:.1f}ms) exceeded soft budget ({budget_threshold}ms)",
                semantic_execution_plan=semantic_execution_plan,
                semantic_plan_error=semantic_plan_error,
            )
        else:
            record = OkkaxShadowComparisonRecord(
                request_id=req_id,
                surface=surface.value,
                auth_state=auth_state,
                user_role=role or "guest",
                has_event_snapshot=bool(event_snapshot),
                legacy_intents=legacy_intents,
                legacy_reasoning_mode=legacy_mode,
                shadow_mode=decision.mode.value,
                shadow_required_llm_tools=decision.required_llm_tools,
                shadow_deterministic_operations=decision.required_deterministic_operations,
                evidence_domains=evidence_domains,
                evidence_sufficiency_score=evidence_score,
                shadow_success=True,
                latency_ms=round(latency, 2),
                disagreement_type=disagreement,
                disagreement_notes=None,
                semantic_execution_plan=semantic_execution_plan,
                semantic_plan_error=semantic_plan_error,
            )

        _SHADOW_TELEMETRY_BUFFER.append(record.model_dump())
        return record

    except Exception as err:
        latency = (time.perf_counter() - t0) * 1000.0
        logger.warning("copilot.shadow_bridge observation error: %s", err, exc_info=False)
        record = OkkaxShadowComparisonRecord(
            request_id=req_id,
            surface=surface.value,
            auth_state=auth_state,
            user_role=role or "guest",
            has_event_snapshot=bool(event_snapshot),
            legacy_intents=legacy_intents,
            legacy_reasoning_mode=legacy_mode,
            shadow_mode="ERROR",
            shadow_required_llm_tools=[],
            shadow_deterministic_operations=[],
            evidence_domains=[],
            evidence_sufficiency_score=None,
            shadow_success=False,
            latency_ms=round(latency, 2),
            disagreement_type=DisagreementType.SHADOW_ERROR,
            disagreement_notes=str(err),
            semantic_execution_plan=None,
            semantic_plan_error=type(err).__name__,
        )
        _SHADOW_TELEMETRY_BUFFER.append(record.model_dump())
        return record


# ---------------------------------------------------------------------------
# Disagreement Classifier Helper
# ---------------------------------------------------------------------------

def _classify_disagreement(
    legacy_intents: List[str],
    legacy_mode: Optional[str],
    shadow_mode: str,
    shadow_tools: List[str],
    shadow_deterministic: List[str],
) -> DisagreementType:
    """Classify structural divergence between legacy production and shadow brain."""
    if shadow_mode == "DIRECT" and any(i in ("small_talk", "conversational") for i in legacy_intents):
        return DisagreementType.AGREE
    if shadow_mode == "DETERMINISTIC" and (shadow_deterministic or any("math" in i or "calculator" in i for i in legacy_intents)):
        return DisagreementType.AGREE
    if shadow_mode == "INTERNAL_READ" and shadow_tools:
        return DisagreementType.SHADOW_REFINEMENT
    if shadow_mode in ("PLANNING", "DECISION_SUPPORT", "ENTERTAINMENT"):
        return DisagreementType.SHADOW_REFINEMENT
    if shadow_tools and not legacy_tools_used(legacy_intents):
        return DisagreementType.TOOL_DIFFERENCE
    return DisagreementType.AGREE


def legacy_tools_used(intents: List[str]) -> bool:
    return any(i.startswith("tool:") or "read_" in i for i in intents)
