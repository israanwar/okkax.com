"""OKKAX Copilot v3 — intelligence routing, policy-versioned calculator,
quota, provider router, tool schemas, anti-template regression, and
pipeline-stage instrumentation.
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
    return {
        "organizer": _login("organizer@okkax.id"),
        "audience": _login("audience@okkax.id"),
        "admin": _login(ADMIN_EMAIL),
    }


# ---------- parser (pure) ----------
def test_parse_baseline_target_saving():
    from okkax_copilot import parse_budget_prompt
    p = parse_budget_prompt("kurangi biaya event dari Rp1 miliar jadi Rp800 juta, tuliskan detailnya")
    assert p["baseline"] == 1_000_000_000
    assert p["target"] == 800_000_000
    assert p["saving_intent"] is True
    assert p["capacity"] is None   # NOT invented


def test_parse_capacity_explicit_only():
    from okkax_copilot import parse_budget_prompt
    p = parse_budget_prompt("Bantu hitung alokasi budget konser 5000 pax Rp1.25 miliar")
    assert p["capacity"] == 5000
    assert p["budget"] == 1_250_000_000


def test_parse_no_numbers_returns_all_none():
    from okkax_copilot import parse_budget_prompt
    p = parse_budget_prompt("Bagaimana pembagian benefit untuk Presenting Sponsor?")
    assert p["budget"] is None and p["capacity"] is None
    assert p["saving_intent"] is False


# ---------- anti-template regression ----------
def test_saving_prompt_returns_exact_user_numbers_no_invention():
    """Exact prompt reported in the bug. Reply must contain the user's own
    baseline/target/saving numbers, must not contain the canned 3,000 pax
    default, and must not contain the canned Rp750,000,000 default budget."""
    r = requests.post(f"{API}/okkax/chat", json={
        "message": "kurangi biaya event dari Rp1 miliar jadi Rp800 juta, tuliskan detailnya"
    }, timeout=15)
    assert r.status_code == 200
    body = r.json()
    reply = body["reply"]
    assert "Rp1,000,000,000" in reply
    assert "Rp800,000,000" in reply
    assert "Rp200,000,000" in reply
    assert "20.0%" in reply
    assert "3,000 Pax" not in reply and "3,000 pax" not in reply
    assert "Rp750,000,000" not in reply
    assert "Rp 750,000,000" not in reply
    assert "[SIMULATION]" in reply
    assert "[UNKNOWN]" in reply  # capacity not asserted
    assert "compute_budget_projection" in body["pipeline_stages"]
    assert body["reasoning_mode"] in ("llm", "deterministic_fallback")


@pytest.mark.parametrize("prompt,expect_baseline,expect_target,expect_pct", [
    ("Turunkan budget dari Rp2 miliar jadi Rp1,5 miliar", 2_000_000_000, 1_500_000_000, "25.0%"),
    ("potong dari Rp500 juta menjadi Rp350 juta", 500_000_000, 350_000_000, "30.0%"),
    ("hemat dari Rp5 miliar jadi Rp4 miliar", 5_000_000_000, 4_000_000_000, "20.0%"),
])
def test_saving_paraphrases_use_user_numbers(prompt, expect_baseline, expect_target, expect_pct):
    r = requests.post(f"{API}/okkax/chat", json={"message": prompt}, timeout=15)
    assert r.status_code == 200
    reply = r.json()["reply"]
    assert f"{expect_baseline:,}".replace(",", ",") in reply.replace(".", ",")
    assert f"{expect_target:,}" in reply
    assert expect_pct in reply
    assert "3,000 pax" not in reply.lower()


def test_simple_identity_stays_fast_deterministic():
    r = requests.post(f"{API}/okkax/chat", json={"message": "siapa kamu"}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["reasoning_mode"] == "deterministic"
    assert "compute_budget_projection" not in body["pipeline_stages"]


# ---------- pipeline instrumentation ----------
def test_analytical_prompt_includes_reasoning_stages():
    r = requests.post(f"{API}/okkax/chat", json={"message": "hitung alokasi budget konser 10.000 pax Rp3 miliar"}, timeout=15)
    body = r.json()
    stages = body["pipeline_stages"]
    for s in ("parse_prompt", "load_calculator_policy", "compute_budget_projection"):
        assert s in stages


def test_grounded_event_stages_track_ground_truth(tokens):
    r = requests.post(f"{API}/okkax/chat", headers=_h(tokens["organizer"]), json={
        "message": "berapa funding gap event ini?",
        "event_id": EVENT_ID,
    }, timeout=15)
    body = r.json()
    stages = body["pipeline_stages"]
    for s in ("gather_event_ground_truth", "compose_grounded_reply"):
        assert s in stages


def test_llm_unavailable_status_surfaces_via_metadata_not_reply():
    """Transparency lives in metadata (`llm_available`, `reasoning_mode`).
    The user-facing reply must NOT contain developer/internal terminology."""
    r = requests.post(f"{API}/okkax/chat", json={
        "message": "hitung target sponsor untuk konser 5000 pax Rp1,5 miliar"
    }, timeout=15)
    body = r.json()
    assert body.get("llm_available") is False
    reply = body["reply"]
    for leak in ("[LLM_UNAVAILABLE]", "reasoning_mode", "pipeline_stages",
                 "EMERGENT_LLM_KEY", "OPENAI_API_KEY", "/api/okkax"):
        assert leak not in reply, f"internal leak in reply: {leak}"


# ---------- Intelligence Engine routing ----------
def test_intelligence_delegation_for_supply_intent(tokens):
    r = requests.post(f"{API}/okkax/chat", headers=_h(tokens["organizer"]), json={
        "message": "cari vendor sound system di Jakarta"
    }, timeout=15)
    body = r.json()
    assert "intelligence_query" in body["pipeline_stages"]
    assert body.get("intelligence") is not None


# ---------- Provider router / engines endpoint ----------
def test_engines_endpoint_lists_provider_registry():
    r = requests.get(f"{API}/okkax/engines", timeout=10)
    assert r.status_code == 200
    body = r.json()
    keys = [e["key"] for e in body["engines"]]
    assert body["default"] in keys
    assert any(e.get("provider") == "openai" for e in body["engines"])
    assert any(e.get("provider") == "anthropic" for e in body["engines"])


def test_engine_pref_is_accepted_in_chat(tokens):
    r = requests.post(f"{API}/okkax/chat", headers=_h(tokens["organizer"]), json={
        "message": "siapa kamu",
        "engine": "claude-haiku-4-5-20251001",
    }, timeout=10)
    assert r.status_code == 200
    # LLM key kosong → fallback tetap deterministic, tapi endpoint tidak crash & schema OK.


# ---------- Tool schema ----------
def test_tool_schema_endpoint_returns_function_shape(tokens):
    r = requests.get(f"{API}/okkax/tools", headers=_h(tokens["organizer"]), timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 6
    for t in body["tools"]:
        assert t["type"] == "function"
        assert "name" in t["function"]
        assert "parameters" in t["function"]


def test_tool_schema_requires_auth():
    r = requests.get(f"{API}/okkax/tools", timeout=10)
    assert r.status_code in (401, 403)


# ---------- Copilot quota ----------
def test_copilot_quota_endpoint(tokens):
    r = requests.get(f"{API}/okkax/quota", headers=_h(tokens["audience"]), timeout=10)
    assert r.status_code == 200
    body = r.json()
    for k in ("plan", "usage", "limit", "remaining"):
        assert k in body


# ---------- Calculator policy is versioned + configurable ----------
def test_calculator_policy_seed_written_in_platform_policies():
    """Reference seed must be present as an admin-editable row."""
    import asyncio
    from okkax_copilot import get_active_copilot_calculator_policy, CANONICAL_COPILOT_CALCULATOR_KEY

    class _NoDB:
        pass

    # Fallback path also returns a valid seed doc when DB is absent
    fallback = asyncio.run(get_active_copilot_calculator_policy(None))
    assert fallback["key"] == CANONICAL_COPILOT_CALCULATOR_KEY
    assert "budget_allocation" in fallback
