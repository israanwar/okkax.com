"""Phase 01. Active workspace authority tests.

Verifies the V5 task contract:

- personal workspace activatable (audience-only policy);
- valid org workspace activatable;
- foreign org rejected;
- inactive membership rejected;
- switch A -> B makes A's authority ineffective on the session;
- membership revoked after activation -> subsequent request denied;
- role changed after activation -> DB role used (no session snapshot);
- session A and session B (same user) hold independent active workspaces;
- revoked session cannot switch (session gate blocks first).

No frontend, no permission snapshot, no second workspace token. active
workspace state lives only on `db.sessions[sid].active_workspace` and is
re-resolved from DB on every read.
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

_db = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

# All rows this suite inserts carry a marker or a prefix so the autouse
# cleanup never touches peer-suite fixtures.
TEST_PREFIX = "test-activews-"
TEST_MARKER = "_activews_test_marker"

# Subject user for org-workspace scenarios: worker seed account has
# `user.org_id=None`, so we can prove membership alone unlocks a
# workspace without any legacy fallback contaminating the test.
SUBJECT_USER_ID = "usr-8"
SUBJECT_USER_EMAIL = "worker@okkax.id"

ORG_A_ID = f"{TEST_PREFIX}org-a"
ORG_B_ID = f"{TEST_PREFIX}org-b"
ORG_FOREIGN_ID = f"{TEST_PREFIX}org-foreign"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _login(email=SUBJECT_USER_EMAIL, pw=DEMO_PASSWORD):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _sid_of(token):
    import base64, json
    payload = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    return payload["sid"]


def _seed_org(org_id, name=None):
    _db.organizations.update_one(
        {"id": org_id},
        {"$set": {"id": org_id, "name": name or f"Org {org_id}",
                  "org_type": "Test", "city": "Nowhere", "verified": False}},
        upsert=True,
    )


def _seed_membership(user_id, org_id, role="organizer", status="active"):
    _db.organization_members.delete_many({"user_id": user_id, "organization_id": org_id})
    _db.organization_members.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id, "organization_id": org_id,
        "role": role, "status": status,
        "created_at": "2026-08-15T00:00:00Z",
        TEST_MARKER: True,
    })


@pytest.fixture(autouse=True)
def _cleanup():
    _db.organization_members.delete_many({TEST_MARKER: True})
    _db.organizations.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    # Clear active_workspace on subject user's sessions so state does
    # not bleed between tests (session rows themselves may persist ,
    # only their workspace context is per-test).
    _db.sessions.update_many({"user_id": SUBJECT_USER_ID},
                             {"$set": {"active_workspace": None}})
    yield
    _db.organization_members.delete_many({TEST_MARKER: True})
    _db.organizations.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.sessions.update_many({"user_id": SUBJECT_USER_ID},
                             {"$set": {"active_workspace": None}})


# ------------------------------------------------------------ activation happy paths

def test_activate_personal_workspace_returns_audience_workspace():
    tok = _login("audience@okkax.id")
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": None, "role": "audience"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    ws = r.json()["workspace"]
    assert ws["organization_id"] is None
    assert ws["role"] == "audience"
    assert ws["kind"] == "personal"

    # Session row now has the personal marker.
    session = _db.sessions.find_one({"id": _sid_of(tok)}, {"_id": 0, "active_workspace": 1})
    assert session["active_workspace"]["organization_id"] is None


def test_activate_valid_organization_workspace():
    _seed_org(ORG_A_ID, "Org A")
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer")
    tok = _login()
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": ORG_A_ID, "role": "organizer"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    ws = r.json()["workspace"]
    assert ws["organization_id"] == ORG_A_ID
    assert ws["role"] == "organizer"
    assert ws["kind"] == "organization"


# ------------------------------------------------------------ activation denials

def test_activate_foreign_org_rejected():
    _seed_org(ORG_FOREIGN_ID)
    # Deliberately NO membership row inserted.
    tok = _login()
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": ORG_FOREIGN_ID, "role": "organizer"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    # Session must not have been mutated.
    session = _db.sessions.find_one({"id": _sid_of(tok)}, {"_id": 0, "active_workspace": 1})
    assert (session.get("active_workspace") or {}).get("organization_id") is None


def test_activate_inactive_membership_rejected():
    _seed_org(ORG_A_ID)
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer", status="revoked")
    tok = _login()
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": ORG_A_ID, "role": "organizer"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


# ------------------------------------------------------------ switch discards prior authority

def test_switch_A_to_B_leaves_only_B_active_on_the_session():
    _seed_org(ORG_A_ID, "Org A")
    _seed_org(ORG_B_ID, "Org B")
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer")
    _seed_membership(SUBJECT_USER_ID, ORG_B_ID, role="sponsor")
    tok = _login()

    # Activate A.
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_A_ID, "role": "organizer"},
                  headers=_h(tok), timeout=10)
    assert requests.get(f"{API}/me/workspace/active", headers=_h(tok), timeout=10) \
        .json()["workspace"]["organization_id"] == ORG_A_ID

    # Switch to B.
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_B_ID, "role": "sponsor"},
                  headers=_h(tok), timeout=10)
    active = requests.get(f"{API}/me/workspace/active", headers=_h(tok), timeout=10).json()["workspace"]
    assert active["organization_id"] == ORG_B_ID
    assert active["role"] == "sponsor"
    # And absolutely NOT A on this session.
    assert active["organization_id"] != ORG_A_ID


# ------------------------------------------------------------ DB is the source of truth on every read

def test_membership_revoked_after_activation_blocks_active_read():
    _seed_org(ORG_A_ID)
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer")
    tok = _login()
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_A_ID, "role": "organizer"},
                  headers=_h(tok), timeout=10)

    # Simulate a membership revocation performed outside the session.
    _db.organization_members.update_many(
        {"user_id": SUBJECT_USER_ID, "organization_id": ORG_A_ID},
        {"$set": {"status": "revoked"}},
    )
    r = requests.get(f"{API}/me/workspace/active", headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    assert "no longer" in r.json().get("detail", "").lower()


def test_role_change_after_activation_uses_current_db_role():
    """Session stores organization_id only. Role is re-derived from
    the current membership on every read, so an out-of-band role change
    is reflected immediately without re-activation."""
    _seed_org(ORG_A_ID)
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer")
    tok = _login()
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_A_ID, "role": "organizer"},
                  headers=_h(tok), timeout=10)

    _db.organization_members.update_many(
        {"user_id": SUBJECT_USER_ID, "organization_id": ORG_A_ID},
        {"$set": {"role": "sponsor"}},
    )

    r = requests.get(f"{API}/me/workspace/active", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["workspace"]["role"] == "sponsor"


# ------------------------------------------------------------ session isolation

def test_two_sessions_hold_independent_active_workspaces():
    _seed_org(ORG_A_ID, "Org A")
    _seed_org(ORG_B_ID, "Org B")
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer")
    _seed_membership(SUBJECT_USER_ID, ORG_B_ID, role="sponsor")

    tok_a = _login()
    tok_b = _login()
    assert _sid_of(tok_a) != _sid_of(tok_b)

    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_A_ID, "role": "organizer"},
                  headers=_h(tok_a), timeout=10)
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_B_ID, "role": "sponsor"},
                  headers=_h(tok_b), timeout=10)

    ws_a = requests.get(f"{API}/me/workspace/active", headers=_h(tok_a), timeout=10).json()["workspace"]
    ws_b = requests.get(f"{API}/me/workspace/active", headers=_h(tok_b), timeout=10).json()["workspace"]
    assert ws_a["organization_id"] == ORG_A_ID
    assert ws_b["organization_id"] == ORG_B_ID


# ------------------------------------------------------------ session gate composes

def test_revoked_session_cannot_switch_workspace():
    _seed_org(ORG_A_ID)
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="organizer")
    tok = _login()
    # Revoke the session out-of-band.
    _db.sessions.update_one({"id": _sid_of(tok)},
                             {"$set": {"revoked_at": "2026-08-15T00:00:00Z"}})

    # Every access. including workspace/activate. must be blocked at
    # the session gate BEFORE workspace logic runs.
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": ORG_A_ID, "role": "organizer"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 401, r.text
    assert "revoked" in r.json().get("detail", "").lower()


def test_no_active_workspace_returns_null_not_403():
    """Fresh login has never activated a workspace. should return
    200 with null, distinguishable from the 403 you get after a
    membership revocation."""
    tok = _login()
    r = requests.get(f"{API}/me/workspace/active", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["workspace"] is None


# ------------------------------------------------------------ policy defenses composed

def test_admin_role_still_blocked_from_org_workspace_activation():
    """Defense-in-depth from Step 5 must still hold: even if a rogue
    membership row claims role=super_admin, activation is refused."""
    _seed_org(ORG_A_ID)
    _seed_membership(SUBJECT_USER_ID, ORG_A_ID, role="super_admin")
    tok = _login()
    r = requests.post(f"{API}/me/workspace/activate",
                      json={"organization_id": ORG_A_ID, "role": "super_admin"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
