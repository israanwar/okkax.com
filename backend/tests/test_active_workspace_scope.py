"""Phase 01. Active Workspace Scope Enforcement tests.

Turns the empirical cross-org probe from the verification pass into a
permanent regression + covers every acceptance case from the V5 task
contract:

1.  member Org A + Org B, workspace B -> Org A private event = 403;
2.  workspace A -> Org A private event = 200;
3.  switch A -> B: authority A immediately gone;
4.  personal workspace -> org private op = 403;
5.  membership A revoked mid-session -> denied;
6.  role changed -> current DB role used (no snapshot);
7.  admin existing access unchanged;
8.  public/published discovery behavior unchanged;
9.  owner path unchanged;
10. list_events scoped to active workspace only.

Multi-org membership is no longer simultaneous multi-org operating
authority. The single-org context lives on `db.sessions[sid]
.active_workspace` and is re-resolved from DB on every request.
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

# Everything the suite inserts is prefixed / marked so peer-suite rows
# are never touched under parallel xdist runs.
TEST_PREFIX = "test-wsscope-"
TEST_MARKER = "_wsscope_test_marker"

# Dedicated test-only user (bcrypted below in a session fixture) so
# peer suites running on other xdist workers cannot race against this
# suite's membership injections. Seed accounts (worker, audience) are
# shared with Step 6B/6C which also inject/clear rows for the same
# user_ids.
SUBJECT_ID = f"{TEST_PREFIX}user"
SUBJECT_EMAIL = f"{TEST_PREFIX}user@okkax.id"
SUBJECT_PASSWORD = "wsscope-test-password-9k2"

# The seed event owned by usr-1 in org-aruna. We use it as Org A so the
# probe has real domain data (brief, budget, etc.) behind it.
ORG_A_ID = "org-aruna"
EVENT_A_ID = "evt-aruna-2026"

ORG_B_ID = f"{TEST_PREFIX}org-b"
EVENT_B_ID = f"{TEST_PREFIX}evt-b"
ORG_FOREIGN_ID = f"{TEST_PREFIX}org-foreign"
EVENT_FOREIGN_ID = f"{TEST_PREFIX}evt-foreign"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _login(email=SUBJECT_EMAIL, pw=SUBJECT_PASSWORD):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _bcrypt(pw: str) -> str:
    import bcrypt
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@pytest.fixture(scope="module", autouse=True)
def _subject_user():
    """Provision the suite-owned subject user (no legacy org_id, no
    peer-suite ownership) once per module. Removed on module teardown."""
    _db.users.delete_many({"id": SUBJECT_ID})
    _db.users.delete_many({"email": SUBJECT_EMAIL})
    _db.users.insert_one({
        "id": SUBJECT_ID, "email": SUBJECT_EMAIL,
        "password_hash": _bcrypt(SUBJECT_PASSWORD),
        "name": "Workspace Scope Subject",
        "roles": ["organizer"], "org_id": None,
        "onboarded": True, "suspended": False,
    })
    yield
    _db.users.delete_many({"id": SUBJECT_ID})
    _db.users.delete_many({"email": SUBJECT_EMAIL})


def _sid_of(tok):
    import base64, json
    return json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))["sid"]


def _seed_org(org_id, name=None):
    _db.organizations.update_one(
        {"id": org_id},
        {"$set": {"id": org_id, "name": name or f"Org {org_id}",
                  "org_type": "Test", "city": "Nowhere", "verified": False}},
        upsert=True,
    )


def _seed_event(event_id, org_id, *, status="published", owner_id="usr-does-not-exist"):
    _db.events.insert_one({
        "id": event_id, "event_code": f"TEST-{event_id[-6:]}",
        "name": f"Test Event {event_id}", "event_type": "Concert",
        "city": "Nowhere", "start_date": "2027-01-01", "end_date": "2027-01-01",
        "owner_user_id": owner_id, "organizer_org_id": org_id,
        "status": status, "is_demo": False, "deleted": False, "capacity": 100,
    })


def _inject_membership(user_id, org_id, role="organizer", status="active"):
    _db.organization_members.delete_many({"user_id": user_id, "organization_id": org_id})
    _db.organization_members.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id, "organization_id": org_id,
        "role": role, "status": status,
        "created_at": "2026-08-15T00:00:00Z",
        TEST_MARKER: True,
    })


def _activate(tok, org_id, role):
    return requests.post(f"{API}/me/workspace/activate",
                         json={"organization_id": org_id, "role": role},
                         headers=_h(tok), timeout=10)


@pytest.fixture(autouse=True)
def _cleanup():
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


# ============================================================
# THE EMPIRICAL CROSS-ORG PROBE (was 200 before this task; now 403)
# ============================================================

def test_cross_org_probe_multi_membership_workspace_B_blocks_org_A():
    """usr-8 is an ACTIVE member of both Org A (org-aruna) and a test-
    only Org B, and has activated Org B on this session. Requesting
    Org A's private brief must be 403. Phase 01 invariant."""
    _seed_org(ORG_B_ID, "Probe Org B")
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    _inject_membership(SUBJECT_ID, ORG_B_ID, role="organizer")

    tok = _login()
    assert _activate(tok, ORG_B_ID, "organizer").status_code == 200

    for surface in ("brief", "command-center", "budget", "graph"):
        r = requests.get(f"{API}/events/{EVENT_A_ID}/{surface}",
                         headers=_h(tok), timeout=10)
        assert r.status_code == 403, \
            f"{surface} leaked to Org B workspace holder (was {r.status_code})"


# ============================================================
# 1 + 2. Membership only unlocks the workspace that is ACTIVE
# ============================================================

def test_org_A_workspace_grants_org_A_private_access():
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    tok = _login()
    assert _activate(tok, ORG_A_ID, "organizer").status_code == 200
    r = requests.get(f"{API}/events/{EVENT_A_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text


# ============================================================
# 3. Switch A -> B: A's authority ineffective on the next request
# ============================================================

def test_switch_A_to_B_immediately_drops_A_authority():
    _seed_org(ORG_B_ID)
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    _inject_membership(SUBJECT_ID, ORG_B_ID, role="organizer")

    tok = _login()
    _activate(tok, ORG_A_ID, "organizer")
    # Sanity. while A is active, A works.
    assert requests.get(f"{API}/events/{EVENT_A_ID}/brief",
                        headers=_h(tok), timeout=10).status_code == 200

    _activate(tok, ORG_B_ID, "organizer")
    # A must fail immediately on the very next request.
    r = requests.get(f"{API}/events/{EVENT_A_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


# ============================================================
# 4. Personal workspace grants no org authority
# ============================================================

def test_personal_workspace_yields_no_org_authority():
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    tok = _login()
    # Explicitly activate PERSONAL (organization_id=None).
    assert requests.post(
        f"{API}/me/workspace/activate",
        json={"organization_id": None, "role": "audience"},
        headers=_h(tok), timeout=10,
    ).status_code == 200
    r = requests.get(f"{API}/events/{EVENT_A_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


# ============================================================
# 5. Membership revoked mid-session -> denied
# ============================================================

def test_membership_revoked_after_activation_blocks_subsequent_requests():
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    tok = _login()
    _activate(tok, ORG_A_ID, "organizer")
    assert requests.get(f"{API}/events/{EVENT_A_ID}/brief",
                        headers=_h(tok), timeout=10).status_code == 200
    # Revoke out-of-band.
    _db.organization_members.update_many(
        {"user_id": SUBJECT_ID, "organization_id": ORG_A_ID},
        {"$set": {"status": "revoked"}},
    )
    r = requests.get(f"{API}/events/{EVENT_A_ID}/brief", headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text


# ============================================================
# 6. Role changed after activation -> current DB role used
# ============================================================

def test_role_change_after_activation_uses_current_db_role():
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    tok = _login()
    _activate(tok, ORG_A_ID, "organizer")
    _db.organization_members.update_many(
        {"user_id": SUBJECT_ID, "organization_id": ORG_A_ID},
        {"$set": {"role": "finance_approver"}},
    )
    # The role changed, but they remain a member of Org A. the
    # workspace context still resolves to Org A with the NEW role.
    active = requests.get(f"{API}/me/workspace/active",
                          headers=_h(tok), timeout=10).json()["workspace"]
    assert active["role"] == "finance_approver"
    # And private access still passes because Org A is the active workspace.
    assert requests.get(f"{API}/events/{EVENT_A_ID}/brief",
                        headers=_h(tok), timeout=10).status_code == 200


# ============================================================
# 7. Admin path unchanged
# ============================================================

def test_admin_access_unchanged_regardless_of_workspace():
    tok = requests.post(f"{API}/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                        timeout=10).json()["token"]
    r = requests.get(f"{API}/events/{EVENT_A_ID}/command-center",
                     headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text


# ============================================================
# 8. Public discovery behavior unchanged
# ============================================================

def test_public_discovery_and_published_endpoints_unchanged():
    # Discover feed (no auth).
    assert requests.get(f"{API}/discover/events", timeout=10).status_code == 200
    # Public event card (no auth).
    assert requests.get(f"{API}/public/events/{EVENT_A_ID}",
                        timeout=10).status_code == 200
    # Published sub-resources remain unauth-readable.
    for surface in ("ticket-tiers", "sponsor-packages", "tenant-zones"):
        assert requests.get(f"{API}/events/{EVENT_A_ID}/{surface}",
                            timeout=10).status_code == 200


# ============================================================
# 9. Owner path unchanged
# ============================================================

def test_owner_path_unchanged_without_workspace_activation():
    """usr-1 owns evt-aruna-2026. Owner authority is orthogonal to
    workspace scope by explicit existing policy. no activation
    required, and owner privilege is NOT expanded."""
    tok = requests.post(f"{API}/auth/login",
                        json={"email": "organizer@okkax.id", "password": DEMO_PASSWORD},
                        timeout=10).json()["token"]
    # Without any /workspace/activate call.
    assert requests.get(f"{API}/events/{EVENT_A_ID}/brief",
                        headers=_h(tok), timeout=10).status_code == 200


# ============================================================
# 10. list_events scoped to active workspace only
# ============================================================

def test_list_events_scoped_to_active_workspace_only():
    _seed_org(ORG_B_ID)
    _seed_event(EVENT_B_ID, ORG_B_ID)
    _inject_membership(SUBJECT_ID, ORG_A_ID, role="organizer")
    _inject_membership(SUBJECT_ID, ORG_B_ID, role="organizer")
    tok = _login()

    _activate(tok, ORG_A_ID, "organizer")
    ids = {e["id"] for e in requests.get(f"{API}/events",
                                          headers=_h(tok), timeout=10).json()["items"]}
    assert EVENT_A_ID in ids
    assert EVENT_B_ID not in ids

    _activate(tok, ORG_B_ID, "organizer")
    ids = {e["id"] for e in requests.get(f"{API}/events",
                                          headers=_h(tok), timeout=10).json()["items"]}
    assert EVENT_B_ID in ids
    assert EVENT_A_ID not in ids


# ============================================================
# Legacy scalar `user.org_id` is a SINGLE-ORG bridge, not a
# simultaneous-authority hole
# ============================================================

def test_legacy_org_id_grants_only_that_one_org_without_activation():
    """finance@okkax.id has `user.org_id=org-aruna` and no membership
    rows. With no active workspace, they still reach Org A private
    data via the transitional legacy fallback. but they have NO way
    to reach any other org because they hold no memberships in
    others."""
    tok = requests.post(f"{API}/auth/login",
                        json={"email": "finance@okkax.id", "password": DEMO_PASSWORD},
                        timeout=10).json()["token"]
    assert requests.get(f"{API}/events/{EVENT_A_ID}/brief",
                        headers=_h(tok), timeout=10).status_code == 200
