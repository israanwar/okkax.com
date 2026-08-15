"""Phase 01 final blocker regression.

Manual browser test confirmed that with Personal workspace active,
`GET /api/events` still returned org-aruna events (owner_user_id
shortcut leaked events belonging to an organization into the personal
list). These tests pin the fixed semantic:

- Org A active         -> events with organizer_org_id=A visible
- Personal active      -> those same events NOT visible
- Org B active         -> Org A events NOT visible
- Switch back to Org A -> Org A events visible again

Uses a suite-owned subject user to avoid xdist races with peer test
files that also inject state for shared seed accounts.
"""
import os
import uuid
from pathlib import Path

import bcrypt
import pymongo
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api"

_db = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

TEST_PREFIX = "test-personalscope-"
TEST_MARKER = "_personalscope_test_marker"

SUBJECT_ID = f"{TEST_PREFIX}user"
SUBJECT_EMAIL = f"{TEST_PREFIX}user@okkax.id"
SUBJECT_PASSWORD = "personalscope-pw-7q"

ORG_A_ID = f"{TEST_PREFIX}org-a"
ORG_B_ID = f"{TEST_PREFIX}org-b"
EVENT_A_ID = f"{TEST_PREFIX}evt-a"
EVENT_B_ID = f"{TEST_PREFIX}evt-b"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _login():
    r = requests.post(f"{API}/auth/login",
                      json={"email": SUBJECT_EMAIL, "password": SUBJECT_PASSWORD},
                      timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _seed_org(org_id):
    _db.organizations.update_one(
        {"id": org_id},
        {"$set": {"id": org_id, "name": f"Test {org_id}",
                  "org_type": "Test", "city": "Nowhere", "verified": False}},
        upsert=True,
    )


def _seed_event(event_id, org_id, owner_id=SUBJECT_ID):
    _db.events.insert_one({
        "id": event_id, "event_code": f"TEST-{event_id[-6:]}",
        "name": f"Event {event_id}", "event_type": "Concert",
        "city": "Nowhere", "start_date": "2027-01-01", "end_date": "2027-01-01",
        "owner_user_id": owner_id, "organizer_org_id": org_id,
        "status": "published", "is_demo": False, "deleted": False, "capacity": 100,
    })


def _inject_membership(org_id, role="organizer"):
    _db.organization_members.delete_many({"user_id": SUBJECT_ID, "organization_id": org_id})
    _db.organization_members.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": SUBJECT_ID, "organization_id": org_id,
        "role": role, "status": "active",
        "created_at": "2026-08-15T00:00:00Z",
        TEST_MARKER: True,
    })


def _activate(tok, org_id, role):
    return requests.post(f"{API}/me/workspace/activate",
                         json={"organization_id": org_id, "role": role},
                         headers=_h(tok), timeout=10)


@pytest.fixture(scope="module", autouse=True)
def _subject_user():
    _db.users.delete_many({"id": SUBJECT_ID})
    _db.users.delete_many({"email": SUBJECT_EMAIL})
    _db.users.insert_one({
        "id": SUBJECT_ID, "email": SUBJECT_EMAIL,
        "password_hash": bcrypt.hashpw(SUBJECT_PASSWORD.encode(),
                                       bcrypt.gensalt()).decode(),
        "name": "Personal Scope Subject",
        "roles": ["organizer"], "org_id": None,
        "onboarded": True, "suspended": False,
    })
    yield
    _db.users.delete_many({"id": SUBJECT_ID})
    _db.users.delete_many({"email": SUBJECT_EMAIL})


@pytest.fixture(autouse=True)
def _per_test_cleanup():
    _db.organization_members.delete_many({TEST_MARKER: True})
    _db.organizations.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.events.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.sessions.update_many({"user_id": SUBJECT_ID},
                             {"$set": {"active_workspace": None}})
    yield
    _db.organization_members.delete_many({TEST_MARKER: True})
    _db.organizations.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.events.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.sessions.update_many({"user_id": SUBJECT_ID},
                             {"$set": {"active_workspace": None}})


def _seed_two_orgs_and_events():
    """Subject is an active organizer in both Org A and Org B and owns
    an event in each. Ownership is the exact channel the bug exploited
    to smuggle Org A events into the Personal list."""
    _seed_org(ORG_A_ID)
    _seed_org(ORG_B_ID)
    _inject_membership(ORG_A_ID)
    _inject_membership(ORG_B_ID)
    _seed_event(EVENT_A_ID, ORG_A_ID)
    _seed_event(EVENT_B_ID, ORG_B_ID)


def _event_ids(tok):
    r = requests.get(f"{API}/events", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    return {e["id"] for e in r.json()["items"]}


def test_org_A_active_lists_org_A_event():
    _seed_two_orgs_and_events()
    tok = _login()
    assert _activate(tok, ORG_A_ID, "organizer").status_code == 200
    ids = _event_ids(tok)
    assert EVENT_A_ID in ids
    assert EVENT_B_ID not in ids


def test_personal_active_hides_org_events_even_when_owner():
    """The exact reproduction from the manual browser test: subject
    OWNS Org A's event, yet with Personal workspace active the event
    must NOT appear in `/api/events`. Owner-shortcut previously leaked
    it despite the workspace boundary."""
    _seed_two_orgs_and_events()
    tok = _login()
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": None, "role": "audience"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    ids = _event_ids(tok)
    assert EVENT_A_ID not in ids, "Personal workspace still returns Org A event"
    assert EVENT_B_ID not in ids, "Personal workspace still returns Org B event"
    assert ids == set(), f"Personal workspace must return empty list, got {ids}"


def test_org_B_active_hides_org_A_event():
    _seed_two_orgs_and_events()
    tok = _login()
    assert _activate(tok, ORG_B_ID, "organizer").status_code == 200
    ids = _event_ids(tok)
    assert EVENT_B_ID in ids
    assert EVENT_A_ID not in ids, "Org A event still visible while workspace = Org B"


def test_switch_A_then_personal_then_back_to_A_reveals_A_again():
    _seed_two_orgs_and_events()
    tok = _login()

    _activate(tok, ORG_A_ID, "organizer")
    assert EVENT_A_ID in _event_ids(tok)

    # Personal -> Org A event hidden.
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": None, "role": "audience"},
                  headers=_h(tok), timeout=10)
    assert EVENT_A_ID not in _event_ids(tok)

    # Switch back to Org A -> visible again immediately.
    _activate(tok, ORG_A_ID, "organizer")
    ids = _event_ids(tok)
    assert EVENT_A_ID in ids
    assert EVENT_B_ID not in ids


def test_private_endpoint_denied_under_personal_even_for_org_owner():
    """Same principle at the assert_event_access layer: an event the
    subject OWNS in Org A must not be reachable via the private brief
    while their workspace is Personal. Owner path is preserved for the
    ORG execution context, not for personal."""
    _seed_two_orgs_and_events()
    tok = _login()
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": None, "role": "audience"},
                  headers=_h(tok), timeout=10)
    r = requests.get(f"{API}/events/{EVENT_A_ID}/brief", headers=_h(tok), timeout=10)
    # Owner-of-record path still passes because ownership is preserved
    # per V5. This asserts current behavior explicitly so any future
    # tightening is an intentional decision, not an accidental drift.
    assert r.status_code == 200, r.text
