"""OKKAX Copilot — Golden QA cross-intent regression.

Proves Copilot answers stay contextual, non-repetitive, non-invented, and
that analytical requests actually traverse the reasoning pipeline stages.
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


# 1. Budget optimasi (SIMULATION dari angka user)
def test_golden_budget_optimization_uses_user_numbers():
    d = _chat("kurangi biaya event dari Rp1 miliar jadi Rp800 juta")
    assert "Rp200,000,000" in d["reply"]
    assert "[SIMULATION]" in d["reply"]
    assert "compute_budget_projection" in d["pipeline_stages"]


# 2. Sponsor — panduan grounded via policy + LLM_UNAVAILABLE untuk analitis
def test_golden_sponsor_strategy_carries_policy_labels():
    d = _chat("strategi paket sponsor untuk festival kota")
    assert "[FACT] Ratio configurable" in d["reply"]  # dari policy
    assert "sponsor" in d["reply"].lower()


# 3. Talent/vendor/venue → Intelligence Engine delegation kalau authed
def test_golden_supply_query_triggers_intelligence(tokens):
    d = _chat("cari vendor sound system Jakarta line array", token=tokens["organizer"])
    assert "intelligence_query" in d["pipeline_stages"]


# 4. Ticketing — panduan operasional dengan pointer live data
def test_golden_ticketing_gate_mentions_scanner():
    d = _chat("bagaimana SOP validasi tiket QR di gate?")
    assert any(k in d["reply"] for k in ("Scanner", "Validator", "QR"))


# 5. Compliance/readiness grounded event
def test_golden_compliance_readiness_uses_live_snapshot(tokens):
    d = _chat("apa status compliance & readiness event ini?", token=tokens["organizer"], event_id=EVENT_ID)
    assert d["grounded"] is True
    assert "gather_event_ground_truth" in d["pipeline_stages"]


# 6. Finance / break-even
def test_golden_breakeven_triggers_intelligence(tokens):
    d = _chat("hitung break-even untuk skenario 5000 pax Rp1.5 miliar", token=tokens["organizer"])
    # breakeven intent tag routes to intelligence
    assert "intelligence_query" in d["pipeline_stages"] or "compute_budget_projection" in d["pipeline_stages"]


# 7. Live operations grounded
def test_golden_live_ops_uses_snapshot(tokens):
    d = _chat("berapa insiden operasional terbuka?", token=tokens["organizer"], event_id=EVENT_ID)
    assert d["grounded"] is True


# 8. Event Graph blocker analitis event-scoped
def test_golden_graph_blocker_grounded(tokens):
    d = _chat("apa blocker kritis di event graph saya?", token=tokens["organizer"], event_id=EVENT_ID)
    assert d["grounded"] is True
    assert "gather_event_ground_truth" in d["pipeline_stages"]


# 9. Pengetahuan umum industri event (identity — cepat, tetap deterministic)
def test_golden_identity_is_fast_and_deterministic():
    d = _chat("apa itu OKKAX?")
    assert d["reasoning_mode"] == "deterministic"
    assert "OKKAX" in d["reply"]


# 10. Data tidak tersedia — Copilot tidak mengarang; UNKNOWN label
def test_golden_unknown_when_no_context():
    d = _chat("ini pertanyaan aneh yang tidak ada intent-nya")
    assert "[UNKNOWN]" in d["reply"] or "[RECOMMENDATION]" in d["reply"]
    # tidak boleh mengarang angka Rupiah / kapasitas / permit
    assert "Rp750,000,000" not in d["reply"]
    assert "3,000 Pax" not in d["reply"]


# 11. Anti-template: 5 prompt berbeda → 5 reply berbeda
def test_golden_five_prompts_produce_five_distinct_replies():
    replies = set()
    for p in [
        "kurangi biaya dari Rp2 miliar jadi Rp1 miliar",
        "cari talent DJ Bali",
        "strategi paket sponsor F&B",
        "SOP crowd control gate",
        "apa itu OKKAX?",
    ]:
        r = _chat(p)["reply"][:200]
        replies.add(r)
    assert len(replies) == 5


# 12. LLM status surfaces via metadata, NOT via reply bubble
def test_golden_llm_status_in_metadata_no_leak_in_reply():
    d = _chat("target sponsor konser 10.000 pax Rp3 miliar")
    assert d.get("llm_available") is False
    for leak in ("[LLM_UNAVAILABLE]", "reasoning_mode", "pipeline_stages", "/api/okkax"):
        assert leak not in d["reply"]


# 13. Small-talk router — natural, short, zero internal leakage
@pytest.mark.parametrize("msg,must_include", [
    ("bro", "Bro"),
    ("halo", "Halo"),
    ("hai", "Halo"),
    ("makasih", "Sama-sama"),
    ("oke", "Siap"),
    ("siap", "Siap"),
    ("bye", "Sampai jumpa"),
])
def test_golden_small_talk_natural_short_no_leak(msg, must_include):
    d = _chat(msg)
    reply = d["reply"]
    assert must_include in reply
    assert len(reply) <= 120
    for leak in ("[UNKNOWN]", "[LLM_UNAVAILABLE]", "reasoning_mode",
                 "pipeline_stages", "/api/", "event_id", "endpoint",
                 "provider", "authenticated"):
        assert leak not in reply, f"leak in small-talk reply: {leak}"
    assert d.get("intents") == ["small_talk"]
    assert d.get("reasoning_mode") == "conversational"
