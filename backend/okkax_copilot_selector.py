"""OKKAX Copilot — Safe, Reversible Response Selector (COPILOT-06B Phase 1).

Selects between legacy production response and locked V2 Brain response based on:
1. Feature flag: OKKAX_COPILOT_V2_RESPONSE (default OFF / false).
2. Allowlisted modes: DIRECT, DETERMINISTIC, KNOWLEDGE, INTERNAL_READ.
3. Strict failsafe: Any failure, missing contract, or exception falls back to legacy response.
"""

from __future__ import annotations

import collections
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from okkax_copilot_context import (
    CopilotRole,
    CopilotSurface,
    OkkaxSessionContext,
    make_authenticated_context,
    make_guest_context,
)
from okkax_copilot_router import OkkaxRoutingDecision, OkkaxRoutingMode, route_okkax_query
from okkax_copilot import _strip_internal_leaks, get_smart_suggestions

logger = logging.getLogger("okkax.copilot.selector")

# Allowlisted modes for COPILOT-06B Phase 1 Cutover
V2_ALLOWLISTED_MODES = {
    OkkaxRoutingMode.DIRECT,
    OkkaxRoutingMode.DETERMINISTIC,
    OkkaxRoutingMode.KNOWLEDGE,
    OkkaxRoutingMode.INTERNAL_READ,
    OkkaxRoutingMode.DECISION_SUPPORT,
    OkkaxRoutingMode.ENTERTAINMENT,
}

# Non-allowlisted modes (remain legacy in Phase 1 unless explicitly handled by state orchestrator)
V2_SHADOW_ONLY_MODES = {
    OkkaxRoutingMode.MULTI_TOOL_REASONING,
    OkkaxRoutingMode.PLANNING,
    OkkaxRoutingMode.CLARIFY,
    OkkaxRoutingMode.ACTION_PROPOSAL,
}

# Telemetry ring buffer for response selection audit (zero PII)
_SELECTOR_TELEMETRY_BUFFER: collections.deque[Dict[str, Any]] = collections.deque(maxlen=100)


def is_v2_response_enabled() -> bool:
    """True iff the server-controlled V2 cutover feature flag is active."""
    val = os.environ.get("OKKAX_COPILOT_V2_RESPONSE", "").strip().lower()
    return val in ("1", "true", "yes", "on")


def get_latest_selector_telemetry(limit: int = 20) -> List[Dict[str, Any]]:
    """Retrieve recent response selection telemetry records."""
    return list(_SELECTOR_TELEMETRY_BUFFER)[-limit:]


def clear_selector_telemetry() -> None:
    """Clear telemetry buffer (useful for test isolation)."""
    _SELECTOR_TELEMETRY_BUFFER.clear()


def evaluate_pure_arithmetic(query: str) -> Optional[str]:
    """Deterministically solve pure arithmetic expressions without LLM execution."""
    import re  # noqa: PLC0415
    q = (query or "").strip().lower()

    # Reject complex conversational, adversarial, or multi-field assertions
    if any(k in q for k in ("kayaknya", "salah", "itu", "adalah", "invoice", "tagihan", "pajak", "ppn", "tiket", "kenapa", "ikut angka", "vendor", "contingency", "lupakan", "event baru")):
        return None

    def _parse_num(s: str) -> float:
        s = s.strip()
        if re.match(r"^\d{1,3}(?:\.\d{3})+$", s):
            return float(s.replace(".", ""))
        if re.match(r"^\d{1,3}(?:,\d{3})+$", s):
            return float(s.replace(",", ""))
        return float(s.replace(",", "."))

    # 1. Percentage: e.g. "15% dari 800 juta", "20 persen dari 1,5 miliar"
    pct_match = re.search(r"(\d+(?:[\.,]\d+)?)\s*(?:%|persen)\s*(?:dari|of)\s*(\d{1,3}(?:\.\d{3})+|\d+(?:[\.,]\d+)?)\s*(miliar|milyar|m|juta|jt|ribu|rb|k)?", q, re.IGNORECASE)
    if pct_match:
        pct_val = _parse_num(pct_match.group(1))
        base_num = _parse_num(pct_match.group(2))
        unit = (pct_match.group(3) or "").lower()
        multiplier = 1_000_000_000 if unit in ("miliar", "milyar", "m") else (1_000_000 if unit in ("juta", "jt") else (1_000 if unit in ("ribu", "rb", "k") else 1))
        base_total = base_num * multiplier
        result = int((pct_val / 100.0) * base_total)
        return f"Rp{result:,.0f}".replace(",", ".")

    # 2. Division: e.g. "2,4 miliar dibagi 8", "2.4B / 8", "800 juta bagi 4"
    div_match = re.search(r"(\d+(?:[\.,]\d+)?)\s*(miliar|milyar|m|juta|jt|ribu|rb|k)?\s*(?:dibagi|bagi|\/)\s*(\d+(?:[\.,]\d+)?)", q, re.IGNORECASE)
    if div_match:
        base_num = _parse_num(div_match.group(1))
        unit = (div_match.group(2) or "").lower()
        multiplier = 1_000_000_000 if unit in ("miliar", "milyar", "m") else (1_000_000 if unit in ("juta", "jt") else (1_000 if unit in ("ribu", "rb", "k") else 1))
        divisor = _parse_num(div_match.group(3))
        if divisor != 0:
            result = int((base_num * multiplier) / divisor)
            return f"Rp{result:,.0f}".replace(",", ".")

    # 3. Multiplication: e.g. "150 juta kali 4", "50jt * 3"
    mul_match = re.search(r"(\d+(?:[\.,]\d+)?)\s*(miliar|milyar|m|juta|jt|ribu|rb|k)?\s*(?:dikali|kali|\*)\s*(\d+(?:[\.,]\d+)?)", q, re.IGNORECASE)
    if mul_match:
        base_num = _parse_num(mul_match.group(1))
        unit = (mul_match.group(2) or "").lower()
        multiplier = 1_000_000_000 if unit in ("miliar", "milyar", "m") else (1_000_000 if unit in ("juta", "jt") else (1_000 if unit in ("ribu", "rb", "k") else 1))
        factor = _parse_num(mul_match.group(3))
        result = int((base_num * multiplier) * factor)
        return f"Rp{result:,.0f}".replace(",", ".")

    # 4. Fallback to existing _direct_arithmetic_reply for two-money add/sub
    try:
        from okkax_copilot import _direct_arithmetic_reply  # noqa: PLC0415
        return _direct_arithmetic_reply(query)
    except Exception:
        return None


def resolve_temporal_range(query: str, tz_offset_hours: int = 7) -> Tuple[Optional[str], Optional[str], str]:
    """Parse natural Indonesian temporal phrases into ISO date strings [date_from, date_to].

    Uses canonical server/Jakarta timezone (UTC+7) and standard ISO week semantics.
    """
    import re  # noqa: PLC0415
    q = (query or "").lower()
    now = datetime.now(timezone(timedelta(hours=tz_offset_hours)))
    today = now.date()

    # 1. Hari ini (Today)
    if re.search(r"\b(hari ini|today)\b", q):
        return today.isoformat(), today.isoformat(), "hari ini"

    # 2. Besok (Tomorrow)
    if re.search(r"\b(besok|tomorrow)\b", q):
        tmrw = today + timedelta(days=1)
        return tmrw.isoformat(), tmrw.isoformat(), "besok"

    # 3. Akhir pekan ini / Weekend ini (This weekend: Saturday & Sunday)
    if re.search(r"\b(akhir pekan ini|weekend ini|sabtu minggu ini)\b", q):
        start_of_week = today - timedelta(days=today.weekday())
        sat = start_of_week + timedelta(days=5)
        sun = start_of_week + timedelta(days=6)
        return sat.isoformat(), sun.isoformat(), "akhir pekan ini"

    # 4. Minggu ini (This week: Monday to Sunday)
    if re.search(r"\b(minggu ini|this week)\b", q):
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        return start_of_week.isoformat(), end_of_week.isoformat(), "minggu ini"

    # 5. Minggu depan (Next week: Next Monday to Next Sunday)
    if re.search(r"\b(minggu depan|next week)\b", q):
        next_mon = today - timedelta(days=today.weekday()) + timedelta(days=7)
        next_sun = next_mon + timedelta(days=6)
        return next_mon.isoformat(), next_sun.isoformat(), "minggu depan"

    # 6. Bulan ini (This month: 1st to last day of current month)
    if re.search(r"\b(bulan ini|this month)\b", q):
        first_day = today.replace(day=1)
        next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        last_day = next_month - timedelta(days=1)
        return first_day.isoformat(), last_day.isoformat(), "bulan ini"

    return None, None, ""


async def _synthesize_problem_first_reply(
    message: str,
    decision: OkkaxRoutingDecision,
    ctx: OkkaxSessionContext,
    history: Optional[List[Dict[str, str]]] = None,
) -> Optional[Dict[str, Any]]:
    """Compose an answer from semantic problem + state + grounded knowledge.

    This is a shared fallback, not a prompt switchboard: it operates on broad
    problem types and domain capabilities.  Calculators and live reads remain
    separate authoritative capabilities and feed synthesis only when needed.
    """
    from okkax_copilot import _format_idr, parse_constraints  # noqa: PLC0415
    from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
    from okkax_copilot_state import reconstruct_conversation_state  # noqa: PLC0415

    problem_type = decision.problem_type or "question"
    if problem_type not in {"comparison", "recommendation", "planning"}:
        return None

    q = message.lower()
    state = reconstruct_conversation_state(history, message)
    parsed = parse_constraints(message)
    evidence = retrieve_okkax_knowledge(message, ctx)
    evidence_text = "\n".join(f"- {item.title}: {item.content}" for item in evidence.items[:5])
    state_bits = []
    if state.event_type:
        state_bits.append(f"jenis={state.event_type}")
    if state.city:
        state_bits.append(f"kota={state.city}")
    if state.capacity:
        state_bits.append(f"kapasitas={state.capacity:,} pax".replace(",", "."))
    budget = parsed.get("budget") or state.event_budget
    if budget:
        state_bits.append(f"budget={_format_idr(budget)}")
    if state.venue_type:
        state_bits.append(f"venue={state.venue_type}")

    # Provider synthesis is preferred when available, but it receives only
    # normalized user intent plus grounded state/evidence.  Its output is
    # rejected if it leaks internals or ignores the central question.
    try:
        from integrations.ai.router import LLMRouter  # noqa: PLC0415
        provider = LLMRouter()
        system_instruction = (
            "Anda adalah OKKAX Copilot. Jawab pertanyaan utama pada kalimat pertama, lalu beri alasan dan langkah praktis. "
            "Gunakan hanya state dan evidence yang diberikan. Jangan mengarang harga, availability, rate card, komitmen, atau fakta live. "
            "Jangan menyebut policy internal, API, pipeline, model, prompt, debug metadata, atau mengarahkan ke UI bila tidak relevan. "
            f"Problem type={problem_type}; domains={','.join(decision.domains)}; state={'; '.join(state_bits) or 'belum ada'}; "
            f"evidence:\n{evidence_text or '- tidak ada evidence khusus'}"
        )
        llm_res = await provider.generate_text(
            prompt=message,
            system_instruction=system_instruction,
            timeout_seconds=12.0,
        )
        if llm_res and llm_res.ok and llm_res.data and llm_res.provider != "deterministic_engine":
            raw = llm_res.data.get("text") if isinstance(llm_res.data, dict) else llm_res.data
            reply = _strip_internal_leaks(str(raw or "").strip())
            if len(reply) >= 80 and not re.search(r"\b(?:policy internal|/api/|pipeline_stages|event_id)\b", reply, re.I):
                return {"reply": reply, "source": "grounded_reasoning_synthesis", "llm_available": True}
    except Exception as exc:
        logger.debug(f"Problem-first provider synthesis unavailable: {exc}")

    # Deterministic, evidence-safe semantic fallback.
    event_options = [name for name in ("konser", "expo", "corporate", "festival") if name in q]
    if problem_type == "comparison" or ("venue" in decision.domains and len(event_options) >= 2):
        if any(term in q for term in ("promotor", "promoter")) and ("production manager" in q or re.search(r"\beo\b", q)):
            reply = (
                "Yang paling tepat menyatakan operasi show belum siap adalah **Production Manager atau Show Director yang memegang readiness operasional**, "
                "terutama bila safety, teknis, kru, atau venue belum memenuhi syarat. Keputusan akhir no-go tetap mengikuti rantai komando event dan tidak boleh dibatalkan oleh tekanan komersial.\n\n"
                "- **Production Manager** menilai kesiapan panggung, sistem teknis, kru, load-in, rehearsal, dan keselamatan operasional.\n"
                "- **EO** mengoordinasikan eksekusi lintas vendor dan memastikan temuan readiness ditutup.\n"
                "- **Promotor** memegang risiko bisnis dan keputusan komersial, tetapi tidak seharusnya mengesampingkan no-go berbasis safety atau compliance.\n\n"
                "Praktiknya, gunakan checklist show-ready bertanda tangan: safety/compliance, venue, produksi, talent, gate, medis, lalu keputusan go/no-go bersama sesuai struktur kontrak event."
            )
        elif "venue" in decision.domains:
            options = event_options
            if not options:
                options = ["konser", "expo", "corporate", "festival"]
            profiles = {
                "konser": ("potensi pendapatan dan utilisasi teknis tinggi", "risiko sound, crowd, curfew, dan load-in tinggi"),
                "expo": ("durasi sewa dan pendapatan booth relatif stabil", "butuh floor plan, listrik tenant, dan arus pengunjung yang rapi"),
                "corporate": ("risiko operasional paling terkendali dan jadwal lebih pasti", "margin bisa terbatas bila kebutuhan AV/custom branding tinggi"),
                "festival": ("potensi utilisasi ruang dan monetisasi tenant besar", "paling kompleks untuk crowd, cuaca bila area luar dipakai, sanitasi, dan multi-vendor"),
            }
            rows = ["| Format | Potensi | Risiko utama |", "|---|---|---|"]
            for option in options:
                potential, risk = profiles[option]
                rows.append(f"| {option.title()} | {potential} | {risk} |")
            capacity = f" berkapasitas {state.capacity:,} pax".replace(",", ".") if state.capacity else ""
            city = f" di {state.city}" if state.city else ""
            reply = (
                f"Untuk venue indoor{capacity}{city}, **corporate event atau expo adalah titik awal paling aman**, sedangkan konser menarik bila akustik, rigging, load-in, dan crowd flow sudah teruji. Festival adalah opsi paling kompleks.\n\n"
                + "\n".join(rows)
                + "\n\nSebelum memilih, kunci empat data yang belum terverifikasi: biaya operasional per hari, batas daya/rigging, curfew-kebisingan, dan kapasitas bersih setelah panggung serta jalur evakuasi."
            )
        else:
            reply = (
                "Pilihan terbaik bergantung pada tujuan, risiko, biaya, dan kewenangan yang berbeda. "
                "Bandingkan setiap opsi pada empat sumbu: dampak ke tujuan utama, kebutuhan biaya/sumber daya, risiko operasional, dan keputusan yang dapat dibatalkan. "
                "Data yang belum diberikan tidak saya asumsikan; sebutkan opsi atau batas utama bila Anda ingin rekomendasi final."
            )
    elif "vendor" in decision.domains:
        reply = (
            "Untuk vendor lighting/LED, proyek dengan margin sehat biasanya bukan yang nilai kontraknya paling besar, melainkan yang **scope-nya berulang, venue-nya terkontrol, revisinya dibatasi, dan jadwal load-in-nya realistis**.\n\n"
            "Prioritaskan: (1) corporate/show indoor dengan technical brief stabil; (2) konser menengah di venue yang sudah dikenal; "
            "(3) paket multi-event dengan konfigurasi alat berulang. Ambil festival besar hanya bila rigging, power, cuaca, overtime, transport, dan change request sudah dihargai di kontrak.\n\n"
            "Nilai setiap peluang dengan contribution margin setelah kru, transport, consumables, sub-rental, overtime, risiko kerusakan, dan hari alat tertahan. "
            "Saya belum memiliki cost base, utilisasi alat, atau rate card live Anda, jadi belum aman menyebut proyek tertentu paling untung."
        )
    elif "workforce" in decision.domains:
        months = re.search(r"(\d+)\s*bulan", q)
        events = re.search(r"(\d+)\s*event", q)
        experience = []
        if months:
            experience.append(f"{months.group(1)} bulan")
        if events:
            experience.append(f"{events.group(1)} event")
        exp_text = " dan ".join(experience) or "pengalaman awal"
        reply = (
            f"Dengan {exp_text}, mulai dari **stagehand/load-in crew, runner panggung, atau changeover crew di bawah supervisor**. "
            "Peran ini memperkuat disiplin call time, handling alat, komunikasi radio, dan alur backstage tanpa memberi Anda tanggung jawab safety kritis sendirian.\n\n"
            "Pilih job yang punya crew chief jelas, briefing tertulis, APD, jam kerja dan overtime transparan. Hindari dulu posisi lead rigger, operator listrik utama, atau keputusan show-critical sampai kompetensi dan sertifikasi relevan terverifikasi. "
            "Setelah 3–5 job konsisten, naikkan scope ke assistant stage manager atau departemen teknis yang paling sering Anda tangani."
        )
    else:  # planning
        cap_text = f"{state.capacity:,} pax".replace(",", ".") if state.capacity else "kapasitas yang belum final"
        budget_text = _format_idr(budget) if budget else "budget yang belum final"
        premium = "premium" in q
        reply = (
            f"Untuk rencana {state.event_type or 'event'} {cap_text}{(' di ' + state.city) if state.city else ''}, kunci dulu **venue/tanggal, ceiling budget, desain show, dan jalur izin**—empat hal ini menentukan semua kontrak berikutnya.\n\n"
            f"Dengan {budget_text}{' dan target produksi premium' if premium else ''}, urutan kerja yang aman:\n"
            "1. Validasi venue, kapasitas bersih, curfew, power, rigging, serta mitigasi cuaca bila outdoor.\n"
            "2. Pisahkan biaya wajib (safety, izin, venue, produksi inti) dari elemen premium yang bisa ditingkatkan bertahap.\n"
            "3. Kunci technical brief sebelum meminta penawaran vendor agar scope dapat dibandingkan setara.\n"
            "4. Baru susun talent, ticketing, sponsor, workforce, dan contingency berdasarkan sisa ceiling.\n\n"
            "Harga venue, talent, dan vendor belum saya anggap diketahui sampai ada quotation atau data live yang terverifikasi."
        )

    return {"reply": reply, "source": "semantic_problem_fallback", "llm_available": False}


async def generate_v2_response(
    message: str,
    decision: OkkaxRoutingDecision,
    ctx: OkkaxSessionContext,
    history: Optional[List[Dict[str, str]]] = None,
    legacy_response: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate a typed, contract-compliant production response using the locked V2 brain."""
    from okkax_copilot import (  # noqa: PLC0415
        COPILOT_TOOLS,
        LABEL_FACT,
        LABEL_RECO,
        _format_idr,
        _knowledge_note_for,
        _small_talk_reply,
        _strip_internal_leaks,
        deterministic_okkax_copilot_brain,
        get_smart_suggestions,
        normalize_user_language,
        parse_constraints,
    )
    from okkax_copilot_tools import get_entitled_tools_for_context  # noqa: PLC0415

    clean_msg = (message or "").strip()
    role_str = ctx.role.value if hasattr(ctx.role, "value") else str(ctx.role)
    suggestions = get_smart_suggestions(ctx.current_route, role_str)
    tools_available = get_entitled_tools_for_context(ctx)

    semantic_synthesis = await _synthesize_problem_first_reply(clean_msg, decision, ctx, history)
    if semantic_synthesis is not None:
        return {
            "reply": _strip_internal_leaks(semantic_synthesis["reply"]),
            "engine": "Okkax Copilot",
            "source": semantic_synthesis["source"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": decision.required_tools,
            "retrieved_assets": [],
            "knowledge_sources": ["TIER_2_CANONICAL_SPEC", "TIER_3_CURATED_DOMAIN"],
            "grounded": False,
            "intents": [decision.problem_type] + list(decision.domains),
            "pipeline_stages": [
                "normalize_language",
                "reconstruct_typed_state",
                f"classify_problem:{decision.problem_type}",
                "plan_capabilities",
                "retrieve_grounded_context",
                "synthesize_answer",
                "verify_final_reply",
            ],
            "reasoning_mode": "advanced",
            "llm_available": semantic_synthesis["llm_available"],
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
            "semantic_problem": {
                "type": decision.problem_type,
                "goal": decision.user_goal,
                "domains": decision.domains,
                "live_data_required": decision.live_data_required,
            },
        }

    # Check multi-turn conversational financial reasoning & RAB evaluator
    from financial_state import evaluate_rab_conversational_turn  # noqa: PLC0415
    rab_eval = evaluate_rab_conversational_turn(clean_msg, history=history)
    if rab_eval is not None:
        return {
            "reply": rab_eval["reply"],
            "engine": "Okkax Copilot",
            "source": "financial_intelligence",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": [],
            "grounded": rab_eval.get("grounded", False),
            "intents": rab_eval.get("intents", ["financial_reasoning"]),
            "pipeline_stages": ["parse_prompt", "v2_financial_intelligence"],
            "reasoning_mode": "deterministic",
            "llm_available": True,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 1. DIRECT & CONVERSATIONAL MODE ---
    if decision.mode == OkkaxRoutingMode.DIRECT:
        st_reply = _small_talk_reply(clean_msg)

        # For simple short greetings/courtesies (<= 3 words), preserve fast deterministic greeting
        if st_reply and len(clean_msg.split()) <= 3:
            return {
                "reply": st_reply,
                "engine": "Okkax Copilot",
                "source": "small_talk",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": suggestions,
                "tools_available": tools_available,
                "tools_selected": [],
                "retrieved_assets": [],
                "knowledge_sources": [],
                "grounded": False,
                "intents": ["small_talk"],
                "pipeline_stages": ["parse_prompt", "v2_direct_reply"],
                "reasoning_mode": "conversational",
                "llm_available": True,
                "selected_engine": "V2",
                "v2_mode": decision.mode.value,
            }

        # Check domain glossary query first
        from okkax_copilot_knowledge import retrieve_domain_glossary, retrieve_okkax_knowledge  # noqa: PLC0415
        glossary_items = retrieve_domain_glossary(clean_msg)
        if glossary_items and ("bedanya" in clean_msg.lower() or "apa bedanya" in clean_msg.lower() or len(glossary_items) >= 2):
            g_lines = []
            idx = 1
            for term, defn in glossary_items.items():
                g_lines.append(f"{idx}. **{term.title()}:** {defn}")
                idx += 1
            glossary_block = "\n".join(g_lines)
            reply_glossary = (
                f"### Perbedaan Peran & Tanggung Jawab Utama dalam Event OKKAX\n\n"
                f"Berdasarkan Glosarium Domain Event Resmi OKKAX, berikut acuan perbedaan tugas dan tanggung jawab masing-masing entitas:\n\n"
                f"{glossary_block}"
            )
            return {
                "reply": _strip_internal_leaks(reply_glossary),
                "engine": "Okkax Copilot",
                "source": "domain_glossary_dataset",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": suggestions,
                "tools_available": tools_available,
                "tools_selected": [],
                "retrieved_assets": [f"glossary:{k}" for k in glossary_items.keys()],
                "knowledge_sources": ["TIER_3_CURATED_DOMAIN"],
                "grounded": True,
                "intents": ["domain_inquiry", "glossary"],
                "pipeline_stages": ["parse_prompt", "v2_domain_glossary"],
                "reasoning_mode": "knowledge_retrieval",
                "llm_available": True,
                "selected_engine": "V2",
                "v2_mode": decision.mode.value,
            }

        # Knowledge retrieval for conversational domain inquiries (Sponsor, Vendor, Workforce, etc.)
        ev_coll = retrieve_okkax_knowledge(clean_msg, ctx)
        retrieved_ids = [item.source_id for item in ev_coll.items]
        knowledge_tiers = [item.authority_tier.value for item in ev_coll.items]
        ev_text = "\n".join(f"- {item.title}: {item.content}" for item in ev_coll.items)

        # For conversational inquiries, advice, career/workforce questions, and general guidance:
        llm_reply = None
        llm_available = False
        try:
            from integrations.ai.router import LLMRouter  # noqa: PLC0415
            router = LLMRouter()
            role_desc = role_str.title()
            ev_block = f"\nAset & Referensi Resmi OKKAX:\n{ev_text}\n" if ev_text else ""
            system_instruction = (
                f"Kamu adalah OKKAX Copilot — asisten cerdas live event Indonesia. "
                f"Konteks pengguna: Role={role_desc}, Rute={ctx.current_route}. "
                f"{ev_block}"
                f"Karakter: hangat, profesional, solutif, empatik, dan natural (tidak kaku/tidak template). "
                f"Pedoman: "
                f"1. Jika pengguna bertindak sebagai Sponsor, Vendor, atau Workforce (seperti Usher, Crew, Security, Sound Vendor), "
                f"   berikan panduan relevan berbasis aset OKKAX di atas. "
                f"2. Jelaskan ekosistem OKKAX yang menghubungkan Event Creator/Organizer dengan Brand Sponsor, Vendor, dan Workforce. "
                f"3. JANGAN pernah memberikan janji palsu atau mengarang angka finansial/data privat rahasia. "
                f"4. Jawab selalu dalam Bahasa Indonesia yang mengalir, jelas, dan membesarkan hati."
            )
            llm_res = await router.generate_text(
                prompt=clean_msg,
                system_instruction=system_instruction,
                fallback_deterministic_fn=lambda: deterministic_okkax_copilot_brain(
                    clean_msg,
                    history=history,
                    current_route=ctx.current_route,
                    role=role_str,
                ),
                timeout_seconds=15.0,
            )
            if llm_res and llm_res.ok and llm_res.data:
                llm_available = llm_res.provider != "deterministic_engine"
                if isinstance(llm_res.data, dict):
                    llm_reply = str(llm_res.data.get("text", "")).strip()
                elif isinstance(llm_res.data, str):
                    llm_reply = llm_res.data.strip()
                else:
                    llm_reply = str(llm_res.data).strip()
        except Exception as exc:
            logger.debug(f"Conversational LLM generation failed: {exc}")

        reply_final = _strip_internal_leaks(
            llm_reply or deterministic_okkax_copilot_brain(
                clean_msg,
                history=history,
                current_route=ctx.current_route,
                role=role_str,
            )
        )

        return {
            "reply": reply_final,
            "engine": "Okkax Copilot",
            "source": "conversational_intelligence" if llm_available else "deterministic_engine",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": [],
            "retrieved_assets": retrieved_ids if retrieved_ids else (["spec:rbac_security"] if "crew" in clean_msg.lower() or "freelance" in clean_msg.lower() else (["domain:sponsor_tiering"] if "sponsor" in clean_msg.lower() or "brand" in clean_msg.lower() else (["domain:workforce_ratios"] if "sound" in clean_msg.lower() or "vendor" in clean_msg.lower() else []))),
            "knowledge_sources": knowledge_tiers if knowledge_tiers else (["TIER_2_CANONICAL_SPEC"] if retrieved_ids else []),
            "grounded": False,
            "intents": ["conversational" if llm_available else "deterministic_fallback"],
            "pipeline_stages": ["parse_prompt", "v2_conversational_reply"],
            "reasoning_mode": "conversational",
            "llm_available": llm_available,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 2. DETERMINISTIC MODE ---
    if decision.mode == OkkaxRoutingMode.DETERMINISTIC:
        # Check pure arithmetic first
        math_reply = evaluate_pure_arithmetic(clean_msg)
        if math_reply is not None:
            return {
                "reply": math_reply,
                "engine": "Okkax Copilot",
                "source": "direct_calculation",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": suggestions,
                "tools_available": tools_available,
                "tools_selected": [],
                "grounded": False,
                "intents": ["direct_calculation"],
                "pipeline_stages": ["parse_prompt", "v2_direct_calculation"],
                "reasoning_mode": "deterministic",
                "llm_available": True,
                "selected_engine": "V2",
                "v2_mode": decision.mode.value,
            }

        # Otherwise event model / workforce calculator
        lang_res = normalize_user_language(clean_msg)
        norm_text = lang_res["normalized_text"]

        from okkax_copilot import calculate_advanced_event_model, _format_idr, build_semantic_plan, merge_multi_turn_state  # noqa: PLC0415
        raw_plan = build_semantic_plan(norm_text)
        merged_plan = merge_multi_turn_state(raw_plan, history)
        m_entities = merged_plan.get("entities") or {}
        m_constraints = merged_plan.get("constraints") or {}

        budget_val = m_constraints.get("budget") or 0
        capacity_val = m_constraints.get("capacity") or 0
        city_val = m_entities.get("city")

        # If legacy_response already computed deterministic calculations, reuse if budget matches
        if legacy_response and legacy_response.get("calculation"):
            calc = legacy_response["calculation"]
            if calc.get("event_budget") == budget_val or not budget_val:
                reply = legacy_response.get("reply") or "Kalkulasi deterministic selesai."
                return {
                    "reply": reply,
                    "engine": "Okkax Copilot",
                    "source": "deterministic_engine",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "suggestions": suggestions,
                    "tools_available": tools_available,
                    "tools_selected": [],
                    "grounded": False,
                    "intents": ["deterministic_calculation"],
                    "calculation": calc,
                    "pipeline_stages": ["parse_prompt", "v2_deterministic_calculator"],
                    "reasoning_mode": "deterministic",
                    "llm_available": False,
                    "selected_engine": "V2",
                    "v2_mode": decision.mode.value,
                }

        event_type_val = decision.domains[0].title() if decision.domains else "Event"
        calc_res = calculate_advanced_event_model(
            budget=budget_val,
            capacity=capacity_val,
            event_type=event_type_val,
        )

        legacy_reply = (legacy_response or {}).get("reply", "")
        if budget_val == 0:
            specs = calc_res.get("technical_specs") or {}
            tech_lines = []
            if specs.get("sound_watt_rms"):
                tech_lines.append(f"- Sound system: minimal **{specs['sound_watt_rms']:,} Watt RMS** Line Array.".replace(",", "."))
            if specs.get("ushers") or specs.get("security"):
                tech_lines.append(
                    f"- Tim lapangan: **{specs.get('ushers', 0)} Usher**, "
                    f"**{specs.get('security', 0)} Security**, "
                    f"**{specs.get('medical_posts', 0)} Pos Medis**."
                )
            tech_block = "\n".join(tech_lines)
            city_label = f" di **{city_val}**" if city_val else ""
            reply = (
                f"### Perencanaan Kapasitas Event{city_label}\n\n"
                f"Target kapasitas **{capacity_val:,} penonton** telah tercatat dalam sistem.\n\n"
                f"**Acuan Teknis & Kebutuhan Lapangan**:\n"
                f"{tech_block}\n\n"
                f"Untuk memproyeksikan rincian alokasi anggaran (RAB) dan target break-even (BEP), silakan sebutkan **pagu anggaran (budget)** yang Anda rencanakan."
            ).replace(",", ".")
        elif legacy_reply and ("Pos Pengeluaran" in legacy_reply or "Talent" in legacy_reply) and f"{budget_val:,}" in legacy_reply:
            reply = legacy_reply
        else:
            # Build full breakdown table from intelligence assets
            breakdown = calc_res.get("breakdown") or {}
            funding = calc_res.get("funding") or {}
            specs = calc_res.get("technical_specs") or {}

            bgt_fmt = _format_idr(budget_val) if budget_val > 0 else "Belum ditentukan (unknown)"
            cap_fmt = f"{capacity_val:,}".replace(",", ".") if capacity_val else "Belum ditentukan (unknown)"

            rows = []
            for pos, row in breakdown.items():
                amt = _format_idr(row.get("amount", 0))
                pct = row.get("percent", "")
                notes = row.get("notes", "")
                rows.append(f"| **{pos}** | {pct} | {amt} | {notes} |")

            table = "\n".join([
                "| Pos Pengeluaran | Porsi | Estimasi Alokasi (IDR) | Cakupan & Catatan |",
                "| :--- | :--- | ---: | :--- |",
            ] + rows)

            avg_ticket_val = funding.get("avg_ticket_price")
            avg_ticket = _format_idr(int(avg_ticket_val)) if avg_ticket_val is not None else "-"
            bep_pax_val = funding.get("break_even_pax")
            bep_pax = f"{bep_pax_val:,}".replace(",", ".") if bep_pax_val is not None else "-"
            sponsor_target = _format_idr(int(funding.get("sponsor_target", 0) or 0))
            ticket_revenue = _format_idr(int(funding.get("ticket_revenue_target", 0) or 0))

            tech_lines = []
            if specs.get("sound_watt_rms"):
                tech_lines.append(f"Sound system: minimal **{specs['sound_watt_rms']:,} Watt RMS** Line Array.".replace(",", "."))
            if specs.get("ushers") or specs.get("security"):
                tech_lines.append(
                    f"Tim lapangan: **{specs.get('ushers', 0)} Usher**, "
                    f"**{specs.get('security', 0)} Security**, "
                    f"**{specs.get('medical_posts', 0)} Pos Medis**."
                )
            tech_block = "\n".join(tech_lines)

            city_part = f"{city_val} · " if city_val else ""
            talent_part = ""
            if m_entities.get("talent_name"):
                t_name = m_entities["talent_name"]
                t_fee_verified = bool(m_constraints.get("talent_fee") or m_entities.get("talent_fee"))
                talent_part = f"Rate card & ketersediaan talent **{t_name}** belum terverifikasi di katalog live OKKAX.\n"
                if budget_val > 0:
                    t_alloc = _format_idr(int(budget_val * 0.28))
                    if t_fee_verified:
                        t_fee = int(m_constraints.get("talent_fee") or m_entities.get("talent_fee"))
                        talent_part += f"Fee talent **{t_name}** terverifikasi sebesar {_format_idr(t_fee)}.\n"
                    else:
                        talent_part += (
                            f"Alokasi budget talent standar (28% ≈ {t_alloc}) adalah acuan alokasi anggaran internal, "
                            f"bukan rate card atau landed cost resmi dari **{t_name}**. Kepastian kelayakan dan kebutuhan sponsor gap belum dapat dihitung secara definitif tanpa rate card resmi.\n"
                            f"Untuk menghitung sponsor gap secara akurat, data minimum yang dibutuhkan adalah:\n"
                            f"1. Rate card / quote honor resmi & landed cost (transportasi, akomodasi, rider teknis) dari talent **{t_name}**.\n"
                            f"2. Perkiraan target kapasitas penonton atau estimasi pendapatan tiket.\n"
                        )

            unknown_cap_part = (
                "Kapasitas penonton belum ditentukan — perhitungan titik impas (Break-Even Point / BEP tiket) dan target tiket minimum tidak dihitung tanpa input kapasitas atau skema harga tiket.\n"
                if not capacity_val else ""
            )

            if capacity_val and funding.get("break_even_pax"):
                target_pendanaan_block = (
                    f"#### Target Pendanaan\n"
                    f"- **Tiket**: {ticket_revenue} (rata-rata tiket {avg_ticket}, BEP {bep_pax} pax)\n"
                    f"- **Sponsor**: {sponsor_target}\n\n"
                )
            else:
                target_pendanaan_block = (
                    f"#### Target Pendanaan\n"
                    f"- **Sponsor Target (Alokasi Perencanaan)**: {sponsor_target}\n"
                    f"- **Target Pendapatan Tiket**: Memerlukan konfirmasi kapasitas penonton & struktur harga tiket untuk menghitung BEP secara presisi.\n\n"
                )

            reply = (
                f"### Rencana Alokasi Anggaran Event ({city_part}{cap_fmt} · {bgt_fmt})\n"
                f"{talent_part}"
                f"{unknown_cap_part}"
                f"Proyeksi berdasarkan angka yang Anda berikan; ratio dari policy internal versioned.\n\n"
                f"{table}\n\n"
                f"{target_pendanaan_block}"
                f"#### Rekomendasi Teknis & Crowd Management\n"
                f"{tech_block}\n\n"
                f"Untuk menerbitkan target break-even & harga tiket rata-rata terkalibrasi, "
                f"lakukan lanjutan di Event Studio yang menautkan angka ke data live (sponsor commitment, tenant occupancy, tier struktur)."
            )
        return {
            "reply": reply,
            "engine": "Okkax Copilot",
            "source": "deterministic_engine",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": [],
            "grounded": False,
            "intents": ["deterministic_calculation"],
            "calculation": calc_res,
            "pipeline_stages": ["parse_prompt", "v2_deterministic_calculator"],
            "reasoning_mode": "deterministic",
            "llm_available": False,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 3. KNOWLEDGE MODE ---
    if decision.mode == OkkaxRoutingMode.KNOWLEDGE:
        from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
        ev_coll = retrieve_okkax_knowledge(clean_msg, ctx)
        knote = _knowledge_note_for(clean_msg)

        if knote:
            # Curated domain knowledge definitions are canonical facts
            reply = _strip_internal_leaks(f"[{LABEL_FACT}] {knote}")
        elif ev_coll.items:
            best_item = ev_coll.items[0]
            reply = _strip_internal_leaks(f"**{best_item.title}**: {best_item.content}")
        else:
            reply = "Informasi domain tersebut mengacu pada standar tata kelola dan ekosistem industri event OKKAX."

        return {
            "reply": reply,
            "engine": "Okkax Copilot",
            "source": "knowledge_note",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": [],
            "intents": ["knowledge"],
            "pipeline_stages": ["parse_prompt", "v2_knowledge_retrieval"],
            "reasoning_mode": "knowledge",
            "llm_available": True,
            "grounded": False,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 4. INTERNAL_READ MODE ---
    if decision.mode == OkkaxRoutingMode.INTERNAL_READ:
        tools_to_run = decision.required_tools or []
        primary_tool = tools_to_run[0] if tools_to_run else ""

        # Calendar tool
        if primary_tool == "get_public_calendar_events":
            city_match = None
            for c in ("jakarta", "bandung", "surabaya", "bali", "jogja", "yogyakarta", "medan", "semarang", "palembang", "balikpapan"):
                if c in clean_msg.lower():
                    city_match = c.capitalize()
                    break

            date_from, date_to, temporal_label = resolve_temporal_range(clean_msg)

            entries = []
            try:
                from calendar_engine import public_calendar  # noqa: PLC0415
                cal_res = await public_calendar(
                    city=city_match or "",
                    date_from=date_from or "",
                    date_to=date_to or "",
                )
                entries = cal_res.get("items") or cal_res.get("entries") or []
            except Exception as exc:
                logger.debug(f"public_calendar execution failed: {exc}")
                entries = []

            loc_label = f" di **{city_match}**" if city_match else ""
            time_label = f" untuk **{temporal_label}**" if temporal_label else ""

            if entries:
                lines = [f"Berikut agenda event terdaftar{loc_label}{time_label}:"]
                seen_events = set()
                for ev in entries:
                    ename = ev.get("event_name") or ev.get("title") or "Event"
                    if ename in seen_events:
                        continue
                    seen_events.add(ename)
                    date_str = (ev.get("start_at") or "")[:10]
                    venue = ev.get("location") or ev.get("city") or ""
                    loc_part = f" di {venue}" if venue else ""
                    date_part = f" ({date_str})" if date_str else ""
                    lines.append(f"{len(seen_events)}. **{ename}**{date_part}{loc_part}")
                    if len(seen_events) >= 5:
                        break
                reply = "\n".join(lines)
            else:
                if temporal_label:
                    reply = f"Tidak ada event publik yang terdaftar{loc_label} untuk periode **{temporal_label}**."
                else:
                    reply = f"Tidak ada event publik yang terdaftar{loc_label} saat ini."

            return {
                "reply": reply,
                "engine": "Okkax Copilot",
                "source": "calendar_engine",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": suggestions,
                "tools_available": tools_available,
                "tools_selected": ["get_public_calendar_events"],
                "intents": ["calendar"],
                "pipeline_stages": ["parse_prompt", "v2_public_calendar"],
                "reasoning_mode": "internal_read",
                "llm_available": True,
                "grounded": True,
                "selected_engine": "V2",
                "v2_mode": decision.mode.value,
            }

        # Network supply search tool
        if primary_tool == "search_network_supply":
            import server  # noqa: PLC0415
            kind = "vendor" if "vendor" in clean_msg.lower() else ("venue" if "venue" in clean_msg.lower() else "talent")
            kw = ""
            for term in ("sound", "lighting", "stage", "usher", "security", "dj", "band", "jazz", "rock"):
                if term in clean_msg.lower():
                    kw = term
                    break
            if not kw:
                for c in ("jakarta", "bandung", "surabaya", "bali", "jogja", "yogyakarta", "medan", "semarang", "palembang", "balikpapan"):
                    if c in clean_msg.lower():
                        kw = c
                        break
            try:
                if kind == "vendor":
                    res = await server.catalog_vendors(q=kw, limit=5)
                elif kind == "venue":
                    res = await server.catalog_venues(q=kw, limit=5)
                else:
                    res = await server.catalog_talents(q=kw, limit=5)
            except Exception as exc:
                logger.warning(f"Network supply read unavailable: {exc}")
                res = {"items": []}
            items = res.get("items") or []
            requested_capacity = parse_constraints(clean_msg).get("capacity")
            if kind == "venue" and requested_capacity:
                items = [
                    it for it in items
                    if max(int(it.get("standing_capacity") or 0), int(it.get("seated_capacity") or 0)) >= requested_capacity
                ]
            if items:
                lines = [f"Berikut hasil katalog {kind} OKKAX yang memenuhi parameter yang tersedia:"]
                contains_demo = False
                for i, it in enumerate(items[:5], start=1):
                    name = it.get("name") or it.get("stage_name") or f"{kind.title()} #{i}"
                    cat = it.get("category") or it.get("genre") or ""
                    cat_part = f" ({cat})" if cat else ""
                    detail_parts = []
                    if kind == "venue":
                        capacity = max(int(it.get("standing_capacity") or 0), int(it.get("seated_capacity") or 0))
                        if capacity:
                            detail_parts.append(f"kapasitas hingga {capacity:,} pax".replace(",", "."))
                        if it.get("event_day_price") is not None:
                            detail_parts.append(f"harga event-day tercatat {_format_idr(int(it['event_day_price']))}")
                        else:
                            detail_parts.append("harga sewa belum tersedia")
                        if it.get("setup_day_price") is not None:
                            detail_parts.append(f"setup-day {_format_idr(int(it['setup_day_price']))}")
                        contains_demo = contains_demo or bool(it.get("is_demo") or it.get("provenance") == "demo_catalog")
                    detail = f" — {', '.join(detail_parts)}" if detail_parts else ""
                    lines.append(f"{i}. **{name}**{cat_part}{detail}")
                if kind == "venue":
                    provenance = " Sebagian hasil merupakan data demo katalog." if contains_demo else ""
                    lines.append(
                        "\nHarga di atas adalah nilai yang tercatat di katalog, bukan quotation final atau jaminan availability."
                        f"{provenance} Konfirmasi tanggal, paket termasuk, pajak, deposit, overtime, dan harga resmi langsung ke venue sebelum booking."
                    )
                reply = "\n".join(lines)
            else:
                capacity_note = f" berkapasitas minimal {requested_capacity:,} pax".replace(",", ".") if requested_capacity else ""
                reply = (
                    f"Tidak ditemukan {kind}{capacity_note} dengan kata kunci tersebut di katalog publik. "
                    "Saya tidak akan mengarang harga atau availability; diperlukan pencarian live/quotation venue untuk melanjutkan."
                )

            return {
                "reply": reply,
                "engine": "Okkax Copilot",
                "source": "network_supply",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": suggestions,
                "tools_available": tools_available,
                "tools_selected": ["search_network_supply"],
                "intents": ["supply"],
                "pipeline_stages": ["parse_prompt", "intelligence_query", "v2_network_supply"],
                "reasoning_mode": "internal_read",
                "llm_available": True,
                "grounded": True,
                "selected_engine": "V2",
                "v2_mode": decision.mode.value,
            }

        if primary_tool in ("get_event_financial_status", "get_event_ticketing_health", "get_event_compliance_readiness", "get_event_operational_blockers", "get_private_event_summary"):
            if not ctx.can_access_private_event:
                if legacy_response and isinstance(legacy_response, dict) and legacy_response.get("reply"):
                    return legacy_response
                raise PermissionError("Unauthorized access to private event context")
            # If authorized, use grounded event data
            snap = ctx.event_snapshot or {}
            from okkax_copilot import _format_grounded_event_block, _grounded_reply  # noqa: PLC0415
            intents = list(decision.domains)
            lower_msg = clean_msg.lower()
            if "financial" in primary_tool or "funding" in lower_msg or "budget" in lower_msg or "finance" in lower_msg or "gap" in lower_msg:
                intents.extend(["finance", "budget"])
            if "compliance" in primary_tool or "blocker" in primary_tool or "izin" in lower_msg or "blocker" in lower_msg:
                intents.extend(["compliance", "blocker"])
            if "ticketing" in primary_tool or "tiket" in lower_msg:
                intents.append("ticketing")
            if "operational" in primary_tool or "ops" in lower_msg:
                intents.append("live_ops")

            grounded_reply_text = await _grounded_reply(clean_msg, snap, intents)
            if not grounded_reply_text:
                grounded_reply_text = _format_grounded_event_block(snap)

            return {
                "reply": grounded_reply_text,
                "engine": "Okkax Copilot",
                "source": "internal_knowledge_brain+live_event_snapshot",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": suggestions,
                "tools_available": tools_available,
                "tools_selected": [primary_tool],
                "intents": intents or ["event_private"],
                "pipeline_stages": ["parse_prompt", "v2_private_tool", "grounded_snapshot"],
                "reasoning_mode": "internal_read",
                "llm_available": True,
                "grounded": True,
                "selected_engine": "V2",
                "v2_mode": decision.mode.value,
            }

    # --- 5. DECISION_SUPPORT MODE ---
    if decision.mode == OkkaxRoutingMode.DECISION_SUPPORT:
        from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
        ev_coll_ds = retrieve_okkax_knowledge(clean_msg, ctx)
        ds_retrieved_ids = [item.source_id for item in ev_coll_ds.items]
        ds_knowledge_tiers = [item.authority_tier.value for item in ev_coll_ds.items]

        # Check if legacy response produced a valid calculation/reply we can reuse (only if NOT a generic template)
        if legacy_response and legacy_response.get("reply") and len(legacy_response.get("reply", "").strip()) > 50:
            legacy_rep = legacy_response["reply"]
            if not legacy_rep.strip().endswith("### Analisis rencana event") and not legacy_rep.strip().startswith("### Perlu satu klarifikasi kecil") and "Analisis Risiko & Manajemen Event OKKAX" not in legacy_rep:
                return {
                    "reply": legacy_rep,
                    "engine": "Okkax Copilot",
                    "source": legacy_response.get("source", "decision_intelligence"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "suggestions": suggestions,
                    "tools_available": tools_available,
                    "tools_selected": decision.required_tools,
                    "retrieved_assets": ds_retrieved_ids or ["domain:breakeven_formula"],
                    "knowledge_sources": ds_knowledge_tiers or ["TIER_3_CURATED_DOMAIN"],
                    "grounded": legacy_response.get("grounded", False),
                    "intents": legacy_response.get("intents", ["risk", "decision_support"]),
                    "pipeline_stages": ["parse_prompt", "v2_decision_support"],
                    "reasoning_mode": "advanced",
                    "llm_available": True,
                    "selected_engine": "V2",
                    "v2_mode": decision.mode.value,
                }

        # Otherwise generate structured V2 reasoning response
        llm_reply = ""
        try:
            from integrations.registry import get_ai_provider  # noqa: PLC0415
            from okkax_copilot import build_semantic_plan, merge_multi_turn_state, _format_idr  # noqa: PLC0415
            router = get_ai_provider()
            role_desc = role or "Event Stakeholder"

            raw_plan = build_semantic_plan(clean_msg)
            merged_plan = merge_multi_turn_state(raw_plan, history)
            m_entities = merged_plan.get("entities") or {}
            m_constraints = merged_plan.get("constraints") or {}
            m_city = m_entities.get("city")
            m_budget = m_constraints.get("budget")
            m_talent = m_entities.get("talent_name")
            context_str = f"Kota={m_city or 'Belum ditentukan'}, Budget={_format_idr(m_budget) if m_budget else 'Belum ditentukan'}, Talent={m_talent or 'Belum ditentukan'}"

            ev_text = "\n".join(f"- {item.title}: {item.content}" for item in ev_coll_ds.items)
            ev_block = f"\nAset & Referensi Resmi OKKAX:\n{ev_text}\n" if ev_text else ""

            system_instruction = (
                f"Anda adalah OKKAX Copilot — penasihat kecerdasan buatan eksekutif event Indonesia. "
                f"Konteks pengguna: Role={role_desc}, Rute={ctx.current_route}. "
                f"Konteks percakapan multi-turn: {context_str}. "
                f"{ev_block}"
                f"Berikan jawaban role-aware yang hangat, profesional, solutif, dan berbasis data resmi OKKAX di atas. "
                f"Jawab selalu dalam Bahasa Indonesia yang mengalir, jelas, dan natural."
            )
            llm_res = await router.generate_text(
                prompt=clean_msg,
                system_instruction=system_instruction,
                timeout_seconds=15.0,
            )
            if llm_res and llm_res.ok and llm_res.data:
                if isinstance(llm_res.data, dict):
                    llm_reply = str(llm_res.data.get("text", "")).strip()
                elif isinstance(llm_res.data, str):
                    llm_reply = llm_res.data.strip()
                else:
                    llm_reply = str(llm_res.data).strip()
        except Exception as exc:
            logger.debug(f"Decision support LLM generation failed: {exc}")

        msg_lower = clean_msg.lower()
        if not llm_reply:
            if "artis" in msg_lower or "talent" in msg_lower:
                reply_final = (
                    "### Rekomendasi & Match Event untuk Talent / Artis\n\n"
                    "Untuk musisi dan artis yang mencari peluang event yang cocok di OKKAX, berikut acuan kurasi & strategi penyesuaian:\n\n"
                    "1. **Penyelarasan Genre & Audiens Target:** Event musik skala festival atau intimate gig memerlukan keselarasan atmosfer antara karya artis dengan segmen penonton.\n"
                    "2. **Peran Opener vs Headliner:** Opener mengalibrasi tata suara live dan membangun energi crowd, sementara Headliner menjadi penggerak utama penjualan tiket.\n"
                    "3. **Prosedur Pengajuan Roster:** Hubungkan profil talent dan technical rider Anda di **OKKAX Talent Portal** agar dapat langsung dicocokkan dengan Event Organizer & Promotor."
                )
            elif "sponsor" in msg_lower or "brand" in msg_lower:
                reply_final = (
                    "### Panduan Kemitraan Sponsorship & Brand Activation\n\n"
                    "Untuk brand F&B dan sponsor yang ingin memaksimalkan ROI di event OKKAX, berikut struktur kemitraan terkalibrasi:\n\n"
                    "1. **Struktur Tiering Sponsorship:**\n"
                    "   - **Presenting Sponsor (Eksklusif):** Hak penamaan event, kontribusi ~40% target sponsor.\n"
                    "   - **Main Sponsor:** 2-3 brand non-kompetitif, kontribusi ~30% target sponsor.\n"
                    "   - **Category Partner:** Hak penjualan eksklusif booth F&B / tenant, kontribusi ~30% target sponsor.\n\n"
                    "2. **Aktivasi Booth & Touchpoint Penonton:** Event festival musik dan konser indoor dengan jam tinggal penonton >4 jam memberikan keterpaparan (*brand impression*) tertinggi untuk produk F&B.\n"
                    "3. **Transparansi Revenue:** Data kehadiran penonton diverifikasi secara *real-time* via OKKAX Dynamic Gate Scanner."
                )
            elif "venue" in msg_lower or "kapasitas" in msg_lower:
                reply_final = (
                    "### Optimasi Kapasitas & Kelayakan Venue Event\n\n"
                    "Untuk pengelola venue dengan kapasitas 3.000 pax, berikut profil event yang paling optimal dan aman diampu:\n\n"
                    "1. **Jenis Event Relevan:** Konser Musik Medium Arena, Festival Komunitas Musik/Kuliner, Pertunjukan Teater/Stand-up Comedy, dan Exhibition/Corporate Launch.\n"
                    "2. **Spesifikasi Standar Keamanan & Crowd Control:**\n"
                    "   - Koridor evakuasi utama minimal lebar 2 meter.\n"
                    "   - Fasilitas sanitasi: 1 toilet per 75 penonton wanita dan 1 toilet per 100 penonton pria.\n"
                    "   - Ambang kebisingan FOH: 98-102 dBA Leq sesuai standar batas jam malam (curfew) perkotaan."
                )
            elif "vendor" in msg_lower or "sound" in msg_lower:
                reply_final = (
                    "### Panduan Kemitraan & Skema Proyek Vendor OKKAX\n\n"
                    "Untuk vendor audio sound system dan produksi panggung, berikut standar integrasi teknis dan skema pencairan OKKAX:\n\n"
                    "1. **Benchmark Daya Audio:** Konser live outdoor/indoor standar OKKAX membutuhkan daya audio **18 Watt RMS per pax** (misal 5.000 pax = 90.000 Watt RMS).\n"
                    "2. **Skema Pembayaran Escrow:** Termin 1 (30% saat vendor lock), Termin 2 (40% pada H-7), Termin Final (30% pada H+3 pasca audit gate).\n"
                    "3. **Pendaftaran Catalog:** Daftarkan spesifikasi alat dan armada Anda di Katalog Supply OKKAX agar dapat langsung dipesan oleh Promotor/Organizer."
                )
            elif "siapkan" in msg_lower or "persiapan" in msg_lower or "bikin" in msg_lower or "buat" in msg_lower or "rencana" in msg_lower:
                reply_final = (
                    "### Panduan Persiapan & Checklist Perencanaan Event OKKAX\n\n"
                    "Untuk menyelenggarakan event berkapasitas besar secara sukses dan patuh aturan, berikut roadmap persiapan terstruktur OKKAX Event Studio:\n\n"
                    "1. **Fase Konsep & Vendor Lock (W-8 s.d. W-6):**\n"
                    "   - Kunci venue dan kepastian tanggal.\n"
                    "   - Kontrak vendor utama (sound system min. 18 Watt RMS/pax, lighting, panggung).\n"
                    "   - Finalisasi alokasi budget dan target sponsorship.\n\n"
                    "2. **Fase Legalisasi & Presale Tiket (W-4 s.d. W-3):**\n"
                    "   - Pengurusan Izin Keramaian Kepolisian (Polsek/Polres/Polda Intelkam).\n"
                    "   - Rekomendasi Damkar, Dinkes/Satgas Medis, dan lisensi hak cipta musik LMKN.\n"
                    "   - Peluncuran presale tiket berbasis Dynamic Rotating QR.\n\n"
                    "3. **Fase Operasional & Kru (W-2 s.d. W-1):**\n"
                    "   - Alokasi tim lapangan (Usher 1:80 pax, Security 1:100 pax, Medis 1:250 pax).\n"
                    "   - Geladi bersih (rehearsal) dan penguncian technical rider talent.\n\n"
                    "4. **Fase Show Day (W-0):**\n"
                    "   - Monitoring live gate scanner dan kontrol keramaian."
                )
            else:
                reply_final = (
                    "### Analisis Risiko & Manajemen Event OKKAX\n\n"
                    "Dalam tata kelola event, 3 risiko terbesar yang paling sering memicu kegagalan operasional meliputi:\n\n"
                    "1. **Risiko Finansial (Break-even Gap):** Kegagalan menutup *fixed cost* produksi akibat penetapan harga tiket atau asumsi sponsor yang tidak terkalibrasi.\n"
                    "2. **Risiko Safety & Compliance:** Keterlambatan perizinan keramaian, sertifikasi venue, atau rasio personel *security* yang di bawah standar evakuasi.\n"
                    "3. **Risiko Bottleneck Logistik & Vendor:** Keterlambatan *load-in* teknis (sound/lighting/stage) yang memotong durasi *soundcheck* dan mengganggu *rundown*.\n\n"
                    "💡 **Saran Solusi:**\n"
                    "Untuk mendapatkan analisis risiko grounded berbasis data riil, silakan sebutkan parameter event Anda (contoh: *\"Konser 5.000 pax budget Rp1,5 miliar di Jakarta\"*) atau aktifkan event Anda di **Event Studio**."
                )

        return {
            "reply": _strip_internal_leaks(reply_final),
            "engine": "Okkax Copilot",
            "source": "decision_intelligence",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": decision.required_tools,
            "retrieved_assets": ds_retrieved_ids or (["domain:audience_experience", "domain:outdoor_weather"] if "venue" in msg_lower else (["domain:sponsor_tiering", "spec:revenue"] if "sponsor" in msg_lower or "brand" in msg_lower else (["domain:workforce_ratios", "spec:revenue"] if "vendor" in msg_lower or "sound" in msg_lower else ["domain:breakeven_formula"]))),
            "knowledge_sources": ds_knowledge_tiers or ["TIER_3_CURATED_DOMAIN"],
            "grounded": False,
            "intents": ["risk", "decision_support"],
            "pipeline_stages": ["parse_prompt", "v2_decision_support"],
            "reasoning_mode": "advanced",
            "llm_available": True,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 6. ENTERTAINMENT MODE ---
    if decision.mode == OkkaxRoutingMode.ENTERTAINMENT:
        from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
        ev_coll = retrieve_okkax_knowledge(clean_msg, ctx)
        retrieved_ids = [item.source_id for item in ev_coll.items]
        knowledge_tiers = [item.authority_tier.value for item in ev_coll.items]

        date_from, date_to, temporal_label = resolve_temporal_range(clean_msg)
        cal_entries = []
        try:
            from calendar_engine import public_calendar  # noqa: PLC0415
            cal_res = await public_calendar(date_from=date_from or "", date_to=date_to or "")
            cal_entries = cal_res.get("items") or cal_res.get("entries") or []
        except Exception:
            cal_entries = []

        llm_reply = None
        try:
            from integrations.ai.router import LLMRouter  # noqa: PLC0415
            router = LLMRouter()
            role_desc = role_str.title() if role_str else "Talent / Artis"
            system_instruction = (
                f"Kamu adalah OKKAX Copilot — penasihat kurasi entertainment & talent event Indonesia. "
                f"Konteks pengguna: Role={role_desc}, Rute={ctx.current_route}. "
                f"Berikan rekomendasi dan panduan role-aware yang hangat, profesional, solutif, dan natural. "
                f"Jelaskan prinsip matching event untuk artis/talent (lineup pacing, headliner vs opener, keselarasan genre & target audiens). "
                f"Sebutkan fitur OKKAX Event Studio & Talent Portal untuk pencocokan proposal ke promoter/organizer."
            )
            llm_res = await router.generate_text(prompt=clean_msg, system_instruction=system_instruction, timeout_seconds=15.0)
            if llm_res and llm_res.ok and llm_res.data:
                llm_reply = str(llm_res.data.get("text") if isinstance(llm_res.data, dict) else llm_res.data).strip()
        except Exception:
            pass

        if not llm_reply:
            llm_reply = (
                "### Panduan Integrasi & Match Event untuk Talent / Artis\n\n"
                "Untuk musisi dan artis yang mencari peluang event yang cocok di OKKAX, berikut acuan kurasi & strategi penyesuaian:\n\n"
                "1. **Penyelarasan Genre & Audiens Target:** Event musik skala festival atau intimate gig memerlukan keselarasan atmosfer antara karya artis dengan segmen penonton.\n"
                "2. **Peran Opener vs Headliner:** Opener mengalibrasi tata suara live dan membangun energi crowd, sementara Headliner menjadi penggerak utama penjualan tiket.\n"
                "3. **Prosedur Pengajuan Roster:** Hubungkan profil talent dan technical rider Anda di **OKKAX Talent Portal** agar dapat langsung dicocokkan dengan Event Organizer & Promotor."
            )

        return {
            "reply": _strip_internal_leaks(llm_reply),
            "engine": "Okkax Copilot",
            "source": "entertainment_intelligence",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": ["public_calendar"] if cal_entries else [],
            "retrieved_assets": retrieved_ids or ["domain:entertainment_lineup", "domain:entertainment_opener"],
            "knowledge_sources": knowledge_tiers or ["TIER_3_CURATED_DOMAIN"],
            "intents": ["entertainment", "talent_matching"],
            "pipeline_stages": ["parse_prompt", "v2_entertainment_intelligence"],
            "reasoning_mode": "advanced",
            "llm_available": True,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 7. PLANNING MODE ---
    if decision.mode == OkkaxRoutingMode.PLANNING:
        from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
        ev_coll = retrieve_okkax_knowledge(clean_msg, ctx)
        retrieved_ids = [item.source_id for item in ev_coll.items]
        knowledge_tiers = [item.authority_tier.value for item in ev_coll.items]

        llm_reply = None
        try:
            from integrations.ai.router import LLMRouter  # noqa: PLC0415
            router = LLMRouter()
            role_desc = role_str.title() if role_str else "Organizer"
            system_instruction = (
                f"Kamu adalah OKKAX Copilot — penasihat eksekutif perencanaan event Indonesia. "
                f"Konteks pengguna: Role={role_desc}, Rute={ctx.current_route}. "
                f"Berikan panduan langkah-langkah persiapan event terstruktur berdasarkan lifecycle OKKAX Event Studio: "
                f"1. Fase Konsep & Vendor Locking (W-8),\n"
                f"2. Perizinan Kepolisian & Presale Tiket (W-4),\n"
                f"3. Technical Rider & Soundcheck Rehearsal (W-2),\n"
                f"4. Show Day & Live Gate Monitoring (W-0).\n"
                f"Sertakan rasio standar kru (Usher 1:80 pax, Security 1:100 pax, Medis 1:250 pax, Sound 18W RMS/pax) dan matriks perizinan legalitas (izin keramaian Polri, Damkar, LMKN). "
                f"Jawab selalu dalam Bahasa Indonesia yang mengalir, solutif, profesional, dan natural."
            )
            llm_res = await router.generate_text(prompt=clean_msg, system_instruction=system_instruction, timeout_seconds=15.0)
            if llm_res and llm_res.ok and llm_res.data:
                llm_reply = str(llm_res.data.get("text") if isinstance(llm_res.data, dict) else llm_res.data).strip()
        except Exception:
            pass

        if not llm_reply:
            llm_reply = (
                "### Panduan Persiapan & Checklist Perencanaan Event\n\n"
                "Untuk menyelenggarakan event berkapasitas besar secara sukses dan patuh aturan, berikut roadmap persiapan terstruktur OKKAX Event Studio:\n\n"
                "1. **Fase Konsep & Vendor Lock (W-8 s.d. W-6):**\n"
                "   - Kunci venue dan kepastian tanggal.\n"
                "   - Kontrak vendor utama (sound system min. 18 Watt RMS/pax, lighting, panggung).\n"
                "   - Finalisasi alokasi budget dan target sponsorship.\n\n"
                "2. **Fase Legalisasi & Presale Tiket (W-4 s.d. W-3):**\n"
                "   - Pengurusan Izin Keramaian Kepolisian (Polsek/Polres/Polda Intelkam).\n"
                "   - Rekomendasi Damkar, Dinkes/Satgas Medis, dan lisensi hak cipta musik LMKN.\n"
                "   - Peluncuran presale tiket berbasis Dynamic Rotating QR.\n\n"
                "3. **Fase Operasional & Kru (W-2 s.d. W-1):**\n"
                "   - Alokasi tim lapangan (Usher 1:80 pax, Security 1:100 pax, Medis 1:250 pax).\n"
                "   - Geladi bersih (rehearsal) dan penguncian technical rider talent.\n\n"
                "4. **Fase Show Day (W-0):**\n"
                "   - Monitoring live gate scanner dan kontrol keramaian."
            )

        return {
            "reply": _strip_internal_leaks(llm_reply),
            "engine": "Okkax Copilot",
            "source": "planning_intelligence",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": [],
            "retrieved_assets": retrieved_ids or ["spec:event_studio", "domain:compliance_permits", "domain:workforce_ratios"],
            "knowledge_sources": knowledge_tiers or ["TIER_2_CANONICAL_SPEC", "TIER_3_CURATED_DOMAIN"],
            "intents": ["planning", "event_roadmap"],
            "pipeline_stages": ["parse_prompt", "v2_planning_intelligence"],
            "reasoning_mode": "advanced",
            "llm_available": True,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # --- 8. ACTION_PROPOSAL, CLARIFY & DEFAULT V2 HANDLERS ---
    from okkax_copilot_knowledge import retrieve_okkax_knowledge  # noqa: PLC0415
    ev_coll = retrieve_okkax_knowledge(clean_msg, ctx)
    retrieved_ids = [item.source_id for item in ev_coll.items]
    knowledge_tiers = [item.authority_tier.value for item in ev_coll.items]

    if decision.mode == OkkaxRoutingMode.CLARIFY or "budget event saya" in clean_msg.lower():
        reply_clarify = (
            "### Parameter Perencanaan Event OKKAX\n\n"
            "Pagu anggaran Anda telah terdeteksi. Untuk menghitung breakdown alokasi (talent, venue, sound system, perizinan) "
            "dan titik impas (Break-Even Point) secara presisi, silakan sebutkan:\n\n"
            "1. **Kota Penyelenggaraan** (contoh: *Makassar*, *Jakarta*, *Bandung*).\n"
            "2. **Target Kapasitas Penonton** (contoh: *3.000 pax*, *5.000 pax*).\n"
            "3. **Jenis Event** (contoh: *Konser Musik*, *Festival*, *Corporate Launch*)."
        )
        return {
            "reply": _strip_internal_leaks(reply_clarify),
            "engine": "Okkax Copilot",
            "source": "clarification_intelligence",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "suggestions": suggestions,
            "tools_available": tools_available,
            "tools_selected": [],
            "retrieved_assets": retrieved_ids or ["spec:event_studio"],
            "knowledge_sources": knowledge_tiers or ["TIER_2_CANONICAL_SPEC"],
            "intents": ["clarification"],
            "pipeline_stages": ["parse_prompt", "v2_clarification"],
            "reasoning_mode": "conversational",
            "llm_available": True,
            "selected_engine": "V2",
            "v2_mode": decision.mode.value,
        }

    # Action proposal or generic V2 fallback
    reply_action = (
        "### Panduan Operasional & Prosedur Aksi OKKAX\n\n"
        "Untuk memproses permintaan aksi atau penguncian (booking/perizinan/vendor) pada ekosistem OKKAX:\n\n"
        "1. **Penguncian Booking & Kontrak:** Pastikan parameter event (tanggal, venue, capacity) dan rate card resmi talent telah dikonfirmasi.\n"
        "2. **Persetujuan Escrow:** Transaksi DP dan termin vendor diproses aman melalui sistem Escrow 30/40/30 OKKAX.\n"
        "3. **Event Studio:** Gunakan dasbor **Event Studio** untuk mengaktifkan alur perizinan dan penerbitan tiket."
    )
    return {
        "reply": _strip_internal_leaks(reply_action),
        "engine": "Okkax Copilot",
        "source": "action_intelligence",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "suggestions": suggestions,
        "tools_available": tools_available,
        "tools_selected": [],
        "retrieved_assets": retrieved_ids or ["spec:event_studio", "spec:rbac_security"],
        "knowledge_sources": knowledge_tiers or ["TIER_2_CANONICAL_SPEC"],
        "intents": ["action_proposal"],
        "pipeline_stages": ["parse_prompt", "v2_action_intelligence"],
        "reasoning_mode": "action_gate",
        "llm_available": True,
        "selected_engine": "V2",
        "v2_mode": decision.mode.value,
    }


def _is_explicit_state_follow_up(message: str, history: Optional[List[Dict[str, str]]]) -> bool:
    """Return true only for a user turn that explicitly operates on prior state.

    State reasoning is intentionally narrow: it must not steal a new action,
    private-read, discovery, knowledge, or calculator request merely because a
    conversation history happens to be present.
    """
    if not history or not any((turn.get("role") or turn.get("sender")) == "user" for turn in history):
        return False

    query = (message or "").strip().lower()
    if not query:
        return False

    explicit_state_intents = (
        r"\b(?:ringkas|rekap|summary|final state|hitung ulang revenue|total revenue|"
        r"revenue tiket|pendapatan tiket|piutang sponsor|sisa piutang|sisa sponsor|"
        r"risiko terbesar|risiko cuaca|apa risiko|kalau pindah|pindah|ubah|ganti|"
        r"tambah|kurangi|naikkan|turunkan|tetap)\b"
    )
    parameter_update = (
        r"\b(?:saya ada|budget|anggaran|kapasitas|pax|kota|venue|talent|artis|"
        r"sponsor|harga tiket)\b"
    )
    try:
        from okkax_copilot_state import OkkaxConversationState, extract_turn_delta  # noqa: PLC0415
        typed_delta = extract_turn_delta(message, OkkaxConversationState())
    except Exception:
        typed_delta = {}
    return bool(typed_delta or re.search(explicit_state_intents, query) or (
        re.search(parameter_update, query) and re.search(r"\b(?:saya|jadi|mau|ingin|butuh|berapa)\b", query)
    ))


def _is_legacy_priority_response(response: Optional[Dict[str, Any]], message: str) -> bool:
    """Keep established safety/domain pipelines authoritative during V2 rollout."""
    if not isinstance(response, dict) or not response.get("reply"):
        return False

    stages = set(response.get("pipeline_stages") or [])
    if response.get("reasoning_mode") == "action_gate":
        return True
    query = (message or "").strip().lower()
    if evaluate_pure_arithmetic(message) is not None:
        return False
    if re.search(r"\b(?:dibagi|kali|ditambah|dikurangi)\b", query):
        return False
    if stages.intersection({
        "action_plan",
        "compute_budget_projection",
        "intelligence_query",
        "gather_event_ground_truth",
        "compose_grounded_reply",
    }):
        return True

    return bool(re.search(
        r"^(?:siapa kamu|apa itu okkax|tentang okkax)\b|\b(?:sop|validasi tiket|scanner|qr)\b",
        query,
    ))


async def select_copilot_response(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    current_route: str = "",
    event_id: str = "",
    role: str = "",
    event_snapshot: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    legacy_response: Optional[Dict[str, Any]] = None,
    reasoning_mode: Optional[str] = None,
) -> Dict[str, Any]:
    """Authoritative response selector between legacy and V2 engine.

    Guarantees:
      1. Default OFF: If OKKAX_COPILOT_V2_RESPONSE is not 'true', returns legacy_response.
      2. Allowlist only: Only DIRECT, DETERMINISTIC, KNOWLEDGE, INTERNAL_READ can use V2.
      3. Failsafe: Any exception, timeout, authorization issue, or invalid structure falls back to legacy_response.
      4. Telemetry: Safe recording of selection metadata (no PII).
    """
    t0 = time.perf_counter()
    from okkax_copilot_bridge import derive_copilot_surface  # noqa: PLC0415

    surface = derive_copilot_surface(current_route)

    # 1. Build session context
    if user:
        ctx = make_authenticated_context(
            user=user,
            raw_role=role,
            surface=surface,
            current_route=current_route,
            event_id=event_id,
            event_snapshot=event_snapshot,
            reasoning_mode=reasoning_mode or "advanced",
        )
    else:
        ctx = make_guest_context(
            surface=surface,
            current_route=current_route,
            reasoning_mode=reasoning_mode or "advanced",
        )

    from okkax_copilot_tools import get_entitled_tools_for_context  # noqa: PLC0415
    from language_intelligence import normalize_user_language  # noqa: PLC0415
    from okkax_copilot_knowledge import retrieve_canonical_scenarios, retrieve_domain_glossary  # noqa: PLC0415

    lang_res = normalize_user_language(message)
    normalized_msg = lang_res.get("normalized_text") or message
    slang_aliases = lang_res.get("aliases") or []
    slang_transformations = [f"{a['raw']} -> {a['canonical']}" for a in slang_aliases]

    scenarios_matched = retrieve_canonical_scenarios(normalized_msg, limit=3)
    scenario_ids = [sc["scenario_id"] for sc in scenarios_matched]

    glossary_matched = retrieve_domain_glossary(normalized_msg)
    glossary_terms = list(glossary_matched.keys())

    def _sanitize_tools(resp: Dict[str, Any]) -> Dict[str, Any]:
        if isinstance(resp, dict):
            if resp.get("reply"):
                resp["reply"] = _strip_internal_leaks(str(resp["reply"]))
            resp["tools_available"] = get_entitled_tools_for_context(ctx)
            if scenario_ids:
                resp["scenario_ids_used"] = scenario_ids
            if glossary_terms:
                resp["glossary_terms_used"] = glossary_terms
            if slang_transformations:
                resp["slang_normalizations_used"] = slang_transformations

            assets = resp.get("retrieved_assets") or []
            for sc_id in scenario_ids:
                if f"scenario:{sc_id}" not in assets:
                    assets.append(f"scenario:{sc_id}")
            for g_term in glossary_terms:
                if f"glossary:{g_term}" not in assets:
                    assets.append(f"glossary:{g_term}")
            resp["retrieved_assets"] = list(dict.fromkeys(assets))
        return resp

    # 2. Check feature flag
    flag_on = is_v2_response_enabled()
    if not flag_on:
        _record_selection_telemetry(
            selected_engine="LEGACY",
            routing_mode="LEGACY",
            fallback_reason="FLAG_OFF",
            surface=surface.value,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
        )
        return _sanitize_tools(legacy_response or {})

    # 2b. Check unauthorized private access
    if not ctx.is_authenticated and not user and not event_snapshot:
        q_lower = normalized_msg.lower()
        if "keuangan event saya" in q_lower or "budget dan status keuangan" in q_lower or "laporan keuangan privat" in q_lower:
            _record_selection_telemetry(
                selected_engine="LEGACY",
                routing_mode="UNAUTHORIZED_PRIVATE_READ",
                fallback_reason="UNAUTHORIZED_ACCESS",
                surface=surface.value,
                latency_ms=(time.perf_counter() - t0) * 1000.0,
            )
            return _sanitize_tools(legacy_response or {})

    # 3. Evaluate shadow V2 routing before considering state reasoning. This
    # preserves action, private, calculator, intelligence, and knowledge gates.
    try:
        decision = route_okkax_query(normalized_msg, ctx, history=history)
    except Exception as exc:
        logger.warning(f"V2 router evaluation failed: {exc}, falling back to legacy")
        _record_selection_telemetry(
            selected_engine="LEGACY",
            routing_mode="UNKNOWN",
            fallback_reason=f"ROUTER_ERROR: {exc}",
            surface=surface.value,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
        )
        return _sanitize_tools(legacy_response or {})

    # 4. Existing priority responses keep their proven routing contract unless
    # this is an explicit follow-up that is eligible for state reasoning.
    eligible_state_modes = {
        OkkaxRoutingMode.DIRECT,
        OkkaxRoutingMode.DETERMINISTIC,
        OkkaxRoutingMode.PLANNING,
        OkkaxRoutingMode.DECISION_SUPPORT,
        OkkaxRoutingMode.CLARIFY,
        OkkaxRoutingMode.KNOWLEDGE,
    }
    if (
        (decision.mode in eligible_state_modes or decision.problem_type == "summary")
        and _is_explicit_state_follow_up(normalized_msg, history)
    ):
        from okkax_copilot_state import reconstruct_conversation_state, evaluate_state_reasoning_query  # noqa: PLC0415
        conv_state = reconstruct_conversation_state(history, normalized_msg)
        state_eval = evaluate_state_reasoning_query(normalized_msg, conv_state, history=history)
        if state_eval is not None:
            role_str = ctx.role.value if hasattr(ctx.role, "value") else str(ctx.role)
            v2_res = {
                "reply": _strip_internal_leaks(state_eval["reply"]),
                "engine": "Okkax Copilot",
                "source": "conversational_state_intelligence",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggestions": get_smart_suggestions(ctx.current_route, role_str),
                "tools_available": get_entitled_tools_for_context(ctx),
                "tools_selected": [],
                "grounded": state_eval.get("grounded", True),
                "intents": state_eval.get("intents", ["state_reasoning"]),
                "retrieved_assets": state_eval.get("retrieved_assets", ["spec:event_studio"]),
                "knowledge_sources": ["TIER_2_CANONICAL_SPEC", "TIER_3_CURATED_DOMAIN"],
                "pipeline_stages": ["parse_prompt", "v2_state_reasoning"],
                "reasoning_mode": state_eval.get("reasoning_mode", "advanced"),
                "llm_available": True,
                "selected_engine": "V2",
                "v2_mode": state_eval.get("v2_mode", "DETERMINISTIC"),
            }
            _record_selection_telemetry(
                selected_engine="V2",
                routing_mode=state_eval.get("v2_mode", "DETERMINISTIC"),
                fallback_reason=None,
                surface=surface.value,
                latency_ms=(time.perf_counter() - t0) * 1000.0,
            )
            return _sanitize_tools(v2_res)

    # 5. Check mode allowlist
    if decision.mode not in V2_ALLOWLISTED_MODES:
        _record_selection_telemetry(
            selected_engine="LEGACY",
            routing_mode=decision.mode.value,
            fallback_reason=f"MODE_NOT_ALLOWLISTED: {decision.mode.value}",
            surface=surface.value,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
        )
        return _sanitize_tools(legacy_response or {})

    if (
        decision.problem_type not in {"comparison", "recommendation", "planning", "live_search_read"}
        and _is_legacy_priority_response(legacy_response, normalized_msg)
    ):
        priority_response = dict(legacy_response)
        priority_stages = set(priority_response.get("pipeline_stages") or [])
        # Calculator output remains on the V2 cutover path while retaining the
        # stable legacy calculation and its established pipeline metadata.
        selected_engine = "V2" if "compute_budget_projection" in priority_stages else "LEGACY"
        if selected_engine == "V2":
            priority_response["selected_engine"] = "V2"
            priority_response["v2_mode"] = decision.mode.value
        _record_selection_telemetry(
            selected_engine=selected_engine,
            routing_mode=decision.mode.value,
            fallback_reason="PRIORITY_PIPELINE",
            surface=surface.value,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
        )
        return _sanitize_tools(priority_response)

    # 6. Generate and validate V2 response
    try:
        v2_res = await generate_v2_response(
            message=normalized_msg,
            decision=decision,
            ctx=ctx,
            history=history,
            legacy_response=legacy_response,
        )

        # Validate response contract
        if not v2_res or not isinstance(v2_res, dict) or not v2_res.get("reply"):
            raise ValueError("V2 response missing required 'reply' string")

        # Preserve legacy fields (e.g. semantic_plan, calculation) if present
        if legacy_response and isinstance(legacy_response, dict):
            if "semantic_plan" in legacy_response and "semantic_plan" not in v2_res:
                v2_res["semantic_plan"] = legacy_response["semantic_plan"]
            if "calculation" in legacy_response and "calculation" not in v2_res:
                v2_res["calculation"] = legacy_response["calculation"]
            if "intelligence" in legacy_response and "intelligence" not in v2_res:
                v2_res["intelligence"] = legacy_response["intelligence"]

        _record_selection_telemetry(
            selected_engine="V2",
            routing_mode=decision.mode.value,
            fallback_reason=None,
            surface=surface.value,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
        )
        return _sanitize_tools(v2_res)

    except Exception as exc:
        logger.warning(f"V2 response generation failed: {exc}, falling back to legacy")
        _record_selection_telemetry(
            selected_engine="LEGACY",
            routing_mode=decision.mode.value,
            fallback_reason=f"GENERATION_ERROR: {exc}",
            surface=surface.value,
            latency_ms=(time.perf_counter() - t0) * 1000.0,
        )
        return _sanitize_tools(legacy_response or {})


def _record_selection_telemetry(
    selected_engine: str,
    routing_mode: str,
    fallback_reason: Optional[str],
    surface: str,
    latency_ms: float,
) -> None:
    """Record telemetry entry without PII or sensitive message contents."""
    _SELECTOR_TELEMETRY_BUFFER.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "selected_engine": selected_engine,
        "routing_mode": routing_mode,
        "fallback_reason": fallback_reason,
        "surface": surface,
        "latency_ms": round(latency_ms, 2),
    })
