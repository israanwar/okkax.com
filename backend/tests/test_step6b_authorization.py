"""Critical authorization boundary tests (STEP 6B).

Covers the P0 vulnerabilities identified in the Step 6A audit:

- Private event surfaces (`brief`, `blueprint`, `talents`, `venue`,
  `vendors`, `workforce`, `venue-matches`, `vendor-matches`, `budget`,
  `graph`, `command-center`, `ripple` for non-demo events) must reject
  audience / foreign-org users even when the event is `status='published'`.
- Owner, admin, and active `organization_members` rows in
  `event.organizer_org_id` retain access. Legacy scalar `user.org_id`
  match remains a backward-compatible fallback.
- `/api/tickets/validate` gates on validator-capable role AND on
  event-scope membership; the endpoint authorizes against the ticket's
  REAL `event_id`, so an organizer of event A cannot validate tickets
  of event B by spoofing the payload.
- `ripple` continues to serve `is_demo=True` events to unauthenticated
  visitors (Landing marketing surface), but requires ownership/membership
  for any other event.

Uses sync `pymongo` for state setup and `requests` against a running
backend (matches the pattern established by `test_workspaces.py` and
`test_suspended_enforcement.py`).
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

# Seed event owned by usr-1 (organizer@okkax.id), organizer_org_id=org-aruna,
# status=published, is_demo=True.
SEED_EVENT_ID = "evt-aruna-2026"
SEED_ORG_ID = "org-aruna"

# Test fixtures — all prefixed to allow deterministic wipe.
TEST_PREFIX = "test-step6b-"
TEST_EVENT_ID = f"{TEST_PREFIX}evt-crossorg"
TEST_FOREIGN_ORG_ID = f"{TEST_PREFIX}org-foreign"
TEST_TICKET_ID = f"{TEST_PREFIX}ticket-crossorg"
TEST_QR = f"{TEST_PREFIX}qr-crossorg"
# Memberships this suite injects into seed orgs also need cleanup — mark
# every row we insert so we can wipe them without touching legitimate
# rows a peer test suite may have created.
TEST_MARKER = "_step6b_test_marker"


# ------------------------------------------------------------ helpers

def _login(email, pw=DEMO_PASSWORD):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _wipe_test_state():
    # Rows the suite owns are either prefixed on their id/organization_id
    # or carry TEST_MARKER (memberships injected into SEED orgs to prove
    # membership-grants-access). The two filters together isolate this
    # suite's mutations from every other suite and from seed data.
    _db.organization_members.delete_many({TEST_MARKER: True})
    _db.organization_members.delete_many({"organization_id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.organizations.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.events.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.tickets.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.ticket_validations.delete_many({"qr_code": {"$regex": f"^{TEST_PREFIX}"}})


def _seed_foreign_event():
    """Second event owned by a distinct user + organization, used to prove
    that an operator of event A cannot validate tickets of event B."""
    _db.organizations.insert_one({
        "id": TEST_FOREIGN_ORG_ID, "name": "Foreign Org (Step 6B)",
        "org_type": "Test", "city": "Nowhere", "verified": False,
    })
    _db.events.insert_one({
        "id": TEST_EVENT_ID, "event_code": "TEST-STEP6B-0001",
        "name": "Foreign Event", "event_type": "Concert", "city": "Nowhere",
        "start_date": "2026-12-01", "end_date": "2026-12-01",
        "owner_user_id": "usr-does-not-exist",
        "organizer_org_id": TEST_FOREIGN_ORG_ID,
        "status": "published", "is_demo": False, "deleted": False,
    })
    _db.tickets.insert_one({
        "id": TEST_TICKET_ID, "event_id": TEST_EVENT_ID,
        "qr_code": TEST_QR, "ticket_number": TEST_QR,
        "attendee_name": "Cross-Org Attendee",
        "status": "valid",
    })


def _inject_membership(user_id, org_id, role="organizer"):
    _db.organization_members.delete_many({"user_id": user_id, "organization_id": org_id})
    _db.organization_members.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "organization_id": org_id,
        "role": role,
        "status": "active",
        "created_at": "2026-08-15T00:00:00Z",
        TEST_MARKER: True,
    })


@pytest.fixture(autouse=True)
def _cleanup():
    _wipe_test_state()
    yield
    _wipe_test_state()


# ------------------------------------------------------------ audience denied on private surfaces

# Every surface listed by Step 6A that used to be readable by ANY
# authenticated user when the event was status=published.
PRIVATE_ENDPOINTS = [
    "brief",
    "blueprint",
    "talents",
    "venue",
    "vendors",
    "workforce",
    "venue-matches",
    "vendor-matches",
    "budget",
    "graph",
    "command-center",
]


@pytest.mark.parametrize("surface", PRIVATE_ENDPOINTS)
def test_audience_forbidden_on_private_surface(surface):
    tok = _login("audience@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/{surface}", headers=_h(tok), timeout=10)
    assert r.status_code == 403, (
        f"{surface} returned {r.status_code}; audience must not read private data "
        f"even for a published event. Body: {r.text[:200]}"
    )


# ------------------------------------------------------------ owner / admin retain access

@pytest.mark.parametrize("surface", PRIVATE_ENDPOINTS)
def test_owner_allowed_on_private_surface(surface):
    tok = _login("organizer@okkax.id")  # usr-1 owns evt-aruna-2026
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/{surface}", headers=_h(tok), timeout=10)
    assert r.status_code == 200, f"{surface} for owner returned {r.status_code}: {r.text[:200]}"


def test_admin_allowed_on_private_surface():
    tok = _login(ADMIN_EMAIL, pw=ADMIN_PASSWORD)
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/command-center", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text


# ------------------------------------------------------------ org membership vs foreign org

def test_active_organizer_org_membership_grants_access():
    """A user with an active membership in `event.organizer_org_id`
    passes even without being the owner. Uses the worker seed account
    (usr-8) as a neutral subject — `user.org_id` is None so we prove
    membership alone unlocks. worker@okkax.id is deliberately picked
    because no other test suite touches its membership rows, avoiding
    race with parallel xdist workers."""
    _inject_membership("usr-8", SEED_ORG_ID, role="organizer")
    tok = _login("worker@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 200, f"membership did not grant access: {r.text}"


def test_foreign_organization_member_forbidden():
    """vendor@okkax.id is scoped to org-sonic (via legacy user.org_id),
    not org-aruna. No membership row for org-aruna exists, so access
    to evt-aruna-2026 must be denied."""
    tok = _login("vendor@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


def test_legacy_user_org_id_still_grants_access():
    """finance@okkax.id has `user.org_id=org-aruna` from seed but zero
    memberships. The legacy scalar fallback in `assert_event_access`
    must still allow it (Step 6B keeps backward-compat until Step 7)."""
    tok = _login("finance@okkax.id")
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text


# ------------------------------------------------------------ ticket validator

def test_audience_cannot_validate_tickets():
    tok = _login("audience@okkax.id")
    r = requests.post(f"{API}/tickets/validate",
                      json={"qr_code": "anything", "event_id": SEED_EVENT_ID},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    # Should NOT leak whether the QR is real.
    assert "QR" not in r.text and "used" not in r.text


def test_vendor_role_cannot_validate_tickets():
    """Vendor is authenticated + has an org, but the role is not
    validator-capable."""
    tok = _login("vendor@okkax.id")
    r = requests.post(f"{API}/tickets/validate",
                      json={"qr_code": "anything", "event_id": SEED_EVENT_ID},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


def test_owner_can_validate_own_event_ticket():
    """Owner of the event validates a ticket that actually belongs to
    that event. Uses one of the seed tickets."""
    tok = _login("organizer@okkax.id")
    # Grab any ticket for the seed event
    doc = _db.tickets.find_one({"event_id": SEED_EVENT_ID}, {"_id": 0, "qr_code": 1})
    assert doc, "seed ticket for evt-aruna-2026 missing — reseed backend"
    r = requests.post(f"{API}/tickets/validate",
                      json={"qr_code": doc["qr_code"], "event_id": SEED_EVENT_ID},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    # "Valid" first time, "Already Used" on re-run — both are authorized outcomes.
    assert body["result"] in ("Valid", "Already Used"), body


def test_operator_of_event_a_cannot_validate_event_b_ticket():
    """Organizer of evt-aruna-2026 tries to validate a ticket belonging
    to a foreign event (different owner + different organizer_org_id).
    Must be 403, regardless of what event_id the client claims in the
    payload — authorization uses the ticket's REAL event_id."""
    _seed_foreign_event()
    tok = _login("organizer@okkax.id")

    # Even if the client claims event_id=SEED_EVENT_ID (spoofing), the
    # server must authorize against the ticket's actual event_id.
    r = requests.post(f"{API}/tickets/validate",
                      json={"qr_code": TEST_QR, "event_id": SEED_EVENT_ID},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, (
        f"organizer of event A validated a ticket of event B (status "
        f"{r.status_code}); event-scope check missing. Body: {r.text}"
    )
    # Ticket must remain valid (not marked used).
    t = _db.tickets.find_one({"id": TEST_TICKET_ID}, {"_id": 0, "status": 1})
    assert t["status"] == "valid", "cross-event validate mutated ticket state"


def test_admin_can_validate_any_ticket():
    _seed_foreign_event()
    tok = _login(ADMIN_EMAIL, pw=ADMIN_PASSWORD)
    r = requests.post(f"{API}/tickets/validate",
                      json={"qr_code": TEST_QR},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["result"] == "Valid"


# ------------------------------------------------------------ ripple (demo-safe)

def test_ripple_public_for_demo_event():
    """Landing page keeps calling this unauthenticated — must stay 200
    for events marked `is_demo=True`."""
    r = requests.get(f"{API}/events/{SEED_EVENT_ID}/ripple", timeout=10)
    assert r.status_code == 200, r.text
    assert "metrics" in r.json()


def test_ripple_non_demo_requires_auth_and_scope():
    _seed_foreign_event()  # is_demo=False
    # Unauthenticated -> 401
    r = requests.get(f"{API}/events/{TEST_EVENT_ID}/ripple", timeout=10)
    assert r.status_code == 401, r.text
    # Foreign authenticated user -> 403
    tok = _login("audience@okkax.id")
    r = requests.get(f"{API}/events/{TEST_EVENT_ID}/ripple", headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
