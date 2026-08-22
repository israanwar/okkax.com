"""OKKAX Copilot — Tool Selection & Reasoning Router (COPILOT-03 Shadow Substrate).

Defines the single unified intelligence router for OKKAX Copilot across all three surfaces
(Homepage, Chatbot, Workspace): Three Surfaces, One Brain.

SHADOW MODE — this module is NOT wired to production `/okkax/chat`.

Authority Order Enforced Here:
  1. CURRENT TURN EXPLICIT CONSTRAINT (user explicit input)
  2. SERVER/LIVE OKKAX STATE (server-verified event snapshot & session)
  3. DETERMINISTIC CALCULATION (policy-based calculators & formulas)
  4. CANONICAL KNOWLEDGE (domain knowledge notes)
  5. TOOL EVIDENCE (authoritative internal read tools)
  6. LLM REASONING (semantic synthesis, planning, decision support)

Canonical Routing Modes:
  - DIRECT: Greetings / simple conversational acknowledgments (zero tool, zero LLM).
  - DETERMINISTIC: Arithmetic, percentage, ratio, BEP, budget formulas (zero tool / calculator, zero LLM math).
  - INTERNAL_READ: Exactly one authoritative OKKAX read tool sufficient.
  - MULTI_TOOL_REASONING: Requires correlation of 2+ authoritative tools.
  - PLANNING: Event roadmap, resource allocation, phased timeline.
  - DECISION_SUPPORT: Comparing options, trade-offs, feasibility, risk evaluation.
  - ENTERTAINMENT: Artist programming, lineup curation, genre concepts, audience flow.
  - KNOWLEDGE: Domain explanations / glossary where live database query is unnecessary.
  - CLARIFY: Critical ambiguity prevents safe / reliable answers.
  - ACTION_PROPOSAL: Write intent detected; returns structured action proposal card only (zero execution).
"""

from __future__ import annotations

import logging
import re
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from okkax_copilot_context import CopilotRole, CopilotSurface, OkkaxSessionContext
from okkax_copilot_models import ActionProposalCard

logger = logging.getLogger("okkax.copilot.router")


# ---------------------------------------------------------------------------
# Canonical Routing Modes
# ---------------------------------------------------------------------------

class OkkaxRoutingMode(str, Enum):
    DIRECT = "DIRECT"
    DETERMINISTIC = "DETERMINISTIC"
    INTERNAL_READ = "INTERNAL_READ"
    MULTI_TOOL_REASONING = "MULTI_TOOL_REASONING"
    PLANNING = "PLANNING"
    DECISION_SUPPORT = "DECISION_SUPPORT"
    ENTERTAINMENT = "ENTERTAINMENT"
    KNOWLEDGE = "KNOWLEDGE"
    CLARIFY = "CLARIFY"
    ACTION_PROPOSAL = "ACTION_PROPOSAL"


# ---------------------------------------------------------------------------
# Typed Routing Output Contract
# ---------------------------------------------------------------------------

class OkkaxRoutingDecision(BaseModel):
    """Typed routing decision emitted by the unified OKKAX Copilot Router."""

    mode: OkkaxRoutingMode = Field(description="Primary routing mode for this turn")
    domains: List[str] = Field(default_factory=list, description="Target domain classifications")
    required_tools: List[str] = Field(default_factory=list, description="Minimum necessary authoritative tool names (alias to required_llm_tools)")
    required_llm_tools: List[str] = Field(default_factory=list, description="Authoritative tools required for LLM runtime execution")
    required_deterministic_operations: List[str] = Field(default_factory=list, description="Canonical deterministic calculator operations (executed directly without LLM tool calls)")
    reasoning_required: bool = Field(default=False, description="Whether LLM reasoning is required")
    calculation_required: bool = Field(default=False, description="Whether deterministic calculation is required")
    clarification_required: bool = Field(default=False, description="Whether caller must be prompted for missing critical info")
    action_proposal: Optional[ActionProposalCard] = Field(default=None, description="Action proposal card for write intents")
    confidence: float = Field(default=1.0, description="Routing classification confidence score [0.0 - 1.0]")
    evidence_requirements: List[str] = Field(default_factory=list, description="Descriptions of required evidence")
    reasoning_hints: List[str] = Field(default_factory=list, description="Domain guidance hints for synthesis")
    problem_type: str = Field(default="question", description="Semantic shape of the user's actual problem")
    user_goal: str = Field(default="", description="Concise normalized goal to answer first")
    state_delta: Dict[str, Any] = Field(default_factory=dict, description="Typed fields explicitly updated by this turn")
    live_data_required: bool = Field(default=False, description="Whether current/live evidence is required")
    source: str = Field(default="shadow_router", description="Decision engine identifier")

    def model_post_init(self, __context: Any) -> None:
        """Sync required_tools and required_llm_tools for seamless backward compatibility."""
        if self.required_llm_tools and not self.required_tools:
            self.required_tools = list(self.required_llm_tools)
        elif self.required_tools and not self.required_llm_tools:
            self.required_llm_tools = list(self.required_tools)


# ---------------------------------------------------------------------------
# Patterns & Keywords
# ---------------------------------------------------------------------------

_ARITHMETIC_EXPRESSION_RE = re.compile(
    r"(?:\b(?:dibagi|kali|dikali|tambah|ditambah|kurang|dikurang|bagi|plus|minus)\b|"
    r"[\+\-\*\/]|\b\d+\s*(?:%|persen)\s*(?:dari|of)\b)",
    re.IGNORECASE,
)

_ENTERTAINMENT_KEYWORDS = re.compile(
    r"\b(lineup|headliner|opener|artis|musisi|band|dj|genre|electronic|jazz|rock|pop|indie|"
    r"festival concept|konsep festival|rundown|programming|curation|setlist)\b",
    re.IGNORECASE,
)

_DECISION_KEYWORDS = re.compile(
    r"\b(atau|vs|bandingkan|mana yang lebih|rekomendasi|trade-off|mending|lebih baik|opsi|"
    r"aman\b|aman gak|aman ga|aman kah|masih aman|feasible|worth it|mana pilihannya|pilih yang mana|"
    r"mana lebih masuk akal|apa dampaknya|dampaknya|apa risikonya|risiko terbesar|kalau .* batal|kalau .* turun|kalau sales|"
    r"siapkan|apa yang harus|bagaimana cara|panduan|paling cocok|relevan|project apa yang|event apa yang|prospek)\b",
    re.IGNORECASE,
)

_PLANNING_KEYWORDS = re.compile(
    r"\b(rencana|roadmap|timeline|jadwal persiapan|milestone|blueprint|tinggal \d+ hari|h-\d+|w-\d+)\b",
    re.IGNORECASE,
)

_ACTION_WRITE_KEYWORDS = re.compile(
    r"\b(buatkan|buat draft|bikin draft|buat \d+.*tiket|buat \d+.*qr|konfirmasi \d+.*tiket|tambah tiket|terbitkan tiket|terbitkan|publish event|publish|"
    r"hapus vendor|hapus|batalkan sponsor|batalkan|cancel|pesan venue|booking|ajukan izin|issue izin|issue|selesaikan blocker|checkout|"
    r"release payout|release dana|release|refund|bayar|transfer|eksekusi|approve)\b",
    re.IGNORECASE,
)


def analyze_semantic_problem(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Describe the user's problem before choosing capabilities.

    This is deliberately independent from response wording.  It gives the
    router one typed view of language, state delta, problem shape, domains,
    and live-data needs across Homepage, Chatbot, and Workspace.
    """
    from language_intelligence import normalize_user_language  # noqa: PLC0415
    from okkax_copilot_state import extract_turn_delta, reconstruct_conversation_state  # noqa: PLC0415

    language = normalize_user_language(message)
    normalized = str(language.get("normalized_text") or message or "").strip()
    q = normalized.lower()
    state = reconstruct_conversation_state(history, "")
    delta = extract_turn_delta(normalized, state)

    if _ACTION_WRITE_KEYWORDS.search(normalized):
        problem_type = "action_request"
    elif re.search(r"\b(ringkas|rangkum|rekap|summary)\b", q):
        problem_type = "summary"
    elif re.search(r"\b(koreksi|maksud saya|bukan .+ tapi|ubah|ganti|revisi)\b", q):
        problem_type = "correction"
    elif re.search(r"\b(cari|search|cek availability|cek ketersediaan|harga sewa|rate card|jadwal terbaru|live)\b", q):
        problem_type = "live_search_read"
    elif re.search(r"\b(hitung|kalkulasi|berapa total|berapa sponsor|berapa sponsornya|sponsor yang (?:saya )?butuhkan|bep|break-even|margin berapa|revenue berapa|sisa budget)\b", q):
        problem_type = "calculation"
    elif re.search(r"\b(bandingkan|beda(?:nya)?|versus|\bvs\b|atau.+atau|mana yang|siapa yang)\b", q):
        problem_type = "comparison"
    elif re.search(r"\b(rekomendasi|sebaiknya|mending|(?:paling|lebih) cocok|prioritas(?:nya)?|apa yang harus|job apa|proyek (?:seperti )?apa|project (?:seperti )?apa)\b", q):
        problem_type = "recommendation"
    elif re.search(r"\b(rencana|roadmap|timeline|langkah|persiapan)\b", q):
        problem_type = "planning"
    elif delta and history:
        problem_type = "state_update"
    elif re.search(r"^(apa|siapa|mengapa|kenapa|bagaimana|jelaskan|what|who|why|how)\b", q):
        problem_type = "knowledge_question"
    elif re.search(r"\b(ini|itu|tersebut|sekarang|lanjut|yang tadi|kondisinya|risikonya)\b", q) and history:
        problem_type = "follow_up_reference"
    else:
        problem_type = "question"

    # Definitions of role differences are knowledge questions.  A question
    # about who owns an actual go/no-go decision remains a comparison.
    if (
        problem_type == "comparison"
        and re.search(r"\b(?:apa )?beda(?:nya)?\b", q)
        and re.search(r"\b(promotor|promoter|event organizer|\beo\b)\b", q)
        and "production manager" not in q
        and "kewenangan" not in q
    ):
        problem_type = "knowledge_question"

    # A fully specified event budget request is a calculation even when it is
    # phrased as "mau bikin".  Decision words such as priority/risk/compare
    # keep it in reasoning mode instead of forcing a budget table.
    has_capacity = bool(
        re.search(r"\b\d+(?:[\.,]\d+)?\s*(?:k\s*)?(?:pax|orang|penonton)\b", q)
        or re.search(r"\bkapasitas\s*(?:jadi|ke|sekitar)?\s*\d+(?:[\.,]\d+)?\s*k?\b", q)
    )
    has_budget = bool(re.search(r"\b(?:budget|anggaran)\b[^.!?]{0,24}\d", q))
    has_decision_goal = bool(re.search(r"\b(prioritas(?:nya)?|risiko|bandingkan|sebaiknya|apa yang harus|premium)\b", q))
    if has_capacity and has_budget and not has_decision_goal:
        problem_type = "calculation"

    domain_terms = {
        "venue": ("venue", "gedung", "arena", "ballroom", "lokasi"),
        "vendor": ("vendor", "lighting", "led", "sound", "rigging", "produksi teknis"),
        "workforce": ("workforce", "freelancer", "crew", "stagehand", "usher", "security", "production manager"),
        "talent": ("talent", "artis", "headliner", "opener", "band", "dj"),
        "sponsor": ("sponsor", "brand", "komitmen", "committed"),
        "tenant": ("tenant", "booth", "f&b", "umkm"),
        "ticketing": ("tiket", "ticket", "sold", "gate", "scanner", "qr"),
        "finance": ("budget", "anggaran", "margin", "revenue", "bep", "break-even", "cashflow", "piutang"),
        "compliance": ("izin", "compliance", "legal", "safety", "siap", "ready"),
        "planning": ("event", "konser", "festival", "expo", "corporate", "show", "roadmap"),
    }
    domains = [name for name, words in domain_terms.items() if any(word in q for word in words)]
    if not domains:
        domains = ["general"]

    live_data_required = problem_type == "live_search_read" or bool(re.search(
        r"\b(tersedia|availability|harga sewa|rate card|jadwal terbaru|status live|aktual|sekarang tersedia)\b",
        q,
    ))
    return {
        "normalized_text": normalized,
        "language": language,
        "problem_type": problem_type,
        "user_goal": normalized,
        "domains": domains,
        "state_delta": delta,
        "live_data_required": live_data_required,
    }


# ---------------------------------------------------------------------------
# Unified Router Implementation
# ---------------------------------------------------------------------------

def route_okkax_query(
    message: str,
    ctx: OkkaxSessionContext,
    history: Optional[List[Dict[str, str]]] = None,
) -> OkkaxRoutingDecision:
    """Evaluate user message against context to determine optimal routing mode & tool set.

    Three Surfaces, One Brain: Surface does not alter routing logic, only entitlement & context.
    """
    semantic_problem = analyze_semantic_problem(message, history)
    clean_msg = semantic_problem["normalized_text"]
    problem_type = semantic_problem["problem_type"]
    if not clean_msg:
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.DIRECT,
            domains=["general"],
            required_tools=[],
            confidence=1.0,
        )

    # 1. DIRECT Short-circuit (Small-talk / Greeting / Gratitude)
    try:
        from okkax_copilot import _small_talk_reply  # noqa: PLC0415
        if _small_talk_reply(clean_msg) is not None:
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.DIRECT,
                domains=["general"],
                required_tools=[],
                reasoning_required=False,
                calculation_required=False,
                confidence=1.0,
                reasoning_hints=["Answer directly with friendly concise conversational Indonesian."],
            )
    except Exception:
        pass

    # 2. DETERMINISTIC Pure Arithmetic & RAB Conversational Short-circuit
    try:
        from financial_state import evaluate_rab_conversational_turn  # noqa: PLC0415
        if evaluate_rab_conversational_turn(clean_msg, history=history) is not None:
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.DETERMINISTIC,
                domains=["finance", "budget", "operations"],
                required_tools=[],
                required_llm_tools=[],
                required_deterministic_operations=[],
                reasoning_required=True,
                calculation_required=True,
                confidence=1.0,
                evidence_requirements=["Deterministic financial & RAB reasoning"],
            )
    except Exception:
        pass

    try:
        from okkax_copilot import _direct_arithmetic_reply  # noqa: PLC0415
        if _direct_arithmetic_reply(clean_msg) is not None or (
            _ARITHMETIC_EXPRESSION_RE.search(clean_msg) and re.search(r"\b(\d+|miliar|juta|jt|m|k)\b", clean_msg, re.IGNORECASE)
            and not _DECISION_KEYWORDS.search(clean_msg)
            and not _ENTERTAINMENT_KEYWORDS.search(clean_msg)
            and not re.search(r"\b(kapasitas|venue|sponsor|talent|tiket)\b", clean_msg, re.IGNORECASE)
        ):
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.DETERMINISTIC,
                domains=["finance", "math"],
                required_tools=[],  # Zero tool — pure deterministic engine solves it
                required_llm_tools=[],
                required_deterministic_operations=[],  # Pure math, not event-budget calculator
                reasoning_required=False,
                calculation_required=True,
                confidence=1.0,
                evidence_requirements=["Deterministic arithmetic solution"],
            )
    except Exception:
        pass

    # 3. ACTION PROPOSAL Intent (Zero Execution)
    if _ACTION_WRITE_KEYWORDS.search(clean_msg):
        # Extract action details
        action_name = "propose_event_action"
        domain = "event"
        params: Dict[str, Any] = {"raw_intent": clean_msg}
        lower_msg = clean_msg.lower()
        if "payout" in lower_msg or "transfer" in lower_msg or "bayar" in lower_msg or "release" in lower_msg:
            action_name = "release_vendor_payout"
            domain = "finance"
        elif "refund" in lower_msg:
            action_name = "process_ticket_refund"
            domain = "ticketing"
        elif "tiket" in lower_msg or "qr" in lower_msg:
            action_name = "create_ticket_tier"
            domain = "ticketing"
            qty_match = re.search(r"(\d+(?:\.\d+)?)", clean_msg)
            if qty_match:
                params["quantity"] = int(qty_match.group(1).replace(".", ""))
            tier_match = re.search(r"\b(regular|vip|vvip|early bird|presale)\b", clean_msg, re.IGNORECASE)
            if tier_match:
                params["tier"] = tier_match.group(1).title()
            if "jangan publish" in lower_msg or "draft" in lower_msg:
                params["publish"] = False
                params["action_mode"] = "draft"
        elif "draft" in lower_msg or "event" in lower_msg:
            action_name = "create_draft_event"
            domain = "event"
        elif "blocker" in lower_msg or "izin" in lower_msg or "permit" in lower_msg:
            action_name = "resolve_compliance_blocker" if "blocker" in lower_msg else "issue_event_permit"
            domain = "compliance"

        card = ActionProposalCard(
            action=action_name,
            label=f"Konfirmasi Aksi: {action_name}",
            domain=domain,
            requires_role="organizer",
            params=params,
            warning="Aksi memerlukan otorisasi resmi di workspace organizer dan tidak dieksekusi otomatis dari chat.",
        )

        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.ACTION_PROPOSAL,
            domains=[domain],
            required_tools=[],
            required_llm_tools=[],
            required_deterministic_operations=[],
            reasoning_required=False,
            calculation_required=False,
            action_proposal=card,
            confidence=0.95,
            reasoning_hints=["Present structured confirmation card; DO NOT execute any write operations."],
        )

    # 4. Constraint Parsing. Language normalization and semantic problem
    # analysis have already happened before every capability gate above.
    from language_intelligence import normalize_user_language  # noqa: PLC0415
    from okkax_copilot import (  # noqa: PLC0415
        _is_state_follow_up,
        _knowledge_note_for,
        build_semantic_plan,
        parse_constraints,
    )

    lang_res = semantic_problem["language"]
    normalized = clean_msg
    parsed = parse_constraints(normalized)

    # Multi-turn history scoping: check new-topic reset boundary
    relevant_history = []
    if history:
        own_plan = build_semantic_plan(normalized)
        if _is_state_follow_up(own_plan, history):
            relevant_history = history
            from okkax_copilot import merge_multi_turn_state  # noqa: PLC0415
            merged_plan = merge_multi_turn_state(own_plan, history)
            merged_c = merged_plan.get("constraints") or {}
            merged_e = merged_plan.get("entities") or {}
            if merged_c.get("budget"):
                parsed["budget"] = merged_c["budget"]
            if merged_c.get("capacity"):
                parsed["capacity"] = merged_c["capacity"]
            if merged_e.get("city") and not parsed.get("city"):
                parsed["city"] = merged_e["city"]

    # 5. KNOWLEDGE Intent (Domain explanation / note / platform info)
    knote = _knowledge_note_for(normalized)
    is_knowledge_query = bool(knote) or bool(
        re.search(
            r"^(apa itu|siapa kamu|tentang okkax|apa fungsi|definisi|bagaimana aturan|standar|regulasi)\b",
            normalized,
            re.IGNORECASE,
        )
    )
    if problem_type != "comparison" and is_knowledge_query and not parsed.get("budget") and not parsed.get("capacity") and not _ACTION_WRITE_KEYWORDS.search(normalized):
        from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
        evidence_coll = retrieve_okkax_knowledge(normalized, ctx)
        ev_reqs = [f"{it.title}: {it.content[:80]}..." for it in evidence_coll.items] or ["Canonical OKKAX domain knowledge"]

        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.KNOWLEDGE,
            domains=["knowledge"],
            required_tools=[],
            required_llm_tools=[],
            reasoning_required=False,
            calculation_required=False,
            confidence=0.95,
            evidence_requirements=ev_reqs,
        )

    # 6. Critical Ambiguity / CLARIFY Check
    # e.g., asks "berapa sisa budget?" or "kondisi event saya?" without active event snapshot and without numbers in current turn
    asks_event_state = bool(re.search(r"\b(sisa budget|kondisi keuangan event|status tiket event|compliance event saya|status keuangan event|kondisi event saya|budget event saya)\b", normalized, re.IGNORECASE))
    has_inline_numbers = bool(re.search(r"\b\d+\s*(?:miliar|juta|jt|m|k)\b", normalized, re.IGNORECASE))
    if asks_event_state and not ctx.event_id and not ctx.event_snapshot and not has_inline_numbers:
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.CLARIFY,
            domains=["event", "finance"],
            required_tools=[],
            clarification_required=True,
            reasoning_required=False,
            confidence=0.9,
            reasoning_hints=["Prompt user to select or specify which event they are referring to."],
        )

    # 7. DETERMINISTIC Calculator / Budget / Ratio queries
    # Pure calculations execute through canonical deterministic engines without requiring LLM tool selection.
    # e.g. "budget 1M, kapasitas 5000" or "hitung rasio usher 8000 pax"
    has_budget = bool(parsed.get("budget")) or bool(re.search(r"\bbudget\s*(?:event)?\s*(?:saya)?\s*\d+", normalized, re.IGNORECASE))
    has_capacity = bool(parsed.get("capacity")) or bool(re.search(r"\b\d+\s*(?:orang|pax|penonton)\b", normalized, re.IGNORECASE))
    is_calculator_query = problem_type == "calculation"
    is_decision_query = problem_type in ("comparison", "recommendation") or bool(_DECISION_KEYWORDS.search(normalized))

    # Check for follow-up sensitivity queries (e.g. "Kalau sponsor batal?")
    is_follow_up_sensitivity = bool(re.search(r"\b(kalau|jika|dampaknya|risiko)\b", normalized, re.IGNORECASE) and (history or "batal" in normalized.lower() or "turun" in normalized.lower()))

    is_search_query = problem_type == "live_search_read" or bool(re.search(r"\b(cari|search|cek)\s+(?:talent|venue|vendor|pekerja)\b", normalized, re.IGNORECASE))

    if is_calculator_query and not is_decision_query and not is_search_query:
        det_ops = []
        if has_budget or "budget" in normalized.lower() or "alokasi" in normalized.lower() or "sisa budget" in normalized.lower():
            det_ops.append("calculate_event_budget")
        if "usher" in normalized.lower() or "security" in normalized.lower() or "sound" in normalized.lower() or "workforce" in normalized.lower():
            det_ops.append("calculate_workforce_ratios")
        if not det_ops:
            det_ops.append("calculate_event_budget")

        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.DETERMINISTIC,
            domains=["finance", "workforce"],
            required_tools=[],  # Zero LLM-selected tools
            required_llm_tools=[],  # Zero LLM tools
            required_deterministic_operations=det_ops,  # Direct canonical executor
            calculation_required=True,
            reasoning_required=False,
            confidence=0.95,
            evidence_requirements=["Deterministic policy calculations via canonical engine"],
            problem_type=problem_type,
            user_goal=semantic_problem["user_goal"],
            state_delta=semantic_problem["state_delta"],
        )

    # 8. DECISION SUPPORT (Comparisons / Feasibility / Risk vs Options / Sensitivity)
    # e.g. "venue Bandung 5k atau Jakarta 8k untuk budget 1M?", "Apakah cash position saya aman?", "Kalau sponsor batal?"
    is_financial_decision = bool(re.search(r"\b(cash position|aman|boncos|rugi|margin|sponsor.*batal|sales.*60%|dampaknya)\b", normalized, re.IGNORECASE))

    if is_decision_query or is_financial_decision or (has_budget and re.search(r"\b(headliner|venue|vendor|sponsor|jangan boncos|jangan lewat)\b", normalized, re.IGNORECASE)) or is_follow_up_sensitivity:
        tools = []
        det_ops = []
        if has_budget or has_inline_numbers or "sponsor" in normalized.lower():
            det_ops.append("calculate_event_budget")

        # Check if user already supplied comparison options (Venue A vs Venue B, Vendor A vs Vendor B)
        has_supplied_comparison_options = bool(
            re.search(r"\b(?:venue|vendor|opsi|pilihan)\s+[a-z]\b", normalized, re.IGNORECASE)
            or (re.search(r"\b(?:venue|vendor)\s+a\b", normalized, re.IGNORECASE) and re.search(r"\b(?:venue|vendor)\s+b\b", normalized, re.IGNORECASE))
            or ("kapasitas" in normalized.lower() and "harga" in normalized.lower() and (" vs " in normalized.lower() or " atau " in normalized.lower()))
        )

        # Minimum Tool Discipline: Only query supply if specific unsupplied search is explicitly requested
        if re.search(r"\b(cari talent|cari venue|cari vendor|rekomendasi vendor)\b", normalized, re.IGNORECASE) and not has_supplied_comparison_options:
            tools.append("search_network_supply")
        # Mentioning a supply domain is not itself a live-search request.
        # Recommendations can be synthesized from user context + knowledge;
        # catalog/network reads are reserved for explicit search intent.

        if ctx.can_access_private_event and ("keuangan" in normalized.lower() or "kondisi" in normalized.lower() or "status" in normalized.lower()):
            tools.append("get_event_financial_status")

        semantic_domains = list(dict.fromkeys(semantic_problem["domains"] + ["decision"]))
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.DECISION_SUPPORT,
            domains=semantic_domains,
            required_tools=tools[:2],
            required_llm_tools=tools[:2],
            required_deterministic_operations=det_ops,
            calculation_required=bool(det_ops),
            reasoning_required=True,
            confidence=0.92,
            reasoning_hints=["Perform trade-off analysis, highlight risk factors and budget constraints."],
            problem_type=problem_type,
            user_goal=semantic_problem["user_goal"],
            state_delta=semantic_problem["state_delta"],
            live_data_required=semantic_problem["live_data_required"],
        )

    # 9. ENTERTAINMENT Reasoning
    # e.g. "lineup 1 headliner 3 opener", "buat konsep festival electronic Jakarta"
    if _ENTERTAINMENT_KEYWORDS.search(normalized):
        tools = []
        # Minimum Tool Discipline: Only call supply tool if actual talent availability/search is requested
        if re.search(r"\b(cari talent|cari artis|daftar talent|cek artis|rekomendasi artis)\b", normalized, re.IGNORECASE):
            tools.append("search_network_supply")
        det_ops = []
        if has_budget or has_capacity:
            det_ops.append("calculate_event_budget")

        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.ENTERTAINMENT,
            domains=["entertainment", "programming"],
            required_tools=tools[:1],
            required_llm_tools=tools[:1],
            required_deterministic_operations=det_ops,
            reasoning_required=True,
            calculation_required=bool(det_ops),
            confidence=0.9,
            reasoning_hints=["Reason over artist flow, pacing, genre synergy, and audience excitement."],
        )

    # 10. PLANNING Mode
    # Minimum Tool Discipline: Pure conceptual planning (e.g. "tahapan persiapan 3 hari") requires 0 tools.
    # Tools are selected only if live event data or explicit calculation is required.
    if problem_type == "planning" or _PLANNING_KEYWORDS.search(normalized) or re.search(r"\b(?:tinggal\s+\d+\s+hari|h-\d+|w-\d+)\b", normalized, re.IGNORECASE):
        tools = []
        det_ops = []
        if ctx.can_access_private_event and re.search(r"\b(event saya|status event|jadwal event)\b", normalized, re.IGNORECASE):
            tools.append("get_private_event_summary")
        if has_budget:
            det_ops.append("calculate_event_budget")
        if has_capacity:
            det_ops.append("calculate_workforce_ratios")

        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.PLANNING,
            domains=["planning", "operations"],
            required_tools=tools[:1],
            required_llm_tools=tools[:1],
            required_deterministic_operations=det_ops,
            reasoning_required=True,
            calculation_required=bool(det_ops),
            confidence=0.9,
            reasoning_hints=["Structure phased roadmap, milestone dependencies, and operational readiness checkpoints."],
            problem_type=problem_type,
            user_goal=semantic_problem["user_goal"],
            state_delta=semantic_problem["state_delta"],
        )

    # 11. MULTI_TOOL_REASONING Mode (Correlating multiple private/public domains)
    # e.g. "cek status compliance dan budget event saya", "cek kondisi finance dan compliance event saya"
    is_multi_domain = sum([
        bool(re.search(r"\b(budget|keuangan|biaya|finance|finansial)\b", normalized, re.IGNORECASE)),
        bool(re.search(r"\b(tiket|penjualan|sales|ticketing)\b", normalized, re.IGNORECASE)),
        bool(re.search(r"\b(compliance|izin|legal|perizinan|kompliansi)\b", normalized, re.IGNORECASE)),
        bool(re.search(r"\b(risiko|insiden|blocker|operasional)\b", normalized, re.IGNORECASE)),
    ]) >= 2

    if is_multi_domain and ctx.can_access_private_event:
        tools = []
        if re.search(r"\b(budget|keuangan|biaya|finance|finansial)\b", normalized, re.IGNORECASE):
            tools.append("get_event_financial_status")
        if re.search(r"\b(tiket|penjualan|sales|ticketing)\b", normalized, re.IGNORECASE):
            tools.append("get_event_ticketing_health")
        if re.search(r"\b(compliance|izin|legal|perizinan|kompliansi)\b", normalized, re.IGNORECASE):
            tools.append("get_event_compliance_readiness")
        if re.search(r"\b(risiko|insiden|blocker|operasional)\b", normalized, re.IGNORECASE):
            tools.append("get_event_operational_blockers")

        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.MULTI_TOOL_REASONING,
            domains=["operations", "cross_domain"],
            required_tools=tools[:3],
            required_llm_tools=tools[:3],
            reasoning_required=True,
            confidence=0.92,
            evidence_requirements=["Correlated evidence from multiple authoritative domain engines"],
        )

    # 12. SINGLE INTERNAL_READ Mode
    # Calendar query
    if re.search(r"\b(kalender|jadwal|minggu ini|bulan ini|agenda|hari ini|besok|akhir pekan|minggu depan)\b", normalized, re.IGNORECASE) and any(w in normalized.lower() for w in ("event", "acara", "konser", "festival")):
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.INTERNAL_READ,
            domains=["calendar"],
            required_tools=["get_public_calendar_events"],
            reasoning_required=False,
            confidence=0.95,
        )

    # Public event catalog
    if (
        re.search(r"\b(event apa|daftar event|cari event|festival apa)\b", normalized, re.IGNORECASE)
        or (
            re.search(r"\b(cari|daftar|lihat|rekomendasi)\b", normalized, re.IGNORECASE)
            and re.search(r"\b(event|festival|konser|acara)\b", normalized, re.IGNORECASE)
        )
    ):
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.INTERNAL_READ,
            domains=["catalog"],
            required_tools=["get_public_event_catalog"],
            reasoning_required=False,
            confidence=0.95,
        )

    # Network supply search (talent, venue, vendor, worker)
    if is_search_query and re.search(r"\b(talent|venue|vendor|pekerja|workforce)\b", normalized, re.IGNORECASE):
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.INTERNAL_READ,
            domains=["supply"],
            required_tools=["search_network_supply"],
            reasoning_required=False,
            confidence=0.95,
            problem_type=problem_type,
            user_goal=semantic_problem["user_goal"],
            state_delta=semantic_problem["state_delta"],
            live_data_required=True,
        )

    # Platform metrics context
    if re.search(r"\b(berapa total event|statistik platform|ekosistem okkax)\b", normalized, re.IGNORECASE):
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.INTERNAL_READ,
            domains=["platform"],
            required_tools=["get_public_platform_context"],
            reasoning_required=False,
            confidence=0.95,
        )

    # User tickets summary
    if re.search(r"\b(tiket saya|pesanan tiket|e-ticket saya)\b", normalized, re.IGNORECASE):
        tools = ["get_my_tickets_summary"] if ctx.is_authenticated else []
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.INTERNAL_READ,
            domains=["ticketing"],
            required_tools=tools,
            reasoning_required=False,
            confidence=0.95,
        )

    # Private single-domain event queries (if authorized)
    if ctx.can_access_private_event:
        if "budget" in normalized.lower() or "biaya" in normalized.lower():
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.INTERNAL_READ,
                domains=["finance"],
                required_tools=["get_event_financial_status"],
                reasoning_required=False,
                confidence=0.95,
            )
        if "tiket" in normalized.lower() or "gmv" in normalized.lower():
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.INTERNAL_READ,
                domains=["ticketing"],
                required_tools=["get_event_ticketing_health"],
                reasoning_required=False,
                confidence=0.95,
            )
        if "compliance" in normalized.lower() or "izin" in normalized.lower():
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.INTERNAL_READ,
                domains=["compliance"],
                required_tools=["get_event_compliance_readiness"],
                reasoning_required=False,
                confidence=0.95,
            )
        if "blocker" in normalized.lower() or "risiko" in normalized.lower():
            return OkkaxRoutingDecision(
                mode=OkkaxRoutingMode.INTERNAL_READ,
                domains=["operations"],
                required_tools=["get_event_operational_blockers"],
                reasoning_required=False,
                confidence=0.95,
            )
        # Default private fallback
        return OkkaxRoutingDecision(
            mode=OkkaxRoutingMode.INTERNAL_READ,
            domains=["event"],
            required_tools=["get_private_event_summary"],
            reasoning_required=False,
            confidence=0.9,
        )

    # Default general fallback
    return OkkaxRoutingDecision(
        mode=OkkaxRoutingMode.DIRECT,
        domains=["general"],
        required_tools=[],
        reasoning_required=False,
        confidence=0.8,
    )


# ---------------------------------------------------------------------------
# Shadow Evaluation & Comparison Harness
# ---------------------------------------------------------------------------

def compare_routing_decisions(
    message: str,
    ctx: OkkaxSessionContext,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Compare legacy pipeline routing intent vs new typed shadow router decision."""
    from okkax_copilot import build_semantic_plan  # noqa: PLC0415

    legacy_plan = build_semantic_plan(message, history=history, event_id_present=bool(ctx.event_id))
    shadow_decision = route_okkax_query(message, ctx, history=history)

    return {
        "message": message,
        "legacy_intent": legacy_plan.get("intent"),
        "legacy_domains": legacy_plan.get("domains"),
        "shadow_mode": shadow_decision.mode.value,
        "shadow_required_tools": shadow_decision.required_tools,
        "shadow_reasoning_required": shadow_decision.reasoning_required,
        "shadow_calculation_required": shadow_decision.calculation_required,
        "shadow_action_proposal": bool(shadow_decision.action_proposal),
        "agreement": legacy_plan.get("intent", "").lower() in shadow_decision.mode.value.lower(),
    }
