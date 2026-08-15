import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient

JWT_ALG = "HS256"

# Sessions expire alongside the access token they were issued with, so a
# stale token whose corresponding session has been revoked or has aged
# out gets rejected at `get_current_user`. Same TTL keeps the two
# lifetimes coupled — no refresh flow (deliberately out of scope).
ACCESS_TOKEN_TTL_DAYS = 7
SESSION_TTL_DAYS = 7

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def nid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, sid: str) -> str:
    """Mint an access token bound to a server-side session.

    `sid` is required. Every request re-verifies the referenced session
    against `db.sessions` — a token whose session was revoked or aged
    out is rejected even though the JWT signature is still valid. This
    is what makes revocation server-authoritative.
    """
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "sid": sid,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def create_session(user_id: str) -> dict:
    """Insert a new session row for `user_id` and return the full doc.
    Caller passes the returned `id` as the `sid` claim of the paired
    access token."""
    now = datetime.now(timezone.utc)
    doc = {
        "id": nid(),
        "user_id": user_id,
        "issued_at": now.isoformat(),
        "expires_at": (now + timedelta(days=SESSION_TTL_DAYS)).isoformat(),
        "revoked_at": None,
    }
    await db.sessions.insert_one(dict(doc))
    return doc


async def issue_access_token(user_id: str, email: str) -> tuple[str, dict]:
    """Convenience wrapper — create a session and mint the JWT bound to
    it in one call. Every production JWT-issuance site (login, register,
    Google session, persona login) goes through this so the two are
    never out of sync."""
    session = await create_session(user_id)
    token = create_access_token(user_id, email, sid=session["id"])
    return token, session


async def revoke_session(sid: str) -> None:
    """Idempotent — revoking a session that is already revoked (or
    never existed) is a no-op. We only stamp `revoked_at` when the row
    exists and is currently active, keeping the first-revoke timestamp
    accurate for audit."""
    if not sid:
        return
    await db.sessions.update_one(
        {"id": sid, "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Phase 01 — server-authoritative session gate. Any token minted
    # before session tracking (missing `sid`) is rejected. Production
    # code never emits such tokens; test fixtures updated to seed a
    # session row + include the sid.
    sid = payload.get("sid")
    if not sid:
        raise HTTPException(status_code=401, detail="Session missing")
    session = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not session or session.get("user_id") != payload.get("sub"):
        raise HTTPException(status_code=401, detail="Session invalid")
    if session.get("revoked_at"):
        raise HTTPException(status_code=401, detail="Session revoked")
    expires_at = session.get("expires_at")
    if expires_at:
        expires_dt = expires_at if isinstance(expires_at, datetime) else \
            datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if expires_dt <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    ensure_account_active(user)
    # Stash the sid on request.state (not on the user dict) so
    # endpoints like `/auth/logout` can revoke the exact session that
    # authorized this request without leaking sid into any response
    # payload that whitelists user fields.
    request.state.session_id = sid
    return clean(user)


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        user_roles = set(user.get("roles", []))
        if "super_admin" in user_roles or "platform_admin" in user_roles:
            return user
        if not user_roles.intersection(roles):
            raise HTTPException(status_code=403, detail="Permission denied for your role")
        return user

    return dep


def is_admin(user: dict) -> bool:
    return bool({"super_admin", "platform_admin"}.intersection(set(user.get("roles", []))))


SUSPENDED_MESSAGE = "Account is suspended. Contact the OKKAX administrator."


def ensure_account_active(user: dict) -> None:
    """Reject the request if `user` is marked suspended.

    Central helper dipanggil dari setiap entry-point auth (login normal, JWT
    verification via `get_current_user`, Google session, dan persona login)
    supaya enforcement suspended tinggal di satu tempat. Pesan 403 disamakan
    untuk semua jalur agar tidak membocorkan alur mana yang dipakai."""
    if user and user.get("suspended"):
        raise HTTPException(status_code=403, detail=SUSPENDED_MESSAGE)


def is_demo_mode() -> bool:
    """Apakah demo-only endpoints (persona login, seed reset) diaktifkan.

    Dibaca dinamis dari env `OKKAX_DEMO_MODE`. **Default FALSE**: kalau env
    tidak diset atau nilainya tidak eksplisit truthy, endpoint terkunci
    (respons 404). Ops harus menyetel `OKKAX_DEMO_MODE=true` di
    environment kompetisi/demo untuk mengaktifkan endpoint.

    Truthy values: `1`, `true`, `yes`, `on` (case-insensitive, whitespace
    di-strip). Nilai lain apa pun (termasuk env yang tidak ada) => False.
    """
    raw = os.environ.get("OKKAX_DEMO_MODE", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


async def audit(event_id: Optional[str], user: Optional[dict], action: str, detail: dict = None):
    await db.audit_logs.insert_one({
        "id": nid(),
        "event_id": event_id,
        "user_id": (user or {}).get("id"),
        "user_email": (user or {}).get("email"),
        "action": action,
        "detail": detail or {},
        "created_at": now_iso(),
    })


async def notify(user_id: str, title: str, body: str, kind: str = "info", event_id: str = None):
    await db.notifications.insert_one({
        "id": nid(),
        "user_id": user_id,
        "event_id": event_id,
        "title": title,
        "body": body,
        "kind": kind,
        "read": False,
        "created_at": now_iso(),
    })


async def get_event_or_404(event_id: str) -> dict:
    ev = await db.events.find_one({"id": event_id, "deleted": {"$ne": True}})
    if not ev:
        ev = await db.events.find_one({"event_code": event_id, "deleted": {"$ne": True}})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    return clean(ev)


async def user_has_active_membership(user_id: Optional[str], organization_id: Optional[str]) -> bool:
    """True when `user_id` has an ACTIVE row in `organization_members` for
    `organization_id`. Step 4 collection is the authoritative source for
    org-scoped authorization from Step 6B onward.

    Returns False on any missing id — never raises, so callers can compose
    it into authorization ladders without special-casing anonymous inputs.
    """
    if not user_id or not organization_id:
        return False
    doc = await db.organization_members.find_one(
        {"user_id": user_id, "organization_id": organization_id, "status": "active"},
        {"_id": 0, "id": 1},
    )
    return doc is not None


async def assert_event_access(event: dict, user: dict, write: bool = False):
    """Enforce access to an event's PRIVATE data (brief, blueprint, budget,
    talents, vendors, workforce, command center, etc.).

    Step 6B behavior:
    1. Admin (`super_admin` / `platform_admin`) always passes.
    2. Event owner (`event.owner_user_id == user.id`) always passes.
    3. Active membership on `event.organizer_org_id` (Step 4 collection)
       passes. This is the authoritative org-scope check.
    4. Legacy scalar `user.org_id == event.organizer_org_id` still passes
       as a backward-compatible fallback for seed/legacy accounts that
       have not yet been migrated into memberships. Removal is scheduled
       for a later step once onboarding backfills every legacy account.
    5. Everything else is 403.

    NOTE: unlike pre-Step-6B, `event.status == "published"` no longer
    grants access to this private surface — published events remain
    reachable via the dedicated public endpoints (`/api/public/events/*`,
    `/api/discover/*`) which never invoke this function. The `write`
    parameter is kept in the signature for source-code readability and
    for potential future divergence, but it does NOT relax the check.
    """
    if is_admin(user):
        return
    if event.get("owner_user_id") == user.get("id"):
        return
    org_id = event.get("organizer_org_id")
    if org_id:
        if await user_has_active_membership(user.get("id"), org_id):
            return
        if user.get("org_id") and user.get("org_id") == org_id:
            return
    raise HTTPException(status_code=403, detail="You do not have access to this event's data")


# Roles that may operate an event's live gate. Everything else (audience,
# sponsor, tenant, talent, vendor, worker, finance_approver) is rejected
# outright, even when authenticated.
TICKET_VALIDATOR_ROLES = frozenset({
    "organizer", "promoter", "event_organizer", "supervisor",
})


async def assert_ticket_validator(event: dict, user: dict):
    """Two-gate check for `POST /api/tickets/validate`:

    - Gate 1 (role): user must have at least one role in
      `TICKET_VALIDATOR_ROLES`, OR be admin, OR be the event owner. Users
      who fail this gate are 403'd BEFORE anything about the QR is
      revealed (no oracle over ticket existence).
    - Gate 2 (event scope): user must additionally be admin, event
      owner, active member of `event.organizer_org_id`, or legacy
      `user.org_id` match. Prevents an organizer of event A from
      validating tickets of event B.
    """
    if is_admin(user):
        return
    if event.get("owner_user_id") == user.get("id"):
        return
    user_roles = set(user.get("roles", []))
    if not user_roles.intersection(TICKET_VALIDATOR_ROLES):
        raise HTTPException(status_code=403, detail="Your role cannot validate tickets")
    org_id = event.get("organizer_org_id")
    if org_id:
        if await user_has_active_membership(user.get("id"), org_id):
            return
        if user.get("org_id") and user.get("org_id") == org_id:
            return
    raise HTTPException(status_code=403,
                        detail="You are not authorized to validate tickets for this event")


ROLES = [
    ("super_admin", "Super Administrator"),
    ("platform_admin", "Platform Administrator"),
    ("organizer", "Organizer / Corporate Buyer"),
    ("promoter", "Promotor"),
    ("event_organizer", "Event Organizer"),
    ("talent_management", "Talent Management"),
    ("talent", "Talent"),
    ("venue_manager", "Venue Manager"),
    ("vendor", "Vendor"),
    ("sponsor", "Sponsor"),
    ("tenant", "Tenant / Exhibitor"),
    ("worker", "Worker / Freelancer"),
    ("audience", "Audience / Ticket Buyer"),
    ("finance_approver", "Finance Approver"),
    ("supervisor", "Event Supervisor"),
]
ROLE_KEYS = [r[0] for r in ROLES]
