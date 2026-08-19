"""Phase 06A — Compliance & Readiness Foundation tests.

Covers Contract V5 §2.7 requirements exercised by the READ-ONLY rule
engine that shipped in F6A:

* R-06.1 deterministic rule-based derivation
* R-06.2 no hardcoded universal police / TNI rule (schema-level check)
* R-06.3 authority categories exposed as configurable enum
* R-06.4 international-performer schema present, no seed rule fabricated
* R-06.8 provenance required on every derived row
* R-06.9 read-side of Requirements/Readiness derived state
* Security: authenticated + tenant-scoped access; audience & cross-org
  are rejected.

These tests never mutate LOCKED Admission/Ticketing state.
"""

import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

API = "http://127.0.0.1:8001/api"
PASSWORD = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "gh8t6P_c1U_yFxy3uPv0cRf0")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin.local@okkax.id")
EVENT_ID = "evt-aruna-2026"


def _login(email, pw=PASSWORD):
    if email == ADMIN_EMAIL or "admin" in email:
        pw = ADMIN_PW
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "organizer": _login("organizer@okkax.id"),
        "audience": _login("audience@okkax.id"),
        "tenant": _login("tenant@okkax.id"),
        "admin": _login(ADMIN_EMAIL),
    }


# -----------------------------------------------------------------------------
# 1. Domain-level tests (pure engine) — no HTTP, no DB
# -----------------------------------------------------------------------------
def test_authority_categories_cover_contract_v5():
    """Contract V5 §2.7 baris 113 lists the authority categories that must
    be supported. Our enum must include each one — extras are allowed
    (event_specific), but nothing on the contract list may be missing.
    """
    from compliance_engine import AUTHORITY_CATEGORIES
    required = {
        "local_government",
        "national_government",
        "public_safety",
        "venue_authority",
        "fire_emergency",
        "medical",
        "traffic",
        "immigration",
        "manpower",
        "tax",
        "ip_performing_rights",
        "environment_noise",
    }
    missing = required - set(AUTHORITY_CATEGORIES.keys())
    assert not missing, f"Missing authority categories: {missing}"


def test_reference_seed_does_not_fabricate_universal_police_rule():
    """Contract V5 §2.7 baris 112: "Do not hardcode universal police/TNI
    requirements." The reference seed must NOT contain any rule that
    invokes police / TNI / polri as universal (jurisdiction=='*') mandate.
    """
    from compliance_engine import DEFAULT_COMPLIANCE_RULES
    banned_tokens = ("polri", "polda", "polres", "tni", "kepolisian")
    for rule in DEFAULT_COMPLIANCE_RULES:
        text = " ".join([
            str(rule.get("title", "")).lower(),
            str(rule.get("description", "")).lower(),
        ])
        if rule.get("jurisdiction") == "*":
            for tok in banned_tokens:
                assert tok not in text, (
                    f"Universal (jurisdiction='*') rule {rule['id']} must not name '{tok}'"
                )


def test_no_seed_rule_fabricates_international_immigration_workflow():
    """Contract V5 §2.7 baris 114 + §5 baris 187: immigration/international
    workflows must be jurisdiction-specific and NOT universally asserted.
    Phase 06A therefore ships schema readiness only — no seed rule may
    require immigration by default.
    """
    from compliance_engine import DEFAULT_COMPLIANCE_RULES
    for rule in DEFAULT_COMPLIANCE_RULES:
        assert rule.get("requires_international") in (None, False), (
            f"Rule {rule['id']} fabricates international workflow: "
            f"requires_international={rule.get('requires_international')!r}"
        )
        assert rule.get("authority_category") != "immigration", (
            f"Rule {rule['id']} fabricates immigration authority"
        )


def test_derive_is_deterministic_and_pure():
    """Calling derive twice with identical inputs yields identical output
    (order + content). No hidden state, no clock dependency.
    """
    from compliance_engine import derive_required_compliance
    event = {
        "id": "evt-x",
        "city": "Makassar",
        "event_type": "Music Festival",
        "capacity": 3000,
    }
    a = derive_required_compliance(event)
    b = derive_required_compliance(event)
    assert a == b
    # Order is deterministic: sorted by (authority_category, rule_id).
    keys = [(r["authority_category"], r["rule_id"]) for r in a]
    assert keys == sorted(keys)


def test_derive_returns_empty_when_no_jurisdiction_and_no_universal_match():
    """When an event lacks jurisdiction signals AND no keyword matches
    universal (jurisdiction='*') rules' scale gate, the engine must NOT
    fabricate anything. In the shipped seed the two universal rules
    (venue agreement + insurance) match ANY event, so we cover the
    "no rule matches" branch via a rule set with an unreachable filter.
    """
    from compliance_engine import derive_required_compliance
    rules = [
        {
            "id": "cr-test-int-only",
            "version": "test",
            "source": "reference_seed",
            "jurisdiction": "*",
            "event_type_keywords": [],
            "scale_min": 1,
            "public_space_only": False,
            "safety_only": False,
            "requires_international": True,   # requires intl performer
            "authority_category": "immigration",
            "title": "Test — international only",
            "description": "-",
            "evidence_required": True,
        }
    ]
    event_local = {"id": "evt-y", "city": "Bandung", "event_type": "Music Festival",
                   "capacity": 5000, "has_international_performer": False}
    assert derive_required_compliance(event_local, rules=rules) == []


def test_provenance_block_present_on_every_row():
    """Contract V5 §6 requires provenance on permit status. Every derived
    row must expose rule_id, rule_version, rule_source, and matched_on.
    """
    from compliance_engine import derive_required_compliance
    event = {"id": "evt-p", "city": "Jakarta", "event_type": "Konser", "capacity": 2000}
    rows = derive_required_compliance(event)
    assert rows, "expected at least one rule to match the demo event"
    for r in rows:
        for k in ("rule_id", "rule_version", "rule_source", "matched_on",
                  "authority_category", "authority_category_label"):
            assert k in r and r[k] not in (None, ""), (
                f"row {r.get('rule_id')} missing provenance field '{k}'"
            )
        assert isinstance(r["matched_on"], dict)
        assert "jurisdiction" in r["matched_on"]


def test_coverage_status_reports_not_configured_when_empty():
    from compliance_engine import compute_coverage_status
    assert compute_coverage_status([]) == "not_configured"


# -----------------------------------------------------------------------------
# 2. API-level tests — authenticated read path
# -----------------------------------------------------------------------------
def test_api_returns_items_provenance_and_coverage(tokens):
    r = requests.get(f"{API}/events/{EVENT_ID}/compliance", headers=_h(tokens["organizer"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["event_id"] == EVENT_ID
    assert isinstance(data["items"], list)
    assert data["coverage_status"] in ("not_configured",)

    prov = data["provenance"]
    assert prov["engine"] == "compliance_engine.derive_required_compliance"
    assert prov["rule_count_active"] >= 1
    assert prov["rule_seed_version"]
    for cat in ("medical", "fire_emergency", "traffic", "venue_authority", "environment_noise",
                "ip_performing_rights", "event_specific", "immigration"):
        assert cat in prov["authority_categories_supported"]

    # Aruna is a Music Festival in Makassar, capacity 2000 — at least the
    # two universal rules (venue + insurance) must fire; ID/music-keyword
    # scale rules also fire because scale >= 500 and city implies ID.
    ids = {i["rule_id"] for i in data["items"]}
    assert "cr-ven-001" in ids
    assert "cr-ins-001" in ids

    # Every item is server-authoritative with default status not_configured.
    for it in data["items"]:
        assert it["event_id"] == EVENT_ID
        assert it["status"] == "not_configured"
        assert it["rule_source"] == "reference_seed"


def test_api_is_idempotent_across_repeated_reads(tokens):
    """Second call must return the same list — same rule_ids and same
    row-level `id` — proving persistence keyed by (event_id, rule_id) and
    idempotent upsert.
    """
    h = _h(tokens["organizer"])
    first = requests.get(f"{API}/events/{EVENT_ID}/compliance", headers=h).json()
    second = requests.get(f"{API}/events/{EVENT_ID}/compliance", headers=h).json()
    first_by_rule = {i["rule_id"]: i["id"] for i in first["items"]}
    second_by_rule = {i["rule_id"]: i["id"] for i in second["items"]}
    assert first_by_rule == second_by_rule


def test_api_requires_authentication():
    r = requests.get(f"{API}/events/{EVENT_ID}/compliance")
    # 401 (missing bearer) or 403 (bearer processing) — both are refusals.
    assert r.status_code in (401, 403), r.text


def test_api_rejects_audience_cross_tenant_read(tokens):
    """Audience must not read organizer-private compliance data of an event
    they do not own or belong to. Mirrors ticket-tier RBAC policy.
    """
    r = requests.get(f"{API}/events/{EVENT_ID}/compliance", headers=_h(tokens["audience"]))
    assert r.status_code == 403, r.text


def test_api_rejects_unrelated_org_tenant_read(tokens):
    """Tenant persona lives under a different organization than the event's
    organizer_org_id — must be 403 by `assert_event_access` policy.
    """
    r = requests.get(f"{API}/events/{EVENT_ID}/compliance", headers=_h(tokens["tenant"]))
    assert r.status_code == 403, r.text


def test_api_admin_can_read_any_event(tokens):
    """Platform admin bypasses tenant isolation per `is_admin` short-circuit
    in `assert_event_access`.
    """
    r = requests.get(f"{API}/events/{EVENT_ID}/compliance", headers=_h(tokens["admin"]))
    assert r.status_code == 200, r.text
