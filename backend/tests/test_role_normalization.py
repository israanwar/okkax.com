"""Tests for `_normalize_user_roles` (STEP 3).

Verifies:
- multi-role users keep every valid role;
- duplicates are removed while preserving first-seen order;
- invalid roles are silently dropped;
- the legacy scalar ``role`` field is respected as primary when valid;
- when ``role`` is missing/invalid, the first valid entry in ``roles`` becomes
  primary and moves to the front;
- when both ``role`` and ``roles`` are empty/invalid, primary falls back to
  ``"audience"``;
- normalization is idempotent (applying the returned update and re-running
  yields ``None``);
- the scalar ``role`` field is preserved but not backfilled on accounts that
  never had it.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from server import _normalize_user_roles  # noqa: E402


def _apply(account, update):
    return {**account, **(update or {})}


# ------------------------------------------------------------ no-op cases

def test_single_valid_role_no_change():
    account = {"id": "u", "roles": ["organizer"]}
    assert _normalize_user_roles(account) is None


def test_multi_valid_role_no_change():
    account = {"id": "u", "roles": ["organizer", "sponsor"]}
    assert _normalize_user_roles(account) is None


def test_super_admin_multi_role_preserved():
    """OLD normalization truncated to ['super_admin']. STEP 3 keeps both."""
    account = {"id": "u", "roles": ["super_admin", "organizer"]}
    assert _normalize_user_roles(account) is None


def test_legacy_role_matches_first_no_change():
    account = {"id": "u", "roles": ["organizer", "sponsor"], "role": "organizer"}
    assert _normalize_user_roles(account) is None


# ------------------------------------------------------------ cleanup cases

def test_duplicate_deduped_preserving_order():
    account = {"id": "u", "roles": ["organizer", "organizer", "sponsor", "organizer"]}
    assert _normalize_user_roles(account) == {"roles": ["organizer", "sponsor"]}


def test_invalid_role_dropped():
    account = {"id": "u", "roles": ["organizer", "bogus", "sponsor"]}
    assert _normalize_user_roles(account) == {"roles": ["organizer", "sponsor"]}


def test_all_invalid_defaults_to_audience():
    account = {"id": "u", "roles": ["foo", "bar"]}
    assert _normalize_user_roles(account) == {"roles": ["audience"]}


def test_empty_roles_defaults_to_audience():
    account = {"id": "u", "roles": []}
    assert _normalize_user_roles(account) == {"roles": ["audience"]}


def test_missing_roles_key_defaults_to_audience():
    account = {"id": "u"}
    assert _normalize_user_roles(account) == {"roles": ["audience"]}


# ------------------------------------------------------------ legacy `role`

def test_legacy_role_moves_to_front_of_roles():
    account = {"id": "u", "roles": ["sponsor", "organizer"], "role": "organizer"}
    assert _normalize_user_roles(account) == {"roles": ["organizer", "sponsor"]}


def test_legacy_role_missing_from_list_is_added_as_primary():
    account = {"id": "u", "roles": ["sponsor"], "role": "organizer"}
    assert _normalize_user_roles(account) == {"roles": ["organizer", "sponsor"]}


def test_invalid_legacy_role_is_replaced_by_first_valid_role():
    account = {"id": "u", "roles": ["organizer", "sponsor"], "role": "bogus"}
    assert _normalize_user_roles(account) == {"role": "organizer"}


def test_invalid_legacy_role_and_empty_roles():
    account = {"id": "u", "roles": [], "role": "bogus"}
    assert _normalize_user_roles(account) == {"roles": ["audience"], "role": "audience"}


def test_scalar_role_not_backfilled_when_absent():
    """Accounts that never had ``role`` do not gain one, unless there is
    another reason to rewrite the document."""
    account = {"id": "u", "roles": ["organizer"]}
    update = _normalize_user_roles(account)
    assert update is None or "role" not in update


# ------------------------------------------------------------ idempotency

def test_idempotent_single_role():
    account = {"id": "u", "roles": ["organizer"]}
    first = _normalize_user_roles(account)
    assert first is None
    second = _normalize_user_roles(_apply(account, first))
    assert second is None


def test_idempotent_after_dedupe():
    account = {"id": "u", "roles": ["organizer", "organizer", "sponsor"]}
    first = _normalize_user_roles(account)
    assert first == {"roles": ["organizer", "sponsor"]}
    second = _normalize_user_roles(_apply(account, first))
    assert second is None


def test_idempotent_after_reorder_with_legacy_role():
    account = {"id": "u", "roles": ["sponsor", "organizer"], "role": "organizer"}
    first = _normalize_user_roles(account)
    assert first == {"roles": ["organizer", "sponsor"]}
    second = _normalize_user_roles(_apply(account, first))
    assert second is None


def test_idempotent_after_defaulting_to_audience():
    account = {"id": "u", "roles": []}
    first = _normalize_user_roles(account)
    assert first == {"roles": ["audience"]}
    second = _normalize_user_roles(_apply(account, first))
    assert second is None


def test_idempotent_after_replacing_invalid_legacy():
    account = {"id": "u", "roles": ["organizer", "sponsor"], "role": "bogus"}
    first = _normalize_user_roles(account)
    assert first == {"role": "organizer"}
    second = _normalize_user_roles(_apply(account, first))
    assert second is None


# ------------------------------------------------------------ misc guardrails

def test_none_role_field_treated_as_missing():
    account = {"id": "u", "roles": ["organizer"], "role": None}
    update = _normalize_user_roles(account)
    # `role` field IS present (with None), and derived primary is "organizer".
    # Because the field exists we may rewrite it, but roles stays the same.
    assert update == {"role": "organizer"} or update is None
