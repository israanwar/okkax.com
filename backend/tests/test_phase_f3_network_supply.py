"""Phase F3 (Network & Supply) focused regression.

Covers V5 Phase 03 acceptance targets that this task actually delivered:

A. catalog filtering (legacy + new params, no auth needed)
B. backward compatibility of existing supply doc shapes
C. deterministic match scoring (talent + venue + vendor + worker parity)
D. availability signal derives from real assignments (Booked / Available / Unknown)
E. double-booking protection on `/me/workspace/confirm`
F. event-aware network authorization (audience -> 403)
G. supply assignment isolation (vendor persona cannot confirm talent row)
H. sponsor opportunities endpoint unchanged shape
I. tenant opportunities endpoint unchanged shape

Test isolation follows the pattern used by peer Phase 01 files: suite-
owned prefix + marker, autouse cleanup, sync `pymongo` for setup +
`requests` to the running backend so motor's event loop is untouched.
"""
import os
import uuid
from pathlib import Path

import pymongo
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"
DEMO_PASSWORD = os.environ["DEMO_PASSWORD"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@okkax.id")

_db = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

TEST_PREFIX = "test-f3-"
TEST_MARKER = "_f3_test_marker"
SEED_EVENT_ID = "evt-aruna-2026"

# `tal-dimas` is Confirmed on evt-aruna-2026 in seed_data.py; use it to
# prove availability derivation surfaces "Booked" for a real overlap.
# `tal-aksara` is the talent-persona-linked talent (linked_talent_ids
# on talent@okkax.id) and is used for the double-booking tests below.
SEED_CONFIRMED_TALENT_ID = "tal-dimas"
LINKED_TALENT_ID = "tal-aksara"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _login(email, pw=DEMO_PASSWORD):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(autouse=True)
def _cleanup():
    _db.event_talents.delete_many({TEST_MARKER: True})
    _db.event_venues.delete_many({TEST_MARKER: True})
    _db.event_vendors.delete_many({TEST_MARKER: True})
    _db.events.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    yield
    _db.event_talents.delete_many({TEST_MARKER: True})
    _db.event_venues.delete_many({TEST_MARKER: True})
    _db.event_vendors.delete_many({TEST_MARKER: True})
    _db.events.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})


# ============================================================
# A. Catalog filtering (public endpoints, legacy + new params)
# ============================================================

def test_catalog_talents_legacy_params_still_return_items():
    r = requests.get(f"{API}/catalog/talents", params={"q": "aksara"}, timeout=10)
    assert r.status_code == 200
    items = r.json()["items"]
    assert isinstance(items, list)


def test_catalog_talents_verified_and_price_and_sort():
    r = requests.get(f"{API}/catalog/talents",
                     params={"verified": "true", "min_price": 1, "sort": "price_desc", "limit": 5},
                     timeout=10)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) <= 5
    if len(items) >= 2:
        fees = [i.get("base_fee") or 0 for i in items]
        assert fees == sorted(fees, reverse=True), f"expected desc, got {fees}"
    for i in items:
        assert i.get("verified") is True


def test_catalog_venues_min_capacity_backward_compat():
    r = requests.get(f"{API}/catalog/venues",
                     params={"city": "Makassar", "min_capacity": 1000}, timeout=10)
    assert r.status_code == 200
    for v in r.json()["items"]:
        cap = max(v.get("standing_capacity", 0), v.get("seated_capacity", 0))
        assert cap >= 1000


def test_catalog_vendors_verified_filter():
    r = requests.get(f"{API}/catalog/vendors",
                     params={"verified": "true"}, timeout=10)
    assert r.status_code == 200
    for v in r.json()["items"]:
        assert v.get("verified") is True


def test_catalog_workers_new_filters_and_backward_compat():
    r_legacy = requests.get(f"{API}/catalog/workers",
                            params={"category": "Security"}, timeout=10)
    assert r_legacy.status_code == 200
    r_new = requests.get(f"{API}/catalog/workers",
                         params={"verified": "true", "sort": "price_asc", "limit": 3},
                         timeout=10)
    assert r_new.status_code == 200
    items = r_new.json()["items"]
    assert len(items) <= 3


# ============================================================
# B. Backward compatibility of existing seed doc shapes
# ============================================================

def test_catalog_returns_existing_seed_shape_unchanged():
    """Confirms our new fields never overwrite or hide the existing
    fields that EventWorkspace / RoleWorkspace already read."""
    talents = requests.get(f"{API}/catalog/talents", timeout=10).json()["items"]
    row = next((t for t in talents if t["id"] == LINKED_TALENT_ID), None)
    assert row is not None
    # Existing fields that pre-F3 callers rely on:
    for key in ("stage_name", "category", "city", "base_fee", "verified"):
        assert key in row, f"legacy field missing: {key}"


# ============================================================
# C. Deterministic match scoring
# ============================================================

def test_talent_matches_requires_event_access_and_is_deterministic():
    tok = _login("organizer@okkax.id")
    r1 = requests.get(f"{API}/events/{SEED_EVENT_ID}/talent-matches",
                      headers=_h(tok), timeout=10)
    r2 = requests.get(f"{API}/events/{SEED_EVENT_ID}/talent-matches",
                      headers=_h(tok), timeout=10)
    assert r1.status_code == 200 and r2.status_code == 200
    ids1 = [i["id"] for i in r1.json()["items"]]
    ids2 = [i["id"] for i in r2.json()["items"]]
    assert ids1 == ids2, "matching order is not deterministic"
    top = r1.json()["items"][0]
    assert "match" in top and "score" in top["match"]
    assert isinstance(top["match"].get("reasons"), list) and top["match"]["reasons"]


def test_worker_matches_returns_needed_roles_and_scores():
    tok = _login("organizer@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/worker-matches",
                     headers=_h(tok), timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "needed_roles" in body
    for w in body["items"]:
        s = w["match"]["score"]
        assert 0 <= s <= 100


def test_venue_and_vendor_matches_now_include_availability_signal():
    tok = _login("organizer@okkax.id")
    for surface in ("venue-matches", "vendor-matches"):
        r = requests.get(f"{API}/events/{SEED_EVENT_ID}/{surface}",
                         headers=_h(tok), timeout=10)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert items and "availability" in items[0]
        assert items[0]["availability"]["status"] in \
            {"Available", "Tentative", "Booked", "Conflict", "Unknown"}


# ============================================================
# D. Availability derivation
# ============================================================

def test_talent_with_confirmed_assignment_shows_booked_in_event_window():
    """`tal-dimas` is Confirmed on evt-aruna-2026 per seed_data.py, so
    querying the SAME event's matching for that talent must surface as
    Booked (a confirmed assignment on overlapping dates is a booking
    signal against the resource)."""
    tok = _login("organizer@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/talent-matches",
                     headers=_h(tok), timeout=10)
    row = next(t for t in r.json()["items"] if t["id"] == SEED_CONFIRMED_TALENT_ID)
    assert row["availability"]["status"] == "Booked", row["availability"]
    assert SEED_EVENT_ID in row["availability"]["conflicting_event_ids"]


# ============================================================
# E. Double-booking guard on /me/workspace/confirm
# ============================================================

def _seed_conflict_event_and_talent_assignment():
    """Create two test-owned events on overlapping dates plus two
    assignments for the linked talent: one already Confirmed on event
    A (the pre-existing booking) and one Pending on event B (the row
    the guard will refuse to promote to Confirmed)."""
    _db.events.insert_one({
        "id": f"{TEST_PREFIX}evt-a",
        "event_code": "TEST-F3-A", "name": "F3 Event A",
        "event_type": "Concert", "city": "Makassar",
        "start_date": "2026-08-14", "end_date": "2026-08-15",
        "owner_user_id": "usr-1", "organizer_org_id": "org-aruna",
        "status": "published", "is_demo": False, "deleted": False,
    })
    _db.events.insert_one({
        "id": f"{TEST_PREFIX}evt-b",
        "event_code": "TEST-F3-B", "name": "F3 Event B",
        "event_type": "Concert", "city": "Makassar",
        "start_date": "2026-08-15", "end_date": "2026-08-16",
        "owner_user_id": "usr-1", "organizer_org_id": "org-aruna",
        "status": "published", "is_demo": False, "deleted": False,
    })
    _db.event_talents.insert_one({
        "id": f"{TEST_PREFIX}evt-tal-a-confirmed",
        "event_id": f"{TEST_PREFIX}evt-a",
        "talent_id": LINKED_TALENT_ID,
        "talent_name": "Aksara",
        "status": "Confirmed",
        TEST_MARKER: True,
    })
    _db.event_talents.insert_one({
        "id": f"{TEST_PREFIX}evt-tal-b-pending",
        "event_id": f"{TEST_PREFIX}evt-b",
        "talent_id": LINKED_TALENT_ID,
        "talent_name": "Aksara",
        "status": "Pending",
        TEST_MARKER: True,
    })


def test_double_booking_confirm_rejected_with_409():
    """Talent persona attempts to Confirm the Event B assignment while
    they are already Confirmed on Event A on overlapping dates. Guard
    must respond 409 with `conflicting_event_ids`."""
    _seed_conflict_event_and_talent_assignment()
    tok = _login("talent@okkax.id")
    r = requests.post(f"{API}/me/workspace/confirm",
                      json={"kind": "talent",
                            "id": f"{TEST_PREFIX}evt-tal-b-pending",
                            "status": "Confirmed"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 409, r.text
    detail = r.json().get("detail") or {}
    assert detail.get("error") == "double_booking"
    assert f"{TEST_PREFIX}evt-a" in (detail.get("conflicting_event_ids") or [])
    # Status must remain Pending (guard is atomic).
    row = _db.event_talents.find_one({"id": f"{TEST_PREFIX}evt-tal-b-pending"},
                                     {"_id": 0, "status": 1})
    assert row["status"] == "Pending"


def test_non_confirming_update_still_allowed_under_conflict():
    """Tentative promotions must NOT trip the guard, so negotiation
    can continue while both events are on the table."""
    _seed_conflict_event_and_talent_assignment()
    tok = _login("talent@okkax.id")
    r = requests.post(f"{API}/me/workspace/confirm",
                      json={"kind": "talent",
                            "id": f"{TEST_PREFIX}evt-tal-b-pending",
                            "status": "Tentative"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text


# ============================================================
# F. Event-aware network authorization
# ============================================================

def test_audience_cannot_read_talent_matches():
    tok = _login("audience@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/talent-matches",
                     headers=_h(tok), timeout=10)
    assert r.status_code == 403


def test_audience_cannot_read_worker_matches():
    tok = _login("audience@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/worker-matches",
                     headers=_h(tok), timeout=10)
    assert r.status_code == 403


def test_catalog_never_returns_private_event_fields():
    """Catalog endpoints must not leak event-scoped fields like
    `event_id`, `booking_id`, or private assignment status."""
    for path in ("/catalog/talents", "/catalog/venues",
                 "/catalog/vendors", "/catalog/workers"):
        items = requests.get(f"{API}{path}", timeout=10).json()["items"]
        for it in items[:5]:
            for banned in ("event_id", "booking_id", "assignment_status",
                           "commercial_status", "quotation_id"):
                assert banned not in it, \
                    f"{path} leaked {banned}"


# ============================================================
# G. Supply assignment isolation
# ============================================================

def test_vendor_persona_cannot_confirm_talent_assignment():
    """Vendor persona has no `linked_talent_ids`; confirm on a talent
    row must be 403, not silently succeed."""
    _seed_conflict_event_and_talent_assignment()
    tok = _login("vendor@okkax.id")
    r = requests.post(f"{API}/me/workspace/confirm",
                      json={"kind": "talent",
                            "id": f"{TEST_PREFIX}evt-tal-b-pending",
                            "status": "Confirmed"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


# ============================================================
# H + I. Sponsor / Tenant portal endpoints unchanged
# ============================================================

def test_sponsor_opportunities_public_endpoint_shape_unchanged():
    r = requests.get(f"{API}/sponsor/opportunities", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    for row in body["items"][:1]:
        assert "event" in row and "packages" in row


def test_tenant_opportunities_public_endpoint_shape_unchanged():
    r = requests.get(f"{API}/tenant/opportunities", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
