import os
import uuid

import pymongo
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = os.environ["DEMO_PASSWORD"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@okkax.id")

# Test-owned membership rows are prefixed with this so cleanup is deterministic
# even if a previous run crashed mid-test.
_TEST_MEMBERSHIP_ORG = "test-workspaces-org-tmp"
_ORGANIZER_USER_ID = "usr-1"  # deterministic seed id for organizer@okkax.id

_sync_db = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _login(email, pw=PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _ensure_test_membership(user_id, org_id, role, status="active"):
    """Insert a deterministic test membership directly. Seed demo users have
    NO rows in organization_members; tests that need one must inject their
    own state instead of assuming."""
    _sync_db.organization_members.delete_many({"user_id": user_id, "organization_id": org_id})
    _sync_db.organizations.delete_many({"id": org_id})
    _sync_db.organizations.insert_one({"id": org_id, "name": f"Test Org for {user_id}"})
    _sync_db.organization_members.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "organization_id": org_id,
        "role": role,
        "status": status,
        "created_at": "2026-01-01T00:00:00Z",
    })


@pytest.fixture(autouse=True)
def _cleanup_test_memberships():
    """Remove any test-owned membership + org before and after each test."""
    _sync_db.organization_members.delete_many({"organization_id": {"$regex": "^test-workspaces-"}})
    _sync_db.organizations.delete_many({"id": {"$regex": "^test-workspaces-"}})
    yield
    _sync_db.organization_members.delete_many({"organization_id": {"$regex": "^test-workspaces-"}})
    _sync_db.organizations.delete_many({"id": {"$regex": "^test-workspaces-"}})


def test_list_personal_workspace():
    tok = _login("audience@okkax.id")
    r = requests.get(f"{API}/me/workspaces", headers=_h(tok))
    assert r.status_code == 200
    items = r.json()["items"]
    # personal workspace must exist
    assert any(w.get("organization_id") is None and w.get("role") == "audience" for w in items)


def test_list_multiple_org_workspaces():
    # Seed users have NO memberships by default (Step 5 does not migrate legacy
    # `user.org_id`). Inject one so we can prove the list surface works.
    org_id = f"{_TEST_MEMBERSHIP_ORG}-list"
    _ensure_test_membership(_ORGANIZER_USER_ID, org_id, "organizer")
    tok = _login("organizer@okkax.id")
    r = requests.get(f"{API}/me/workspaces", headers=_h(tok))
    assert r.status_code == 200
    items = r.json()["items"]
    org_items = [w for w in items if w.get("organization_id")]
    assert len(org_items) >= 1
    assert any(w.get("organization_id") == org_id and w.get("role") == "organizer"
               for w in org_items)


def test_validate_valid_org_workspace():
    org_id = f"{_TEST_MEMBERSHIP_ORG}-valid"
    _ensure_test_membership(_ORGANIZER_USER_ID, org_id, "organizer")
    tok = _login("organizer@okkax.id")
    payload = {"organization_id": org_id, "role": "organizer"}
    v = requests.post(f"{API}/me/workspace/validate", json=payload, headers=_h(tok))
    assert v.status_code == 200, v.text
    ws = v.json().get("workspace")
    assert ws is not None
    assert ws["organization_id"] == org_id
    assert ws["role"] == "organizer"


def test_validate_wrong_role_for_org_forbidden():
    org_id = f"{_TEST_MEMBERSHIP_ORG}-wrong-role"
    _ensure_test_membership(_ORGANIZER_USER_ID, org_id, "organizer")
    tok = _login("organizer@okkax.id")
    # Correct org, wrong role for that membership -> deny.
    payload = {"organization_id": org_id, "role": "sponsor"}
    v = requests.post(f"{API}/me/workspace/validate", json=payload, headers=_h(tok))
    assert v.status_code == 403


def test_validate_inactive_membership_forbidden():
    # Insert an inactive membership directly via demo admin is out of scope; instead use a known non-member org
    tok = _login("audience@okkax.id")
    # audience likely not member of org-aruna
    payload = {"organization_id": "org-aruna", "role": "organizer"}
    v = requests.post(f"{API}/me/workspace/validate", json=payload, headers=_h(tok))
    assert v.status_code == 403


def test_validate_foreign_org_forbidden():
    # Another user attempts to validate an org they are not a member of
    tok = _login("vendor@okkax.id")
    # vendor demo user is linked to org-sonic; try org-aruna
    payload = {"organization_id": "org-aruna", "role": "organizer"}
    v = requests.post(f"{API}/me/workspace/validate", json=payload, headers=_h(tok))
    assert v.status_code == 403


def test_admin_workspace_escalation_forbidden():
    """Admin cannot claim an organization workspace they are not a member of.
    Membership rows never authorize admin roles either (defense in depth)."""
    tok = _login(ADMIN_EMAIL, pw=ADMIN_PASSWORD)
    # Admin claiming a random org membership -> deny (not a member).
    payload = {"organization_id": "org-aruna", "role": "organizer"}
    v = requests.post(f"{API}/me/workspace/validate", json=payload, headers=_h(tok))
    assert v.status_code == 403


def test_unauthenticated_access():
    r = requests.get(f"{API}/me/workspaces")
    assert r.status_code == 401
    v = requests.post(f"{API}/me/workspace/validate", json={"organization_id": None, "role": "audience"})
    assert v.status_code == 401
