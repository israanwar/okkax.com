"""Step 6C P1 hardening tests.

Covers the three P1 findings from the Step 6A audit:

- **Admin privilege escalation** (`admin_patch_user`). server-side
  hierarchy validation: only `super_admin` may grant/revoke admin
  roles or suspend an existing administrator. `platform_admin`
  handles day-to-day user admin without being able to elevate
  peers or self via the `roles` payload.
- **Multi-org event scope** (`GET /api/events`). a user with active
  membership in more than one organization sees events from every
  org they belong to. Legacy scalar `user.org_id` continues to work
  as a backward-compatible fallback. Foreign-org events remain
  hidden.
- **Draft commercial data leak** (`sponsor-packages`, `tenant-zones`,
  `ticket-tiers`). draft events answered with 404 for
  unauthenticated/foreign callers; owner/admin/member still see
  their own draft.
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

# Every fixture inserted by this suite carries this prefix or marker so
# concurrent xdist workers do not race with peer suites.
TEST_PREFIX = "test-step6c-"
TEST_MARKER = "_step6c_test_marker"

PLATFORM_ADMIN_ID = f"{TEST_PREFIX}usr-platform-admin"
PLATFORM_ADMIN_EMAIL = f"{TEST_PREFIX}platadmin@okkax.id"
PLATFORM_ADMIN_PASSWORD = "PlatformAdmin!123-step6c"

TARGET_USER_ID = f"{TEST_PREFIX}usr-target"
TARGET_USER_EMAIL = f"{TEST_PREFIX}target@okkax.id"

TARGET_ADMIN_ID = f"{TEST_PREFIX}usr-target-admin"
TARGET_ADMIN_EMAIL = f"{TEST_PREFIX}target-admin@okkax.id"

MULTI_ORG_USER_ID = "usr-8"           # worker@okkax.id. no legacy org
MULTI_ORG_USER_EMAIL = "worker@okkax.id"
ORG_A_ID = f"{TEST_PREFIX}org-a"
ORG_B_ID = f"{TEST_PREFIX}org-b"
ORG_FOREIGN_ID = f"{TEST_PREFIX}org-foreign"
EVENT_A_ID = f"{TEST_PREFIX}evt-a"
EVENT_B_ID = f"{TEST_PREFIX}evt-b"
EVENT_FOREIGN_ID = f"{TEST_PREFIX}evt-foreign"

DRAFT_EVENT_ID = f"{TEST_PREFIX}evt-draft"
DRAFT_EVENT_ORG_ID = f"{TEST_PREFIX}org-draft"


# ------------------------------------------------------------ helpers

def _login(email, pw=DEMO_PASSWORD):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _bcrypt(pw):
    # Import lazily so pymongo is not forced onto the test-collection path.
    import bcrypt
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _wipe():
    _db.users.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.organizations.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.events.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.ticket_tiers.delete_many({"event_id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.sponsor_packages.delete_many({"event_id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.tenant_zones.delete_many({"event_id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.booth_slots.delete_many({"event_id": {"$regex": f"^{TEST_PREFIX}"}})
    _db.organization_members.delete_many({TEST_MARKER: True})
    _db.organization_members.delete_many({"organization_id": {"$regex": f"^{TEST_PREFIX}"}})


def _seed_platform_admin():
    _db.users.insert_one({
        "id": PLATFORM_ADMIN_ID,
        "email": PLATFORM_ADMIN_EMAIL,
        "password_hash": _bcrypt(PLATFORM_ADMIN_PASSWORD),
        "name": "Test Platform Admin",
        "roles": ["platform_admin"],
        "role": "platform_admin",
        "onboarded": True,
    })


def _seed_target(user_id, email, roles):
    _db.users.insert_one({
        "id": user_id, "email": email,
        "password_hash": _bcrypt("unused"),
        "name": "Test Target", "roles": list(roles),
        "onboarded": True,
    })


def _seed_event(event_id, org_id, status="published", is_demo=False, owner_id=None):
    _db.organizations.update_one(
        {"id": org_id},
        {"$set": {"id": org_id, "name": f"Org {org_id}", "org_type": "Test",
                  "city": "Nowhere", "verified": False}},
        upsert=True,
    )
    _db.events.insert_one({
        "id": event_id, "event_code": f"TEST-{event_id[-6:]}",
        "name": f"Test Event {event_id}", "event_type": "Concert",
        "city": "Nowhere", "start_date": "2027-01-01", "end_date": "2027-01-01",
        "owner_user_id": owner_id or "usr-does-not-exist",
        "organizer_org_id": org_id, "status": status, "is_demo": is_demo,
        "deleted": False, "capacity": 100,
    })


def _inject_membership(user_id, org_id, role="organizer"):
    _db.organization_members.delete_many({"user_id": user_id, "organization_id": org_id})
    _db.organization_members.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id, "organization_id": org_id,
        "role": role, "status": "active",
        "created_at": "2026-08-15T00:00:00Z",
        TEST_MARKER: True,
    })


@pytest.fixture(autouse=True)
def _cleanup():
    _wipe()
    yield
    _wipe()


# ================================================================
# 1. ADMIN PRIVILEGE ESCALATION
# ================================================================

def test_platform_admin_cannot_grant_super_admin():
    """`platform_admin` attempting to set target's roles to ['super_admin']
    must be rejected 403 with server-side hierarchy check. client claim
    in the roles payload is never authoritative."""
    _seed_platform_admin()
    _seed_target(TARGET_USER_ID, TARGET_USER_EMAIL, ["organizer"])

    tok = _login(PLATFORM_ADMIN_EMAIL, pw=PLATFORM_ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_USER_ID}",
                       json={"roles": ["super_admin"]}, headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    # Target's roles must remain unchanged.
    target = _db.users.find_one({"id": TARGET_USER_ID}, {"_id": 0, "roles": 1})
    assert target["roles"] == ["organizer"]


def test_platform_admin_cannot_grant_platform_admin():
    """Same escalation blocked for the peer tier."""
    _seed_platform_admin()
    _seed_target(TARGET_USER_ID, TARGET_USER_EMAIL, ["organizer"])

    tok = _login(PLATFORM_ADMIN_EMAIL, pw=PLATFORM_ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_USER_ID}",
                       json={"roles": ["platform_admin"]}, headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    target = _db.users.find_one({"id": TARGET_USER_ID}, {"_id": 0, "roles": 1})
    assert target["roles"] == ["organizer"]


def test_platform_admin_cannot_demote_existing_admin():
    """Even a non-admin new role fails when the target is currently an
    admin. only super_admin may mutate an administrator's roles."""
    _seed_platform_admin()
    _seed_target(TARGET_ADMIN_ID, TARGET_ADMIN_EMAIL, ["platform_admin"])

    tok = _login(PLATFORM_ADMIN_EMAIL, pw=PLATFORM_ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_ADMIN_ID}",
                       json={"roles": ["organizer"]}, headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    target = _db.users.find_one({"id": TARGET_ADMIN_ID}, {"_id": 0, "roles": 1})
    assert target["roles"] == ["platform_admin"]


def test_platform_admin_cannot_suspend_admin():
    _seed_platform_admin()
    _seed_target(TARGET_ADMIN_ID, TARGET_ADMIN_EMAIL, ["platform_admin"])

    tok = _login(PLATFORM_ADMIN_EMAIL, pw=PLATFORM_ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_ADMIN_ID}",
                       json={"suspended": True}, headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    target = _db.users.find_one({"id": TARGET_ADMIN_ID}, {"_id": 0, "suspended": 1})
    assert not target.get("suspended")


def test_platform_admin_can_update_non_admin_user():
    """Sanity. legitimate day-to-day admin work still works."""
    _seed_platform_admin()
    _seed_target(TARGET_USER_ID, TARGET_USER_EMAIL, ["organizer"])

    tok = _login(PLATFORM_ADMIN_EMAIL, pw=PLATFORM_ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_USER_ID}",
                       json={"roles": ["sponsor"]}, headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    target = _db.users.find_one({"id": TARGET_USER_ID}, {"_id": 0, "roles": 1})
    assert target["roles"] == ["sponsor"]


def test_super_admin_can_grant_admin_roles():
    """Seed admin (`admin.local@okkax.id`) is super_admin. Sanity ,
    super_admin path is not blocked by the new hierarchy check."""
    _seed_target(TARGET_USER_ID, TARGET_USER_EMAIL, ["organizer"])
    tok = _login(ADMIN_EMAIL, pw=ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_USER_ID}",
                       json={"roles": ["platform_admin"]}, headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    target = _db.users.find_one({"id": TARGET_USER_ID}, {"_id": 0, "roles": 1})
    assert target["roles"] == ["platform_admin"]


def test_super_admin_can_suspend_admin():
    _seed_target(TARGET_ADMIN_ID, TARGET_ADMIN_EMAIL, ["platform_admin"])
    tok = _login(ADMIN_EMAIL, pw=ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{TARGET_ADMIN_ID}",
                       json={"suspended": True}, headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    target = _db.users.find_one({"id": TARGET_ADMIN_ID}, {"_id": 0, "suspended": 1})
    assert target.get("suspended") is True


def test_platform_admin_self_elevate_via_payload_blocked():
    """Direct self-elevation: platform_admin patches its OWN account with
    roles=['super_admin']. The check that blocks 'grant admin' also
    catches this because it is agnostic to actor==target."""
    _seed_platform_admin()
    tok = _login(PLATFORM_ADMIN_EMAIL, pw=PLATFORM_ADMIN_PASSWORD)
    r = requests.patch(f"{API}/admin/users/{PLATFORM_ADMIN_ID}",
                       json={"roles": ["super_admin"]}, headers=_h(tok), timeout=10)
    assert r.status_code == 403, r.text
    me = _db.users.find_one({"id": PLATFORM_ADMIN_ID}, {"_id": 0, "roles": 1})
    assert me["roles"] == ["platform_admin"]


# ================================================================
# 2. MULTI-ORG EVENT SCOPE
# ================================================================

def test_events_scope_follows_active_workspace_not_all_memberships():
    """Phase 01 Active Workspace Scope Enforcement (supersedes the
    Step 6C multi-membership-union semantic): a user with active
    memberships in Org A AND Org B sees ONLY the events of whichever
    workspace they have currently activated. Switching workspaces
    switches the visible scope; the two memberships never grant
    simultaneous authority."""
    _seed_event(EVENT_A_ID, ORG_A_ID, status="published")
    _seed_event(EVENT_B_ID, ORG_B_ID, status="published")
    _seed_event(EVENT_FOREIGN_ID, ORG_FOREIGN_ID, status="published")
    _inject_membership(MULTI_ORG_USER_ID, ORG_A_ID, role="organizer")
    _inject_membership(MULTI_ORG_USER_ID, ORG_B_ID, role="finance_approver")

    tok = _login(MULTI_ORG_USER_EMAIL)

    # Activate Org A -> only Org A's event visible.
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_A_ID, "role": "organizer"},
                  headers=_h(tok), timeout=10)
    ids_a = {e["id"] for e in
             requests.get(f"{API}/events", headers=_h(tok), timeout=10).json()["items"]}
    assert EVENT_A_ID in ids_a
    assert EVENT_B_ID not in ids_a, "Org B event visible while workspace = Org A"
    assert EVENT_FOREIGN_ID not in ids_a

    # Switch to Org B -> only Org B's event visible.
    requests.post(f"{API}/me/workspace/activate",
                  json={"organization_id": ORG_B_ID, "role": "finance_approver"},
                  headers=_h(tok), timeout=10)
    ids_b = {e["id"] for e in
             requests.get(f"{API}/events", headers=_h(tok), timeout=10).json()["items"]}
    assert EVENT_B_ID in ids_b
    assert EVENT_A_ID not in ids_b, "Org A event still visible after switching to Org B"
    assert EVENT_FOREIGN_ID not in ids_b


def test_legacy_user_org_id_still_scoped():
    """finance@okkax.id has legacy `user.org_id=org-aruna` but zero
    memberships. It must still see org-aruna events, so the legacy
    fallback path is preserved during the migration window."""
    tok = _login("finance@okkax.id")
    r = requests.get(f"{API}/events", headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    ids = {e["id"] for e in r.json()["items"]}
    # evt-aruna-2026 is the seed org-aruna event
    assert "evt-aruna-2026" in ids


def test_events_query_is_batch_not_n_plus_one():
    """Sanity. the endpoint must not issue a per-event membership
    query. Approximation: with two membership rows and three events,
    the wall time stays modest and no error surfaces even when the
    org set is large."""
    for i in range(5):
        _inject_membership(MULTI_ORG_USER_ID, f"{TEST_PREFIX}org-batch-{i}",
                           role="organizer")
    tok = _login(MULTI_ORG_USER_EMAIL)
    r = requests.get(f"{API}/events", headers=_h(tok), timeout=5)
    assert r.status_code == 200, r.text


# ================================================================
# 3. DRAFT COMMERCIAL DATA LEAK
# ================================================================

def _seed_draft_sub_resources():
    _seed_event(DRAFT_EVENT_ID, DRAFT_EVENT_ORG_ID, status="draft")
    _db.ticket_tiers.insert_one({
        "id": f"{TEST_PREFIX}tier-draft",
        "event_id": DRAFT_EVENT_ID,
        "name": "Early Bird (leaked?)", "price": 150000,
        "quantity": 100, "sold": 0, "active": True,
    })
    _db.sponsor_packages.insert_one({
        "id": f"{TEST_PREFIX}pkg-draft",
        "event_id": DRAFT_EVENT_ID,
        "name": "Main Sponsor (leaked?)", "tier": "Main",
        "price": 200_000_000, "quantity": 1, "sold": 0,
    })
    _db.tenant_zones.insert_one({
        "id": f"{TEST_PREFIX}zone-draft",
        "event_id": DRAFT_EVENT_ID,
        "name": "Food Court (leaked?)", "category": "F&B",
    })


def test_draft_ticket_tiers_not_public():
    _seed_draft_sub_resources()
    r = requests.get(f"{API}/events/{DRAFT_EVENT_ID}/ticket-tiers", timeout=10)
    assert r.status_code == 404, r.text


def test_draft_sponsor_packages_not_public():
    _seed_draft_sub_resources()
    r = requests.get(f"{API}/events/{DRAFT_EVENT_ID}/sponsor-packages", timeout=10)
    assert r.status_code == 404, r.text


def test_draft_tenant_zones_not_public():
    _seed_draft_sub_resources()
    r = requests.get(f"{API}/events/{DRAFT_EVENT_ID}/tenant-zones", timeout=10)
    assert r.status_code == 404, r.text


def test_draft_leak_blocked_for_authenticated_foreign_user():
    """Authenticated caller with no relation to the draft event still
    gets 404. 403 would confirm the id exists."""
    _seed_draft_sub_resources()
    tok = _login("audience@okkax.id")
    for surface in ("ticket-tiers", "sponsor-packages", "tenant-zones"):
        r = requests.get(f"{API}/events/{DRAFT_EVENT_ID}/{surface}",
                         headers=_h(tok), timeout=10)
        assert r.status_code == 404, f"{surface}: {r.text}"


def test_draft_sub_resources_visible_to_admin():
    _seed_draft_sub_resources()
    tok = _login(ADMIN_EMAIL, pw=ADMIN_PASSWORD)
    for surface in ("ticket-tiers", "sponsor-packages", "tenant-zones"):
        r = requests.get(f"{API}/events/{DRAFT_EVENT_ID}/{surface}",
                         headers=_h(tok), timeout=10)
        assert r.status_code == 200, f"{surface}: {r.text}"


def test_draft_sub_resources_visible_to_owner():
    """Owner of a draft event must still see their own tiers/packages/
    zones while composing the event."""
    _seed_event(DRAFT_EVENT_ID, DRAFT_EVENT_ORG_ID,
                status="draft", owner_id="usr-1")  # usr-1 = organizer@okkax.id
    _db.ticket_tiers.insert_one({
        "id": f"{TEST_PREFIX}tier-draft-owner", "event_id": DRAFT_EVENT_ID,
        "name": "VIP", "price": 500000, "quantity": 10, "sold": 0, "active": True,
    })
    tok = _login("organizer@okkax.id")
    r = requests.get(f"{API}/events/{DRAFT_EVENT_ID}/ticket-tiers",
                     headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    assert any(t["id"] == f"{TEST_PREFIX}tier-draft-owner" for t in r.json()["items"])


def test_published_sub_resources_stay_public():
    """Sanity. the seed published event's ticket tiers / sponsor
    packages / tenant zones must remain readable without auth."""
    seed_event_id = "evt-aruna-2026"
    tiers = requests.get(f"{API}/events/{seed_event_id}/ticket-tiers", timeout=10)
    assert tiers.status_code == 200, tiers.text
    pkgs = requests.get(f"{API}/events/{seed_event_id}/sponsor-packages", timeout=10)
    assert pkgs.status_code == 200, pkgs.text
    zones = requests.get(f"{API}/events/{seed_event_id}/tenant-zones", timeout=10)
    assert zones.status_code == 200, zones.text
