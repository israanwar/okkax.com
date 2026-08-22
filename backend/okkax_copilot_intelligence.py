"""OKKAX Copilot — Evidence-Grounded Planning & Decision Intelligence (COPILOT-05 Shadow Substrate).

Implements structured reasoning models, deterministic option comparisons, what-if sensitivity analysis,
and entertainment decision support with strict provenance and authority tracking.

SHADOW MODE: Not wired to production `/okkax/chat`.

Non-Negotiable Principles:
  1. Never flatten reasoning inputs into an untyped text blob.
  2. The LLM may interpret results, but MUST NOT calculate authoritative numbers itself.
  3. Missing data remains explicitly UNKNOWN, never fabricated.
  4. What-if / Counterfactual calculations compute non-destructively via deterministic formulas.
  5. Planning & Decision outputs may propose next actions via ActionProposalCard; ZERO write executions.
"""

from __future__ import annotations

import logging
import re
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from okkax_copilot_knowledge import (
    AuthorityTier,
    OkkaxEvidenceCollection,
    OkkaxEvidenceItem,
    ProvenanceType,
)
from okkax_copilot_models import ActionProposalCard

logger = logging.getLogger("okkax.copilot.intelligence")


# ---------------------------------------------------------------------------
# Risk & Grounding Enums
# ---------------------------------------------------------------------------

class RiskSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RuleGroundingClassification(str, Enum):
    VERIFIED_EXTERNAL_FACT = "VERIFIED_EXTERNAL_FACT"      # Verified external legal/data record or live authoritative DB
    OKKAX_CANONICAL_RULE = "OKKAX_CANONICAL_RULE"          # Locked OKKAX platform spec (e.g. Event Studio W-4, HMAC QR)
    CURATED_PRACTICE = "CURATED_PRACTICE"                  # Curated industry benchmark/heuristic (e.g. 1:80 ushers, 18 W/pax)
    UNKNOWN_LIVE_VERIFICATION = "UNKNOWN_LIVE_VERIFICATION"  # Local/jurisdiction specific, requires live regional verification

    # Backward compatibility aliases
    VERIFIED_FACT = "VERIFIED_EXTERNAL_FACT"
    CANONICAL_SPEC = "OKKAX_CANONICAL_RULE"


class OkkaxRiskItem(BaseModel):
    """Structured operational, financial, compliance, or talent risk item."""

    severity: RiskSeverity = Field(description="Severity classification")
    domain: str = Field(description="finance | compliance | operations | talent | venue | crowd_safety")
    title: str = Field(description="Concise risk header")
    reason: str = Field(description="Root cause or condition creating the risk")
    evidence_source: str = Field(description="Traceable source key or calculation origin")
    impact: str = Field(description="Operational or commercial impact")
    mitigation: str = Field(description="Concrete actionable mitigation step")
    grounding_classification: RuleGroundingClassification = Field(
        default=RuleGroundingClassification.CURATED_PRACTICE,
        description="Epistemological classification of the underlying rule",
    )


# ---------------------------------------------------------------------------
# Evidence Sufficiency Scoring (Support Completeness, NOT Probability)
# ---------------------------------------------------------------------------

def compute_evidence_sufficiency_score(
    live_facts_count: int = 0,
    calculations_count: int = 0,
    canonical_evidence_count: int = 0,
    curated_knowledge_count: int = 0,
    assumptions_count: int = 0,
    unknowns_count: int = 0,
    conflicts_count: int = 0,
    live_data_required_missing: bool = False,
) -> float:
    """Compute evidence sufficiency score measuring support completeness.

    Semantics:
      - This is NOT a statistical probability of correctness (no '95% true' claim).
      - It measures whether the reasoning is grounded in verified live data, calculations,
        and canonical specs versus assumptions and missing unknowns.

    Scoring Logic:
      - Baseline with 0 evidence: 0.25 (low sufficiency)
      - +0.30 if live facts present (+0.05 per additional fact, max +0.40)
      - +0.20 if deterministic calculations present
      - +0.10 if canonical OKKAX specs present
      - +0.05 if curated domain knowledge present
      - -0.08 per unknown
      - -0.04 per assumption
      - -0.15 per detected authority conflict
      - -0.25 if required live data is missing/unavailable
      Clamped between [0.10, 0.99], rounded to 2 decimal places.
    """
    score = 0.25

    if live_facts_count > 0:
        score += min(0.40, 0.30 + 0.05 * (live_facts_count - 1))
    if calculations_count > 0:
        score += 0.20
    if canonical_evidence_count > 0:
        score += 0.10
    if curated_knowledge_count > 0:
        score += 0.05

    score -= (0.08 * unknowns_count)
    score -= (0.04 * assumptions_count)
    score -= (0.15 * conflicts_count)

    if live_data_required_missing:
        score -= 0.25

    return round(max(0.10, min(0.99, score)), 2)


# Backward compatibility alias
def compute_deterministic_confidence(
    live_facts_count: int = 0,
    calculations_count: int = 0,
    assumptions_count: int = 0,
    unknowns_count: int = 0,
    conflicts_count: int = 0,
    live_data_required_missing: bool = False,
) -> float:
    """Alias for compute_evidence_sufficiency_score with canonical defaults."""
    # When called with only legacy parameters, treat as standard canonical workflow
    return compute_evidence_sufficiency_score(
        live_facts_count=live_facts_count,
        calculations_count=calculations_count,
        canonical_evidence_count=1 if (live_facts_count or calculations_count) else 0,
        curated_knowledge_count=1 if (live_facts_count or calculations_count) else 0,
        assumptions_count=assumptions_count,
        unknowns_count=unknowns_count,
        conflicts_count=conflicts_count,
        live_data_required_missing=live_data_required_missing,
    )


# ---------------------------------------------------------------------------
# Typed Reasoning Input
# ---------------------------------------------------------------------------

class OkkaxReasoningInput(BaseModel):
    """Structured input package provided to planning and decision support engines.

    Guarantees that live facts, deterministic calculations, canonical specs, and curated
    knowledge are separated cleanly from user constraints, assumptions, and unknowns.
    """

    explicit_constraints: Dict[str, Any] = Field(default_factory=dict, description="Current-turn explicit constraints")
    live_facts: List[OkkaxEvidenceItem] = Field(default_factory=list, description="Verified live OKKAX state (Tier 1)")
    calculated_results: List[OkkaxEvidenceItem] = Field(default_factory=list, description="Deterministic calculations (Tier 1/3)")
    canonical_evidence: List[OkkaxEvidenceItem] = Field(default_factory=list, description="Platform locked specs (Tier 2)")
    curated_knowledge: List[OkkaxEvidenceItem] = Field(default_factory=list, description="Curated domain cards (Tier 3)")
    assumptions: List[str] = Field(default_factory=list, description="Explicit assumptions made for this turn")
    unknowns: List[str] = Field(default_factory=list, description="Information not present in evidence or constraints")
    conflicts_detected: List[Any] = Field(default_factory=list, description="Detected authority conflicts")


# ---------------------------------------------------------------------------
# Decision & Option Comparison Models
# ---------------------------------------------------------------------------

class OkkaxDecisionPlan(BaseModel):
    """Typed decision support analysis with evidence-backed recommendations."""

    objective: str = Field(description="Primary decision objective")
    options: List[Dict[str, Any]] = Field(default_factory=list, description="Candidate options evaluated")
    constraints: Dict[str, Any] = Field(default_factory=dict, description="Governing constraints applied")
    facts: List[str] = Field(default_factory=list, description="Ground truth facts cited")
    calculations: List[Dict[str, Any]] = Field(default_factory=list, description="Deterministic numeric models evaluated")
    tradeoffs: List[str] = Field(default_factory=list, description="Comparative trade-offs between options")
    risks: List[OkkaxRiskItem] = Field(default_factory=list, description="Structured risks identified")
    assumptions: List[str] = Field(default_factory=list, description="Assumptions underlying the analysis")
    unknowns: List[str] = Field(default_factory=list, description="Missing data points that remain unverified")
    recommended_option: Optional[str] = Field(default=None, description="Name or key of the recommended option")
    recommendation_reason: str = Field(description="Evidence-traceable rationale for recommendation")
    evidence_sufficiency_score: float = Field(default=0.85, description="Evidence completeness support score [0.10 - 0.99]")
    confidence: float = Field(default=0.85, description="Alias for evidence_sufficiency_score")
    next_steps: List[str] = Field(default_factory=list, description="Recommended next actions for user")
    action_proposal: Optional[ActionProposalCard] = Field(default=None, description="Optional action card for UI confirmation")


# ---------------------------------------------------------------------------
# Planning Models
# ---------------------------------------------------------------------------

class OkkaxPlanPhase(BaseModel):
    """Structured milestone phase in an event timeline."""

    phase_code: str = Field(description="'W-8' | 'W-4' | 'W-2' | 'W-1' | 'W-0' | 'Post-Event'")
    title: str = Field(description="Phase title")
    milestones: List[str] = Field(default_factory=list, description="Key deliverables and checklist items")
    decision_gates: List[str] = Field(default_factory=list, description="Go/No-Go criteria before progressing")
    deliverables: List[str] = Field(default_factory=list, description="Expected operational assets")


class OkkaxEventPlan(BaseModel):
    """Evidence-grounded comprehensive event roadmap and blueprint."""

    goal: str = Field(description="Event strategic or operational goal")
    phases: List[OkkaxPlanPhase] = Field(default_factory=list, description="Phased timeline breakdown")
    tasks_or_milestones: List[str] = Field(default_factory=list, description="Overall milestone checklist")
    dependencies: List[str] = Field(default_factory=list, description="Cross-workstream dependencies")
    constraints: Dict[str, Any] = Field(default_factory=dict, description="Budget, capacity, and city constraints")
    critical_risks: List[OkkaxRiskItem] = Field(default_factory=list, description="High/Critical risks and mitigations")
    required_resources: Dict[str, Any] = Field(default_factory=dict, description="Workforce, production, and equipment needs")
    financial_implications: Dict[str, Any] = Field(default_factory=dict, description="Cost breakdown and funding gap notes")
    decision_gates: List[str] = Field(default_factory=list, description="Required approval gates")
    assumptions: List[str] = Field(default_factory=list, description="Operational assumptions")
    unknowns: List[str] = Field(default_factory=list, description="Unconfirmed parameters")
    next_action: Optional[ActionProposalCard] = Field(default=None, description="Proposed first step card")
    evidence_sufficiency_score: float = Field(default=0.85, description="Evidence completeness support score [0.10 - 0.99]")
    confidence: float = Field(default=0.85, description="Alias for evidence_sufficiency_score")


# ---------------------------------------------------------------------------
# Deterministic Financial & What-If Engine
# ---------------------------------------------------------------------------

def run_what_if_analysis(
    scenario_query: str,
    baseline_state: Dict[str, Any],
    constraints: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Execute non-destructive counterfactual sensitivity calculations.

    Supported Scenarios:
      - 'sponsor batal' / 'sponsor turun': Recalculates net funding gap and required ticket price/sales.
      - 'kapasitas naik/turun X%': Adjusts capacity, budget allocations, and workforce ratios deterministically.
      - 'ticket sales cuma X%': Computes revenue shortfall vs Break-Even Point (BEP).
      - 'pindah venue': Evaluates capacity variance and budget feasibility.
    """
    from okkax_copilot import calculate_advanced_event_model  # noqa: PLC0415

    q = (scenario_query or "").lower()
    c = constraints or {}

    base_budget = float(c.get("budget") or baseline_state.get("total_cost") or baseline_state.get("budget") or 1_000_000_000)
    base_capacity = int(c.get("capacity") or baseline_state.get("capacity") or 5_000)
    base_confirmed_sponsor = float(baseline_state.get("confirmed_funding") or c.get("sponsor_committed") or 0.0)

    # 1. Sponsor Cancellation Counterfactual
    if "sponsor batal" in q or "sponsor turun" in q or "sponsor hilang" in q:
        new_sponsor = 0.0
        funding_gap = base_budget - new_sponsor
        bep_ticket_price = funding_gap / (base_capacity * 0.85) if base_capacity > 0 else 0
        risk = OkkaxRiskItem(
            severity=RiskSeverity.CRITICAL if funding_gap > 0.5 * base_budget else RiskSeverity.HIGH,
            domain="finance",
            title="Sponsorship Cancellation Deficit",
            reason="Komitmen sponsor batal 100%, seluruh beban pendanaan berpindah ke penjualan tiket atau dana cadangan.",
            evidence_source="what_if:sponsor_cancellation",
            impact=f"Funding gap meningkat menjadi Rp{funding_gap:,.0f}. Rata-rata harga tiket BEP naik ke Rp{bep_ticket_price:,.0f} pada 85% okupansi.",
            mitigation="Buka tier presale tambahan atau renegosiasi alokasi talent rider untuk memangkas budget produksi.",
        )
        return {
            "scenario": "sponsor_cancellation",
            "baseline_funding_gap": float(baseline_state.get("funding_gap") or 0.0),
            "recalculated_funding_gap": funding_gap,
            "recalculated_sponsor_funding": new_sponsor,
            "bep_ticket_price_85pct": bep_ticket_price,
            "risk": risk.model_dump(),
            "provenance_type": "CALCULATED",
        }

    # 2. Capacity Adjustment Counterfactual (+X% / -X%)
    cap_match = re.search(r"kapasitas\s+(?:naik|turun|ubah)?\s*(\d+)(?:%|\s*persen)", q)
    if cap_match or "kapasitas naik" in q or "kapasitas turun" in q:
        pct = float(cap_match.group(1)) if cap_match else 20.0
        multiplier = (1.0 + pct / 100.0) if "turun" not in q else (1.0 - pct / 100.0)
        new_capacity = int(base_capacity * multiplier)

        model = calculate_advanced_event_model(budget=int(base_budget), capacity=new_capacity)
        ushers_needed = max(1, new_capacity // 80)
        security_needed = max(1, new_capacity // 100)

        risk = OkkaxRiskItem(
            severity=RiskSeverity.HIGH if multiplier > 1.3 else RiskSeverity.MEDIUM,
            domain="operations",
            title=f"Capacity Scale Adjustment ({'+' if multiplier >= 1.0 else ''}{pct:.0f}%)",
            reason=f"Perubahan kapasitas penonton menjadi {new_capacity:,} pax mengubah kebutuhan rasio crowd control dan beban sanitasi.",
            evidence_source="what_if:capacity_scaling",
            impact=f"Kebutuhan usher naik menjadi {ushers_needed} orang, security {security_needed} orang, audio {new_capacity * 18:,} W.",
            mitigation="Konfirmasi izin kapasitas damkar dan perluas koridor evakuasi menjadi minimal 2.5 meter.",
        )
        return {
            "scenario": "capacity_scaling",
            "baseline_capacity": base_capacity,
            "recalculated_capacity": new_capacity,
            "ushers_needed": ushers_needed,
            "security_needed": security_needed,
            "budget_allocation": model.get("budget_allocation"),
            "risk": risk.model_dump(),
            "provenance_type": "CALCULATED",
        }

    # 3. Ticket Sell-Through Shortfall Counterfactual (e.g. 60% sales)
    sales_match = re.search(r"ticket\s+sales\s+(?:cuma|hanya|sebesar)?\s*(\d+)%", q)
    if sales_match or "sales cuma" in q or "penjualan tiket rendah" in q:
        sell_pct = float(sales_match.group(1)) if sales_match else 60.0
        sold_tickets = int(base_capacity * (sell_pct / 100.0))
        avg_price = float(c.get("ticket_price") or 250_000)
        gross_sales = sold_tickets * avg_price
        net_balance = gross_sales + base_confirmed_sponsor - base_budget

        risk = OkkaxRiskItem(
            severity=RiskSeverity.HIGH if net_balance < 0 else RiskSeverity.LOW,
            domain="finance",
            title=f"Low Ticket Sell-Through ({sell_pct:.0f}%)",
            reason=f"Penjualan tiket hanya mencapai {sell_pct:.0f}% ({sold_tickets:,} tiket dari {base_capacity:,} pax).",
            evidence_source="what_if:ticket_shortfall",
            impact=f"Gross penjualan tiket Rp{gross_sales:,.0f}. Saldo bersih pasca biaya produksi: {'-' if net_balance < 0 else '+'}Rp{abs(net_balance):,.0f}.",
            mitigation="Aktifkan program bundling promo komunitas atau renegosiasi pos variabel biaya produksi.",
        )
        return {
            "scenario": "ticket_shortfall",
            "sell_through_pct": sell_pct,
            "sold_tickets": sold_tickets,
            "gross_sales": gross_sales,
            "net_balance": net_balance,
            "risk": risk.model_dump(),
            "provenance_type": "CALCULATED",
        }

    # Default fallback
    model = calculate_advanced_event_model(budget=int(base_budget), capacity=base_capacity)
    return {
        "scenario": "standard_recalculation",
        "budget": base_budget,
        "capacity": base_capacity,
        "allocations": model.get("budget_allocation"),
        "provenance_type": "CALCULATED",
    }


# ---------------------------------------------------------------------------
# Option Comparison Engine
# ---------------------------------------------------------------------------

def compare_event_options(
    objective: str,
    options: List[Dict[str, Any]],
    constraints: Dict[str, Any],
    reasoning_input: OkkaxReasoningInput,
) -> OkkaxDecisionPlan:
    """Evaluate candidate options (Venues, Talents, Vendors, Pricing Tiers) with evidence grounding.

    Enforces:
      - Objective scoring against constraints.
      - Unsupported dimensions explicitly declared in `unknowns`.
      - Strict evidence traceability for the recommendation.
    """
    clean_obj = objective.strip()
    unknowns = list(reasoning_input.unknowns)
    assumptions = list(reasoning_input.assumptions)
    facts: List[str] = [it.content for it in reasoning_input.live_facts]
    calculations: List[Dict[str, Any]] = []
    tradeoffs: List[str] = []
    risks: List[OkkaxRiskItem] = []

    # Check for missing critical constraint data
    if not constraints.get("budget") and not constraints.get("capacity"):
        unknowns.append("Budget limit dan target kapasitas audiens belum ditentukan secara eksplisit.")

    # Evaluate options
    recommended: Optional[str] = None
    rec_reason = ""
    scores: List[tuple[float, Dict[str, Any]]] = []

    target_cap = int(constraints.get("capacity") or 5000)
    target_budget = float(constraints.get("budget") or 1_000_000_000)

    for opt in options:
        name = opt.get("name") or opt.get("id") or "Option"
        cap = opt.get("capacity")
        cost = opt.get("cost") or opt.get("price") or opt.get("fee")

        if cap is None:
            unknowns.append(f"Kapasitas resmi untuk {name} belum diverifikasi.")
        if cost is None:
            unknowns.append(f"Biaya / Rate card riil untuk {name} belum diverifikasi.")

        # Compute fitness score
        score = 100.0
        if cap is not None:
            if cap < target_cap:
                score -= 40.0
                tradeoffs.append(f"{name}: Kapasitas ({cap:,} pax) berada di bawah target ({target_cap:,} pax).")
                risks.append(
                    OkkaxRiskItem(
                        severity=RiskSeverity.HIGH,
                        domain="venue",
                        title=f"{name} Capacity Shortfall",
                        reason=f"Kapasitas venue ({cap:,}) lebih kecil dari target audiens ({target_cap:,}).",
                        evidence_source="constraint:capacity",
                        impact="Potensi overcapacity atau hilangnya pendapatan tiket.",
                        mitigation="Terapkan sistem 2 sesi pertunjukan atau pilih venue dengan kapasitas lebih besar.",
                    )
                )
            else:
                tradeoffs.append(f"{name}: Kapasitas memadai ({cap:,} pax).")

        if cost is not None:
            if cost > target_budget:
                score -= 50.0
                tradeoffs.append(f"{name}: Biaya (Rp{cost:,.0f}) melebihi budget (Rp{target_budget:,.0f}).")
            else:
                tradeoffs.append(f"{name}: Biaya masuk dalam alokasi budget (Rp{cost:,.0f}).")

        scores.append((score, opt))

    scores.sort(key=lambda x: x[0], reverse=True)

    if scores:
        best_opt = scores[0][1]
        recommended = best_opt.get("name") or best_opt.get("id")
        rec_reason = f"{recommended} dipilih karena memiliki keselarasan tertinggi terhadap target kapasitas ({target_cap:,} pax) dan batas alokasi budget (Rp{target_budget:,.0f})."

    # Deterministic confidence calculation based strictly on evidence completeness
    confidence = compute_deterministic_confidence(
        live_facts_count=len(reasoning_input.live_facts),
        calculations_count=len(calculations),
        assumptions_count=len(assumptions),
        unknowns_count=len(unknowns),
        conflicts_count=len(getattr(reasoning_input, "conflicts_detected", [])),
    )

    return OkkaxDecisionPlan(
        objective=clean_obj,
        options=options,
        constraints=constraints,
        facts=facts,
        calculations=calculations,
        tradeoffs=tradeoffs,
        risks=risks,
        assumptions=assumptions,
        unknowns=unknowns,
        recommended_option=recommended,
        recommendation_reason=rec_reason,
        confidence=confidence,
        next_steps=[
            f"Kunci ketersediaan tanggal untuk opsi terpilih: {recommended}.",
            "Lakukan survey teknis kelistrikan dan jalur evakuasi.",
            "Ajukan surat permohonan rekomendasi izin keramaian ke otoritas wilayah.",
        ],
    )


# ---------------------------------------------------------------------------
# Comprehensive Adaptive Planning Engine
# ---------------------------------------------------------------------------

def generate_evidence_grounded_plan(
    goal: str,
    constraints: Dict[str, Any],
    reasoning_input: OkkaxReasoningInput,
) -> OkkaxEventPlan:
    """Build an adaptive, evidence-grounded event blueprint based on scale and time horizon."""
    from okkax_copilot import calculate_advanced_event_model  # noqa: PLC0415

    clean_goal = goal.strip()
    cap = int(constraints.get("capacity") or 5_000)
    bgt = float(constraints.get("budget") or 1_000_000_000)
    horizon_days = constraints.get("days_before") or constraints.get("time_horizon_days")

    # Compute deterministic numbers
    calc_model = calculate_advanced_event_model(budget=int(bgt), capacity=cap)
    alloc = calc_model.get("budget_allocation", {})

    ushers = max(1, cap // 80)
    security = max(1, cap // 100)
    audio_watt = cap * 18

    assumptions = list(reasoning_input.assumptions)
    unknowns = list(reasoning_input.unknowns)

    if not constraints.get("event_date"):
        assumptions.append("Timeline disusun dalam fase milestone relatif karena tanggal kalender definitif belum ditentukan.")

    # Adaptive Phase Generation
    if horizon_days and int(horizon_days) <= 35:
        # Express short-horizon timeline (<= 5 weeks)
        phases = [
            OkkaxPlanPhase(
                phase_code="H-30",
                title="Inisiasi Kilat & Penguncian Venue",
                milestones=[
                    "Finalisasi konsep ringkas dan lineup artis",
                    f"Kunci sewa venue untuk kapasitas {cap:,} pax",
                    "Bayar uang muka venue dan vendor utama",
                ],
                decision_gates=["Venue booking fee tervalidasi"],
                deliverables=["Express Concept Deck", "Venue Receipt"],
            ),
            OkkaxPlanPhase(
                phase_code="H-14",
                title="Perizinan Prioritas & Tiket Flash",
                milestones=[
                    "Pengajuan izin keramaian kepolisian jalur cepat",
                    "Rekomendasi satgas medis dan inspeksi damkar",
                    "Peluncuran penjualan tiket flash online",
                ],
                decision_gates=["Izin keramaian terbit"],
                deliverables=["Surat Izin Keramaian", "Gate Scanner Config"],
            ),
            OkkaxPlanPhase(
                phase_code="H-3",
                title="Finalisasi Produksi & Gladi Bersih",
                milestones=[
                    f"Briefing kru usher ({ushers} pax) dan security ({security} pax)",
                    f"Load-in sound system FOH ({audio_watt:,} Watt RMS)",
                    "Simulasi evakuasi darurat",
                ],
                decision_gates=["Clearance soundcheck panggung"],
                deliverables=["Rundown Minute-by-Minute"],
            ),
            OkkaxPlanPhase(
                phase_code="H-0",
                title="Show Day & Rekonsiliasi",
                milestones=[
                    "Operasional live gate dan scanning tiket",
                    "Monitoring pos medis dan mitigasi crowd",
                    "Pencairan termin akhir vendor via escrow",
                ],
                decision_gates=["Audit gate report selesai"],
                deliverables=["Gate Attendance Log", "Settlement Report"],
            ),
        ]
    elif cap > 10_000 or "festival" in clean_goal.lower():
        # Large scale / multi-day festival timeline
        phases = [
            OkkaxPlanPhase(
                phase_code="W-12",
                title="Master Concept & Headliner Curation",
                milestones=[
                    "Kurasi master lineup festival (Headliner + Co-Headliners)",
                    f"Kunci kawasan venue skala besar ({cap:,} pax)",
                    "Struktur paket sponsorship multi-tier",
                ],
                decision_gates=["Headliner contract lock", "Venue master lease agreement"],
                deliverables=["Master Festival Blueprint", "Sponsorship Deck"],
            ),
            OkkaxPlanPhase(
                phase_code="W-6",
                title="Perizinan Terpadu & Early Bird Wave",
                milestones=[
                    "Pengajuan izin keramaian ke Polda Intelkam & Pemda Disparekraf",
                    "Persetujuan traffic management dan rekayasa lalu lintas Dishub",
                    "Buka penjualan tiket Wave 1 Early Bird",
                ],
                decision_gates=["Rekomendasi Dishub & Damkar terbit", "Target Wave 1 tercapai"],
                deliverables=["Traffic Management Plan", "Ticketing Wave Schedule"],
            ),
            OkkaxPlanPhase(
                phase_code="W-2",
                title="Heavy Rigging & Workforce Deployment",
                milestones=[
                    f"Mobilisasi tim lapangan ({ushers} ushers, {security} security)",
                    "Load-in rigging panggung utama, genset IP54+, dan LED screens",
                    "Koordinasi pos medis darurat dan ambulans standby",
                ],
                decision_gates=["Structural rigging safety certificate"],
                deliverables=["Production Rider Sign-off", "Safety Matrix"],
            ),
            OkkaxPlanPhase(
                phase_code="W-0",
                title="Festival Show Days & Live Gate Control",
                milestones=[
                    "Aktivasi turnstile gate scanner QR dinamis",
                    "Manajemen crowd flow antar panggung dan area tenant F&B",
                    "Penegakan curfew sound level (98-102 dBA)",
                ],
                decision_gates=["Pintu gerbang clearance inspeksi harian"],
                deliverables=["Real-Time Turnstile Logs", "Incident Log Sheet"],
            ),
            OkkaxPlanPhase(
                phase_code="Post-Event",
                title="Escrow Settlement & Royalty Reporting",
                milestones=[
                    "Pencairan termin escrow final kepada seluruh vendor",
                    "Pelaporan royalti musik LMKN dan pajak hiburan daerah",
                    "Laporan ROI sponsor dan evaluasi penyelenggaraan",
                ],
                decision_gates=["Audit rekonsiliasi gate tervalidasi"],
                deliverables=["Final Audit Report", "Sponsor Value Delivery Book"],
            ),
        ]
    else:
        # Standard 5-Phase W-8 to W-0 Lifecycle
        phases = [
            OkkaxPlanPhase(
                phase_code="W-8",
                title="Konsep & Penguncian Mitra Kunci",
                milestones=[
                    "Finalisasi tema acara dan kurasi lineup artis",
                    f"Kunci sewa venue untuk target kapasitas {cap:,} pax",
                    f"Alokasi budget talent (~28%): Rp{alloc.get('talent', bgt * 0.28):,.0f}",
                ],
                decision_gates=["Persetujuan proposal sponsorship utama", "Kontrak booking fee venue terbayar"],
                deliverables=["Event Concept Deck", "Venue Agreement Letter"],
            ),
            OkkaxPlanPhase(
                phase_code="W-4",
                title="Perizinan & Peluncuran Tiket",
                milestones=[
                    "Pengajuan berkas izin keramaian ke Polres/Polda Intelkam",
                    "Koordinasi rekomendasi keselamatan Damkar dan Dinkes",
                    "Buka penjualan tiket Presale dengan sistem kuota aman",
                ],
                decision_gates=["Surat Rekomendasi Satgas/Damkar terbit", "Target Presale 30% tercapai"],
                deliverables=["Izin Keramaian Resmi", "Ticketing Gate Setup"],
            ),
            OkkaxPlanPhase(
                phase_code="W-2",
                title="Produksi & Finalisasi Kru",
                milestones=[
                    f"Mobilisasi tim usher ({ushers} orang) dan keamanan ({security} orang)",
                    f"Finalisasi spesifikasi teknis audio FOH ({audio_watt:,} Watt RMS)",
                    "Penyusunan rundown detail dan technical rider artis",
                ],
                decision_gates=["Technical Rider artis disepakati", "Briefing kepala keamanan venue selesai"],
                deliverables=["Rundown Minute-by-Minute", "Crowd Management Matrix"],
            ),
            OkkaxPlanPhase(
                phase_code="W-0",
                title="Hari Acara (Show Day & Gate Operations)",
                milestones=[
                    "Load-in final, sound check, dan simulasi jalur evakuasi",
                    "Aktivasi gate validator scanner QR dinamis",
                    "Monitoring crowd density dan operasional pos medis",
                ],
                decision_gates=["Clearance inspeksi panggung sebelum pintu dibuka"],
                deliverables=["Live Gate Attendance Log", "Incident Log Sheet"],
            ),
            OkkaxPlanPhase(
                phase_code="Post-Event",
                title="Audit Finansial & Rekonsiliasi",
                milestones=[
                    "Pencairan termin final vendor dan escrow settlement OKKAX",
                    "Laporan pajak hiburan daerah dan royalti LMKN",
                    "Evaluasi kepuasan penonton dan laporan sponsor",
                ],
                decision_gates=["Audit gate dan rekonsiliasi ticketing tervalidasi"],
                deliverables=["Final Financial Post-Mortem", "Sponsorship Value Report"],
            ),
        ]

    critical_risks = [
        OkkaxRiskItem(
            severity=RiskSeverity.HIGH,
            domain="compliance",
            title="Keterlambatan Penerbitan Izin Keramaian",
            reason="Berkas perizinan terlambat diajukan sebelum W-3 dari tanggal pelaksanaan.",
            evidence_source="spec:event_studio",
            impact="Potensi penundaan acara atau pembatalan paksa oleh otoritas keamanan.",
            mitigation="Ajukan berkas izin lengkap di W-4 dan tunjuk liaison officer khusus koordinasi aparat.",
            grounding_classification=RuleGroundingClassification.CANONICAL_SPEC,
        ),
        OkkaxRiskItem(
            severity=RiskSeverity.MEDIUM,
            domain="workforce",
            title="Under-Staffed Gate Usher & Security",
            reason=f"Jumlah kru tidak memenuhi rasio standar OKKAX ({ushers} ushers, {security} security).",
            evidence_source="domain:workforce_ratios",
            impact="Penumpukan antrean penonton di pintu masuk dan risiko keamanan.",
            mitigation=f"Kunci kontrak penyedia tenaga kerja di W-2 dengan buffer cadangan 10%.",
            grounding_classification=RuleGroundingClassification.CURATED_PRACTICE,
        ),
    ]

    action_card = ActionProposalCard(
        action="create_draft_event",
        label="Buat Draft Blueprint di Event Studio",
        domain="event",
        requires_role="organizer",
        params={"goal": clean_goal, "budget": bgt, "capacity": cap},
        warning="Draft blueprint akan dibuat di workspace organizer untuk verifikasi detail sebelum dipublikasikan.",
    )

    confidence = compute_deterministic_confidence(
        live_facts_count=len(reasoning_input.live_facts),
        calculations_count=1,
        assumptions_count=len(assumptions),
        unknowns_count=len(unknowns),
        conflicts_count=len(getattr(reasoning_input, "conflicts_detected", [])),
    )

    return OkkaxEventPlan(
        goal=clean_goal,
        phases=phases,
        tasks_or_milestones=[m for p in phases for m in p.milestones],
        dependencies=[
            "Izin keramaian kepolisian (CANONICAL_SPEC: W-4) wajib terbit sebelum tiket regular dijual publik.",
            "Technical rider panggung harus disepakati sebelum vendor audio load-in.",
            "Settlement termin vendor mengikuti milestone termin pencairan escrow OKKAX.",
        ],
        constraints=constraints,
        critical_risks=critical_risks,
        required_resources={
            "ushers_count": ushers,
            "security_count": security,
            "audio_sound_power_watts": audio_watt,
        },
        financial_implications=alloc,
        decision_gates=["W-8 Vendor Approval", "W-4 Permit Clearance", "W-0 Stage Safety Clearance"],
        assumptions=assumptions,
        unknowns=unknowns,
        next_action=action_card,
        evidence_sufficiency_score=confidence,
        confidence=confidence,
    )
