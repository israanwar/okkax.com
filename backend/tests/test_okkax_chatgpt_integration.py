"""Backend regression tests for ChatGPT (Emergent LLM) integration in Okkax Copilot.

Covers: engine selection, reasoning_mode=fast bypass, deterministic-number
guardrail, no internal-key leakage, health, and Event Compiler non-regression.
"""
import os
import re
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://economy-network.preview.emergentagent.com").rstrip("/")
CHAT_URL = f"{BASE_URL}/api/okkax/chat"
TIMEOUT = 60


def _post_chat(**kwargs):
    """POST to /api/okkax/chat with sane defaults and long timeout for ChatGPT latency."""
    body = {"message": "", "history": []}
    body.update(kwargs)
    return requests.post(CHAT_URL, json=body, timeout=TIMEOUT)


# --- Health ---
def test_health_ok():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200


# --- Core: default engine gpt-5.4 on analytical prompt ---
def test_analytical_prompt_returns_chatgpt_default_model():
    r = _post_chat(message="Hitung target sponsor untuk konser 5000 pax dengan budget Rp1,5 miliar.")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("llm_available") is True, f"llm_available not true: {data.get('llm_available')}"
    rp = data.get("reasoning_provider") or {}
    assert rp.get("provider") == "chatgpt", f"provider={rp.get('provider')} full={rp}"
    assert rp.get("model") == "gpt-5.4", f"model={rp.get('model')}"
    assert data.get("engine_key") == "gpt-5.4", f"engine_key={data.get('engine_key')}"
    assert data.get("reasoning_mode") == "semantic_reasoning", f"reasoning_mode={data.get('reasoning_mode')}"


@pytest.mark.parametrize("engine,expected", [
    ("gpt-5.4-mini", "gpt-5.4-mini"),
    ("gpt-5.5", "gpt-5.5"),
    ("foo", "gpt-5.4"),  # unknown -> default
])
def test_engine_selection(engine, expected):
    r = _post_chat(
        message="Hitung target sponsor untuk konser 5000 pax dengan budget Rp1,5 miliar.",
        engine=engine,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    rp = data.get("reasoning_provider") or {}
    assert rp.get("provider") == "chatgpt"
    assert rp.get("model") == expected, f"engine={engine} => model={rp.get('model')}, want {expected}"


# --- reasoning_mode=fast must bypass LLM ---
def test_reasoning_mode_fast_skips_llm():
    r = _post_chat(
        message="Hitung target sponsor untuk konser 5000 pax dengan budget Rp1,5 miliar.",
        reasoning_mode="fast",
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # In fast mode, no LLM call is made => no reasoning_provider from ChatGPT.
    rp = data.get("reasoning_provider")
    if rp:
        assert rp.get("provider") != "chatgpt", f"fast mode called chatgpt: {rp}"


def test_reasoning_mode_smarter_ok():
    r = _post_chat(
        message="Hitung target sponsor untuk konser 5000 pax dengan budget Rp1,5 miliar.",
        reasoning_mode="smarter",
    )
    assert r.status_code == 200


# --- Deterministic numbers preserved; SIMULATION/UNKNOWN labels present ---
def test_deterministic_numbers_and_labels():
    r = _post_chat(
        message="Kurangi biaya event dari Rp1 miliar jadi Rp800 juta, tuliskan detailnya.",
    )
    assert r.status_code == 200, r.text
    reply = (r.json().get("reply") or "")
    for needed in ("Rp1,000,000,000", "Rp800,000,000", "Rp200,000,000", "20.0%",
                   "[SIMULATION]", "[UNKNOWN]"):
        assert needed in reply, f"missing '{needed}' in reply\n---\n{reply}"
    # LLM must NOT introduce fabricated numbers
    forbidden_numbers = ["3,000 pax", "3000 pax", "Rp750,000,000"]
    for bad in forbidden_numbers:
        assert bad not in reply, f"reply contains fabricated '{bad}'\n---\n{reply}"


# --- No internal key/plumbing leakage in reply text ---
def test_no_internal_leakage():
    r = _post_chat(message="Hitung target sponsor untuk konser 5000 pax dengan budget Rp1,5 miliar.")
    assert r.status_code == 200
    reply = (r.json().get("reply") or "")
    for banned in ("EMERGENT_LLM_KEY", "OPENAI_API_KEY", "pipeline_stages",
                   "reasoning_mode", "/api/okkax"):
        assert banned not in reply, f"reply leaks '{banned}'\n---\n{reply}"


# --- Other copilot paths ---
def test_small_talk_ok():
    r = _post_chat(message="Halo Okkax, apa kabar?")
    assert r.status_code == 200


def test_knowledge_ok():
    r = _post_chat(message="Apa beda promoter dan EO?")
    assert r.status_code == 200
    assert (r.json().get("reply") or "").strip() != ""


def test_action_ok():
    r = _post_chat(message="Buatkan 50 tiket VIP")
    assert r.status_code == 200


# --- Grounded event path with organizer login ---
def _login_organizer(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "organizer@okkax.id", "password": "Okkax#2026"},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"organizer login not available: {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        session.headers["Authorization"] = f"Bearer {tok}"
    return session


def test_grounded_event_ok():
    s = requests.Session()
    _login_organizer(s)
    ev = s.get(f"{BASE_URL}/api/events", timeout=20)
    assert ev.status_code == 200, ev.text
    events = ev.json() if isinstance(ev.json(), list) else ev.json().get("items") or []
    if not events:
        pytest.skip("no events available for organizer")
    event_id = events[0].get("id") or events[0].get("_id")
    r = s.post(
        CHAT_URL,
        json={"message": "Ringkas status event ini.", "event_id": event_id},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text


# --- Event Compiler non-regression ---
def test_ai_engines_endpoint_ok():
    r = requests.get(f"{BASE_URL}/api/ai/engines", timeout=15)
    assert r.status_code == 200, r.text


def test_event_compile_still_works():
    s = requests.Session()
    _login_organizer(s)
    ev = s.get(f"{BASE_URL}/api/events", timeout=20)
    assert ev.status_code == 200
    events = ev.json() if isinstance(ev.json(), list) else ev.json().get("items") or []
    if not events:
        pytest.skip("no events available")
    event_id = events[0].get("id") or events[0].get("_id")
    r = s.post(f"{BASE_URL}/api/events/{event_id}/compile", timeout=90)
    # Some deployments may return 200 or 202
    assert r.status_code in (200, 202), f"{r.status_code} {r.text[:400]}"


# --- Multi-city regression (light-weight; deep coverage in test_okkax_multicity_bug.py) ---
def test_multicity_first_turn_retains_five_cities():
    r = _post_chat(
        message=("Bantu cari dan membandingkan kebutuhan venue konser di "
                 "Jakarta, Bandung, Surabaya, Yogyakarta, dan Bali untuk tour 5.000 pax per kota."),
    )
    assert r.status_code == 200
    data = r.json()
    reply = (data.get("reply") or "")
    for city in ("Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Bali"):
        assert city in reply, f"missing city {city} in multi-city reply"
