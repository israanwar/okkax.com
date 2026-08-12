import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient

JWT_ALG = "HS256"

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


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


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
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
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


async def assert_event_access(event: dict, user: dict, write: bool = False):
    if is_admin(user):
        return
    if event.get("owner_user_id") == user.get("id"):
        return
    if not write and event.get("status") == "published":
        return
    if event.get("organizer_org_id") and event.get("organizer_org_id") == user.get("org_id"):
        return
    raise HTTPException(status_code=403, detail="You do not have access to this event's data")


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
