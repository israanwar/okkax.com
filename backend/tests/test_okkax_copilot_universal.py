"""OKKAX Copilot v4 — universal intent router + behavioral cross-domain QA.

Locks in the anti-template architecture: intent classifier decides route
(CONVERSATIONAL/KNOWLEDGE/ANALYTICAL/SIMULATION/ACTION/UNKNOWN), constraint
parser extracts money/pax/qty/city/type/date/action from natural prompts,
and reply composition never uses per-domain canned strings.
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


def _chat(msg, token=None, event_id=None):
    payload = {"message": msg}
    if event_id:
        payload["event_id"] = event_id
    headers = _h(token) if token else {"Content-Type": "application/json"}
    r = requests.post(f"{API}/okkax/chat", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- pure classifier/parser ----------
def test_classifier_covers_all_intents():
    from okkax_copilot import classify_intent, INTENT_CONVERSATIONAL, INTENT_ACTION, INTENT_SIMULATION, INTENT_ANALYTICAL, INTENT_KNOWLEDGE
    assert classify_intent("halo") == INTENT_CONVERSATIONAL
    assert classify_intent("generate 1000 QR tickets") == INTENT_ACTION
    assert classify_intent("kurangi biaya dari Rp1 miliar jadi Rp800 juta") == INTENT_SIMULATION
    assert classify_intent("hitung break-even konser 5000 pax Rp1,5 miliar") == INTENT_ANALYTICAL
    assert classify_intent("apa itu Event Graph OKKAX?") == INTENT_KNOWLEDGE


def test_parser_extracts_qty_city_type_date_cancel():
    from okkax_copilot import parse_constraints
    p = parse_constraints("sponsor batal H-7, festival di Jakarta")
    assert p["cancellation_intent"] is True
    assert p["days_before"] == 7
    assert p["city"] == "Jakarta"
    assert p["event_type"] == "festival"


def test_parser_reads_ticket_quantity():
    from okkax_copilot import parse_constraints
    p = parse_constraints("generate 1000 QR tickets")
    assert p["quantity_tickets"] == 1000
    assert any("generate" in v for v in p["action_verbs"])


# ---------- BEHAVIORAL — anti-template + intent routing ----------
@pytest.mark.parametrize("msg,expected_mode", [
    ("bro", "conversational"),
    ("halo, ada yang bisa dibantu?", "conversational"),
    ("makasih", "conversational"),
    ("bye", "conversational"),
])
def test_conversational_intents_route_correctly(msg, expected_mode):
    d = _chat(msg)
    assert d["reasoning_mode"] == expected_mode
    for leak in ("[UNKNOWN]", "[LLM_UNAVAILABLE]", "/api/", "pipeline_stages"):
        assert leak not in d["reply"]


def test_action_intent_generate_1000_qr_gates_with_confirmation():
    d = _chat("generate 1000 QR tickets untuk event saya")
    assert d.get("reasoning_mode") == "action_gate"
    # Copilot may ask for missing field OR issue confirmation gate; both are valid.
    assert ("Konfirmasi diperlukan" in d["reply"]) or ("mohon jelaskan" in d["reply"].lower())
    assert d.get("parsed_constraints", {}).get("quantity_tickets") == 1000


def test_action_refund_or_cancel_gates_with_confirmation():
    d = _chat("batalkan tiket order OKX-ORD-000023 dan refund pembelinya")
    assert d["reasoning_mode"] == "action_gate"
    assert ("Konfirmasi diperlukan" in d["reply"]) or ("mohon jelaskan" in d["reply"].lower())


# ---------- exact regression prompts ----------
def test_regression_festival_5000pax_budget_breakeven():
    d = _chat("festival 5000 pax break-even Rp1,5 miliar")
    reply = d["reply"]
    assert "5,000" in reply or "5000" in reply
    assert "Rp1,500,000,000" in reply
    # analytical pipeline stage
    assert "compute_budget_projection" in d["pipeline_stages"] or "intelligence_query" in d["pipeline_stages"]


def test_regression_rp1b_to_rp800m_saving():
    d = _chat("Rp1 miliar jadi Rp800 juta, tolong bantu")
    assert "Rp1,000,000,000" in d["reply"]
    assert "Rp800,000,000" in d["reply"]
    assert "[SIMULATION]" in d["reply"]


def test_regression_generate_1000_qr_tickets_is_action():
    d = _chat("generate 1000 QR tickets")
    assert d["reasoning_mode"] == "action_gate"
    assert d.get("parsed_constraints", {}).get("quantity_tickets") == 1000


def test_regression_sponsor_cancels_h_minus_7(tokens):
    d = _chat("sponsor utama batal H-7, apa dampaknya?", token=tokens["organizer"], event_id=EVENT_ID)
    # Must be SIMULATION or analytical routed with cancellation context
    assert d["reasoning_mode"] in ("deterministic_fallback", "action_gate", "llm")
    parsed = d.get("parsed_constraints", {}) if d.get("reasoning_mode") == "action_gate" else {}
    reply = d["reply"]
    assert "sponsor" in reply.lower() or "funding" in reply.lower() or "H-7" in reply or "gap" in reply.lower() or d.get("grounded") is True


def test_regression_blocker_event_grounded(tokens):
    d = _chat("apa blocker event saya sekarang?", token=tokens["organizer"], event_id=EVENT_ID)
    assert d["grounded"] is True
    assert "gather_event_ground_truth" in d["pipeline_stages"]


# ---------- domain-coverage behavioral (pipeline invocation checks) ----------
@pytest.mark.parametrize("msg,require_stage", [
    ("hitung break-even 3000 pax Rp900 juta", "compute_budget_projection"),
    ("cari talent DJ Bali", "intelligence_query"),
    ("cari vendor sound Jakarta", "intelligence_query"),
    ("cari venue outdoor 5000 pax", "intelligence_query"),
    ("dampak ekonomi Bandung", "intelligence_query"),
    ("harga pasar tenant F&B", "intelligence_query"),
])
def test_domain_prompts_invoke_correct_pipeline_stage(tokens, msg, require_stage):
    d = _chat(msg, token=tokens["organizer"])
    assert require_stage in d["pipeline_stages"], f"missing stage {require_stage} for '{msg}'"


# ---------- Missing data → SIMULATION/UNKNOWN, no invention ----------
def test_missing_data_no_invention():
    d = _chat("aku mau bikin event, tolong bantu")
    reply = d["reply"]
    # must NOT invent 3000/5000 pax or Rp750M
    assert "3,000" not in reply
    assert "Rp750,000,000" not in reply
    # Should ask for context, not template
    assert "[UNKNOWN]" in reply or "[RECOMMENDATION]" in reply or "klarifikasi" in reply.lower() or "sebutkan" in reply.lower()


# ---------- Security (unchanged invariants) ----------
def test_security_tenant_isolation_preserved(tokens):
    d = _chat("apa funding gap event ini?", token=tokens["audience"], event_id=EVENT_ID)
    assert d["grounded"] is False


def test_no_internal_leak_across_intents():
    for msg in ("hitung budget 5000 pax Rp1 miliar", "generate 1000 QR tickets",
                "apa itu Event Graph OKKAX", "halo bro", "aku mau bikin event"):
        d = _chat(msg)
        for leak in ("EMERGENT_LLM_KEY", "OPENAI_API_KEY", "/api/okkax", "pipeline_stages",
                     "reasoning_mode", "LLM_UNAVAILABLE"):
            assert leak not in d["reply"], f"leak `{leak}` for `{msg}`"
