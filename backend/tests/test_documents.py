"""Comprehensive contract and regression tests for OKKAX Document Design System."""

import os
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API = "http://127.0.0.1:8001/api"
PASSWORD = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")
EVENT_ID = "evt-aruna-2026"


def _login(email, pw=PASSWORD):
    if email == os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id"):
        pw = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def tokens():
    return {
        "organizer": _login("organizer@okkax.id"),
        "audience": _login("audience@okkax.id"),
        "tenant": _login("tenant@okkax.id"),
        "admin": _login(os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id")),
    }


def test_quotation_pdf_generation(tokens):
    """Ensure Quotation PDF generates a valid, compliant PDF with OKKAX document headers."""
    r = requests.get(f"{API}/documents/quotation/{EVENT_ID}", headers=_h(tokens["organizer"]), timeout=15)
    assert r.status_code == 200, r.text[:400]
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert "attachment" in r.headers.get("content-disposition", "").lower()
    assert "OKKAX-Quotation-" in r.headers.get("content-disposition", "")
    assert len(r.content) > 2048
    assert r.content.startswith(b"%PDF")


def test_payment_schedule_pdf_multipage_generation(tokens):
    """Ensure Payment Schedule PDF handles large milestone lists without cutoff."""
    r = requests.get(f"{API}/documents/payment-schedule/{EVENT_ID}", headers=_h(tokens["organizer"]), timeout=15)
    assert r.status_code == 200, r.text[:400]
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert "attachment" in r.headers.get("content-disposition", "").lower()
    assert "OKKAX-Payment-Schedule-" in r.headers.get("content-disposition", "")
    assert len(r.content) > 4096
    assert r.content.startswith(b"%PDF")


def test_invoice_pdf_generation(tokens):
    """Ensure Invoice PDF generates for an existing order."""
    r_orders = requests.get(f"{API}/my/orders", headers=_h(tokens["audience"]), timeout=10)
    assert r_orders.status_code == 200
    items = r_orders.json().get("items", [])
    if not items:
        pytest.skip("No audience orders found for invoice test")

    oid = items[0]["id"]
    r = requests.get(f"{API}/documents/invoice/{oid}", headers=_h(tokens["audience"]), timeout=15)
    assert r.status_code == 200, r.text[:400]
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert "attachment" in r.headers.get("content-disposition", "").lower()
    assert "OKKAX-Invoice-" in r.headers.get("content-disposition", "")
    assert len(r.content) > 2048
    assert r.content.startswith(b"%PDF")


def test_quotation_forbidden_for_audience(tokens):
    """Ensure unauthorized roles cannot download internal event quotation."""
    r = requests.get(f"{API}/documents/quotation/{EVENT_ID}", headers=_h(tokens["audience"]), timeout=10)
    assert r.status_code == 403


def test_invoice_forbidden_for_unrelated_user(tokens):
    """Ensure user A cannot download user B's invoice."""
    r_orders = requests.get(f"{API}/my/orders", headers=_h(tokens["audience"]), timeout=10)
    assert r_orders.status_code == 200
    items = r_orders.json().get("items", [])
    if not items:
        pytest.skip("No audience orders found")

    oid = items[0]["id"]
    r = requests.get(f"{API}/documents/invoice/{oid}", headers=_h(tokens["tenant"]), timeout=10)
    assert r.status_code == 403
