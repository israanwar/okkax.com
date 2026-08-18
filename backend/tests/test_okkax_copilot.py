"""Test suite untuk OKKAX Event Copilot — endpoints, intelligence, budget, sound calculations, dan gate security."""
import os
import httpx
import pytest

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8001")
API = f"{BASE}/api"


def test_okkax_copilot_suggestions():
    """Menguji saran kontekstual cerdas dari OKKAX Copilot."""
    r = httpx.get(f"{API}/okkax/suggestions?route=/studio", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) >= 3


def test_okkax_copilot_identity_and_intro():
    """Menguji perkenalan dan identitas OKKAX Copilot."""
    payload = {
        "message": "Siapa kamu dan apa kemampuanmu di OKKAX?",
        "history": [],
        "current_route": "/",
        "role": "organizer"
    }
    r = httpx.post(f"{API}/okkax/chat", json=payload, timeout=60)
    assert r.status_code == 200
    reply = r.json()["reply"]
    assert "OKKAX" in reply
    assert "Copilot" in reply or "Intelligence" in reply


def test_okkax_copilot_mega_scale_budget_and_tech_specs():
    """Menguji komputasi skala besar (50.000 pax stadion / 5.000 pax festival)."""
    payload = {
        "message": "Bantu hitung alokasi biaya dan teknis sound system konser festival 5000 orang di Bandung budget 1.25 Milyar",
        "history": [],
        "current_route": "/app/studio",
        "role": "organizer"
    }
    r = httpx.post(f"{API}/okkax/chat", json=payload, timeout=60)
    assert r.status_code == 200
    reply = r.json()["reply"]
    assert "Talent & Rider" in reply
    assert "Produksi Teknis" in reply
    assert "Watt RMS" in reply or "Line Array" in reply
    assert "Rp" in reply


def test_okkax_copilot_event_graph_analysis():
    """Menguji pemahaman OKKAX Copilot tentang Event Graph dan dependensi blocker."""
    payload = {
        "message": "Jelaskan struktur node Event Graph dan bagaimana menangani node yang statusnya Blocked",
        "history": [],
        "current_route": "/app/events",
        "role": "organizer"
    }
    r = httpx.post(f"{API}/okkax/chat", json=payload, timeout=60)
    assert r.status_code == 200
    reply = r.json()["reply"]
    assert "Event ID" in reply or "Event Graph" in reply
    assert "Blocked" in reply or "Confirmed" in reply


def test_okkax_copilot_gate_scanner_and_crowd_safety():
    """Menguji pemahaman gate validator dan SOP crowd safety."""
    payload = {
        "message": "Bagaimana SOP validasi scanner tiket QR di gate dan pencegahan tiket ganda?",
        "history": [],
        "current_route": "/validator",
        "role": "worker"
    }
    r = httpx.post(f"{API}/okkax/chat", json=payload, timeout=60)
    assert r.status_code == 200
    reply = r.json()["reply"]
    assert "QR" in reply or "Scanner" in reply or "Validator" in reply
