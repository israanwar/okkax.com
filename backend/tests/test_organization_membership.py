"""Organization membership foundation tests (STEP 4).

Verifies:
- validation helper `_validate_membership_input` accepts every OKKAX
  ROLE_KEYS role and status ``"active"``, rejects everything else;
- the compound unique index on ``(user_id, organization_id)`` prevents
  duplicates at the database level;
- a user can join more than one organization;
- an organization can have more than one member;
- adding memberships never touches the legacy ``user.role`` / ``user.roles``
  fields (additive-only guarantee);
- acceptance gate: user_001 → org_aruna (organizer) + org_brand_xyz
  (sponsor) works, with legacy identity preserved.
"""

import os
from pathlib import Path

import pymongo
import pytest
from dotenv import load_dotenv
from pymongo.errors import DuplicateKeyError

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from server import (MEMBERSHIP_STATUSES, ROLE_KEYS, _validate_membership_input,  # noqa: E402
                    nid, now_iso)

_client = pymongo.MongoClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]

# Belt-and-braces: make sure the compound unique index exists before running
# the tests in case the backend startup hook has not run in this DB yet.
_db.organization_members.create_index(
    [("user_id", 1), ("organization_id", 1)], unique=True, name="uniq_user_org"
)

USER_A = "test-step4-user-a"
USER_B = "test-step4-user-b"
ORG_A = "test-step4-org-a"
ORG_B = "test-step4-org-b"
ACCEPTANCE_USER = "test-step4-user_001"
ACCEPTANCE_ORG_1 = "test-step4-org-aruna"
ACCEPTANCE_ORG_2 = "test-step4-org-brand-xyz"


def _wipe():
    for uid in (USER_A, USER_B, ACCEPTANCE_USER):
        _db.organization_members.delete_many({"user_id": uid})
        _db.users.delete_many({"id": uid})
    for oid in (ORG_A, ORG_B, ACCEPTANCE_ORG_1, ACCEPTANCE_ORG_2):
        _db.organization_members.delete_many({"organization_id": oid})


@pytest.fixture(autouse=True)
def _cleanup():
    _wipe()
    yield
    _wipe()


def _insert_membership(user_id: str, org_id: str, role: str = "organizer",
                       status: str = "active") -> dict:
    doc = {
        "id": nid(),
        "user_id": user_id,
        "organization_id": org_id,
        "role": role,
        "status": status,
        "created_at": now_iso(),
    }
    _db.organization_members.insert_one(dict(doc))
    return doc


# ------------------------------------------------------------ validation

def test_valid_role_and_active_status_passes():
    _validate_membership_input(role="organizer", status="active")


def test_invalid_role_raises_value_error():
    with pytest.raises(ValueError, match="Invalid membership role"):
        _validate_membership_input(role="not_a_role", status="active")


def test_invalid_status_raises_value_error():
    with pytest.raises(ValueError, match="Invalid membership status"):
        _validate_membership_input(role="organizer", status="not_a_status")


def test_every_role_key_accepted_as_membership_role():
    for role in ROLE_KEYS:
        _validate_membership_input(role=role, status="active")


def test_membership_statuses_contains_active():
    assert "active" in MEMBERSHIP_STATUSES


# ------------------------------------------------------------ multi-org / multi-member

def test_user_can_join_multiple_organizations():
    _insert_membership(USER_A, ORG_A, role="organizer")
    _insert_membership(USER_A, ORG_B, role="sponsor")
    memberships = list(_db.organization_members.find({"user_id": USER_A}, {"_id": 0}))
    assert len(memberships) == 2
    role_by_org = {m["organization_id"]: m["role"] for m in memberships}
    assert role_by_org == {ORG_A: "organizer", ORG_B: "sponsor"}


def test_organization_can_have_multiple_members():
    _insert_membership(USER_A, ORG_A, role="organizer")
    _insert_membership(USER_B, ORG_A, role="finance_approver")
    members = list(_db.organization_members.find({"organization_id": ORG_A}, {"_id": 0}))
    assert len(members) == 2
    role_by_user = {m["user_id"]: m["role"] for m in members}
    assert role_by_user == {USER_A: "organizer", USER_B: "finance_approver"}


def test_user_can_hold_different_roles_across_different_orgs():
    """The same user can be `organizer` in one org and `sponsor` in another."""
    _insert_membership(USER_A, ORG_A, role="organizer")
    _insert_membership(USER_A, ORG_B, role="sponsor")
    a = _db.organization_members.find_one(
        {"user_id": USER_A, "organization_id": ORG_A}, {"_id": 0, "role": 1}
    )
    b = _db.organization_members.find_one(
        {"user_id": USER_A, "organization_id": ORG_B}, {"_id": 0, "role": 1}
    )
    assert a["role"] == "organizer"
    assert b["role"] == "sponsor"


# ------------------------------------------------------------ uniqueness

def test_duplicate_user_org_pair_is_rejected_by_unique_index():
    _insert_membership(USER_A, ORG_A, role="organizer")
    with pytest.raises(DuplicateKeyError):
        _insert_membership(USER_A, ORG_A, role="sponsor")


def test_duplicate_pair_rejected_even_with_different_role():
    """`(user_id, organization_id)` is the composite key; role does not
    participate in uniqueness, so a second membership with a different role
    is still a duplicate."""
    _insert_membership(USER_A, ORG_A, role="organizer")
    with pytest.raises(DuplicateKeyError):
        _insert_membership(USER_A, ORG_A, role="finance_approver")


# ------------------------------------------------------------ legacy identity untouched

def test_adding_memberships_does_not_touch_user_role_or_roles():
    """Membership is additive: `user.role` and `user.roles` remain untouched."""
    _db.users.insert_one({
        "id": USER_A, "email": f"{USER_A}@example.com",
        "roles": ["organizer"], "role": "organizer",
        "name": "Test User", "onboarded": True,
    })
    baseline = _db.users.find_one(
        {"id": USER_A}, {"_id": 0, "roles": 1, "role": 1}
    )

    _insert_membership(USER_A, ORG_A, role="organizer")
    _insert_membership(USER_A, ORG_B, role="sponsor")

    after = _db.users.find_one(
        {"id": USER_A}, {"_id": 0, "roles": 1, "role": 1}
    )
    assert after == baseline


def test_existing_single_role_account_still_works():
    """A legacy single-role user (roles=['organizer']) still exists with zero
    memberships and its identity is not modified."""
    _db.users.insert_one({
        "id": USER_A, "email": f"{USER_A}@example.com",
        "roles": ["organizer"],
        "name": "Legacy Single Role",
    })
    memberships = list(_db.organization_members.find({"user_id": USER_A}))
    assert memberships == []
    user = _db.users.find_one({"id": USER_A}, {"_id": 0, "roles": 1})
    assert user["roles"] == ["organizer"]


# ------------------------------------------------------------ acceptance gate

def test_acceptance_gate_multi_org_relationship():
    """user_001 → org_aruna (organizer) + org_brand_xyz (sponsor)."""
    _db.users.insert_one({
        "id": ACCEPTANCE_USER, "email": f"{ACCEPTANCE_USER}@example.com",
        "roles": ["organizer"], "name": "Acceptance User",
    })
    baseline_user = _db.users.find_one(
        {"id": ACCEPTANCE_USER}, {"_id": 0, "roles": 1, "role": 1}
    )

    _insert_membership(ACCEPTANCE_USER, ACCEPTANCE_ORG_1, role="organizer")
    _insert_membership(ACCEPTANCE_USER, ACCEPTANCE_ORG_2, role="sponsor")

    memberships = list(_db.organization_members.find(
        {"user_id": ACCEPTANCE_USER}, {"_id": 0}
    ))
    assert len(memberships) == 2
    by_org = {m["organization_id"]: m for m in memberships}
    assert by_org[ACCEPTANCE_ORG_1]["role"] == "organizer"
    assert by_org[ACCEPTANCE_ORG_2]["role"] == "sponsor"
    assert by_org[ACCEPTANCE_ORG_1]["status"] == "active"
    assert by_org[ACCEPTANCE_ORG_2]["status"] == "active"

    # Legacy identity untouched.
    after_user = _db.users.find_one(
        {"id": ACCEPTANCE_USER}, {"_id": 0, "roles": 1, "role": 1}
    )
    assert after_user == baseline_user
