"""Iteration 3 backend tests: /api/demo/summary endpoint + dynamic key numbers proof."""
import os
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")

DEMO_PASSWORD = os.environ["DEMO_PASSWORD"]
ORGANIZER_EMAIL = "organizer@okkax.id"
EVENT_ID = "evt-aruna-2026"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def organizer_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ORGANIZER_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- /api/demo/summary contract ----------
def test_demo_summary_public_ok(s):
    r = s.get(f"{BASE_URL}/api/demo/summary")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "key_numbers" in d
    K = d["key_numbers"]
    for k in ("total_event_cost", "confirmed_funding", "funding_gap", "economic_activity"):
        assert k in K and isinstance(K[k], (int, float))
    assert d["event"]["id"] == EVENT_ID
    assert d["network"]["talents"] > 0
    assert d["network"]["rider_items"] > 0
    assert d["sample_qr"].startswith("OKKAX|")
    assert d["disclaimer"]


def test_demo_summary_personas_no_admin(s):
    r = s.get(f"{BASE_URL}/api/demo/summary")
    d = r.json()
    emails = [p["email"] for p in d["personas"]]
    labels = [p["label"] for p in d["personas"]]
    assert "admin@okkax.id" not in emails
    assert not any("Administrator" in l or "Platform" in l for l in labels)
    assert set(emails) == {
        "organizer@okkax.id", "sponsor@okkax.id", "tenant@okkax.id",
        "audience@okkax.id", "supervisor@okkax.id",
    }


def test_demo_summary_matches_budget_endpoint(s, organizer_token):
    ds = s.get(f"{BASE_URL}/api/demo/summary").json()
    r = s.get(f"{BASE_URL}/api/events/{EVENT_ID}/budget",
              headers={"Authorization": f"Bearer {organizer_token}"})
    assert r.status_code == 200, r.text
    b = r.json()
    K = ds["key_numbers"]
    assert K["total_event_cost"] == b["total_cost"]
    assert K["confirmed_funding"] == b["confirmed_funding"]
    assert K["funding_gap"] == b["funding_gap"]


# ---------- proof that numbers are not hard-coded ----------
def test_key_numbers_change_when_funding_added(s, organizer_token):
    h = {"Authorization": f"Bearer {organizer_token}"}
    before = s.get(f"{BASE_URL}/api/demo/summary").json()["key_numbers"]

    payload = {"source": "Partner Contributions", "label": "Uji juri",
               "amount": 50_000_000, "state": "committed"}
    add = s.post(f"{BASE_URL}/api/events/{EVENT_ID}/funding-items", json=payload, headers=h)
    assert add.status_code in (200, 201), add.text

    try:
        after = s.get(f"{BASE_URL}/api/demo/summary").json()["key_numbers"]
        assert after["confirmed_funding"] - before["confirmed_funding"] == 50_000_000, \
            f"confirmed_funding delta wrong: {before} -> {after}"
        assert before["funding_gap"] - after["funding_gap"] == 50_000_000, \
            f"funding_gap delta wrong: {before} -> {after}"
    finally:
        # cleanup: reset demo data via admin auth
        adm_email = os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id")
        adm_pw = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
        adm_r = s.post(f"{BASE_URL}/api/auth/login", json={"email": adm_email, "password": adm_pw}, timeout=10)
        adm_h = {"Authorization": f"Bearer {adm_r.json()['token']}"} if adm_r.status_code == 200 else {}
        rr = s.post(f"{BASE_URL}/api/demo/reset", headers=adm_h, timeout=30)
        assert rr.status_code in (200, 201), rr.text
        # summary still 200 after reset
        final = s.get(f"{BASE_URL}/api/demo/summary", timeout=15)
        assert final.status_code == 200
