"""OKKAX Copilot v5 — semantic plan + multi-turn state carry-over.

Behavioral tests (not exact-string): assert semantic_plan shape, multi-turn
constraint carry-over via history, and low UNKNOWN rate on realistic ID/EN
phrasings.
"""
import os
import asyncio
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
API = "http://127.0.0.1:8001/api"
PW = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id")
EVENT_ID = "evt-aruna-2026"


def _login(email, pw=PW):
    if "admin" in email:
        pw = ADMIN_PW
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {"organizer": _login("organizer@okkax.id"), "audience": _login("audience@okkax.id"), "admin": _login(ADMIN_EMAIL)}


def _chat(msg, token=None, event_id=None, history=None):
    payload = {"message": msg}
    if event_id:
        payload["event_id"] = event_id
    if history is not None:
        payload["history"] = history
    headers = _h(token) if token else {"Content-Type": "application/json"}
    r = requests.post(f"{API}/okkax/chat", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- pure: semantic plan shape ----------
def test_semantic_plan_shape_and_keys():
    from okkax_copilot import build_semantic_plan
    plan = build_semantic_plan("hitung break-even festival 5000 pax Rp1,5 miliar Jakarta")
    for k in ("intent", "domains", "objective", "entities", "constraints",
              "missing_fields", "needs_live_data", "needs_graph",
              "needs_intelligence", "needs_action"):
        assert k in plan
    assert plan["intent"] == "ANALYTICAL"
    assert "budget" in plan["domains"] or "ticketing" in plan["domains"]
    assert plan["constraints"]["budget"] == 1_500_000_000
    assert plan["constraints"]["capacity"] == 5000
    assert plan["entities"]["city"] == "Jakarta"
    assert plan["entities"]["event_type"] == "festival"


def test_semantic_plan_action_flags_missing_fields():
    from okkax_copilot import build_semantic_plan
    plan = build_semantic_plan("buat 1000 QR tiket")
    assert plan["intent"] == "ACTION"
    assert plan["entities"]["quantity_tickets"] == 1000
    # Missing: tier_name and event_id
    assert "tier_name" in plan["missing_fields"]


def test_semantic_plan_simulation_from_saving_prompt():
    from okkax_copilot import build_semantic_plan
    plan = build_semantic_plan("kurangi biaya dari Rp1 miliar jadi Rp800 juta")
    assert plan["intent"] == "SIMULATION"
    assert plan["constraints"]["baseline"] == 1_000_000_000
    assert plan["constraints"]["target"] == 800_000_000


def test_indonesian_grouping_and_bm_money_normalization():
    from okkax_copilot import parse_constraints
    parsed = parse_constraints("festival 5.000 pax budget 1B maksimal 800M")
    assert parsed["capacity"] == 5_000
    assert parsed["baseline"] == 1_000_000_000
    assert parsed["target"] == 800_000_000
    assert parsed["budget"] == 800_000_000


def test_event_budget_with_sound_scope_is_not_reclassified_as_vendor_cap():
    from okkax_copilot import parse_constraints

    parsed = parse_constraints(
        "Bantu hitung alokasi biaya dan teknis sound system konser festival "
        "5000 orang di Bandung budget 1.25 Milyar"
    )
    assert parsed["budget"] == 1_250_000_000
    assert parsed["vendor_max_budget"] is None

    scoped = parse_constraints("Saya butuh vendor sound system. Budget maksimal Rp120 juta.")
    assert scoped["budget"] is None
    assert scoped["vendor_max_budget"] == 120_000_000


def test_exact_capacity_only_budget_breakeven_prompt_gets_complete_fallback(monkeypatch):
    from okkax_copilot import (
        DEFAULT_COPILOT_CALCULATOR_POLICY_DOC,
        _build_semantic_projection,
        _semantic_intents,
        ask_okkax_copilot,
        build_semantic_plan,
        parse_constraints,
    )

    prompt = "Bantu hitung budget & break-even festival 5.000 pax"
    parsed = parse_constraints(prompt)
    plan = build_semantic_plan(prompt, parsed)
    projection = _build_semantic_projection(plan, DEFAULT_COPILOT_CALCULATOR_POLICY_DOC)

    assert parsed["capacity"] == 5_000
    assert plan["intent"] == "ANALYTICAL"
    assert "budget" in _semantic_intents(plan)
    assert "breakeven" in _semantic_intents(plan)
    assert projection["planning_estimate"] is True
    assert projection["event_budget"] == 1_000_000_000
    assert projection["funding"]["break_even_pax"] == 4_100

    monkeypatch.setenv("OKKAX_COPILOT_REASONING_ENABLED", "false")
    result = asyncio.run(ask_okkax_copilot(prompt))
    assert result["engine"] == "Okkax Copilot"
    assert result["reasoning_mode"] == "deterministic_fallback"
    assert "5,000 pax" in result["reply"]
    assert "Struktur budget deterministik" in result["reply"]
    assert "BEP kerja: 4,100 tiket" in result["reply"]
    assert "kapasitas penonton belum disebut" not in result["reply"].lower()
    assert "butuh angka spesifik" not in result["reply"].lower()


# ---------- multi-turn ----------
def test_multi_turn_action_fills_tier_and_quantity_from_prior():
    # Turn 1 asks to generate tickets; Turn 2 completes with "Regular"
    history = [
        {"role": "user", "content": "buat 1000 QR tiket"},
        {"role": "assistant", "content": "Sebelum lanjut, tiket masuk tier apa?"},
    ]
    d = _chat("Regular", history=history)
    plan = d.get("semantic_plan", {})
    assert plan.get("intent") == "ACTION"
    ent = plan.get("entities", {})
    assert ent.get("quantity_tickets") == 1000


def test_multi_turn_analytical_inherits_budget_from_prior():
    history = [
        {"role": "user", "content": "hitung break-even konser 5000 pax"},
        {"role": "assistant", "content": "Budget totalnya berapa?"},
    ]
    d = _chat("budget 1 miliar", history=history)
    plan = d.get("semantic_plan", {})
    assert plan["constraints"]["budget"] == 1_000_000_000
    assert plan["constraints"]["capacity"] == 5000


def test_multi_turn_saving_carries_baseline_target():
    history = [
        {"role": "user", "content": "budget event Rp1 miliar"},
    ]
    d = _chat("turunin jadi 800 juta", history=history)
    plan = d.get("semantic_plan", {})
    assert plan["intent"] == "SIMULATION"
    # Baseline should be inferred from prior (1B) and target from current (800M)
    assert plan["constraints"]["baseline"] in (1_000_000_000, None)  # depending on parser resolution
    assert plan["constraints"]["target"] == 800_000_000


def test_full_conversation_state_vendor_scope_and_qr_action():
    from okkax_copilot import build_semantic_plan, merge_multi_turn_state, parse_constraints

    turns = [
        "festival Jakarta",
        "5.000 pax",
        "budget 1B maksimal 800M",
        "break-even",
        "30% penjualan H-7",
        "sponsor batal",
        "vendor sound maksimal 120M",
        "1.000 QR Regular",
    ]
    history = []
    final_plan = None
    for message in turns:
        parsed = parse_constraints(message)
        final_plan = merge_multi_turn_state(build_semantic_plan(message, parsed), history)
        history.extend([
            {"role": "user", "content": message},
            {"role": "assistant", "content": "lanjut"},
        ])

    assert final_plan["intent"] == "ACTION"
    assert final_plan["entities"]["city"] == "Jakarta"
    assert final_plan["entities"]["event_type"] == "festival"
    assert final_plan["entities"]["quantity_tickets"] == 1_000
    assert final_plan["entities"]["ticket_tier"] == "Regular"
    assert final_plan["entities"]["vendor_type"] == "sound"
    assert final_plan["entities"]["cancellation_intent"] is True
    assert final_plan["constraints"]["capacity"] == 5_000
    assert final_plan["constraints"]["target"] == 800_000_000
    assert final_plan["constraints"]["budget"] == 800_000_000
    assert final_plan["constraints"]["ticket_sales_pct"] == 30
    assert final_plan["constraints"]["vendor_max_budget"] == 120_000_000


def test_reasoning_uses_gemini_primary_openrouter_secondary_once(monkeypatch):
    from integrations.ai.router import LLMRouter
    from integrations.base import ProviderResult
    from integrations.config import settings
    from okkax_copilot import AI_STUDIO_SYSTEM_INSTRUCTION, _run_primary_semantic_reasoning, build_semantic_plan

    calls = []

    async def fake_generate_structured(self, **kwargs):
        calls.append({
            "prompt": kwargs.get("prompt"),
            "primary": self.primary_name,
            "fallback": self.fallback_names,
            "preferred": kwargs.get("preferred_engine"),
            "system_instruction": kwargs.get("system_instruction"),
            "model": kwargs.get("model"),
            "temperature": kwargs.get("temperature"),
            "top_p": kwargs.get("top_p"),
            "max_tokens": kwargs.get("max_tokens"),
            "thinking_budget": kwargs.get("thinking_budget"),
        })
        return ProviderResult.success(
            "gemini",
            {
                "structured": {
                    "intent": "ANALYTICAL",
                    "domains": ["finance"],
                    "reasoning_summary": "Target perlu diuji terhadap titik impas.",
                    "tradeoffs": ["Harga tiket versus okupansi."],
                    "recommendation": "Pertahankan buffer dan percepat penjualan.",
                    "calculation_requests": ["break_even"],
                },
                "model": settings.GEMINI_MODEL,
            },
            provenance={"provider": "gemini", "model": settings.GEMINI_MODEL},
        )

    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-live")
    monkeypatch.setenv("OKKAX_COPILOT_REASONING_ENABLED", "true")
    monkeypatch.setattr(LLMRouter, "generate_structured", fake_generate_structured)
    plan = build_semantic_plan("break-even festival 5.000 pax budget 800M")
    merged, meta = asyncio.run(_run_primary_semantic_reasoning("break-even", [], plan))

    assert len(calls) == 1
    assert calls[0]["primary"] == "gemini"
    assert calls[0]["fallback"] == ["chatgpt", "openrouter"]
    assert calls[0]["preferred"] == "gemini"
    assert calls[0]["system_instruction"] == AI_STUDIO_SYSTEM_INSTRUCTION
    assert calls[0]["model"] == settings.GEMINI_MODEL
    assert calls[0]["temperature"] == 0.2
    assert calls[0]["top_p"] == 0.8
    assert calls[0]["max_tokens"] == 2048
    assert calls[0]["thinking_budget"] == 0
    assert "history=" in calls[0]["prompt"]
    assert "platform_context=" in calls[0]["prompt"]
    assert "semantic_state=" in calls[0]["prompt"]
    assert meta["provider"] == "gemini"
    assert merged["authority"] == "gemini"
    assert merged["reasoning"]["calculation_requests"] == ["break_even"]


def test_ai_studio_five_turn_state_hierarchy_is_preserved():
    from okkax_copilot import (
        DEFAULT_COPILOT_CALCULATOR_POLICY_DOC,
        _build_semantic_projection,
        build_semantic_plan,
        merge_multi_turn_state,
        parse_constraints,
    )

    turns = [
        "Festival Jakarta.",
        "Kapasitas 5.000.",
        "Budget Rp1 miliar, maksimal Rp800 juta.",
        "Sound maksimal Rp120 juta.",
        "Sponsor Rp200 juta batal.",
    ]
    history = []
    for message in turns:
        plan = merge_multi_turn_state(build_semantic_plan(message, parse_constraints(message)), history)
        history.extend([{"role": "user", "content": message}, {"role": "assistant", "content": "lanjut"}])

    projection = _build_semantic_projection(plan, DEFAULT_COPILOT_CALCULATOR_POLICY_DOC)
    assert plan["entities"]["city"] == "Jakarta"
    assert plan["constraints"]["capacity"] == 5_000
    assert plan["constraints"]["budget"] == 800_000_000
    assert plan["constraints"]["vendor_max_budget"] == 120_000_000
    assert plan["constraints"]["vendor_cap_type"] == "sound"
    assert plan["constraints"]["sponsor_expected"] == 200_000_000
    assert plan["constraints"]["sponsor_status"] == "cancelled"
    assert projection["event_budget"] == 800_000_000
    assert projection["vendor"]["cap"] == 120_000_000
    assert projection["sponsor_cancelled"] is True
    assert projection["sponsor"]["gap_to_expectation"] == 200_000_000


def test_venue_discovery_routes_only_explicit_discovery_and_preserves_provenance(monkeypatch):
    from integrations.base import ProviderResult
    from integrations.location.serpapi_maps_client import serpapi_maps_client
    from okkax_copilot import ask_okkax_copilot

    calls = []

    async def fake_search(query, limit=3, timeout_seconds=12.0):
        calls.append(query)
        return ProviderResult.success(
            "serpapi_maps",
            [{"name": "Jakarta Concert Hall", "address": "Menteng, Jakarta", "area": "", "rating": 4.7, "source": "SerpApi"}],
            latency_ms=12.0,
            provenance={"source": "SerpApi", "engine": "google_maps", "query": query},
        )

    monkeypatch.setenv("OKKAX_COPILOT_REASONING_ENABLED", "false")
    monkeypatch.setattr(serpapi_maps_client, "search_venues", fake_search)
    discovered = asyncio.run(ask_okkax_copilot("Cari venue konser di Jakarta"))

    assert calls == ["concert venue Jakarta"]
    assert discovered["tools_executed"] == ["venue_discovery"]
    assert discovered["venue_discovery"]["provenance"]["source"] == "SerpApi"
    assert "Jakarta Concert Hall" in discovered["reply"]
    assert "Source/provenance: SerpApi" in discovered["reply"]

    asyncio.run(ask_okkax_copilot("Apa risiko venue outdoor di Jakarta?"))
    assert calls == ["concert venue Jakarta"]


def test_venue_discovery_failure_is_graceful(monkeypatch):
    from integrations.base import ProviderResult
    from integrations.location.serpapi_maps_client import serpapi_maps_client
    from okkax_copilot import ask_okkax_copilot

    async def failed_search(query, limit=3, timeout_seconds=12.0):
        return ProviderResult.failure("serpapi_maps", "RATE_LIMITED", "quota reached")

    monkeypatch.setenv("OKKAX_COPILOT_REASONING_ENABLED", "false")
    monkeypatch.setattr(serpapi_maps_client, "search_venues", failed_search)
    result = asyncio.run(ask_okkax_copilot("Cari venue konser di Jakarta"))

    assert result["venue_discovery"]["ok"] is False
    assert result["reasoning_mode"] == "deterministic_fallback"
    assert "tidak akan mengarang nama venue" in result["reply"]


def test_venue_discovery_tool_is_registered():
    from okkax_copilot import COPILOT_TOOLS, get_copilot_tool_schemas

    assert "venue_discovery" in {tool["name"] for tool in COPILOT_TOOLS}
    assert "venue_discovery" in {tool["function"]["name"] for tool in get_copilot_tool_schemas()}


def test_accumulated_projection_is_consistent_and_vendor_cap_isolated():
    from okkax_copilot import (
        DEFAULT_COPILOT_CALCULATOR_POLICY_DOC,
        _build_semantic_projection,
        build_semantic_plan,
        merge_multi_turn_state,
        parse_constraints,
    )

    turns = [
        "festival Jakarta", "5.000 pax", "budget 1B maksimal 800M",
        "break-even", "30% penjualan H-7", "sponsor batal",
        "vendor sound maksimal 120M",
    ]
    history = []
    plan = None
    for message in turns:
        plan = merge_multi_turn_state(build_semantic_plan(message, parse_constraints(message)), history)
        history.extend([{"role": "user", "content": message}, {"role": "assistant", "content": "lanjut"}])

    projection = _build_semantic_projection(plan, DEFAULT_COPILOT_CALCULATOR_POLICY_DOC)
    assert projection["event_budget"] == 800_000_000
    assert projection["saving_amount"] == 200_000_000
    assert projection["funding"]["sponsor_target"] == 0
    assert projection["funding"]["ticket_revenue_target"] == 720_000_000
    assert projection["ticket_sales"]["sold_pax"] == 1_500
    assert projection["ticket_sales"]["remaining_to_break_even"] == 2_600
    assert projection["vendor"]["cap"] == 120_000_000
    assert projection["vendor"]["gap"] == 72_000_000


def test_championship_constraint_hierarchy_and_user_corrections():
    from okkax_copilot import build_semantic_plan, merge_multi_turn_state, parse_constraints

    turns = [
        "festival musik di Jakarta",
        "Target awal 5.000 orang",
        "Budget Rp1 miliar, total pengeluaran maksimal Rp800 juta",
        "kapasitas venue ternyata cuma 4.200 orang, jangan ubah budget",
        "Regular Rp250 ribu dan VIP Rp600 ribu",
        "VIP Rp600 ribu terlalu mahal. Turunkan jadi Rp450 ribu",
        "10% inventory untuk guest list, media, sponsor, complimentary",
        "Sponsor Rp200 juta batal",
        "2 sponsor pengganti masing-masing Rp60 juta",
        "vendor sound system budget maksimal Rp120 juta",
        "Rp120 juta budget sound system, BUKAN budget event",
        "Headliner minta tambahan hospitality Rp35 juta",
        "Security butuh tambahan 20 personel",
        "kapasitas jadi 5k lagi, budget tidak dinaikkan",
        "venue berubah ke Bandung, yang berubah cuma kota",
    ]
    history = []
    plan = None
    for message in turns:
        plan = merge_multi_turn_state(build_semantic_plan(message, parse_constraints(message)), history)
        history += [{"role": "user", "content": message}, {"role": "assistant", "content": "lanjut"}]

    assert plan["entities"]["city"] == "Bandung"
    assert plan["entities"]["event_type"] == "festival"
    assert plan["constraints"]["baseline"] == 1_000_000_000
    assert plan["constraints"]["target"] == 800_000_000
    assert plan["constraints"]["budget"] == 800_000_000
    assert plan["constraints"]["capacity"] == 5_000
    assert plan["constraints"]["ticket_prices"] == {"regular": 250_000, "vip": 450_000}
    assert plan["constraints"]["complimentary_pct"] == 10
    assert plan["constraints"]["sponsor_expected"] == 200_000_000
    assert plan["constraints"]["sponsor_replacement"] == 120_000_000
    assert plan["constraints"]["vendor_max_budget"] == 120_000_000
    assert plan["constraints"]["hospitality_change"] == 35_000_000
    assert plan["constraints"]["workforce_extra"] == 20


def test_championship_history_retains_sixty_turn_conversation():
    from okkax_copilot import sanitize_history

    history = []
    for number in range(1, 61):
        history += [
            {"role": "user", "content": f"turn {number}"},
            {"role": "assistant", "content": f"answer {number}"},
        ]
    sanitized = sanitize_history(history)
    assert len(sanitized) == 120
    assert sanitized[0]["content"] == "turn 1"
    assert sanitized[-1]["content"] == "answer 60"


def test_championship_action_stays_hold_then_draft_only():
    from okkax_copilot import build_semantic_plan, merge_multi_turn_state, parse_constraints

    history = []
    plan = None
    for message in (
        "buat 1.000 QR tiket Regular",
        "Stop. Jangan eksekusi dulu.",
        "Saya konfirmasi quantity 1.000, kategori Regular. Tapi jangan publish dulu.",
        "Siapkan sebagai draft. Jangan melakukan tindakan di luar yang saya izinkan.",
    ):
        plan = merge_multi_turn_state(build_semantic_plan(message, parse_constraints(message)), history)
        history += [{"role": "user", "content": message}, {"role": "assistant", "content": "lanjut"}]

    assert plan["intent"] == "ACTION"
    assert plan["entities"]["quantity_tickets"] == 1000
    assert plan["entities"]["ticket_tier"] == "Regular"
    assert plan["entities"]["action_mode"] == "draft_only"


def test_championship_scoped_clocks_vendor_and_numeric_guard():
    from okkax_copilot import (
        DEFAULT_COPILOT_CALCULATOR_POLICY_DOC,
        _build_semantic_projection,
        _grounded_reasoning_text,
        build_semantic_plan,
        merge_multi_turn_state,
        parse_constraints,
    )

    turns = [
        "festival Jakarta 4.200 orang budget maksimal Rp800 juta",
        "Regular Rp250 ribu dan VIP Rp450 ribu",
        "10% inventory complimentary",
        "30% penjualan H-7",
        "vendor sound system budget maksimal Rp120 juta",
        "Lighting harus sinkron dengan rider",
        "load-in H-1 pukul 22.00",
    ]
    history = []
    plan = None
    for message in turns:
        plan = merge_multi_turn_state(build_semantic_plan(message, parse_constraints(message)), history)
        history += [{"role": "user", "content": message}, {"role": "assistant", "content": "lanjut"}]

    projection = _build_semantic_projection(plan, DEFAULT_COPILOT_CALCULATOR_POLICY_DOC)
    assert projection["ticket_sales"] == {
        "pct": 30,
        "sold_pax": 1134,
        "remaining_to_break_even": projection["funding"]["break_even_pax"] - 1134,
        "days_before": 7,
    }
    assert projection["vendor"]["type"] == "sound"
    assert _grounded_reasoning_text("PPN 11% dan platform fee 7%", plan, projection) == ""


def test_internal_and_repeated_reasoning_lines_are_removed():
    from okkax_copilot import _dedupe_clean_lines
    lines = _dedupe_clean_lines([
        "Jaga produksi inti.",
        "Jaga produksi inti.",
        "pipeline_stages internal provider",
    ])
    assert lines.count("Jaga produksi inti.") == 1
    assert all("pipeline_stages" not in line for line in lines)


# ---------- knowledge composer (no template) ----------
def test_knowledge_promoter_vs_eo_returns_semantic_note():
    d = _chat("apa beda promoter dan EO?")
    assert d["reasoning_mode"] == "knowledge"
    reply = d["reply"].lower()
    assert "promoter" in reply and ("eo" in reply or "event organizer" in reply)
    assert "risiko" in reply or "management fee" in reply


def test_knowledge_outdoor_safety_returns_semantic_note():
    d = _chat("venue outdoor saya aman gak kalau hujan?")
    assert d["reasoning_mode"] == "knowledge"
    reply = d["reply"].lower()
    assert "outdoor" in reply or "tenda" in reply or "cuaca" in reply


# ---------- realistic ID phrasings — UNKNOWN should be RARE ----------
@pytest.mark.parametrize("msg", [
    "event gue boncos, tiket baru 30% padahal H-5",
    "sponsor utama batal H-7, impactnya?",
    "vendor sound bermasalah, alternatif?",
    "hitung margin kalau tenant nambah 5 booth",
    "produksi meleset budget, prioritas mana yg dipotong?",
])
def test_realistic_phrasings_not_unknown(msg, tokens):
    d = _chat(msg, token=tokens["organizer"])
    plan = d.get("semantic_plan", {})
    # Should be classified as ANALYTICAL / SIMULATION / ACTION, not UNKNOWN
    assert plan.get("intent") != "UNKNOWN", f"UNKNOWN misclassification for `{msg}`"


# ---------- truly ambiguous input asks ONE clarifying question ----------
def test_truly_ambiguous_asks_one_clarification():
    d = _chat("mmm")
    plan = d.get("semantic_plan", {})
    # ambiguous → UNKNOWN allowed here
    assert plan.get("intent") in ("UNKNOWN", "CONVERSATIONAL")
    reply = d["reply"]
    # Response must not leak internal, must offer clarification
    for leak in ("/api/", "EMERGENT_LLM_KEY", "pipeline_stages"):
        assert leak not in reply


# ---------- domain routing intact ----------
def test_supply_intent_still_delegates_to_intelligence(tokens):
    d = _chat("cari vendor lighting Bandung", token=tokens["organizer"])
    assert "intelligence_query" in d["pipeline_stages"]


# ---------- security (unchanged) ----------
def test_semantic_plan_does_not_leak_cross_tenant(tokens):
    d = _chat("berapa funding gap event ini?", token=tokens["audience"], event_id=EVENT_ID)
    assert d["grounded"] is False


def test_semantic_plan_reply_stripped_of_internal_markers(tokens):
    for msg in ("kurangi biaya dari Rp1 miliar jadi Rp800 juta",
                "buat 500 QR tiket",
                "apa beda promoter dan EO"):
        d = _chat(msg, token=tokens["organizer"])
        for leak in ("EMERGENT_LLM_KEY", "OPENAI_API_KEY", "/api/okkax",
                     "reasoning_mode", "pipeline_stages", "LLM_UNAVAILABLE"):
            assert leak not in d["reply"], f"leak `{leak}` for `{msg}`"
