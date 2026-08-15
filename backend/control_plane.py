"""
OKKAX V5 Phase 02 - Control Plane.

Governance backbone only:
- canonical control domains
- R0/R1/R2/R3 policy registry
- fresh-auth evidence
- approval requests
- separation of duty / no self approval
- append-only governance evidence

Business-domain execution remains in its owning V5 phase.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from core import (
    db, nid, now_iso, verify_password,
    get_current_user, require_roles, is_admin, clean,
)

router = APIRouter(prefix="/api/control", tags=["Control Plane"])

CONTROL_DOMAINS = [
    "overview",
    "identity_access",
    "live_economy",
    "commerce_finance",
    "ticketing",
    "verification_trust",
    "event_operations",
    "intelligence_data",
    "security",
    "analytics",
    "audit_governance",
]

RISK_LEVELS = {
    "R0": {
        "label": "Routine",
        "approval_required": False,
        "fresh_auth_required": False,
    },
    "R1": {
        "label": "Sensitive",
        "approval_required": False,
        "fresh_auth_required": False,
    },
    "R2": {
        "label": "High Risk",
        "approval_required": True,
        "fresh_auth_required": True,
    },
    "R3": {
        "label": "Critical",
        "approval_required": True,
        "fresh_auth_required": True,
    },
}

# Registry is configuration/policy, not client authority.
ACTION_POLICIES = {
    "identity.user.suspend": {
        "risk": "R2",
        "domain": "identity_access",
    },
    "identity.user.role_change": {
        "risk": "R2",
        "domain": "identity_access",
    },
    "identity.admin.assign": {
        "risk": "R3",
        "domain": "identity_access",
    },
    "identity.admin.suspend": {
        "risk": "R3",
        "domain": "security",
    },
    "verification.entity.verify": {
        "risk": "R1",
        "domain": "verification_trust",
    },
    "demo.reset": {
        "risk": "R3",
        "domain": "security",
    },
}

FRESH_AUTH_MINUTES = 10


class ReauthIn(BaseModel):
    password: str


class ControlRequestIn(BaseModel):
    action: str
    target_type: str
    target_id: str
    reason: str = Field(min_length=3, max_length=1000)
    payload: Dict[str, Any] = {}


class DecisionIn(BaseModel):
    decision: str
    reason: str = Field(min_length=3, max_length=1000)


async def governance_evidence(
    *,
    actor: Optional[dict],
    action: str,
    risk: str,
    domain: str,
    request_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    outcome: str,
    reason: Optional[str] = None,
    detail: Optional[dict] = None,
):
    """
    Append-only evidence writer.

    No update/delete helper is exposed for control_evidence.
    Historical evidence is written as new immutable-intent rows.
    """
    doc = {
        "id": nid(),
        "request_id": request_id,
        "actor_user_id": (actor or {}).get("id"),
        "actor_email": (actor or {}).get("email"),
        "action": action,
        "risk": risk,
        "domain": domain,
        "target_type": target_type,
        "target_id": target_id,
        "outcome": outcome,
        "reason": reason,
        "detail": detail or {},
        "created_at": now_iso(),
    }
    await db.control_evidence.insert_one(doc)
    return clean(doc)


async def session_has_fresh_auth(request: Request) -> bool:
    sid = getattr(request.state, "session_id", None)
    if not sid:
        return False

    session = await db.sessions.find_one(
        {"id": sid},
        {"_id": 0, "reauthenticated_at": 1, "issued_at": 1},
    )
    if not session:
        return False

    raw = session.get("reauthenticated_at") or session.get("issued_at")
    if not raw:
        return False

    dt = raw if isinstance(raw, datetime) else datetime.fromisoformat(
        str(raw).replace("Z", "+00:00")
    )
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return datetime.now(timezone.utc) - dt <= timedelta(
        minutes=FRESH_AUTH_MINUTES
    )


def get_action_policy(action: str) -> dict:
    policy = ACTION_POLICIES.get(action)
    if not policy:
        raise HTTPException(
            status_code=400,
            detail="Action is not registered in the Control Plane policy",
        )
    return policy


@router.get("/policy")
async def control_policy(
    user: dict = Depends(require_roles("platform_admin")),
):
    return {
        "domains": CONTROL_DOMAINS,
        "risk_levels": RISK_LEVELS,
        "actions": ACTION_POLICIES,
        "fresh_auth_minutes": FRESH_AUTH_MINUTES,
    }


@router.get("/overview")
async def control_overview(
    user: dict = Depends(require_roles("platform_admin")),
):
    pending = await db.control_requests.count_documents({"status": "pending"})
    approved = await db.control_requests.count_documents({"status": "approved"})
    rejected = await db.control_requests.count_documents({"status": "rejected"})

    by_risk = {}
    for risk in RISK_LEVELS:
        by_risk[risk] = await db.control_requests.count_documents(
            {"risk": risk}
        )

    evidence_count = await db.control_evidence.count_documents({})
    suspended_accounts = await db.users.count_documents({"suspended": True})
    active_sessions = await db.sessions.count_documents({"revoked_at": None})

    recent = await db.control_evidence.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    return {
        "domains": CONTROL_DOMAINS,
        "requests": {
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "by_risk": by_risk,
        },
        "security": {
            "suspended_accounts": suspended_accounts,
            "active_sessions": active_sessions,
        },
        "evidence_count": evidence_count,
        "recent_evidence": recent,
    }


@router.post("/reauth")
async def control_reauth(
    payload: ReauthIn,
    request: Request,
    user: dict = Depends(get_current_user),
):
    account = await db.users.find_one({"id": user["id"]})
    if not account or not verify_password(
        payload.password,
        account.get("password_hash", ""),
    ):
        await governance_evidence(
            actor=user,
            action="security.reauth",
            risk="R2",
            domain="security",
            outcome="denied",
            reason="Invalid credential",
        )
        raise HTTPException(status_code=401, detail="Re-authentication failed")

    sid = getattr(request.state, "session_id", None)
    if not sid:
        raise HTTPException(status_code=401, detail="Session missing")

    at = now_iso()
    await db.sessions.update_one(
        {"id": sid, "user_id": user["id"], "revoked_at": None},
        {"$set": {"reauthenticated_at": at}},
    )
    await governance_evidence(
        actor=user,
        action="security.reauth",
        risk="R2",
        domain="security",
        outcome="success",
        reason="Fresh authentication established",
        detail={"sid": sid},
    )
    return {
        "ok": True,
        "reauthenticated_at": at,
        "fresh_for_minutes": FRESH_AUTH_MINUTES,
    }


@router.post("/requests")
async def create_control_request(
    payload: ControlRequestIn,
    request: Request,
    user: dict = Depends(require_roles("platform_admin")),
):
    policy = get_action_policy(payload.action)
    risk = policy["risk"]

    if RISK_LEVELS[risk]["fresh_auth_required"]:
        if not await session_has_fresh_auth(request):
            raise HTTPException(
                status_code=428,
                detail="Fresh authentication required",
            )

    doc = {
        "id": nid(),
        "action": payload.action,
        "risk": risk,
        "domain": policy["domain"],
        "target_type": payload.target_type,
        "target_id": payload.target_id,
        "payload": payload.payload,
        "reason": payload.reason,
        "requester_user_id": user["id"],
        "requester_email": user.get("email"),
        "status": "pending",
        "created_at": now_iso(),
        "decided_at": None,
        "decided_by_user_id": None,
        "decision_reason": None,
    }
    await db.control_requests.insert_one(dict(doc))

    await governance_evidence(
        actor=user,
        action=payload.action,
        risk=risk,
        domain=policy["domain"],
        request_id=doc["id"],
        target_type=payload.target_type,
        target_id=payload.target_id,
        outcome="requested",
        reason=payload.reason,
        detail={"payload": payload.payload},
    )

    return clean(doc)


@router.get("/requests")
async def list_control_requests(
    status: Optional[str] = None,
    user: dict = Depends(require_roles("platform_admin")),
):
    query = {}
    if status:
        query["status"] = status

    rows = await db.control_requests.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(300)
    return {"items": rows}


@router.post("/requests/{request_id}/decision")
async def decide_control_request(
    request_id: str,
    payload: DecisionIn,
    request: Request,
    user: dict = Depends(require_roles("platform_admin")),
):
    if payload.decision not in {"approved", "rejected"}:
        raise HTTPException(
            status_code=400,
            detail="Decision must be approved or rejected",
        )

    rec = await db.control_requests.find_one(
        {"id": request_id},
        {"_id": 0},
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Control request not found")

    if rec.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Request already decided")

    if rec.get("requester_user_id") == user.get("id"):
        await governance_evidence(
            actor=user,
            action=rec["action"],
            risk=rec["risk"],
            domain=rec["domain"],
            request_id=rec["id"],
            target_type=rec.get("target_type"),
            target_id=rec.get("target_id"),
            outcome="self_approval_denied",
            reason=payload.reason,
        )
        raise HTTPException(
            status_code=403,
            detail="Requester cannot approve or reject own request",
        )

    if RISK_LEVELS[rec["risk"]]["fresh_auth_required"]:
        if not await session_has_fresh_auth(request):
            raise HTTPException(
                status_code=428,
                detail="Fresh authentication required",
            )

    at = now_iso()
    await db.control_requests.update_one(
        {"id": request_id, "status": "pending"},
        {
            "$set": {
                "status": payload.decision,
                "decided_at": at,
                "decided_by_user_id": user["id"],
                "decided_by_email": user.get("email"),
                "decision_reason": payload.reason,
            }
        },
    )

    await governance_evidence(
        actor=user,
        action=rec["action"],
        risk=rec["risk"],
        domain=rec["domain"],
        request_id=rec["id"],
        target_type=rec.get("target_type"),
        target_id=rec.get("target_id"),
        outcome=payload.decision,
        reason=payload.reason,
    )

    return {"ok": True, "status": payload.decision}


@router.get("/evidence")
async def control_evidence(
    limit: int = 200,
    user: dict = Depends(require_roles("platform_admin")),
):
    limit = max(1, min(limit, 500))
    rows = await db.control_evidence.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return {"items": rows}
