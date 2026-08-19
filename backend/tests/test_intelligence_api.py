"""
Test Suite for OKKAX Intelligence Engine API Suite.
Verifies all 8 intelligence endpoints, provenance contract, and quota management.
"""

import pytest
import requests
import json
import os

API = f"{os.environ.get('TEST_BASE_URL', os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001'))}/api"
PASSWORD = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")

@pytest.fixture(scope="session")
def auth_headers():
    login_res = requests.post(f"{API}/auth/login", json={"email": "organizer@okkax.id", "password": PASSWORD})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_intelligence_quota_endpoint(auth_headers):
    """GET /api/intelligence/quota returns valid entitlement telemetry."""
    res = requests.get(f"{API}/intelligence/quota", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "plan" in data
    assert "usage" in data
    assert "limit" in data
    assert "remaining" in data
    assert "reset_at" in data
    assert isinstance(data["features_enabled"], list)


def test_intelligence_nl_query_workforce(auth_headers):
    """POST /api/intelligence/query handles workforce intent and returns job cards."""
    payload = {
        "query": "Cari job event sebagai FOH Sound Engineer atau Stage Crew di Makassar akhir pekan ini"
    }
    res = requests.post(f"{API}/intelligence/query", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "intent" in data
    assert data["intent"]["category"] == "workforce_discovery"
    assert "structured_payload" in data
    assert data["structured_payload"]["payload_type"] == "job_cards"
    assert len(data["structured_payload"]["items"]) > 0
    assert "provenance" in data["structured_payload"]
    assert data["structured_payload"]["provenance"]["status"] == "verified"


def test_intelligence_nl_query_vendor(auth_headers):
    """POST /api/intelligence/query handles vendor procurement intent."""
    payload = {
        "query": "Pengadaan lighting moving head 380W beam dan LED screen P3.91 untuk panggung outdoor di Jakarta"
    }
    res = requests.post(f"{API}/intelligence/query", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"]["category"] == "vendor_procurement"
    assert data["structured_payload"]["payload_type"] == "procurement_cards"
    assert len(data["structured_payload"]["items"]) > 0


def test_intelligence_nl_query_economic_ripple(auth_headers):
    """POST /api/intelligence/query handles economic multiplier modeling."""
    payload = {
        "query": "Berapa proyeksi perputaran uang dan dampak ekonomi untuk festival 5.000 pax di Bali?"
    }
    res = requests.post(f"{API}/intelligence/query", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["intent"]["category"] == "economic_ripple"
    assert data["structured_payload"]["payload_type"] == "economic_ripple"
    assert "total_economic_activity_idr" in data["structured_payload"]["summary_metrics"]


def test_pricing_benchmark_endpoint(auth_headers):
    """POST /api/intelligence/benchmark/pricing returns regional price distributions."""
    payload = {
        "category": "sound_system",
        "city": "Surabaya",
        "scale": "medium"
    }
    res = requests.post(f"{API}/intelligence/benchmark/pricing", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["min"] < data["median"] < data["max"]
    assert data["currency"] == "IDR"
    assert "provenance" in data
    assert data["provenance"]["status"] == "verified"


def test_breakeven_forecast_endpoint(auth_headers):
    """POST /api/intelligence/forecast/break-even computes multi-tier financial sensitivity."""
    payload = {
        "capacity": 3000,
        "fixed_costs": 400000000,
        "variable_cost_per_pax": 40000,
        "ticket_tiers": [
            {"name": "Presale", "price": 250000, "quota_pct": 30},
            {"name": "Regular", "price": 350000, "quota_pct": 50},
            {"name": "VIP", "price": 750000, "quota_pct": 20}
        ],
        "sponsor_revenue": 100000000,
        "tenant_revenue": 50000000
    }
    res = requests.post(f"{API}/intelligence/forecast/break-even", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "breakeven_tickets" in data
    assert "breakeven_occupancy_pct" in data
    assert data["breakeven_occupancy_pct"] > 0
    assert len(data["scenarios"]) == 3
    assert data["scenarios"][0]["scenario"].startswith("Pessimistic")


def test_risk_assessment_endpoint(auth_headers):
    """POST /api/intelligence/risk/assessment evaluates clash, weather, and crowd safety."""
    payload = {
        "city": "Makassar",
        "start_date": "2026-09-12",
        "capacity": 3500,
        "is_outdoor": True,
        "budget": 750000000
    }
    res = requests.post(f"{API}/intelligence/risk/assessment", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "risk_score" in data
    assert "overall_risk_level" in data
    assert len(data["identified_risks"]) >= 3
    assert "provenance" in data


def test_supply_matching_endpoint(auth_headers):
    """POST /api/intelligence/supply/match returns scored supply entities."""
    payload = {
        "role": "talent",
        "city": "Jakarta",
        "verified_only": True,
        "limit": 5
    }
    res = requests.post(f"{API}/intelligence/supply/match", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "matches" in data
    assert len(data["matches"]) > 0
    assert data["matches"][0]["match_score"] >= 80.0
    assert "provenance" in data


def test_economic_ripple_endpoint(auth_headers):
    """POST /api/intelligence/economic-ripple computes 3-tier ripple breakdown."""
    payload = {
        "city": "Bandung",
        "attendance": 4000,
        "avg_ticket_price": 250000,
        "days": 2,
        "event_type": "Festival Musik"
    }
    res = requests.post(f"{API}/intelligence/economic-ripple", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "composite_multiplier" in data
    assert data["composite_multiplier"] > 1.0
    assert "breakdown" in data
    assert "direct" in data["breakdown"]
    assert "indirect" in data["breakdown"]
    assert "induced" in data["breakdown"]


def test_industry_trends_endpoint(auth_headers):
    """GET /api/intelligence/trends returns ecosystem macro telemetry."""
    res = requests.get(f"{API}/intelligence/trends", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "ecosystem_summary" in data
    assert data["ecosystem_summary"]["total_monitored_events"] > 0
    assert len(data["top_growth_cities"]) > 0
    assert len(data["top_demand_categories"]) > 0
