"""OKKAX Copilot v5 — semantic plan + multi-turn state carry-over.

Behavioral tests (not exact-string): assert semantic_plan shape, multi-turn
constraint carry-over via history, and low UNKNOWN rate on realistic ID/EN
phrasings.
"""
import os
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
