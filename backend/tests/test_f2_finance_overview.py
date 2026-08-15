import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = (
    os.environ.get(
        "TEST_BASE_URL",
        "http://127.0.0.1:8001",
    ).rstrip("/")
    + "/api"
)

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
DEMO_PASSWORD = os.environ["DEMO_PASSWORD"]


def login(email, password):
    r = requests.post(
        f"{BASE}/auth/login",
        json={
            "email": email,
            "password": password,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


def headers(token):
    return {
        "Authorization": f"Bearer {token}"
    }


def test_super_admin_can_read_finance_overview():
    token = login(
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
    )

    r = requests.get(
        f"{BASE}/admin/finance/overview",
        headers=headers(token),
        timeout=30,
    )

    assert r.status_code == 200, r.text

    data = r.json()

    assert "summary" in data
    assert "counts" in data
    assert "activity" in data
    assert "events" in data

    summary = data["summary"]

    assert "network_gmv" in summary
    assert "secured_obligations" in summary
    assert "released" in summary
    assert "protected" in summary
    assert "pending_settlement" in summary
    assert "refund_exposure" in summary


def test_non_admin_cannot_read_finance_overview():
    token = login(
        "organizer@okkax.id",
        DEMO_PASSWORD,
    )

    r = requests.get(
        f"{BASE}/admin/finance/overview",
        headers=headers(token),
        timeout=30,
    )

    assert r.status_code == 403
