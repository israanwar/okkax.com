import os
import hashlib
import logging
import secrets
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from core import (db, nid, now_iso, hash_password, verify_password, create_access_token,
                  issue_access_token, revoke_session, clean,
                  get_current_user, get_optional_user, require_roles, is_admin, is_demo_mode,
                  ensure_account_active, audit, notify, get_event_or_404, assert_event_access,
                  assert_ticket_validator, user_has_active_membership, TICKET_VALIDATOR_ROLES,
                  ROLES, ROLE_KEYS)
from compiler import (compile_blueprint, _fallback as baseline_blueprint,
                      AI_ENGINES, DEFAULT_ENGINE, resolve_engine)
import asyncio
import seed_data
from control_plane import router as control_router


async def refine_blueprint(event_id: str, brief: dict, doc_id: str, engine: str | None = None):
    """The OKKAX Blueprint Engine runs in background so the UI stays responsive."""
    try:
        bp = await compile_blueprint(brief, engine)
        bp.pop("id", None)
        await db.event_blueprints.update_one(
            {"id": doc_id},
            {"$set": {**bp, "ai_status": "ai_error" if bp.get("ai_error") else "done"}})
    except Exception as e:
        logger.warning(f"blueprint refine failed: {e}")
        await db.event_blueprints.update_one({"id": doc_id}, {"$set": {"ai_status": "ai_error"}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("okkax")

app = FastAPI(title="OKKAX API", description="Live Event Operating Network")
api = APIRouter(prefix="/api")

DISCLAIMER = seed_data.DISCLAIMER
SANDBOX_NOTICE = "Mode demo kompetisi. Tidak ada uang nyata yang akan ditagihkan."

PAYMENT_METHODS = [
    {"group": "Virtual Account", "key": "virtual_account", "channels": [
        "BCA Virtual Account", "BRI Virtual Account", "BNI Virtual Account", "Mandiri Virtual Account",
        "Permata Virtual Account", "CIMB Niaga Virtual Account"], "available": True},
    {"group": "Transfer Bank", "key": "bank_transfer", "channels": ["Transfer manual dengan bukti pembayaran"], "available": True},
    {"group": "QRIS", "key": "qris", "channels": ["QRIS Dynamic", "QRIS Static"], "available": True},
    {"group": "E-Wallet", "key": "ewallet", "channels": ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja"], "available": True},
    {"group": "Kartu", "key": "card", "channels": ["Kartu Kredit (sandbox)", "Kartu Debit (sandbox)"], "available": True},
    {"group": "Retail Outlet", "key": "retail", "channels": ["Indomaret", "Alfamart"], "available": True},
    {"group": "PayLater", "key": "paylater", "channels": ["Future integration"], "available": False},
    {"group": "Corporate Payment", "key": "corporate", "channels": ["Invoice / Purchase Order", "Term payment", "Milestone payment"], "available": True},
    {"group": "International Payment", "key": "international", "channels": ["Future-ready structure"], "available": False},
]


# ---------------------------------------------------------------- models
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = "audience"
    roles: Optional[List[str]] = None
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    city: Optional[str] = None
    terms_accepted: bool = True


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class BriefIn(BaseModel):
    name: str
    event_type: str
    objective: str = ""
    description: str = ""
    city: str
    venue_preference: str = "Indoor"
    start_date: str
    days: int = 1
    setup_days: int = 1
    capacity: int = 500
    audience_profile: str = ""
    target_age: str = ""
    budget: int = 0
    currency: str = "IDR"
    talent_preference: str = ""
    talent_category: str = ""
    production_standard: str = "Balanced"
    attendance_format: str = "Offline"
    ticketed: bool = True
    sponsor_requirement: bool = True
    tenant_requirement: bool = True
    workforce_requirement: bool = True
    accessibility: str = ""
    sustainability: str = ""
    brand_restrictions: str = ""
    brand: str = ""
    brand_category: str = ""
    notes: str = ""


class CheckoutIn(BaseModel):
    event_id: str
    tier_id: str
    quantity: int = Field(ge=1, le=10)
    attendees: List[Dict[str, str]] = []
    method: str
    method_channel: str


# ---------------------------------------------------------------- auth
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    requested_roles = payload.roles if payload.roles is not None else [payload.role]
    if len(requested_roles) != 1:
        raise HTTPException(status_code=400, detail="Satu akun hanya dapat memiliki satu peran")
    selected_role = requested_roles[0]
    if selected_role not in ROLE_KEYS or selected_role in {"super_admin", "platform_admin"}:
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    roles = [selected_role]
    org_id = None
    if payload.organization_name:
        org_id = nid()
        await db.organizations.insert_one({
            "id": org_id, "name": payload.organization_name, "org_type": payload.organization_type or "Other",
            "city": payload.city or "", "verified": False, "document_status": "Pending",
            "currency": "IDR", "timezone": "Asia/Jakarta", "language": "id", "created_at": now_iso()})
    user = {"id": nid(), "email": email, "password_hash": hash_password(payload.password),
            "name": payload.name, "roles": roles, "org_id": org_id, "city": payload.city or "",
            "terms_accepted": payload.terms_accepted, "onboarded": bool(org_id or "audience" in roles),
            "created_at": now_iso()}
    await db.users.insert_one(user)
    token, _ = await issue_access_token(user["id"], email)
    await audit(None, user, "auth.register")
    return {"token": token, "user": clean(user)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    ident = f"{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5:
        locked_until = datetime.fromisoformat(att["last_at"]) + timedelta(minutes=15)
        if datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"last_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    ensure_account_active(user)
    await db.login_attempts.delete_one({"identifier": ident})
    token, _ = await issue_access_token(user["id"], email)
    await audit(None, clean(user), "auth.login")
    return {"token": token, "user": clean(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user.get("org_id")}) if user.get("org_id") else None
    return {"user": user, "organization": clean(org) if org else None}


@api.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(get_current_user)):
    """Revoke the session that authenticated THIS request. Idempotent
    (revoking a already-revoked session is a no-op) and scoped to a
    single session. Phase 01 deliberately excludes logout-all."""
    sid = getattr(request.state, "session_id", None)
    if sid:
        await revoke_session(sid)
        await audit(None, user, "auth.logout", {"sid": sid})
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot(payload: ForgotIn):
    user = await db.users.find_one({"email": payload.email.lower().strip()})
    if user:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        await db.password_reset_tokens.insert_one({
            "id": nid(), "token_hash": token_hash, "user_id": user["id"], "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "created_at": now_iso()})
        await notify(user["id"], "Permintaan reset kata sandi",
                     "Permintaan reset diterima. Hubungi administrator bila Anda tidak memintanya.", "info")
    return {"ok": True, "message": "Jika email terdaftar, instruksi reset akan dikirim."}


@api.post("/auth/reset-password")
async def reset(payload: ResetIn):
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    rec = await db.password_reset_tokens.find_one({"token_hash": token_hash, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Token tidak valid atau sudah digunakan")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="Token kedaluwarsa")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"id": rec["id"]}, {"$set": {"used": True}})
    return {"ok": True}


@api.get("/meta/roles")
async def meta_roles():
    return {"roles": [{"key": k, "label": l} for k, l in ROLES],
            "payment_methods": PAYMENT_METHODS, "disclaimer": DISCLAIMER, "sandbox_notice": SANDBOX_NOTICE}


# ---------------------------------------------------------------- catalog
# Phase F3. Canonical supply catalog helpers. Sort keys are whitelisted so
# a client cannot ask the DB to sort by an arbitrary field, and the
# per-response cap stays small even when the caller passes a large limit.
_CATALOG_HARD_CAP = 300


def _catalog_sort_spec(sort: str, allowed: dict):
    """Translate a sort token into a Mongo sort spec, or None to keep
    insertion order. `allowed` maps public tokens to (field, direction)."""
    if not sort:
        return None
    spec = allowed.get(sort)
    if not spec:
        return None
    return [(spec[0], spec[1])]


def _catalog_limit(limit: int) -> int:
    if limit and limit > 0:
        return min(limit, _CATALOG_HARD_CAP)
    return _CATALOG_HARD_CAP


@api.get("/catalog/talents")
async def catalog_talents(q: str = "", category: str = "", city: str = "",
                          verified: Optional[bool] = None,
                          min_price: int = 0, max_price: int = 0,
                          sort: str = "", limit: int = 0):
    """Discover talents. Legacy params (q, category, city) unchanged;
    verified/min_price/max_price/sort/limit are additive."""
    f: Dict[str, Any] = {}
    if q:
        f["$or"] = [{"stage_name": {"$regex": q, "$options": "i"}},
                    {"genre": {"$regex": q, "$options": "i"}}]
    if category:
        f["category"] = category
    if city:
        f["city"] = city
    if verified is not None:
        f["verified"] = bool(verified)
    price_clause: Dict[str, Any] = {}
    if min_price:
        price_clause["$gte"] = int(min_price)
    if max_price:
        price_clause["$lte"] = int(max_price)
    if price_clause:
        f["base_fee"] = price_clause
    cursor = db.talents.find(f, {"_id": 0})
    spec = _catalog_sort_spec(sort, {
        "price_asc": ("base_fee", 1), "price_desc": ("base_fee", -1),
        "rating_desc": ("delivery_score", -1), "name_asc": ("stage_name", 1),
    })
    if spec:
        cursor = cursor.sort(spec)
    return {"items": await cursor.to_list(_catalog_limit(limit))}


@api.get("/catalog/venues")
async def catalog_venues(city: str = "", min_capacity: int = 0,
                         q: str = "", verified: Optional[bool] = None,
                         indoor: Optional[bool] = None,
                         min_price: int = 0, max_price: int = 0,
                         sort: str = "", limit: int = 0):
    """Discover venues. Legacy params (city, min_capacity) preserved."""
    f: Dict[str, Any] = {}
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    if city:
        f["city"] = city
    if verified is not None:
        f["verified"] = bool(verified)
    if indoor is not None:
        f["indoor"] = bool(indoor)
    price_clause: Dict[str, Any] = {}
    if min_price:
        price_clause["$gte"] = int(min_price)
    if max_price:
        price_clause["$lte"] = int(max_price)
    if price_clause:
        f["event_day_price"] = price_clause
    cursor = db.venues.find(f, {"_id": 0})
    spec = _catalog_sort_spec(sort, {
        "price_asc": ("event_day_price", 1), "price_desc": ("event_day_price", -1),
        "capacity_desc": ("standing_capacity", -1), "name_asc": ("name", 1),
    })
    if spec:
        cursor = cursor.sort(spec)
    rows = await cursor.to_list(_catalog_limit(limit))
    if min_capacity:
        rows = [r for r in rows
                if max(r.get("standing_capacity", 0), r.get("seated_capacity", 0)) >= min_capacity]
    return {"items": rows}


@api.get("/catalog/vendors")
async def catalog_vendors(category: str = "", city: str = "",
                          q: str = "", verified: Optional[bool] = None,
                          min_price: int = 0, max_price: int = 0,
                          sort: str = "", limit: int = 0):
    """Discover vendors. Legacy params (category, city) preserved.
    `city` matches `service_cities` (existing semantic)."""
    f: Dict[str, Any] = {}
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    if category:
        f["category"] = category
    if city:
        f["service_cities"] = city
    if verified is not None:
        f["verified"] = bool(verified)
    price_clause: Dict[str, Any] = {}
    if min_price:
        price_clause["$gte"] = int(min_price)
    if max_price:
        price_clause["$lte"] = int(max_price)
    if price_clause:
        f["price_min"] = price_clause
    cursor = db.vendors.find(f, {"_id": 0})
    spec = _catalog_sort_spec(sort, {
        "price_asc": ("price_min", 1), "price_desc": ("price_max", -1),
        "rating_desc": ("delivery_score", -1), "name_asc": ("name", 1),
    })
    if spec:
        cursor = cursor.sort(spec)
    return {"items": await cursor.to_list(_catalog_limit(limit))}


@api.get("/catalog/workers")
async def catalog_workers(category: str = "", q: str = "", city: str = "",
                          verified: Optional[bool] = None,
                          min_price: int = 0, max_price: int = 0,
                          sort: str = "", limit: int = 0):
    """Discover workforce. Legacy param (category) preserved."""
    f: Dict[str, Any] = {}
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    if category:
        f["category"] = category
    if city:
        f["city"] = city
    if verified is not None:
        f["verified"] = bool(verified)
    price_clause: Dict[str, Any] = {}
    if min_price:
        price_clause["$gte"] = int(min_price)
    if max_price:
        price_clause["$lte"] = int(max_price)
    if price_clause:
        f["rate_per_day"] = price_clause
    cursor = db.workers.find(f, {"_id": 0})
    spec = _catalog_sort_spec(sort, {
        "price_asc": ("rate_per_day", 1), "price_desc": ("rate_per_day", -1),
        "rating_desc": ("attendance_rate", -1), "name_asc": ("name", 1),
    })
    if spec:
        cursor = cursor.sort(spec)
    return {"items": await cursor.to_list(_catalog_limit(limit))}


# ---------------------------------------------------------------- events / studio

# Statuses at which sub-resource endpoints (sponsor packages, tenant
# zones, ticket tiers) may serve their contents to anonymous or non-
# authorized callers. Anything else is treated as private and answered
# with 404 to avoid enumerating draft-event ids.
_PUBLIC_EVENT_STATUSES = frozenset({"published", "live"})


async def _event_visible_to_public_caller(ev: dict, user: Optional[dict]) -> bool:
    """Step 6C guardrail for the three public / optional-auth sub-
    resource endpoints below.

    Rules:
    - Events whose `status` is in `_PUBLIC_EVENT_STATUSES` are visible
      to anyone (existing marketplace behavior).
    - Otherwise the caller must be authenticated AND pass
      `assert_event_access` (admin / owner / active member of
      `organizer_org_id` / legacy `user.org_id` match. the Step 6B
      ladder).
    - Any other case returns False; callers translate that to a 404
      rather than a 403 so a draft event's existence is not disclosed
      via response-code enumeration.
    """
    if ev.get("status") in _PUBLIC_EVENT_STATUSES:
        return True
    if not user:
        return False
    try:
        await assert_event_access(ev, user)
    except HTTPException:
        return False
    return True


async def next_event_code(city: str) -> str:
    prefix = "".join([c for c in city.upper() if c.isalpha()])[:3] or "IDN"
    count = await db.events.count_documents({}) + 1
    return f"EVT-{prefix}-{datetime.now(timezone.utc).year}-{count:04d}"


@api.post("/events")
async def create_event(brief: BriefIn, user: dict = Depends(require_roles("organizer", "event_organizer", "promoter"))):
    event_id = nid()
    code = await next_event_code(brief.city)
    org = await db.organizations.find_one({"id": user.get("org_id")}) if user.get("org_id") else None
    ev = {
        "id": event_id, "event_code": code, "name": brief.name, "event_type": brief.event_type,
        "city": brief.city, "venue_name": None, "organizer_org_id": user.get("org_id"),
        "organizer_name": (org or {}).get("name") or user["name"], "owner_user_id": user["id"],
        "status": "draft", "start_date": brief.start_date, "end_date": brief.start_date,
        "start_time": "18:00", "timezone": "Asia/Jakarta", "days": brief.days, "setup_days": brief.setup_days,
        "capacity": brief.capacity, "budget": brief.budget, "currency": brief.currency,
        "description": brief.description, "objective": brief.objective,
        "audience_profile": brief.audience_profile, "age_limit": brief.target_age or "All ages",
        "hero_image": seed_data.HERO2, "indoor": brief.venue_preference == "Indoor",
        "format": brief.attendance_format, "accessibility": brief.accessibility,
        "refund_policy": "Refund penuh hingga H-14, 50% hingga H-7.",
        "reschedule_policy": "Tiket berlaku pada tanggal pengganti bila dijadwalkan ulang.",
        "gate_info": "Informasi gate akan diperbarui organizer.", "support_contact": user["email"],
        "faq": [], "is_demo": False, "created_at": now_iso(),
    }
    await db.events.insert_one(ev)
    await db.event_briefs.insert_one({"id": nid(), "event_id": event_id,
                                      "payload": {**brief.model_dump(), "event_id": event_id},
                                      "created_at": now_iso()})
    await audit(event_id, user, "event.create", {"name": brief.name})
    return {"event": clean(ev)}


@api.get("/events")
async def list_events(user: dict = Depends(get_current_user)):
    f = {"deleted": {"$ne": True}}
    if not is_admin(user):
        # Phase 01 Active Workspace Scope, strict form:
        # - Personal workspace activated: audience context, no operational
        #   events. Ownership shortcut MUST NOT smuggle events belonging
        #   to an organization into this list. Returns empty.
        # - Organization workspace activated (session or legacy fallback):
        #   only events whose `organizer_org_id` equals the active org.
        #   Multi-org membership grants no simultaneous visibility;
        #   ownership of events in ANOTHER org does not surface here
        #   either (that org is not the caller's execution context on
        #   this request).
        # - No activation and no legacy org: fall back to owner-only so
        #   a brand-new account has a minimum visible surface before
        #   choosing a workspace.
        ctx = user.get("_workspace_ctx") or {}
        kind = ctx.get("kind")
        if kind == "personal":
            return {"items": []}
        active_org_id = ctx.get("organization_id")
        if active_org_id:
            f["organizer_org_id"] = active_org_id
        else:
            f["owner_user_id"] = user["id"]
    rows = await db.events.find(f, {"_id": 0}).sort("created_at", -1).to_list(100)
    out = []
    for ev in rows:
        b = await compute_budget(ev["id"])
        out.append({**ev, "funding_gap": b["funding_gap"], "total_cost": b["total_cost"],
                    "confirmed_funding": b["confirmed_funding"]})
    return {"items": out}


@api.get("/events/{event_id}/brief")
async def get_brief(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    b = await db.event_briefs.find_one({"event_id": ev["id"]}, {"_id": 0})
    return {"event": ev, "brief": b}


@api.get("/ai/engines")
async def ai_engines():
    return {"default": DEFAULT_ENGINE,
            "engines": [{"key": k, **v} for k, v in AI_ENGINES.items()]}


@api.post("/events/{event_id}/compile")
async def compile_event(event_id: str, engine: str | None = None, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    brief_doc = await db.event_briefs.find_one({"event_id": ev["id"]}, {"_id": 0})
    brief = (brief_doc or {}).get("payload", {})
    brief["event_id"] = ev["id"]
    bp = baseline_blueprint(brief)
    await db.event_blueprints.delete_many({"event_id": ev["id"]})
    eng = resolve_engine(engine)
    doc = {"id": nid(), "event_id": ev["id"], **bp, "ai_status": "refining",
           "ai_engine": eng["model"], "ai_vendor": eng["vendor"], "created_at": now_iso()}
    await db.event_blueprints.insert_one(doc)
    asyncio.create_task(refine_blueprint(ev["id"], brief, doc["id"], eng["model"]))
    # seed estimated budget items from blueprint if none exist
    if await db.budget_items.count_documents({"event_id": ev["id"]}) == 0:
        for c in bp.get("budget_categories", []):
            await db.budget_items.insert_one({
                "id": nid(), "event_id": ev["id"], "category": c.get("category", "Other"),
                "label": c.get("label", "Estimasi AI"), "amount": int(c.get("amount_estimate") or 0),
                "state": "estimated", "source": "blueprint", "created_at": now_iso()})
    if await db.funding_items.count_documents({"event_id": ev["id"]}) == 0 and ev.get("budget"):
        await db.funding_items.insert_one({
            "id": nid(), "event_id": ev["id"], "source": "Organizer Budget", "label": "Anggaran penyelenggara",
            "amount": int(ev["budget"]), "state": "committed", "source_type": "brief", "created_at": now_iso()})
    await audit(ev["id"], user, "event.compile", {"source": bp.get("source")})
    return {"blueprint": clean(doc)}


@api.get("/events/{event_id}/blueprint")
async def get_blueprint(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    bp = await db.event_blueprints.find_one({"event_id": ev["id"]}, {"_id": 0})
    return {"blueprint": bp}


@api.patch("/events/{event_id}/blueprint")
async def patch_blueprint(event_id: str, patch: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    patch.pop("id", None)
    patch.pop("event_id", None)
    await db.event_blueprints.update_one({"event_id": ev["id"]}, {"$set": {**patch, "user_confirmed": True}})
    await audit(ev["id"], user, "blueprint.edit", {"fields": list(patch.keys())})
    bp = await db.event_blueprints.find_one({"event_id": ev["id"]}, {"_id": 0})
    return {"blueprint": bp}


# ---------------------------------------------------------------- talent + rider
@api.get("/events/{event_id}/talents")
async def event_talents(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    rows = await db.event_talents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    riders = await db.rider_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    return {"items": rows, "riders": riders}


@api.post("/events/{event_id}/talents")
async def add_talent(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    talent = await db.talents.find_one({"id": body.get("talent_id")}, {"_id": 0})
    if not talent:
        raise HTTPException(status_code=404, detail="Talent tidak ditemukan")
    if await db.event_talents.find_one({"event_id": ev["id"], "talent_id": talent["id"]}):
        raise HTTPException(status_code=400, detail="Talent sudah ditambahkan ke event ini")
    et_id = nid()
    rider_cost = 0
    for r in talent.get("rider_template", []):
        rider_cost += int(r.get("estimated_cost") or 0)
        await db.rider_items.insert_one({
            "id": nid(), "event_id": ev["id"], "event_talent_id": et_id, "category": r["category"],
            "item": r["item"], "quantity": r["quantity"], "specification": r["specification"],
            "mandatory": r["mandatory"], "responsible_party": "Organizer", "matched_provider": None,
            "status": "Requires Confirmation", "estimated_cost": r["estimated_cost"], "actual_cost": None,
            "notes": "", "created_at": now_iso()})
    fee = int(talent["base_fee"])
    tax = int(fee * 0.02)
    scale = max(1, talent.get("team_size", 1)) / 18
    travel = int(72000000 * scale)
    accommodation = int(48000000 * scale)
    transport = int(24000000 * scale)
    security = int(12000000 * scale)
    hospitality = int(26000000 * scale)
    landed = fee + tax + travel + accommodation + transport + security + hospitality + rider_cost
    doc = {"id": et_id, "event_id": ev["id"], "talent_id": talent["id"], "talent_name": talent["stage_name"],
           "fee": fee, "tax_estimate": tax, "travel": travel, "accommodation": accommodation,
           "local_transport": transport, "security": security, "hospitality": hospitality,
           "rider_cost": rider_cost, "landed_cost": landed, "status": "Pending",
           "performance_slot": body.get("performance_slot") or "", "created_at": now_iso()}
    await db.event_talents.insert_one(doc)
    await audit(ev["id"], user, "talent.add", {"talent": talent["stage_name"], "landed_cost": landed})
    return {"event_talent": clean(doc)}


@api.patch("/events/{event_id}/talents/{et_id}")
async def patch_event_talent(event_id: str, et_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    allowed = {k: v for k, v in body.items() if k in ("status", "performance_slot", "fee")}
    if "fee" in allowed:
        et = await db.event_talents.find_one({"id": et_id})
        delta = int(allowed["fee"]) - int(et["fee"])
        allowed["landed_cost"] = int(et["landed_cost"]) + delta
        allowed["tax_estimate"] = int(int(allowed["fee"]) * 0.02)
    await db.event_talents.update_one({"id": et_id, "event_id": ev["id"]}, {"$set": allowed})
    await audit(ev["id"], user, "talent.update", allowed)
    return {"ok": True}


@api.delete("/events/{event_id}/talents/{et_id}")
async def remove_talent(event_id: str, et_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    await db.event_talents.delete_one({"id": et_id, "event_id": ev["id"]})
    await db.rider_items.delete_many({"event_talent_id": et_id})
    await audit(ev["id"], user, "talent.remove", {"event_talent_id": et_id})
    return {"ok": True}


@api.patch("/events/{event_id}/rider/{item_id}")
async def patch_rider(event_id: str, item_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    allowed = {k: v for k, v in body.items()
               if k in ("status", "matched_provider", "responsible_party", "estimated_cost", "actual_cost", "notes")}
    await db.rider_items.update_one({"id": item_id, "event_id": ev["id"]}, {"$set": allowed})
    items = await db.rider_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    by_talent: Dict[str, int] = {}
    for i in items:
        by_talent[i["event_talent_id"]] = by_talent.get(i["event_talent_id"], 0) + int(i.get("estimated_cost") or 0)
    for et_id, cost in by_talent.items():
        et = await db.event_talents.find_one({"id": et_id})
        if et:
            new_landed = (int(et["landed_cost"]) - int(et["rider_cost"])) + cost
            await db.event_talents.update_one({"id": et_id}, {"$set": {"rider_cost": cost, "landed_cost": new_landed}})
    await audit(ev["id"], user, "rider.update", {"item": item_id, **allowed})
    return {"ok": True}


# ---------------------------------------------------------------- venue
def venue_score(ev: dict, v: dict) -> dict:
    reasons, score = [], 0
    cap = max(v["standing_capacity"], v["seated_capacity"])
    if cap >= ev["capacity"]:
        score += 30
        reasons.append(f"Kapasitas {cap:,} memenuhi target {ev['capacity']:,} pengunjung")
    else:
        reasons.append(f"Kapasitas {cap:,} di bawah target {ev['capacity']:,} pengunjung")
    if v["city"].lower() == (ev.get("city") or "").lower():
        score += 20
        reasons.append(f"Berlokasi di {v['city']} sesuai brief")
    else:
        reasons.append(f"Berada di {v['city']}, di luar kota target")
    if ev.get("indoor") == v["indoor"]:
        score += 10
        reasons.append("Tipe indoor/outdoor sesuai preferensi")
    if v.get("power_kva", 0) >= 400:
        score += 15
        reasons.append(f"Power {v['power_kva']} kVA mendukung rider produksi")
    else:
        reasons.append("Power terbatas, membutuhkan genset tambahan")
    total = v["event_day_price"] * ev.get("days", 1) + v["setup_day_price"] * ev.get("setup_days", 0)
    if ev.get("budget") and total <= ev["budget"] * 0.25:
        score += 15
        reasons.append(f"Biaya venue Rp{total:,} berada dalam 25% anggaran")
    else:
        reasons.append(f"Biaya venue Rp{total:,} relatif tinggi terhadap anggaran")
    if v.get("accessibility"):
        score += 10
        reasons.append("Informasi aksesibilitas tersedia: " + ", ".join(v["accessibility"][:3]))
    return {"score": min(score, 100), "reasons": reasons, "estimated_total": total}


# -------------------------------------------------- Phase F3 supply helpers
def _date_range(ev: Dict[str, Any]) -> List[str]:
    """Return the list of ISO date strings the event physically occupies
    (start_date .. end_date inclusive). Returns [] on malformed input so
    the availability helper degrades to 'Unknown' rather than crashing."""
    try:
        start = datetime.fromisoformat(ev["start_date"])
        end = datetime.fromisoformat(ev.get("end_date") or ev["start_date"])
    except Exception:
        return []
    if end < start:
        return []
    out = []
    cur = start
    while cur <= end:
        out.append(cur.date().isoformat())
        cur = cur + timedelta(days=1)
    return out


async def _resource_availability(resource_type: str, resource_id: str,
                                 dates: List[str]) -> Dict[str, Any]:
    """Deterministic availability signal derived from EXISTING event
    assignments (event_talents/event_venues/event_vendors/event_workers)
    plus `calendar_entries` exceptions. Returns:

    - status: "Available" | "Tentative" | "Booked" | "Conflict" | "Unknown"
    - conflicting_event_ids: [] (empty unless Booked/Conflict)

    Never fabricates data. When there is no signal at all, returns
    Unknown per V5 §4 rule.
    """
    if not dates:
        return {"status": "Unknown", "conflicting_event_ids": []}
    coll_key = {"talent": ("event_talents", "talent_id"),
                "venue": ("event_venues", "venue_id"),
                "vendor": ("event_vendors", "vendor_id"),
                "worker": ("event_workers", "worker_id")}.get(resource_type)
    if not coll_key:
        return {"status": "Unknown", "conflicting_event_ids": []}
    coll_name, key_field = coll_key
    assignments = await db[coll_name].find(
        {key_field: resource_id}, {"_id": 0, "event_id": 1, "status": 1}
    ).to_list(500)
    if not assignments:
        return {"status": "Available", "conflicting_event_ids": []}
    event_ids = [a["event_id"] for a in assignments]
    events = await db.events.find(
        {"id": {"$in": event_ids}, "deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "start_date": 1, "end_date": 1},
    ).to_list(500)
    ev_by_id = {e["id"]: e for e in events}
    booked, tentative = [], []
    target_days = set(dates)
    for a in assignments:
        ev = ev_by_id.get(a["event_id"])
        if not ev:
            continue
        ev_days = set(_date_range(ev))
        if not (ev_days & target_days):
            continue
        confirmed_like = str(a.get("status", "")).lower() in (
            "confirmed", "signed", "paid", "in progress")
        (booked if confirmed_like else tentative).append(a["event_id"])
    if booked:
        return {"status": "Booked", "conflicting_event_ids": booked}
    if tentative:
        return {"status": "Tentative", "conflicting_event_ids": tentative}
    return {"status": "Available", "conflicting_event_ids": []}


def talent_score(ev: Dict[str, Any], t: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic talent match score, mirrors venue/vendor style."""
    score = 0
    reasons: List[str] = []
    if t.get("city") == ev.get("city"):
        score += 25
        reasons.append(f"Berbasis di {t['city']} sesuai kota event")
    elif t.get("city"):
        reasons.append(f"Berbasis di {t['city']}, luar kota event")
    genres = " ".join([t.get("genre") or "", t.get("category") or ""]).lower()
    event_type = (ev.get("event_type") or "").lower()
    if event_type and any(word in genres for word in event_type.split()):
        score += 20
        reasons.append(f"Genre selaras dengan tipe event {ev.get('event_type')}")
    base_fee = int(t.get("base_fee") or 0)
    budget = int(ev.get("budget") or 0)
    if budget and base_fee:
        if base_fee <= budget * 0.4:
            score += 20
            reasons.append(f"Fee Rp{base_fee:,} dalam 40% anggaran")
        elif base_fee <= budget * 0.7:
            score += 10
            reasons.append(f"Fee Rp{base_fee:,} pada 40-70% anggaran")
        else:
            reasons.append(f"Fee Rp{base_fee:,} melebihi 70% anggaran")
    if t.get("verified"):
        score += 15
        reasons.append("Talent terverifikasi")
    delivery = int(t.get("delivery_score") or 0)
    if delivery:
        score += min(20, delivery // 5)
        reasons.append(f"Delivery score {delivery}/100")
    return {"score": min(score, 100), "reasons": reasons}


def worker_score(ev: Dict[str, Any], w: Dict[str, Any],
                  needed_roles: Optional[List[str]] = None) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []
    cat = w.get("category", "")
    if needed_roles and cat in needed_roles:
        score += 35
        reasons.append(f"Role {cat} sesuai kebutuhan blueprint")
    elif needed_roles:
        reasons.append(f"Role {cat} di luar daftar kebutuhan")
    if w.get("city") == ev.get("city"):
        score += 20
        reasons.append(f"Berbasis di {w['city']} sesuai kota event")
    elif w.get("city"):
        reasons.append(f"Berbasis di {w['city']}, luar kota event")
    if w.get("verified"):
        score += 15
        reasons.append("Pekerja terverifikasi")
    attendance = int(w.get("attendance_rate") or 0)
    if attendance:
        score += min(20, attendance // 5)
        reasons.append(f"Attendance rate {attendance}%")
    completed = int(w.get("completed_events") or 0)
    if completed:
        score += min(10, completed)
        reasons.append(f"{completed} event selesai")
    return {"score": min(score, 100), "reasons": reasons}


@api.get("/events/{event_id}/talent-matches")
async def talent_matches(event_id: str, user: dict = Depends(get_current_user)):
    """Phase F3 parity with venue-matches / vendor-matches. Authorized
    org-scope only."""
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    talents = await db.talents.find({}, {"_id": 0}).to_list(300)
    dates = _date_range(ev)
    out = []
    for t in talents:
        avail = await _resource_availability("talent", t["id"], dates)
        out.append({**t, "match": talent_score(ev, t), "availability": avail})
    out.sort(key=lambda x: -x["match"]["score"])
    return {"items": out}


@api.get("/events/{event_id}/worker-matches")
async def worker_matches(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    jobs = await db.event_jobs.find(
        {"event_id": ev["id"]}, {"_id": 0, "role": 1}
    ).to_list(100)
    needed = [j["role"] for j in jobs] or None
    workers = await db.workers.find({}, {"_id": 0}).to_list(300)
    dates = _date_range(ev)
    out = []
    for w in workers:
        avail = await _resource_availability("worker", w["id"], dates)
        out.append({**w, "match": worker_score(ev, w, needed), "availability": avail})
    out.sort(key=lambda x: -x["match"]["score"])
    return {"items": out, "needed_roles": needed or []}


@api.get("/events/{event_id}/venue-matches")
async def venue_matches(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    venues = await db.venues.find({}, {"_id": 0}).to_list(200)
    dates = _date_range(ev)
    out = []
    for v in venues:
        avail = await _resource_availability("venue", v["id"], dates)
        out.append({**v, "compatibility": venue_score(ev, v), "availability": avail})
    out.sort(key=lambda x: -x["compatibility"]["score"])
    return {"items": out}


@api.get("/events/{event_id}/venue")
async def get_event_venue(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    return {"item": await db.event_venues.find_one({"event_id": ev["id"]}, {"_id": 0})}


@api.post("/events/{event_id}/venue")
async def select_venue(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    v = await db.venues.find_one({"id": body.get("venue_id")}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Venue tidak ditemukan")
    comp = venue_score(ev, v)
    doc = {"id": nid(), "event_id": ev["id"], "venue_id": v["id"], "venue_name": v["name"],
           "event_days": ev.get("days", 1), "setup_days": ev.get("setup_days", 0),
           "total_cost": comp["estimated_total"], "deposit": v["deposit"], "status": "Confirmed",
           "compatibility": {"score": comp["score"], "reasons": comp["reasons"]}, "created_at": now_iso()}
    await db.event_venues.delete_many({"event_id": ev["id"]})
    await db.event_venues.insert_one(doc)
    await db.events.update_one({"id": ev["id"]}, {"$set": {"venue_name": v["name"], "indoor": v["indoor"]}})
    await audit(ev["id"], user, "venue.select", {"venue": v["name"], "score": comp["score"]})
    return {"item": clean(doc)}


# ---------------------------------------------------------------- vendors + workforce
@api.get("/events/{event_id}/vendor-matches")
async def vendor_matches(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    bp = await db.event_blueprints.find_one({"event_id": ev["id"]}, {"_id": 0}) or {}
    needed = [r["category"] for r in bp.get("vendor_requirements", [])] or \
             ["Event Organizer", "Stage", "Sound", "Lighting", "LED", "Security", "Medical"]
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(300)
    out = []
    dates = _date_range(ev)
    for v in vendors:
        match = 40 if v["category"] in needed else 10
        reasons = [f"Kategori {v['category']}" + (" sesuai kebutuhan blueprint" if v["category"] in needed else " tidak pada daftar kebutuhan")]
        if (ev.get("city") in v.get("service_cities", [])):
            match += 25
            reasons.append(f"Melayani {ev.get('city')}")
        if v.get("verified"):
            match += 15
            reasons.append("Dokumen bisnis terverifikasi")
        match += min(20, int(v.get("delivery_score", 0) / 5))
        reasons.append(f"Delivery record {v.get('delivery_score')}/100, respons ~{v.get('response_hours')} jam")
        avail = await _resource_availability("vendor", v["id"], dates)
        out.append({**v, "match": {"score": min(match, 100), "reasons": reasons},
                    "availability": avail})
    out.sort(key=lambda x: -x["match"]["score"])
    return {"items": out, "needed_categories": needed}


@api.get("/events/{event_id}/vendors")
async def get_event_vendors(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    return {"items": await db.event_vendors.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)}


@api.post("/events/{event_id}/vendors")
async def add_vendor(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    v = await db.vendors.find_one({"id": body.get("vendor_id")}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor tidak ditemukan")
    cost = int(body.get("cost") or (v["price_min"] + v["price_max"]) // 2)
    doc = {"id": nid(), "event_id": ev["id"], "vendor_id": v["id"], "vendor_name": v["name"],
           "category": v["category"], "cost": cost, "status": body.get("status", "Pending"),
           "created_at": now_iso()}
    await db.event_vendors.insert_one(doc)
    await audit(ev["id"], user, "vendor.add", {"vendor": v["name"], "cost": cost})
    return {"item": clean(doc)}


@api.patch("/events/{event_id}/vendors/{item_id}")
async def patch_vendor(event_id: str, item_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    allowed = {k: v for k, v in body.items() if k in ("status", "cost")}
    await db.event_vendors.update_one({"id": item_id, "event_id": ev["id"]}, {"$set": allowed})
    return {"ok": True}


@api.get("/events/{event_id}/workforce")
async def get_workforce(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    jobs = await db.event_jobs.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    workers = await db.event_workers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(300)
    pool = await db.workers.find({}, {"_id": 0}).to_list(300)
    return {"jobs": jobs, "assigned": workers, "pool": pool}


@api.post("/events/{event_id}/jobs")
async def create_job(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "role": body["role"], "needed": int(body.get("needed") or 1),
           "shift": body.get("shift", "Show day"), "location": ev.get("venue_name") or ev["city"],
           "compensation_per_day": int(body.get("compensation_per_day") or 300000),
           "days": int(body.get("days") or ev.get("days", 1)), "supervisor": body.get("supervisor", "Event Supervisor"),
           "required_skills": body.get("required_skills", [body["role"]]), "filled": 0, "status": "Not Started",
           "created_at": now_iso()}
    await db.event_jobs.insert_one(doc)
    await audit(ev["id"], user, "job.create", {"role": doc["role"], "needed": doc["needed"]})
    return {"item": clean(doc)}


@api.post("/events/{event_id}/workers")
async def assign_worker(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    w = await db.workers.find_one({"id": body.get("worker_id")}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Pekerja tidak ditemukan")
    doc = {"id": nid(), "event_id": ev["id"], "worker_id": w["id"], "worker_name": w["name"],
           "role": w["category"], "job_id": body.get("job_id"), "status": "Selected", "check_in_at": None,
           "payment_status": "Scheduled", "created_at": now_iso()}
    await db.event_workers.insert_one(doc)
    if body.get("job_id"):
        await db.event_jobs.update_one({"id": body["job_id"]}, {"$inc": {"filled": 1}, "$set": {"status": "In Progress"}})
    return {"item": clean(doc)}


@api.post("/events/{event_id}/workers/{item_id}/checkin")
async def worker_checkin(event_id: str, item_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    await db.event_workers.update_one({"id": item_id, "event_id": ev["id"]},
                                      {"$set": {"status": "Checked In", "check_in_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------- sponsors
@api.get("/events/{event_id}/sponsor-packages")
async def list_packages(event_id: str, user: Optional[dict] = Depends(get_optional_user)):
    ev = await get_event_or_404(event_id)
    if not await _event_visible_to_public_caller(ev, user):
        raise HTTPException(status_code=404, detail="Event not found")
    rows = await db.sponsor_packages.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    return {"items": rows}


@api.post("/events/{event_id}/sponsor-packages")
async def create_package(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "name": body["name"], "tier": body.get("tier", body["name"]),
           "price": int(body["price"]), "quantity": int(body.get("quantity") or 1), "sold": 0,
           "rights": body.get("rights", []), "exclusivity": body.get("exclusivity", "Open"),
           "deadline": body.get("deadline", ev["start_date"]),
           "deliverables": [{"item": r, "status": "Not Started"} for r in body.get("rights", [])],
           "audience_profile": ev.get("audience_profile", ""), "estimated_attendance": ev.get("capacity"),
           "status": "Open", "created_at": now_iso()}
    await db.sponsor_packages.insert_one(doc)
    await audit(ev["id"], user, "sponsor_package.create", {"name": doc["name"], "price": doc["price"]})
    return {"item": clean(doc)}


@api.get("/sponsor/opportunities")
async def sponsor_opportunities(city: str = "", category: str = ""):
    f = {"status": "published", "deleted": {"$ne": True}}
    if city:
        f["city"] = city
    if category:
        f["event_type"] = {"$regex": category, "$options": "i"}
    events = await db.events.find(f, {"_id": 0}).to_list(100)
    out = []
    for ev in events:
        pkgs = await db.sponsor_packages.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
        available = [p for p in pkgs if p["sold"] < p["quantity"]]
        if available:
            out.append({"event": ev, "packages": available})
    return {"items": out}


@api.post("/sponsor-interests")
async def create_interest(body: Dict[str, Any], user: dict = Depends(require_roles("sponsor", "organizer"))):
    pkg = await db.sponsor_packages.find_one({"id": body.get("package_id")}, {"_id": 0})
    if not pkg:
        raise HTTPException(status_code=404, detail="Sponsor package tidak ditemukan")
    if pkg["sold"] >= pkg["quantity"]:
        raise HTTPException(status_code=400, detail="Paket sponsor sudah penuh")
    ev = await get_event_or_404(pkg["event_id"])
    doc = {"id": nid(), "event_id": pkg["event_id"], "package_id": pkg["id"], "package_name": pkg["name"],
           "sponsor_org_id": user.get("org_id"), "sponsor_user_id": user["id"], "sponsor_name": user["name"],
           "amount": int(body.get("amount") or pkg["price"]), "message": body.get("message", ""),
           "status": "pending", "created_at": now_iso()}
    await db.sponsor_interests.insert_one(doc)
    await notify(ev["owner_user_id"], "Sponsor interest baru",
                 f"{user['name']} mengajukan minat pada paket {pkg['name']}.", "info", ev["id"])
    await audit(ev["id"], user, "sponsor.interest", {"package": pkg["name"]})
    return {"item": clean(doc)}


@api.get("/sponsor/my-interests")
async def my_interests(user: dict = Depends(get_current_user)):
    rows = await db.sponsor_interests.find({"sponsor_user_id": user["id"]}, {"_id": 0}).to_list(200)
    commits = await db.sponsor_commitments.find(
        {"sponsor_org_id": user.get("org_id")} if user.get("org_id") else {"sponsor_name": user["name"]},
        {"_id": 0}).to_list(200)
    for r in rows + commits:
        ev = await db.events.find_one({"id": r["event_id"]}, {"_id": 0})
        r["event_name"] = (ev or {}).get("name")
    return {"interests": rows, "commitments": commits}


@api.get("/events/{event_id}/sponsor-interests")
async def event_interests(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    return {"items": await db.sponsor_interests.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200),
            "commitments": await db.sponsor_commitments.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)}


@api.post("/sponsor-interests/{interest_id}/decision")
async def decide_interest(interest_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    it = await db.sponsor_interests.find_one({"id": interest_id}, {"_id": 0})
    if not it:
        raise HTTPException(status_code=404, detail="Interest tidak ditemukan")
    ev = await get_event_or_404(it["event_id"])
    await assert_event_access(ev, user, write=True)
    decision = body.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Keputusan harus approved atau rejected")
    await db.sponsor_interests.update_one({"id": interest_id}, {"$set": {"status": decision, "decided_at": now_iso()}})
    if decision == "approved":
        pkg = await db.sponsor_packages.find_one({"id": it["package_id"]})
        await db.sponsor_commitments.insert_one({
            "id": nid(), "event_id": ev["id"], "package_id": it["package_id"], "package_name": it["package_name"],
            "sponsor_org_id": it.get("sponsor_org_id"), "sponsor_name": it["sponsor_name"],
            "amount": it["amount"], "status": "Confirmed", "fulfillment_status": "Not Started",
            "created_at": now_iso()})
        await db.sponsor_packages.update_one({"id": it["package_id"]}, {"$inc": {"sold": 1}})
        if pkg and pkg["sold"] + 1 >= pkg["quantity"]:
            await db.sponsor_packages.update_one({"id": pkg["id"]}, {"$set": {"status": "Fully Committed"}})
        for pct, desc in ((50, "Contract Signed"), (50, "Pre-event Settlement")):
            await db.payment_milestones.insert_one({
                "id": nid(), "event_id": ev["id"], "ref_type": "sponsor", "ref_id": it["id"],
                "ref_name": it["sponsor_name"], "description": desc, "percentage": pct,
                "amount": int(it["amount"] * pct / 100), "due_date": ev["start_date"],
                "condition": desc, "status": "Pending", "created_at": now_iso()})
        await notify(it["sponsor_user_id"], "Sponsorship disetujui",
                     f"Komitmen {it['package_name']} untuk {ev['name']} telah disetujui organizer.", "success", ev["id"])
    else:
        await notify(it["sponsor_user_id"], "Sponsorship belum disetujui",
                     f"Pengajuan {it['package_name']} untuk {ev['name']} ditolak organizer.", "warning", ev["id"])
    await audit(ev["id"], user, "sponsor.decision", {"interest": interest_id, "decision": decision})
    budget = await compute_budget(ev["id"])
    return {"ok": True, "budget": budget}


# ---------------------------------------------------------------- tenants
@api.get("/events/{event_id}/tenant-zones")
async def tenant_zones(event_id: str, user: Optional[dict] = Depends(get_optional_user)):
    ev = await get_event_or_404(event_id)
    if not await _event_visible_to_public_caller(ev, user):
        raise HTTPException(status_code=404, detail="Event not found")
    zones = await db.tenant_zones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    booths = await db.booth_slots.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    return {"zones": zones, "booths": booths}


@api.post("/events/{event_id}/tenant-zones")
async def create_zone(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    zid = nid()
    slots = int(body.get("slots") or 5)
    price = int(body.get("price") or 5000000)
    zone = {"id": zid, "event_id": ev["id"], "name": body["name"], "category": body.get("category", "Retail Pop-up"),
            "area_sqm": int(body.get("area_sqm") or 100), "slots": slots,
            "utilities": body.get("utilities", ["Electricity"]),
            "operating_hours": body.get("operating_hours", "15:00 - 22:00"),
            "description": body.get("description", ""), "created_at": now_iso()}
    await db.tenant_zones.insert_one(zone)
    prefix = "".join([c for c in body["name"].upper() if c.isalpha()])[:3]
    for i in range(slots):
        await db.booth_slots.insert_one({
            "id": nid(), "event_id": ev["id"], "zone_id": zid, "zone_name": zone["name"],
            "code": f"{prefix}-{i+1:02d}", "size": body.get("size", "3m x 3m"), "price": price,
            "deposit": int(price * 0.2), "electricity_watt": int(body.get("electricity_watt") or 1200),
            "furniture": "1 meja, 2 kursi", "position": f"Row {chr(65 + i // 5)}-{i % 5 + 1}",
            "status": "available", "tenant_name": None, "tenant_application_id": None, "created_at": now_iso()})
    await audit(ev["id"], user, "tenant_zone.create", {"zone": zone["name"], "slots": slots})
    return {"item": clean(zone)}


@api.get("/tenant/opportunities")
async def tenant_opportunities(city: str = ""):
    f = {"status": "published", "deleted": {"$ne": True}}
    if city:
        f["city"] = city
    events = await db.events.find(f, {"_id": 0}).to_list(100)
    out = []
    for ev in events:
        booths = await db.booth_slots.find({"event_id": ev["id"], "status": "available"}, {"_id": 0}).to_list(500)
        if booths:
            out.append({"event": ev, "available_booths": len(booths), "booths": booths[:60]})
    return {"items": out}


@api.post("/tenant-applications")
async def apply_booth(body: Dict[str, Any], user: dict = Depends(require_roles("tenant", "organizer"))):
    booth = await db.booth_slots.find_one({"id": body.get("booth_id")}, {"_id": 0})
    if not booth:
        raise HTTPException(status_code=404, detail="Booth tidak ditemukan")
    if booth["status"] != "available":
        raise HTTPException(status_code=400, detail="Booth sudah tidak tersedia")
    ev = await get_event_or_404(booth["event_id"])
    conflicts = []
    dupes = await db.tenant_applications.count_documents({
        "event_id": ev["id"], "product_category": body.get("product_category"), "status": "approved"})
    if dupes >= 3:
        conflicts.append("Duplicate category: sudah ada 3 tenant pada kategori yang sama")
    if int(body.get("power_watt") or 0) > booth["electricity_watt"]:
        conflicts.append(f"Kebutuhan listrik melebihi kapasitas booth ({booth['electricity_watt']}W)")
    doc = {"id": nid(), "event_id": ev["id"], "booth_id": booth["id"], "booth_code": booth["code"],
           "zone_name": booth["zone_name"], "tenant_user_id": user["id"], "tenant_org_id": user.get("org_id"),
           "business_name": body.get("business_name") or user["name"],
           "product_category": body.get("product_category", "Retail Pop-up"),
           "amount": booth["price"], "deposit": booth["deposit"], "status": "pending",
           "payment_status": "Draft", "power_requirement": f"{body.get('power_watt', 0)}W",
           "staffing": int(body.get("staffing") or 2), "documents": body.get("documents", []),
           "food_safety": body.get("food_safety", False), "compatibility_conflicts": conflicts,
           "checkin_status": "Not Checked In", "created_at": now_iso()}
    await db.tenant_applications.insert_one(doc)
    await db.booth_slots.update_one({"id": booth["id"]}, {"$set": {"status": "reserved", "tenant_application_id": doc["id"],
                                                                   "tenant_name": doc["business_name"]}})
    await notify(ev["owner_user_id"], "Aplikasi tenant baru",
                 f"{doc['business_name']} mengajukan booth {booth['code']}.", "info", ev["id"])
    await audit(ev["id"], user, "tenant.apply", {"booth": booth["code"]})
    return {"item": clean(doc)}


@api.get("/tenant/my-applications")
async def my_applications(user: dict = Depends(get_current_user)):
    rows = await db.tenant_applications.find({"tenant_user_id": user["id"]}, {"_id": 0}).to_list(200)
    for r in rows:
        ev = await db.events.find_one({"id": r["event_id"]}, {"_id": 0})
        r["event_name"] = (ev or {}).get("name")
    return {"items": rows}


@api.get("/events/{event_id}/tenant-applications")
async def event_applications(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    return {"items": await db.tenant_applications.find({"event_id": ev["id"]}, {"_id": 0}).to_list(300)}


@api.post("/tenant-applications/{app_id}/decision")
async def decide_application(app_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ap = await db.tenant_applications.find_one({"id": app_id}, {"_id": 0})
    if not ap:
        raise HTTPException(status_code=404, detail="Aplikasi tidak ditemukan")
    ev = await get_event_or_404(ap["event_id"])
    await assert_event_access(ev, user, write=True)
    decision = body.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Keputusan harus approved atau rejected")
    await db.tenant_applications.update_one({"id": app_id}, {"$set": {
        "status": decision, "payment_status": "Simulated Paid" if decision == "approved" else "Cancelled",
        "decided_at": now_iso()}})
    await db.booth_slots.update_one({"id": ap["booth_id"]}, {"$set": {
        "status": "occupied" if decision == "approved" else "available",
        "tenant_name": ap["business_name"] if decision == "approved" else None,
        "tenant_application_id": ap["id"] if decision == "approved" else None}})
    await notify(ap["tenant_user_id"], f"Aplikasi booth {ap['booth_code']} {'disetujui' if decision == 'approved' else 'ditolak'}",
                 f"Event {ev['name']}", "success" if decision == "approved" else "warning", ev["id"])
    await audit(ev["id"], user, "tenant.decision", {"application": app_id, "decision": decision})
    return {"ok": True, "budget": await compute_budget(ev["id"])}


# ---------------------------------------------------------------- ticketing
@api.get("/events/{event_id}/ticket-tiers")
async def list_tiers(event_id: str, user: Optional[dict] = Depends(get_optional_user)):
    # Step 6C. was fully public. Now serves normally for published/live
    # events (marketplace flow) but returns 404 for draft events unless
    # the caller is authorized on that event (owner/admin/member).
    ev = await get_event_or_404(event_id)
    if not await _event_visible_to_public_caller(ev, user):
        raise HTTPException(status_code=404, detail="Event not found")
    return {"items": await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)}


@api.post("/events/{event_id}/ticket-tiers")
async def create_tier(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "name": body["name"], "ticket_type": body.get("ticket_type", "Regular"),
           "price": int(body.get("price") or 0), "quantity": int(body.get("quantity") or 100), "sold": 0,
           "sale_start": body.get("sale_start", now_iso()[:10]), "sale_end": body.get("sale_end", ev["start_date"]),
           "benefits": body.get("benefits", []), "purchase_limit": int(body.get("purchase_limit") or 4),
           "age_rule": body.get("age_rule", ev.get("age_limit", "All ages")),
           "transfer_rule": body.get("transfer_rule", "Tidak dapat dipindahtangankan"),
           "refund_rule": body.get("refund_rule", "Refund penuh hingga H-14"), "active": True,
           "created_at": now_iso()}
    await db.ticket_tiers.insert_one(doc)
    await audit(ev["id"], user, "tier.create", {"name": doc["name"], "price": doc["price"]})
    return {"item": clean(doc)}


@api.patch("/events/{event_id}/ticket-tiers/{tier_id}")
async def patch_tier(event_id: str, tier_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    tier = await db.ticket_tiers.find_one({"id": tier_id, "event_id": ev["id"]}, {"_id": 0})
    if not tier:
        raise HTTPException(status_code=404, detail="Ticket tier tidak ditemukan")

    allowed = {k: v for k, v in body.items() if k in (
        "name", "ticket_type", "price", "quantity", "active", "sale_end", "benefits",
        "purchase_limit", "age_rule", "transfer_rule", "refund_rule",
    )}
    if "name" in allowed:
        allowed["name"] = str(allowed["name"]).strip()
        if not allowed["name"]:
            raise HTTPException(status_code=400, detail="Nama ticket tier wajib diisi")
    if "ticket_type" in allowed:
        allowed["ticket_type"] = str(allowed["ticket_type"]).strip()
        if not allowed["ticket_type"]:
            raise HTTPException(status_code=400, detail="Tipe ticket tier wajib diisi")
    if "price" in allowed:
        try:
            allowed["price"] = int(allowed["price"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Harga tiket harus berupa angka")
        if allowed["price"] < 0:
            raise HTTPException(status_code=400, detail="Harga tiket tidak boleh negatif")
    if "quantity" in allowed:
        try:
            allowed["quantity"] = int(allowed["quantity"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Kuota tiket harus berupa angka")
        if allowed["quantity"] < int(tier.get("sold") or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Kuota tidak boleh lebih kecil dari {int(tier.get('sold') or 0)} tiket yang sudah terjual",
            )
    if "purchase_limit" in allowed:
        try:
            allowed["purchase_limit"] = int(allowed["purchase_limit"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Batas pembelian harus berupa angka")
        if allowed["purchase_limit"] < 1:
            raise HTTPException(status_code=400, detail="Batas pembelian minimal 1 tiket")

    allowed["updated_at"] = now_iso()
    await db.ticket_tiers.update_one({"id": tier_id, "event_id": ev["id"]}, {"$set": allowed})
    updated = await db.ticket_tiers.find_one({"id": tier_id, "event_id": ev["id"]}, {"_id": 0})
    await audit(ev["id"], user, "tier.update", {
        "tier_id": tier_id,
        "changes": {k: v for k, v in allowed.items() if k != "updated_at"},
    })
    return {"ok": True, "item": updated}


@api.post("/events/{event_id}/publish")
async def publish_event(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    tiers = await db.ticket_tiers.count_documents({"event_id": ev["id"]})
    venue = await db.event_venues.find_one({"event_id": ev["id"]})
    missing = []
    if not venue:
        missing.append("Venue belum dipilih")
    if tiers == 0:
        missing.append("Belum ada ticket tier")
    if missing:
        raise HTTPException(status_code=400, detail="Belum dapat dipublikasikan: " + "; ".join(missing))
    await db.events.update_one({"id": ev["id"]}, {"$set": {"status": "published", "published_at": now_iso()}})
    await audit(ev["id"], user, "event.publish")
    await notify(user["id"], "Event dipublikasikan", f"{ev['name']} kini tampil di OKKAX Discover.", "success", ev["id"])
    return {"ok": True, "status": "published"}


@api.get("/discover/events")
async def discover(city: str = "", category: str = "", q: str = "", free: Optional[bool] = None,
                   sort: str = "trending"):
    f = {"status": {"$in": ["published", "live"]}, "deleted": {"$ne": True}}
    if city:
        f["city"] = city
    if category:
        f["event_type"] = {"$regex": category, "$options": "i"}
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    events = await db.events.find(f, {"_id": 0}).to_list(400)
    today = datetime.now().date()
    ids = [ev["id"] for ev in events]

    # Batched lookups: satu query per koleksi (bukan per event). Untuk 136 event ini
    # menurunkan >1.600 query menjadi delapan, sehingga /discover/events tidak lagi
    # timeout di produksi.
    async def group(coll: str, extra: dict | None = None) -> dict:
        query: dict = {"event_id": {"$in": ids}}
        if extra:
            query.update(extra)
        rows = await db[coll].find(query, {"_id": 0}).to_list(20000)
        by_event: dict = defaultdict(list)
        for row in rows:
            by_event[row["event_id"]].append(row)
        return by_event

    tiers_by = await group("ticket_tiers")
    talents_by = await group("event_talents")
    booths_by = await group("booth_slots", {"status": "occupied"})
    pkgs_by = await group("sponsor_packages")
    vendors_by = await group("event_vendors")
    venues_by = await group("event_venues")
    jobs_by = await group("event_jobs")
    budget_items_by = await group("budget_items")

    out = []
    for ev in events:
        eid = ev["id"]
        tiers = tiers_by.get(eid, [])
        prices = [t["price"] for t in tiers if t.get("active")]
        remaining = sum(max(0, t["quantity"] - t["sold"]) for t in tiers)
        total_qty = sum(t["quantity"] for t in tiers) or 1
        sold = sum(t["sold"] for t in tiers)
        if free is True and (not prices or min(prices) > 0):
            continue
        if free is False and prices and min(prices) == 0:
            continue
        talents = talents_by.get(eid, [])
        booths = booths_by.get(eid, [])
        pkgs = pkgs_by.get(eid, [])
        vendors_list = vendors_by.get(eid, [])
        # total_cost mengikuti struktur compute_budget: talent landed_cost + venue
        # total_cost + vendor cost + workforce (needed × comp × days) + budget_items.
        total_cost = (
            sum(t.get("landed_cost", 0) for t in talents)
            + sum(v.get("total_cost", 0) for v in venues_by.get(eid, []))
            + sum(v.get("cost", 0) for v in vendors_list)
            + sum(j.get("needed", 0) * j.get("compensation_per_day", 0) * j.get("days", 1)
                  for j in jobs_by.get(eid, []))
            + sum(b.get("amount", 0) for b in budget_items_by.get(eid, []))
        )
        ticket_gmv = sum(t["sold"] * t["price"] for t in tiers)
        tenant_revenue = sum(x.get("price") or 0 for x in booths)
        try:
            start = datetime.fromisoformat(ev["start_date"]).date()
            end = datetime.fromisoformat(ev.get("end_date") or ev["start_date"]).date()
        except Exception:
            start = end = today
        days_to = (start - today).days
        out.append({**ev, "min_price": min(prices) if prices else 0, "max_price": max(prices) if prices else 0,
                    "tickets_remaining": remaining, "sold": sold,
                    "almost_sold_out": remaining / total_qty < 0.2, "tiers": tiers,
                    "sold_percentage": round(sold / total_qty * 100),
                    "headline_talent": talents[0]["talent_name"] if talents else None,
                    "talent_count": len(talents), "tenant_count": len(booths),
                    "vendor_count": len(vendors_list),
                    "sponsor_slots": sum(p["quantity"] for p in pkgs),
                    "sponsor_sold": sum(p["sold"] for p in pkgs),
                    "economic_ripple": total_cost + ticket_gmv + tenant_revenue,
                    "is_live": start <= today <= end, "days_to_event": days_to,
                    "this_week": 0 <= days_to <= 7})
    if sort == "date":
        out.sort(key=lambda x: x.get("start_date") or "")
    else:
        out.sort(key=lambda x: -x["sold"])
    cities = sorted({e["city"] for e in out})
    categories = sorted({e["event_type"] for e in out})
    highlights = {
        "live": [e["id"] for e in out if e["is_live"]],
        "this_week": [e["id"] for e in out if e["this_week"] and not e["is_live"]],
        "almost_sold_out": [e["id"] for e in sorted(out, key=lambda x: -x["sold_percentage"]) if e["sold_percentage"] >= 70][:12],
        "top_impact": [e["id"] for e in sorted(out, key=lambda x: -x["economic_ripple"])[:12]],
    }
    return {"items": out, "cities": cities, "categories": categories, "total": len(out),
            "highlights": highlights,
            "totals": {"events": len(out), "cities": len(cities), "categories": len(categories),
                       "economic_ripple": sum(e["economic_ripple"] for e in out),
                       "tickets_sold": sum(e["sold"] for e in out)}}


@api.get("/public/events/{event_id}")
async def public_event(event_id: str):
    ev = await get_event_or_404(event_id)
    if ev.get("status") not in ("published", "live", "completed"):
        raise HTTPException(status_code=404, detail="Event belum dipublikasikan")
    tiers = await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    talents = await db.event_talents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    talent_details = []
    for t in talents:
        tal = await db.talents.find_one({"id": t["talent_id"]},
                                        {"_id": 0, "base_fee": 0, "fee_min": 0, "fee_max": 0, "rider_template": 0})
        if tal:
            talent_details.append({**tal, "status": t["status"], "slot": t.get("performance_slot")})
    venue_link = await db.event_venues.find_one({"event_id": ev["id"]}, {"_id": 0})
    venue = await db.venues.find_one({"id": (venue_link or {}).get("venue_id")}, {"_id": 0}) if venue_link else None
    sponsors = await db.sponsor_commitments.find({"event_id": ev["id"], "status": "Confirmed"},
                                                 {"_id": 0, "amount": 0}).to_list(50)
    tenants = await db.tenant_applications.find({"event_id": ev["id"], "status": "approved"},
                                                {"_id": 0, "amount": 0, "documents": 0}).to_list(100)
    schedule = await db.schedule_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    org = await db.organizations.find_one({"id": ev.get("organizer_org_id")}, {"_id": 0})
    readiness = {
        "organizer_verified": bool((org or {}).get("verified")),
        "venue_confirmed": bool(venue_link and venue_link.get("status") == "Confirmed"),
        "talent_confirmed": any(t["status"] == "Confirmed" for t in talents),
        "ticketing_active": any(t.get("active") for t in tiers),
        "refund_policy_available": bool(ev.get("refund_policy")),
        "accessibility_info_available": bool(ev.get("accessibility")),
    }
    return {"event": ev, "tiers": tiers, "talents": talent_details, "venue": venue, "sponsors": sponsors,
            "tenant_highlights": tenants[:12], "schedule": schedule, "organizer": clean(org) if org else None,
            "readiness": readiness, "disclaimer": DISCLAIMER if ev.get("is_demo") else None}


@api.post("/checkout")
async def checkout(payload: CheckoutIn, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(payload.event_id)
    tier = await db.ticket_tiers.find_one({"id": payload.tier_id, "event_id": ev["id"]}, {"_id": 0})
    if not tier:
        raise HTTPException(status_code=404, detail="Ticket tier tidak ditemukan")
    if not tier.get("active"):
        raise HTTPException(status_code=400, detail="Tier ini sedang tidak dijual")
    remaining = tier["quantity"] - tier["sold"]
    if payload.quantity > remaining:
        raise HTTPException(status_code=400, detail=f"Sisa tiket hanya {remaining}")
    if payload.quantity > tier.get("purchase_limit", 4):
        raise HTTPException(status_code=400, detail=f"Maksimum {tier['purchase_limit']} tiket per transaksi")
    method_valid = any(m["key"] == payload.method and m["available"] for m in PAYMENT_METHODS)
    if not method_valid:
        raise HTTPException(status_code=400, detail="Metode pembayaran belum tersedia pada MVP sandbox")
    gross = tier["price"] * payload.quantity
    platform_fee = int(gross * 0.03)
    tax = int(gross * 0.11)
    gateway_fee = 4000 if gross else 0
    total = gross + platform_fee + tax
    count = await db.ticket_orders.count_documents({}) + 1
    order_id = nid()
    payment_id = nid()
    order = {"id": order_id, "order_code": f"OKX-ORD-{count:06d}", "event_id": ev["id"], "event_name": ev["name"],
             "tier_id": tier["id"], "tier_name": tier["name"], "user_id": user["id"], "buyer_name": user["name"],
             "buyer_email": user["email"], "quantity": payload.quantity,
             "attendees": payload.attendees or [{"name": user["name"]}], "gross": gross,
             "platform_fee": platform_fee, "tax": tax, "total": total, "currency": "IDR",
             "status": "awaiting_payment", "payment_id": payment_id, "created_at": now_iso()}
    await db.ticket_orders.insert_one(order)
    payment = {"id": payment_id, "payment_ref": f"OKX-PAY-{count:06d}", "order_id": order_id, "event_id": ev["id"],
               "payer_user_id": user["id"], "payer_name": user["name"], "payee": "OKKAX Sandbox Settlement",
               "purpose": "Ticket purchase", "gross": gross, "discount": 0, "tax_estimate": tax,
               "platform_fee": platform_fee, "gateway_fee": gateway_fee, "net": total - platform_fee - gateway_fee,
               "currency": "IDR", "method": payload.method, "method_channel": payload.method_channel,
               "status": "Awaiting Payment", "created_at": now_iso(),
               "due_date": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
               "expired_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
               "paid_at": None, "refund_status": None,
               "reference_number": f"{payload.method[:3].upper()}-{secrets.randbelow(9999999999):010d}",
               "audit": [{"at": now_iso(), "action": "created", "by": user["email"]}],
               "sandbox_notice": SANDBOX_NOTICE}
    await db.payments.insert_one(payment)
    await audit(ev["id"], user, "order.create", {"order": order["order_code"], "total": total})
    return {"order": clean(order), "payment": clean(payment), "sandbox_notice": SANDBOX_NOTICE}


@api.post("/payments/{payment_id}/simulate")
async def simulate_payment(payment_id: str, body: Dict[str, Any] = None, user: dict = Depends(get_current_user)):
    body = body or {}
    pay = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment tidak ditemukan")
    if pay["payer_user_id"] != user["id"] and not is_admin(user):
        raise HTTPException(status_code=403, detail="Bukan pembayaran Anda")
    if pay["status"] == "Simulated Paid":
        return {"payment": pay, "already": True}
    outcome = body.get("outcome", "success")
    if outcome == "fail":
        await db.payments.update_one({"id": payment_id}, {"$set": {"status": "Failed"},
                                                          "$push": {"audit": {"at": now_iso(), "action": "failed"}}})
        await db.ticket_orders.update_one({"id": pay["order_id"]}, {"$set": {"status": "failed"}})
        return {"payment": {**pay, "status": "Failed"}}
    order = await db.ticket_orders.find_one({"id": pay["order_id"]}, {"_id": 0})
    tier = await db.ticket_tiers.find_one({"id": order["tier_id"]}, {"_id": 0})
    remaining = tier["quantity"] - tier["sold"]
    if order["quantity"] > remaining:
        raise HTTPException(status_code=400, detail="Inventory tidak lagi tersedia")
    await db.payments.update_one({"id": payment_id}, {
        "$set": {"status": "Simulated Paid", "paid_at": now_iso()},
        "$push": {"audit": {"at": now_iso(), "action": "simulated_paid", "channel": pay["method_channel"]}}})
    await db.ticket_orders.update_one({"id": order["id"]}, {"$set": {"status": "paid"}})
    await db.ticket_tiers.update_one({"id": tier["id"]}, {"$inc": {"sold": order["quantity"]}})
    total_tickets = await db.tickets.count_documents({})
    tickets = []
    ev = await get_event_or_404(order["event_id"])
    for i in range(order["quantity"]):
        tno = f"OKX-TIX-{total_tickets + i + 1:06d}"
        att = order["attendees"][i]["name"] if i < len(order["attendees"]) else order["buyer_name"]
        t = {"id": nid(), "ticket_number": tno, "qr_code": f"OKKAX|{ev['event_code']}|{tno}",
             "order_id": order["id"], "event_id": ev["id"], "event_name": ev["name"], "tier_id": tier["id"],
             "tier_name": tier["name"], "attendee_name": att, "user_id": order["user_id"], "status": "valid",
             "used_at": None, "created_at": now_iso()}
        await db.tickets.insert_one(t)
        tickets.append(clean(t))
    await notify(order["user_id"], "Pembayaran sandbox berhasil",
                 f"{order['quantity']} tiket {tier['name']} untuk {ev['name']} telah diterbitkan.", "success", ev["id"])
    await notify(ev["owner_user_id"], "Penjualan tiket baru",
                 f"{order['quantity']} tiket {tier['name']} terjual (sandbox).", "info", ev["id"])
    await audit(ev["id"], user, "payment.simulated_paid", {"payment_ref": pay["payment_ref"]})
    return {"payment": {**pay, "status": "Simulated Paid"}, "tickets": tickets,
            "budget": await compute_budget(ev["id"])}


@api.get("/my/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    orders = await db.ticket_orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for o in orders:
        o["payment"] = await db.payments.find_one({"id": o.get("payment_id")}, {"_id": 0})
    return {"items": orders}


@api.get("/my/tickets")
async def my_tickets(user: dict = Depends(get_current_user)):
    rows = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
    for t in rows:
        ev = await db.events.find_one({"id": t["event_id"]}, {"_id": 0})
        t["event"] = {"start_date": (ev or {}).get("start_date"), "venue_name": (ev or {}).get("venue_name"),
                      "city": (ev or {}).get("city"), "start_time": (ev or {}).get("start_time"),
                      "gate_info": (ev or {}).get("gate_info")}
    return {"items": rows}


@api.get("/my/refunds")
async def my_refunds(user: dict = Depends(get_current_user)):
    return {"items": await db.refunds.find({"requested_by": user["id"]}, {"_id": 0}).to_list(100)}


@api.post("/orders/{order_id}/refund")
async def request_refund(order_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    order = await db.ticket_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if order["user_id"] != user["id"] and not is_admin(user):
        raise HTTPException(status_code=403, detail="Bukan order Anda")
    if order["status"] != "paid":
        raise HTTPException(status_code=400, detail="Hanya order berstatus paid dapat direfund")
    ev = await get_event_or_404(order["event_id"])
    amount = order["total"] if body.get("type", "full") == "full" else int(order["total"] * 0.5)
    r = {"id": nid(), "payment_id": order["payment_id"], "order_id": order_id, "event_id": ev["id"],
         "reason": body.get("reason", "Permintaan pembeli"), "policy": ev.get("refund_policy"),
         "amount": amount, "requested_by": user["id"], "approved_by": "OKKAX Sandbox",
         "status": "Processed", "processed_date": now_iso(), "created_at": now_iso()}
    await db.refunds.insert_one(r)
    await db.ticket_orders.update_one({"id": order_id}, {"$set": {"status": "refunded"}})
    await db.payments.update_one({"id": order["payment_id"]}, {
        "$set": {"status": "Refunded" if amount == order["total"] else "Partially Refunded",
                 "refund_status": "Refunded"},
        "$push": {"audit": {"at": now_iso(), "action": "refunded", "amount": amount}}})
    await db.tickets.update_many({"order_id": order_id}, {"$set": {"status": "refunded"}})
    await db.ticket_tiers.update_one({"id": order["tier_id"]}, {"$inc": {"sold": -order["quantity"]}})
    await notify(user["id"], "Refund diproses (sandbox)", f"Refund Rp{amount:,} untuk {order['order_code']}.", "info", ev["id"])
    await audit(ev["id"], user, "refund.process", {"order": order["order_code"], "amount": amount})
    return {"refund": clean(r)}


class ValidateIn(BaseModel):
    qr_code: str
    event_id: Optional[str] = None


@api.post("/tickets/validate")
async def validate_ticket(payload: ValidateIn, user: dict = Depends(get_current_user)):
    # Step 6B. role gate FIRST, before any DB read that could leak whether
    # a QR is real. Audience, sponsor, tenant, talent, vendor, worker, and
    # finance_approver never pass this line, so they cannot use the endpoint
    # as an oracle either.
    user_roles = set(user.get("roles", []))
    if not is_admin(user) and not user_roles.intersection(TICKET_VALIDATOR_ROLES):
        raise HTTPException(status_code=403, detail="Your role cannot validate tickets")

    t = await db.tickets.find_one({"qr_code": payload.qr_code.strip()}, {"_id": 0})
    if not t:
        t = await db.tickets.find_one({"ticket_number": payload.qr_code.strip()}, {"_id": 0})
    if not t:
        result = "Invalid"
        await db.ticket_validations.insert_one({"id": nid(), "ticket_id": None, "event_id": payload.event_id,
                                                "result": result, "at": now_iso(), "by": user["id"],
                                                "qr_code": payload.qr_code})
        return {"result": result, "message": "QR tidak dikenali oleh OKKAX."}
    # Step 6B. event-scope gate. Authorize against the ticket's REAL
    # event_id, not the client-supplied `payload.event_id`. An organizer
    # of event A must not be able to validate tickets of event B by
    # spoofing the event_id.
    ev = await db.events.find_one({"id": t["event_id"], "deleted": {"$ne": True}}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event untuk tiket ini tidak ditemukan")
    await assert_ticket_validator(ev, user)
    if t["status"] == "used":
        result = "Already Used"
        message = f"Tiket sudah digunakan pada {t.get('used_at')}"
    elif t["status"] in ("cancelled", "refunded"):
        result = t["status"].capitalize()
        message = f"Tiket berstatus {t['status']}"
    else:
        result = "Valid"
        message = f"Selamat masuk, {t['attendee_name']}"
        await db.tickets.update_one({"id": t["id"]}, {"$set": {"status": "used", "used_at": now_iso()}})
    await db.ticket_validations.insert_one({"id": nid(), "ticket_id": t["id"], "event_id": t["event_id"],
                                            "result": result, "at": now_iso(), "by": user["id"],
                                            "qr_code": payload.qr_code})
    return {"result": result, "message": message, "ticket": {**t, "status": "used" if result == "Valid" else t["status"]}}


@api.get("/events/{event_id}/validations")
async def validations(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    return {"items": await db.ticket_validations.find({"event_id": ev["id"]}, {"_id": 0}).sort("at", -1).to_list(100)}


# ---------------------------------------------------------------- budget engine
async def compute_budget(event_id: str) -> dict:
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        return {"total_cost": 0, "confirmed_funding": 0, "funding_gap": 0, "cost_lines": [], "funding_lines": []}
    cost_lines: List[dict] = []
    talents = await db.event_talents.find({"event_id": event_id}, {"_id": 0}).to_list(50)
    for t in talents:
        state = "committed" if t["status"] == "Confirmed" else "estimated"
        cost_lines.append({"category": "Talent", "label": f"{t['talent_name']} (landed cost)",
                           "amount": t["landed_cost"], "state": state, "source": "talent",
                           "breakdown": {"Performance Fee": t["fee"], "Estimated Tax": t["tax_estimate"],
                                         "Travel": t["travel"], "Accommodation": t["accommodation"],
                                         "Local Transport": t["local_transport"], "Security": t["security"],
                                         "Hospitality": t["hospitality"], "Technical Rider": t["rider_cost"]}})
    venue = await db.event_venues.find_one({"event_id": event_id}, {"_id": 0})
    if venue:
        cost_lines.append({"category": "Venue", "label": venue["venue_name"], "amount": venue["total_cost"],
                           "state": "committed" if venue["status"] == "Confirmed" else "estimated", "source": "venue"})
    for v in await db.event_vendors.find({"event_id": event_id}, {"_id": 0}).to_list(200):
        cost_lines.append({"category": v["category"], "label": v["vendor_name"], "amount": v["cost"],
                           "state": "committed" if v["status"] == "Confirmed" else "estimated", "source": "vendor"})
    for j in await db.event_jobs.find({"event_id": event_id}, {"_id": 0}).to_list(100):
        cost_lines.append({"category": "Workforce", "label": f"{j['role']} x{j['needed']} ({j['days']} hari)",
                           "amount": j["needed"] * j["compensation_per_day"] * j.get("days", 1),
                           "state": "estimated", "source": "workforce"})
    for b in await db.budget_items.find({"event_id": event_id}, {"_id": 0}).to_list(200):
        cost_lines.append({"category": b["category"], "label": b["label"], "amount": b["amount"],
                           "state": b.get("state", "estimated"), "source": b.get("source", "manual"),
                           "id": b["id"]})
    total_cost = sum(c["amount"] for c in cost_lines)

    funding_lines: List[dict] = []
    for f in await db.funding_items.find({"event_id": event_id}, {"_id": 0}).to_list(100):
        funding_lines.append({"source": f["source"], "label": f["label"], "amount": f["amount"],
                              "state": f.get("state", "estimated"), "id": f["id"]})
    for c in await db.sponsor_commitments.find({"event_id": event_id, "status": "Confirmed"}, {"_id": 0}).to_list(100):
        funding_lines.append({"source": "Sponsor Commitments", "label": f"{c['sponsor_name']}. {c['package_name']}",
                              "amount": c["amount"], "state": "committed"})
    tenant_rev = 0
    for a in await db.tenant_applications.find({"event_id": event_id, "status": "approved"}, {"_id": 0}).to_list(300):
        tenant_rev += a["amount"]
    if tenant_rev:
        funding_lines.append({"source": "Tenant Revenue", "label": "Booth terkonfirmasi", "amount": tenant_rev,
                              "state": "committed"})
    ticket_rev = 0
    for o in await db.ticket_orders.find({"event_id": event_id, "status": "paid"}, {"_id": 0}).to_list(1000):
        ticket_rev += o["gross"]
    if ticket_rev:
        funding_lines.append({"source": "Ticket Revenue", "label": "Order terbayar (sandbox)", "amount": ticket_rev,
                              "state": "paid"})
    confirmed_funding = sum(f["amount"] for f in funding_lines if f["state"] in ("committed", "paid"))
    tiers = await db.ticket_tiers.find({"event_id": event_id}, {"_id": 0}).to_list(50)
    sell_through = 0.65
    projected_ticket_revenue = int(sum(t["price"] * t["quantity"] for t in tiers) * sell_through)
    weighted_avg = 0
    total_qty = sum(t["quantity"] for t in tiers)
    if total_qty:
        weighted_avg = sum(t["price"] * t["quantity"] for t in tiers) / total_qty
    funding_gap = total_cost - confirmed_funding
    break_even_tickets = int(max(0, funding_gap) / weighted_avg) + 1 if weighted_avg else None
    by_category: Dict[str, int] = {}
    for c in cost_lines:
        by_category[c["category"]] = by_category.get(c["category"], 0) + c["amount"]
    return {"event_id": event_id, "currency": ev.get("currency", "IDR"), "cost_lines": cost_lines,
            "funding_lines": funding_lines, "total_cost": total_cost, "confirmed_funding": confirmed_funding,
            "funding_gap": funding_gap, "projected_ticket_revenue": projected_ticket_revenue,
            "sell_through_assumption": sell_through, "weighted_avg_ticket_price": int(weighted_avg),
            "break_even_tickets": break_even_tickets, "tickets_sold": sum(t["sold"] for t in tiers),
            "cost_by_category": by_category,
            "tax_estimate_note": "Estimasi. Memerlukan verifikasi profesional. Bukan nasihat pajak."}


@api.get("/events/{event_id}/budget")
async def get_budget(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    return await compute_budget(ev["id"])


@api.post("/events/{event_id}/budget-items")
async def add_budget_item(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "category": body.get("category", "Other"),
           "label": body.get("label", "Item baru"), "amount": int(body.get("amount") or 0),
           "state": body.get("state", "estimated"), "source": "manual", "created_at": now_iso()}
    await db.budget_items.insert_one(doc)
    return {"item": clean(doc), "budget": await compute_budget(ev["id"])}


@api.post("/events/{event_id}/funding-items")
async def add_funding_item(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "source": body.get("source", "Other"),
           "label": body.get("label", "Sumber baru"), "amount": int(body.get("amount") or 0),
           "state": body.get("state", "committed"), "created_at": now_iso()}
    await db.funding_items.insert_one(doc)
    return {"item": clean(doc), "budget": await compute_budget(ev["id"])}


@api.post("/events/{event_id}/simulate")
async def simulate(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    base = await compute_budget(ev["id"])
    scenarios = {}
    presets = {"lean": {"production": 0.8, "sell": 0.5, "contingency": 0.03, "ticket": 0.9},
               "balanced": {"production": 1.0, "sell": 0.65, "contingency": 0.05, "ticket": 1.0},
               "premium": {"production": 1.25, "sell": 0.8, "contingency": 0.08, "ticket": 1.15}}
    override = {"sell": body.get("sell_through"), "ticket": body.get("ticket_price_multiplier"),
                "production": body.get("production_multiplier"), "capacity": body.get("capacity")}
    tiers = await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    for key, p in presets.items():
        prod_mult = override["production"] if (override["production"] and body.get("apply_to_all")) else p["production"]
        sell = override["sell"] if (override["sell"] and body.get("apply_to_all")) else p["sell"]
        tmult = override["ticket"] if (override["ticket"] and body.get("apply_to_all")) else p["ticket"]
        cost = int(sum(c["amount"] * (prod_mult if c["category"] not in ("Talent", "Venue") else 1)
                       for c in base["cost_lines"]))
        cost += int(cost * p["contingency"])
        cap = int(override["capacity"] or ev.get("capacity") or 0)
        cap_factor = (cap / ev["capacity"]) if ev.get("capacity") else 1
        ticket_rev = int(sum(t["price"] * tmult * t["quantity"] * cap_factor for t in tiers) * sell)
        confirmed = base["confirmed_funding"]
        gap = cost - confirmed - ticket_rev
        wavg = base["weighted_avg_ticket_price"] * tmult or 1
        scenarios[key] = {
            "label": key.capitalize(), "total_cost": cost, "ticket_revenue": ticket_rev,
            "confirmed_funding": confirmed, "funding_gap": gap,
            "break_even_tickets": int(max(0, cost - confirmed) / wavg) + 1 if wavg else None,
            "capacity": cap, "sell_through": sell, "production_multiplier": prod_mult,
            "risk": "High" if gap > 0 else "Low",
            "local_economic_impact": int(cost * 0.62 + ticket_rev * 0.18)}
    return {"base": {"total_cost": base["total_cost"], "funding_gap": base["funding_gap"]},
            "scenarios": scenarios, "note": "Estimasi AI/simulasi. Perubahan tidak memengaruhi event sebelum Apply Scenario."}


@api.post("/events/{event_id}/apply-scenario")
async def apply_scenario(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    updates = {}
    if body.get("capacity"):
        updates["capacity"] = int(body["capacity"])
    if body.get("scenario"):
        updates["applied_scenario"] = body["scenario"]
    if updates:
        await db.events.update_one({"id": ev["id"]}, {"$set": updates})
    if body.get("ticket_price_multiplier"):
        mult = float(body["ticket_price_multiplier"])
        for t in await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50):
            await db.ticket_tiers.update_one({"id": t["id"]}, {"$set": {"price": int(t["price"] * mult)}})
    await audit(ev["id"], user, "scenario.apply", body)
    return {"ok": True, "budget": await compute_budget(ev["id"])}


# ---------------------------------------------------------------- graph / ripple / ops
@api.get("/events/{event_id}/graph")
async def event_graph(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    nodes, edges = [], []

    def add(nid_, label, kind, status, meta=None):
        nodes.append({"id": nid_, "label": label, "kind": kind, "status": status, "meta": meta or {}})

    add("event", ev["name"], "Event", "Confirmed" if ev["status"] == "published" else "Draft",
        {"event_code": ev["event_code"], "city": ev["city"], "capacity": ev["capacity"]})
    add("organizer", ev.get("organizer_name") or "Organizer", "Organizer", "Confirmed", {})
    edges.append({"source": "event", "target": "organizer", "label": "diselenggarakan oleh"})

    talents = await db.event_talents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    riders = await db.rider_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    for t in talents:
        tid = f"talent-{t['id']}"
        add(tid, t["talent_name"], "Talent", t["status"], {"landed_cost": t["landed_cost"], "fee": t["fee"]})
        edges.append({"source": "event", "target": tid, "label": "talent"})
        rs = [r for r in riders if r["event_talent_id"] == t["id"]]
        missing = [r for r in rs if r["status"] in ("Missing", "Requires Confirmation") and r["mandatory"]]
        rid = f"rider-{t['id']}"
        add(rid, f"Rider {t['talent_name']} ({len(rs)} item)", "Rider",
            "Missing" if missing else "Confirmed", {"items": len(rs), "unconfirmed": len(missing)})
        edges.append({"source": tid, "target": rid, "label": "mengaktifkan"})

    venue = await db.event_venues.find_one({"event_id": ev["id"]}, {"_id": 0})
    if venue:
        add("venue", venue["venue_name"], "Venue", venue["status"],
            {"cost": venue["total_cost"], "score": venue["compatibility"]["score"]})
        edges.append({"source": "event", "target": "venue", "label": "venue"})
    else:
        add("venue", "Venue belum dipilih", "Venue", "Missing", {})
        edges.append({"source": "event", "target": "venue", "label": "venue"})

    for v in await db.event_vendors.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200):
        vid = f"vendor-{v['id']}"
        add(vid, f"{v['vendor_name']} ({v['category']})", "Vendor", v["status"], {"cost": v["cost"]})
        edges.append({"source": "venue" if venue else "event", "target": vid, "label": "vendor"})

    pkgs = await db.sponsor_packages.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    for p in pkgs:
        pid = f"sponsor-{p['id']}"
        st = "Completed" if p["sold"] >= p["quantity"] else ("Pending" if p["sold"] else "Draft")
        add(pid, f"{p['name']} ({p['sold']}/{p['quantity']})", "Sponsor", st,
            {"price": p["price"], "sold": p["sold"]})
        edges.append({"source": "event", "target": pid, "label": "sponsor inventory"})

    zones = await db.tenant_zones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    booths = await db.booth_slots.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    for z in zones:
        zid = f"zone-{z['id']}"
        zb = [b for b in booths if b["zone_id"] == z["id"]]
        occ = len([b for b in zb if b["status"] == "occupied"])
        add(zid, f"{z['name']} ({occ}/{len(zb)} booth)", "Tenant", "Confirmed" if occ else "Pending",
            {"occupied": occ, "total": len(zb)})
        edges.append({"source": "event", "target": zid, "label": "tenant zone"})

    jobs = await db.event_jobs.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    if jobs:
        filled = sum(j["filled"] for j in jobs)
        needed = sum(j["needed"] for j in jobs)
        add("workforce", f"Workforce ({filled}/{needed})", "Worker",
            "Confirmed" if filled >= needed else "At Risk", {"filled": filled, "needed": needed})
        edges.append({"source": "event", "target": "workforce", "label": "workforce"})

    tiers = await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    for t in tiers:
        tid = f"tier-{t['id']}"
        add(tid, f"{t['name']} ({t['sold']}/{t['quantity']})", "Ticket tier",
            "Completed" if t["sold"] >= t["quantity"] else ("Pending" if t["sold"] else "Draft"),
            {"price": t["price"], "sold": t["sold"]})
        edges.append({"source": "event", "target": tid, "label": "ticket tier"})

    b = await compute_budget(ev["id"])
    add("budget", f"Total cost Rp{b['total_cost']:,}", "Budget",
        "At Risk" if b["funding_gap"] > 0 else "Confirmed", {"total_cost": b["total_cost"]})
    add("funding", f"Confirmed funding Rp{b['confirmed_funding']:,}", "Funding",
        "Confirmed" if b["funding_gap"] <= 0 else "Pending",
        {"confirmed": b["confirmed_funding"], "gap": b["funding_gap"]})
    edges.append({"source": "event", "target": "budget", "label": "budget"})
    edges.append({"source": "budget", "target": "funding", "label": "funding gap"})

    risks = await db.risks.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    if risks:
        high = [r for r in risks if r["severity"] in ("High", "Critical")]
        add("risk", f"Risk register ({len(risks)})", "Risk", "At Risk" if high else "Pending",
            {"high": len(high)})
        edges.append({"source": "event", "target": "risk", "label": "risiko"})

    payments = await db.payments.count_documents({"event_id": ev["id"], "status": "Simulated Paid"})
    add("payments", f"Payments simulated paid ({payments})", "Payment", "Completed" if payments else "Draft", {})
    edges.append({"source": "event", "target": "payments", "label": "payment"})

    counts: Dict[str, int] = {}
    for n in nodes:
        counts[n["status"]] = counts.get(n["status"], 0) + 1
    return {"nodes": nodes, "edges": edges, "status_counts": counts,
            "readiness_score": int(100 * counts.get("Confirmed", 0) / max(1, len(nodes)))}


@api.get("/events/{event_id}/ripple")
async def ripple(event_id: str, user: Optional[dict] = Depends(get_optional_user)):
    ev = await get_event_or_404(event_id)
    # Step 6B. non-demo events return economic ripple only for owner /
    # admin / active organizer-org member. Landing page continues to
    # display the demo event's aggregate ripple to unauthenticated
    # visitors (marketing surface, explicitly labeled as demo data).
    if not ev.get("is_demo"):
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        await assert_event_access(ev, user)
    b = await compute_budget(ev["id"])
    talents = await db.event_talents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    vendors = await db.event_vendors.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)
    jobs = await db.event_jobs.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    venue = await db.event_venues.find_one({"event_id": ev["id"]}, {"_id": 0})
    sponsors = await db.sponsor_commitments.find({"event_id": ev["id"], "status": "Confirmed"}, {"_id": 0}).to_list(100)
    tenants = await db.tenant_applications.find({"event_id": ev["id"], "status": "approved"}, {"_id": 0}).to_list(300)
    orders = await db.ticket_orders.find({"event_id": ev["id"], "status": "paid"}, {"_id": 0}).to_list(1000)
    talent_payout = sum(t["fee"] for t in talents)
    vendor_payout = sum(v["cost"] for v in vendors)
    workforce_payout = sum(j["needed"] * j["compensation_per_day"] * j.get("days", 1) for j in jobs)
    workers = sum(j["needed"] for j in jobs)
    room_nights = sum(1 for t in talents) * 12 * 2
    data = {
        "total_event_cost": b["total_cost"], "total_funding": b["confirmed_funding"],
        "ticket_gmv": sum(o["total"] for o in orders), "sponsor_commitment": sum(s["amount"] for s in sponsors),
        "tenant_revenue": sum(t["amount"] for t in tenants), "talent_payout": talent_payout,
        "venue_income": (venue or {}).get("total_cost", 0), "vendor_payout": vendor_payout,
        "workforce_payout": workforce_payout,
        "businesses_activated": len(vendors) + len(tenants) + (1 if venue else 0) + len(talents),
        "workers": workers, "local_workers": int(workers * 0.85), "local_spending_percentage": 72,
        "hotel_room_nights": room_nights, "transport_bookings": len(talents) * 6 + len(vendors),
        "total_economic_activity": b["total_cost"] + sum(o["total"] for o in orders) + sum(t["amount"] for t in tenants),
    }
    return {"metrics": data, "is_demo": bool(ev.get("is_demo")),
            "label": "Data fiktif untuk demonstrasi kompetisi." if ev.get("is_demo") else "Dihitung dari data event aktual di OKKAX."}


CITY_COORDS = {
    "Jakarta": (-6.2088, 106.8456), "Bandung": (-6.9175, 107.6191), "Surabaya": (-7.2575, 112.7521),
    "Yogyakarta": (-7.7956, 110.3695), "Denpasar": (-8.6705, 115.2126), "Medan": (3.5952, 98.6722),
    "Semarang": (-6.9932, 110.4203), "Makassar": (-5.1477, 119.4327), "Palembang": (-2.9761, 104.7754),
    "Balikpapan": (-1.2379, 116.8529), "Manado": (1.4748, 124.8421), "Padang": (-0.9471, 100.4172),
    "Pontianak": (-0.0263, 109.3425), "Jayapura": (-2.5916, 140.6690), "Batam": (1.0456, 104.0305),
    "Malang": (-7.9666, 112.6326),
}


@api.get("/economy/map")
async def economy_map():
    """Sebaran live event dan aktivitasnya per kota untuk peta Indonesia interaktif."""
    events = await db.events.find({"status": {"$in": ["published", "live"]}, "deleted": {"$ne": True}},
                                 {"_id": 0}).to_list(300)
    ids = [ev["id"] for ev in events]

    # Sama seperti /discover/events: batch semua lookup dengan $in supaya total query
    # tidak tumbuh linear terhadap jumlah event (dulu 15 query per event x 136 = ~2000).
    async def group(coll: str, extra: dict | None = None) -> dict:
        query: dict = {"event_id": {"$in": ids}}
        if extra:
            query.update(extra)
        rows = await db[coll].find(query, {"_id": 0}).to_list(20000)
        by_event: dict = defaultdict(list)
        for row in rows:
            by_event[row["event_id"]].append(row)
        return by_event

    tiers_by = await group("ticket_tiers")
    vendors_by = await group("event_vendors")
    talents_by = await group("event_talents")
    jobs_by = await group("event_jobs")
    booths_by = await group("booth_slots")
    pkgs_by = await group("sponsor_packages")
    venues_by = await group("event_venues")
    budget_items_by = await group("budget_items")
    funding_items_by = await group("funding_items")
    sponsor_confirmed_by = await group("sponsor_commitments", {"status": "Confirmed"})
    tenant_approved_by = await group("tenant_applications", {"status": "approved"})
    ticket_orders_paid_by = await group("ticket_orders", {"status": "paid"})

    cities: dict = {}
    for ev in events:
        eid = ev["id"]
        tiers = tiers_by.get(eid, [])
        vendors = vendors_by.get(eid, [])
        talents = talents_by.get(eid, [])
        jobs = jobs_by.get(eid, [])
        booths = booths_by.get(eid, [])
        pkgs = pkgs_by.get(eid, [])
        venue = (venues_by.get(eid) or [{}])[0] if venues_by.get(eid) else None
        occupied = [x for x in booths if x["status"] == "occupied"]
        ticket_gmv = sum(t["sold"] * t["price"] for t in tiers)
        tenant_revenue = sum(x.get("price") or 0 for x in occupied)
        sponsor_value = sum(p["price"] * p["sold"] for p in pkgs)
        workforce_payout = sum(j["needed"] * j["compensation_per_day"] * j.get("days", 1) for j in jobs)
        workers = sum(j["needed"] for j in jobs)

        # Rekonstruksi total_cost/confirmed_funding/funding_gap sesuai compute_budget()
        # tanpa memanggilnya (biayanya 8 query per event).
        total_cost = (
            sum(t.get("landed_cost", 0) for t in talents)
            + (venue.get("total_cost", 0) if venue else 0)
            + sum(v.get("cost", 0) for v in vendors)
            + workforce_payout
            + sum(b.get("amount", 0) for b in budget_items_by.get(eid, []))
        )
        confirmed_funding = (
            sum(f.get("amount", 0) for f in funding_items_by.get(eid, []) if f.get("state") in ("committed", "paid"))
            + sum(s.get("amount", 0) for s in sponsor_confirmed_by.get(eid, []))
            + sum(t.get("amount", 0) for t in tenant_approved_by.get(eid, []))
            + sum(o.get("gross", 0) for o in ticket_orders_paid_by.get(eid, []))
        )
        funding_gap = total_cost - confirmed_funding

        c = cities.setdefault(ev["city"], {
            "city": ev["city"], "lat": CITY_COORDS.get(ev["city"], (-2.0, 118.0))[0],
            "lng": CITY_COORDS.get(ev["city"], (-2.0, 118.0))[1], "events": [], "event_count": 0,
            "capacity": 0, "total_cost": 0, "confirmed_funding": 0, "funding_gap": 0, "ticket_gmv": 0,
            "sponsor_value": 0, "tenant_revenue": 0, "venue_income": 0, "talent_payout": 0,
            "vendor_payout": 0, "workforce_payout": 0, "workers": 0, "businesses": 0,
            "categories": [], "economic_activity": 0})
        c["events"].append({"id": ev["id"], "name": ev["name"], "event_type": ev["event_type"],
                            "start_date": ev.get("start_date"), "capacity": ev.get("capacity", 0),
                            "hero_image": ev.get("hero_image"), "venue_name": ev.get("venue_name"),
                            "economic_activity": total_cost + ticket_gmv + tenant_revenue})
        c["event_count"] += 1
        c["capacity"] += ev.get("capacity", 0)
        c["total_cost"] += total_cost
        c["confirmed_funding"] += confirmed_funding
        c["funding_gap"] += max(0, funding_gap)
        c["ticket_gmv"] += ticket_gmv
        c["sponsor_value"] += sponsor_value
        c["tenant_revenue"] += tenant_revenue
        c["venue_income"] += (venue or {}).get("total_cost", 0)
        c["talent_payout"] += sum(t["fee"] for t in talents)
        c["vendor_payout"] += sum(v["cost"] for v in vendors)
        c["workforce_payout"] += workforce_payout
        c["workers"] += workers
        c["businesses"] += len(vendors) + len(occupied) + len(talents) + (1 if venue else 0)
        if ev["event_type"] not in c["categories"]:
            c["categories"].append(ev["event_type"])
        c["economic_activity"] += total_cost + ticket_gmv + tenant_revenue

    items = sorted(cities.values(), key=lambda x: -x["economic_activity"])
    for c in items:
        c["events"].sort(key=lambda e: -e["economic_activity"])
    totals = {k: sum(c[k] for c in items) for k in
              ("event_count", "capacity", "total_cost", "confirmed_funding", "funding_gap", "ticket_gmv",
               "sponsor_value", "tenant_revenue", "venue_income", "talent_payout", "vendor_payout",
               "workforce_payout", "workers", "businesses", "economic_activity")}
    totals["cities"] = len(items)
    totals["categories"] = len({t for c in items for t in c["categories"]})
    return {"cities": items, "totals": totals,
            "label": "Angka pada mode demo merupakan data fiktif untuk keperluan demonstrasi kompetisi."}


@api.get("/events/{event_id}/command-center")
async def command_center(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user)
    graph = await event_graph(event_id, user)
    b = await compute_budget(ev["id"])
    tiers = await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    jobs = await db.event_jobs.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    booths = await db.booth_slots.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    milestones = await db.payment_milestones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)
    riders = await db.rider_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    activities = await db.audit_logs.find({"event_id": ev["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    try:
        days_left = (datetime.fromisoformat(ev["start_date"]) - datetime.now()).days
    except Exception:
        days_left = None
    return {
        "event": ev, "days_to_event": days_left, "readiness_score": graph["readiness_score"],
        "status_counts": graph["status_counts"], "budget": b,
        "ticket_sales": {"sold": sum(t["sold"] for t in tiers), "capacity": sum(t["quantity"] for t in tiers),
                         "revenue": sum(t["sold"] * t["price"] for t in tiers)},
        "workforce": {"filled": sum(j["filled"] for j in jobs), "needed": sum(j["needed"] for j in jobs)},
        "tenant_occupancy": {"occupied": len([x for x in booths if x["status"] == "occupied"]), "total": len(booths)},
        "rider_fulfillment": {"matched": len([r for r in riders if r["status"] == "Matched"]), "total": len(riders)},
        "milestones": milestones,
        "risks": await db.risks.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50),
        "incidents": await db.incidents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50),
        "schedule": await db.schedule_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100),
        "activities": activities,
    }


@api.post("/events/{event_id}/schedule")
async def add_schedule(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "day": body.get("day", ev["start_date"]), "time": body["time"],
           "activity": body["activity"], "location": body.get("location", ""), "owner": body.get("owner", ""),
           "dependency": body.get("dependency", ""), "status": body.get("status", "Not Started"),
           "notes": body.get("notes", ""), "created_at": now_iso()}
    await db.schedule_items.insert_one(doc)
    return {"item": clean(doc)}


@api.patch("/events/{event_id}/schedule/{item_id}")
async def patch_schedule(event_id: str, item_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    await db.schedule_items.update_one({"id": item_id, "event_id": ev["id"]},
                                       {"$set": {k: v for k, v in body.items() if k in ("status", "time", "notes", "activity")}})
    return {"ok": True}


@api.post("/events/{event_id}/incidents")
async def add_incident(event_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    doc = {"id": nid(), "event_id": ev["id"], "category": body.get("category", "Operations"),
           "severity": body.get("severity", "Low"), "time": body.get("time", now_iso()),
           "location": body.get("location", ""), "reporter": user["name"], "description": body["description"],
           "owner": body.get("owner", user["name"]), "resolution": "", "status": "Open",
           "evidence": body.get("evidence", []), "created_at": now_iso()}
    await db.incidents.insert_one(doc)
    await audit(ev["id"], user, "incident.create", {"severity": doc["severity"]})
    return {"item": clean(doc)}


@api.patch("/events/{event_id}/incidents/{item_id}")
async def patch_incident(event_id: str, item_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    await db.incidents.update_one({"id": item_id, "event_id": ev["id"]},
                                  {"$set": {k: v for k, v in body.items() if k in ("status", "resolution", "owner", "severity")}})
    return {"ok": True}


@api.get("/events/{event_id}/payments")
async def event_payments(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    payments = await db.payments.find({"event_id": ev["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    milestones = await db.payment_milestones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)
    refunds = await db.refunds.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    b = await compute_budget(ev["id"])
    gross = sum(p["gross"] for p in payments if p["status"] == "Simulated Paid")
    settlement = [
        {"party": "Talent payout", "amount": sum(t["fee"] for t in await db.event_talents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50))},
        {"party": "Venue payout", "amount": (await db.event_venues.find_one({"event_id": ev["id"]}, {"_id": 0}) or {}).get("total_cost", 0)},
        {"party": "Vendor payout", "amount": sum(v["cost"] for v in await db.event_vendors.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200))},
        {"party": "Workforce payout", "amount": sum(j["needed"] * j["compensation_per_day"] * j.get("days", 1) for j in await db.event_jobs.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100))},
        {"party": "Platform fee (OKKAX)", "amount": sum(p["platform_fee"] for p in payments)},
        {"party": "Payment gateway fee", "amount": sum(p.get("gateway_fee", 0) for p in payments)},
        {"party": "Tax allocation (estimasi)", "amount": sum(p["tax_estimate"] for p in payments)},
    ]
    return {"payments": payments, "milestones": milestones, "refunds": refunds,
            "settlement_simulation": settlement, "gross_collected": gross, "budget_summary": {
                "total_cost": b["total_cost"], "confirmed_funding": b["confirmed_funding"],
                "funding_gap": b["funding_gap"]},
            "notice": "Simulated settlement. OKKAX tidak menyimpan dana nyata dan bukan escrow."}


@api.post("/events/{event_id}/milestones/{milestone_id}/pay")
async def pay_milestone(event_id: str, milestone_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    await db.payment_milestones.update_one({"id": milestone_id, "event_id": ev["id"]},
                                            {"$set": {"status": "Simulated Paid", "paid_at": now_iso()}})
    await audit(ev["id"], user, "milestone.pay", {"milestone": milestone_id})
    return {"ok": True}


# ---------------------------------------------------------------- notifications / admin / demo
@api.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"items": rows, "unread": len([r for r in rows if not r.get("read")])}


@api.post("/notifications/read")
async def read_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(require_roles("platform_admin"))):
    orders = await db.ticket_orders.find({"status": "paid"}, {"_id": 0}).to_list(2000)
    return {"users": await db.users.count_documents({}), "organizations": await db.organizations.count_documents({}),
            "events": await db.events.count_documents({}), "published_events": await db.events.count_documents({"status": "published"}),
            "talents": await db.talents.count_documents({}), "venues": await db.venues.count_documents({}),
            "vendors": await db.vendors.count_documents({}), "workers": await db.workers.count_documents({}),
            "tickets": await db.tickets.count_documents({}), "orders": len(orders),
            "gmv": sum(o["total"] for o in orders),
            "sponsor_commitments": await db.sponsor_commitments.count_documents({}),
            "tenant_applications": await db.tenant_applications.count_documents({})}



@api.get("/admin/finance/overview")
async def admin_finance_overview(
    user: dict = Depends(require_roles("platform_admin")),
):
    """Ringkasan pergerakan dana seluruh jaringan OKKAX.

    Seluruh nilai dibaca dari record ekonomi yang sudah ada.
    Mode kompetisi tetap sandbox dan tidak merepresentasikan
    penyimpanan uang nyata oleh OKKAX.
    """

    payments = await db.payments.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    milestones = await db.payment_milestones.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    refunds = await db.refunds.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)

    orders = await db.ticket_orders.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    events = await db.events.find(
        {"deleted": {"$ne": True}},
        {
            "_id": 0,
            "id": 1,
            "event_code": 1,
            "name": 1,
            "city": 1,
            "start_date": 1,
            "status": 1,
            "total_cost": 1,
            "confirmed_funding": 1,
            "funding_gap": 1,
        },
    ).to_list(2000)

    event_name = {
        e["id"]: e.get("name") or e.get("event_code") or e["id"]
        for e in events
        if e.get("id")
    }

    def money(row):
        """Ambil nilai rupiah dari berbagai schema ekonomi lama."""
        for key in (
            "amount",
            "gross",
            "total",
            "value",
            "fee",
            "payment_amount",
            "refund_amount",
        ):
            value = row.get(key)
            if isinstance(value, (int, float)):
                return int(value)
        return 0

    def state(row):
        return str(row.get("status") or "").strip().lower()

    released_states = {
        "paid",
        "simulated paid",
        "released",
        "settled",
        "completed",
        "complete",
        "success",
        "successful",
    }

    pending_states = {
        "pending",
        "awaiting payment",
        "awaiting",
        "scheduled",
        "protected",
        "funded",
        "held",
    }

    # --------------------------------------------------------
    # TICKETING GMV
    # --------------------------------------------------------

    paid_orders = [
        o for o in orders
        if state(o) in {"paid", "completed", "success", "successful"}
    ]

    ticket_gmv = sum(money(o) for o in paid_orders)

    # --------------------------------------------------------
    # PAYMENT FLOW
    # --------------------------------------------------------

    successful_payments = [
        p for p in payments
        if state(p) in released_states
    ]

    payment_gross = sum(money(p) for p in successful_payments)

    platform_fee = sum(
        int(p.get("platform_fee") or 0)
        for p in payments
    )

    gateway_fee = sum(
        int(p.get("gateway_fee") or 0)
        for p in payments
    )

    tax_estimate = sum(
        int(p.get("tax_estimate") or 0)
        for p in payments
    )

    # --------------------------------------------------------
    # PROTECTED FULFILLMENT OBLIGATIONS
    # --------------------------------------------------------

    milestone_total = sum(money(m) for m in milestones)

    released_total = sum(
        money(m)
        for m in milestones
        if state(m) in released_states
    )

    protected_total = sum(
        money(m)
        for m in milestones
        if state(m) in pending_states
    )

    # Legacy milestone yang belum memiliki canonical status
    # tetap dihitung sebagai outstanding obligation.
    classified_total = released_total + protected_total

    if classified_total < milestone_total:
        protected_total += milestone_total - classified_total

    # --------------------------------------------------------
    # REFUND
    # --------------------------------------------------------

    refund_total = sum(money(r) for r in refunds)

    # --------------------------------------------------------
    # NETWORK ECONOMIC VOLUME
    # --------------------------------------------------------

    network_gmv = max(
        ticket_gmv,
        payment_gross,
        ticket_gmv + milestone_total,
    )

    pending_settlement = max(
        0,
        protected_total,
    )

    # --------------------------------------------------------
    # EVENT FINANCIAL STATE
    # --------------------------------------------------------

    milestone_by_event = {}
    released_by_event = {}
    protected_by_event = {}

    for m in milestones:
        eid = m.get("event_id")
        if not eid:
            continue

        amount = money(m)

        milestone_by_event[eid] = (
            milestone_by_event.get(eid, 0) + amount
        )

        if state(m) in released_states:
            released_by_event[eid] = (
                released_by_event.get(eid, 0) + amount
            )
        else:
            protected_by_event[eid] = (
                protected_by_event.get(eid, 0) + amount
            )

    ticket_by_event = {}

    for order in paid_orders:
        eid = order.get("event_id")
        if not eid:
            continue

        ticket_by_event[eid] = (
            ticket_by_event.get(eid, 0) + money(order)
        )

    event_finance = []

    for event in events:
        eid = event.get("id")
        if not eid:
            continue

        secured = milestone_by_event.get(eid, 0)
        released = released_by_event.get(eid, 0)
        protected = protected_by_event.get(eid, 0)

        budget = int(event.get("total_cost") or 0)
        funding = int(event.get("confirmed_funding") or 0)

        readiness = 0

        if budget > 0:
            readiness = min(
                100,
                round((funding / budget) * 100),
            )

        event_finance.append({
            "event_id": eid,
            "event_code": event.get("event_code"),
            "name": event.get("name"),
            "city": event.get("city"),
            "start_date": event.get("start_date"),
            "status": event.get("status"),
            "budget": budget,
            "confirmed_funding": funding,
            "funding_gap": int(event.get("funding_gap") or 0),
            "secured_obligations": secured,
            "released": released,
            "protected": protected,
            "ticket_revenue": ticket_by_event.get(eid, 0),
            "funding_readiness": readiness,
        })

    event_finance.sort(
        key=lambda e: (
            e["secured_obligations"]
            + e["ticket_revenue"]
            + e["budget"]
        ),
        reverse=True,
    )

    # --------------------------------------------------------
    # FINANCIAL ACTIVITY STREAM
    # --------------------------------------------------------

    activity = []

    for m in milestones:
        amount = money(m)

        activity.append({
            "id": f"milestone:{m.get('id')}",
            "type": "milestone",
            "event_id": m.get("event_id"),
            "event_name": event_name.get(m.get("event_id")),
            "title": (
                m.get("description")
                or m.get("label")
                or "Kewajiban pembayaran"
            ),
            "party": (
                m.get("ref_name")
                or m.get("party_name")
                or m.get("ref_type")
                or "Mitra event"
            ),
            "amount": amount,
            "status": m.get("status") or "Pending",
            "direction": (
                "released"
                if state(m) in released_states
                else "protected"
            ),
            "created_at": (
                m.get("paid_at")
                or m.get("updated_at")
                or m.get("created_at")
            ),
        })

    for payment in payments:
        activity.append({
            "id": f"payment:{payment.get('id')}",
            "type": "payment",
            "event_id": payment.get("event_id"),
            "event_name": event_name.get(payment.get("event_id")),
            "title": "Pembayaran masuk",
            "party": (
                payment.get("payer_name")
                or payment.get("provider")
                or "Pembeli"
            ),
            "amount": money(payment),
            "status": payment.get("status") or "Unknown",
            "direction": "in",
            "created_at": (
                payment.get("paid_at")
                or payment.get("updated_at")
                or payment.get("created_at")
            ),
        })

    for refund in refunds:
        activity.append({
            "id": f"refund:{refund.get('id')}",
            "type": "refund",
            "event_id": refund.get("event_id"),
            "event_name": event_name.get(refund.get("event_id")),
            "title": "Pengembalian dana",
            "party": (
                refund.get("customer_name")
                or refund.get("buyer_name")
                or "Pembeli"
            ),
            "amount": money(refund),
            "status": refund.get("status") or "Processed",
            "direction": "out",
            "created_at": (
                refund.get("processed_at")
                or refund.get("processed_date")
                or refund.get("updated_at")
                or refund.get("created_at")
            ),
        })

    activity.sort(
        key=lambda row: str(row.get("created_at") or ""),
        reverse=True,
    )

    return {
        "summary": {
            "network_gmv": network_gmv,
            "ticket_gmv": ticket_gmv,
            "payment_gross": payment_gross,
            "secured_obligations": milestone_total,
            "released": released_total,
            "protected": protected_total,
            "pending_settlement": pending_settlement,
            "refund_exposure": refund_total,
            "platform_fee": platform_fee,
            "gateway_fee": gateway_fee,
            "tax_estimate": tax_estimate,
        },
        "counts": {
            "events": len(events),
            "payments": len(payments),
            "milestones": len(milestones),
            "refunds": len(refunds),
            "ticket_orders": len(orders),
            "paid_ticket_orders": len(paid_orders),
        },
        "activity": activity[:100],
        "events": event_finance[:100],
        "notice": (
            "Mode demo kompetisi. Seluruh pergerakan dana adalah "
            "simulasi operasional dan tidak menunjukkan bahwa OKKAX "
            "menyimpan dana nyata."
        ),
    }


@api.get("/admin/users")
async def admin_users(user: dict = Depends(require_roles("platform_admin"))):
    return {"items": await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)}


_ADMIN_ROLES = frozenset({"super_admin", "platform_admin"})


def _is_super_admin(user: dict) -> bool:
    """Only `super_admin` may grant/revoke administrator roles or suspend
    an existing administrator. `platform_admin` handles day-to-day user
    admin but cannot mutate the admin tier itself."""
    return "super_admin" in set(user.get("roles", []))


@api.patch("/admin/users/{user_id}")
async def admin_patch_user(user_id: str, body: Dict[str, Any],
                            user: dict = Depends(require_roles("platform_admin"))):
    """Update a user's roles or suspended flag with server-side hierarchy
    validation. Client claims in the payload never authorize the change
    on their own. every decision compares the actor's real roles (from
    the JWT-verified account) against the target's current roles.

    Hierarchy (Step 6C):
    - `super_admin` may change any user's roles or suspension flag,
      including granting/revoking `super_admin` and `platform_admin`.
    - `platform_admin` may change non-administrator users only. Any
      attempt to (a) grant an admin role, (b) modify an existing
      administrator's roles, or (c) suspend an existing administrator
      is 403.
    """
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    actor_is_super = _is_super_admin(user)
    target_current_roles = set(target.get("roles", []))
    target_is_admin = bool(target_current_roles & _ADMIN_ROLES)

    allowed: Dict[str, Any] = {}

    if "roles" in body:
        requested_roles = body["roles"] if isinstance(body["roles"], list) else []
        # Step 3 constraint preserved: single canonical role via this endpoint.
        # (Multi-role editing is out of Step 6C's P1 scope.)
        if len(requested_roles) != 1 or requested_roles[0] not in ROLE_KEYS:
            raise HTTPException(status_code=400,
                                detail="Satu akun hanya dapat memiliki satu peran yang valid")
        new_role = requested_roles[0]
        requested_is_admin = new_role in _ADMIN_ROLES

        # Non-super_admin cannot grant an admin tier.
        if requested_is_admin and not actor_is_super:
            raise HTTPException(status_code=403,
                                detail="Only super_admin may assign administrator roles")
        # Non-super_admin cannot mutate an existing administrator's roles
        # (blocks demoting/rotating peers or lateral swaps).
        if target_is_admin and not actor_is_super:
            raise HTTPException(status_code=403,
                                detail="Only super_admin may change an administrator's roles")
        allowed["roles"] = [new_role]

    if "suspended" in body:
        new_suspended = bool(body["suspended"])
        # Non-super_admin cannot suspend an administrator. Un-suspending
        # is allowed (accidental self-lockout recovery). defense-in-depth,
        # not a privilege pivot.
        if new_suspended and target_is_admin and not actor_is_super:
            raise HTTPException(status_code=403,
                                detail="Only super_admin may suspend an administrator")
        allowed["suspended"] = new_suspended

    if not allowed:
        raise HTTPException(status_code=400,
                            detail="Tidak ada perubahan yang valid dalam payload")

    await db.users.update_one({"id": user_id}, {"$set": allowed})
    await audit(None, user, "admin.user.update", {"user_id": user_id, **allowed})
    return {"ok": True}


@api.get("/admin/organizations")
async def admin_orgs(user: dict = Depends(require_roles("platform_admin"))):
    return {"items": await db.organizations.find({}, {"_id": 0}).to_list(500)}


@api.post("/admin/verify")
async def admin_verify(body: Dict[str, Any], user: dict = Depends(require_roles("platform_admin"))):
    coll = {"talent": "talents", "venue": "venues", "vendor": "vendors", "worker": "workers",
            "organization": "organizations"}.get(body.get("kind"))
    if not coll:
        raise HTTPException(status_code=400, detail="Jenis entitas tidak dikenali")
    await db[coll].update_one({"id": body["id"]}, {"$set": {"verified": bool(body.get("verified", True))}})
    await audit(None, user, "admin.verify", body)
    return {"ok": True}


@api.get("/admin/audit-logs")
async def admin_audit(user: dict = Depends(require_roles("platform_admin")), limit: int = 100):
    return {"items": await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)}


@api.get("/admin/events")
async def admin_events(user: dict = Depends(require_roles("platform_admin"))):
    return {"items": await db.events.find({}, {"_id": 0}).to_list(500)}


@api.post("/demo/reset")
async def demo_reset(user_opt: Optional[dict] = Depends(get_optional_user)):
    """Restore deterministic demo fixtures without deleting unrelated records.

    Gated dua lapis:
    1. `OKKAX_DEMO_MODE` harus `true` (default true selama kompetisi). Kalau
       demo mode dimatikan, endpoint ini merespons 404.
    2. Pemanggil harus authenticated sebagai admin (`super_admin` atau
       `platform_admin`). Kalau tanpa token -> 401, kalau role non-admin -> 403.
    """
    if not is_demo_mode():
        raise HTTPException(status_code=404, detail="Not found")
    if user_opt is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not is_admin(user_opt):
        raise HTTPException(status_code=403, detail="Only administrators can reset demo data")
    res = await seed_data.seed(force=True)
    await audit(None, user_opt, "demo.reset")
    return {"ok": True, **res, "demo_event_code": seed_data.EVENT_CODE, "demo_event_id": seed_data.EVENT_ID}


@api.get("/demo/state")
async def demo_state():
    ev = await db.events.find_one({"id": seed_data.EVENT_ID}, {"_id": 0})
    return {"seeded": bool(ev), "event": ev, "disclaimer": DISCLAIMER,
            "accounts": [{"email": e, "name": n, "roles": r} for e, n, r, _ in seed_data.DEMO_USERS] +
                        [{"email": os.environ.get("ADMIN_EMAIL"), "name": "OKKAX Super Admin",
                          "roles": ["super_admin"]}]}


@api.get("/health")
async def health():
    return {"status": "ok", "product": "OKKAX", "sandbox_notice": SANDBOX_NOTICE}


# --- Step 5 endpoints: MUST be defined BEFORE app.include_router(api)
app.include_router(control_router)
# FastAPI mounts them. Helpers referenced here are defined later in the
# module; Python resolves them at request time, not decoration time.

class WorkspaceValidateIn(BaseModel):
    organization_id: Optional[str] = None
    role: str


@api.get("/me/workspaces")
async def me_workspaces(user: dict = Depends(get_current_user)):
    """Return available execution contexts for the authenticated user."""

    if "super_admin" in set(user.get("roles", [])):
        return {
            "items": [{
                "kind": "platform",
                "user_id": user["id"],
                "organization_id": None,
                "membership_id": None,
                "role": "super_admin",
                "label": "Super Admin · Platform",
            }]
        }

    workspaces = await list_available_workspaces(user)
    return {"items": workspaces}


@api.post("/me/workspace/validate")
async def validate_workspace(payload: WorkspaceValidateIn,
                             user: dict = Depends(get_current_user)):
    """Validate a client-claimed workspace. Stateless; no DB writes or tokens.

    Returns 200 + resolved workspace when valid, otherwise raises 403 with a
    generic message. Adds an audit entry for the attempt (success and
    forbidden), never for the unauthenticated case (Depends handles that
    with 401 before we get here).
    """
    try:
        workspace = await resolve_active_workspace(
            user,
            organization_id=payload.organization_id,
            role=payload.role,
        )
    except HTTPException as exc:
        if exc.status_code == 403:
            await audit(None, user, "workspace.validate", {
                "organization_id": payload.organization_id,
                "role": payload.role,
                "result": "forbidden",
            })
        raise
    await audit(None, user, "workspace.validate", {
        "organization_id": payload.organization_id,
        "role": payload.role,
        "result": "ok",
    })
    return {"workspace": workspace}


@api.post("/me/workspace/activate")
async def activate_workspace(payload: WorkspaceValidateIn, request: Request,
                              user: dict = Depends(get_current_user)):
    """Persist the caller's active workspace onto the CURRENT session.

    The client's claim is validated by `resolve_active_workspace`
    against live DB state (personal-audience-only, admin-role blocked,
    active membership required. all the same guardrails as
    `/me/workspace/validate`). Only `organization_id` is written to the
    session row; the effective role is re-derived from the membership
    on every read of `/me/workspace/active`, so a role change after
    activation is reflected immediately and no permission snapshot
    lives on the session.

    Scoped to a single session by design. logging in from a second
    browser gives that session its own independent active workspace.
    """
    workspace = await resolve_active_workspace(
        user,
        organization_id=payload.organization_id,
        role=payload.role,
    )
    sid = getattr(request.state, "session_id", None)
    if not sid:
        # Belt-and-braces: get_current_user always sets this. If it did
        # not, the session gate is broken. refuse rather than silently
        # writing to a null sid.
        raise HTTPException(status_code=401, detail="Session missing")
    await db.sessions.update_one(
        {"id": sid, "user_id": user["id"]},
        {"$set": {"active_workspace": {
            "organization_id": workspace["organization_id"],
        }}},
    )
    await audit(None, user, "workspace.activate", {
        "organization_id": workspace["organization_id"],
        "role": workspace["role"],
    })
    return {"workspace": workspace}


@api.get("/me/workspace/active")
async def read_active_workspace(request: Request,
                                 user: dict = Depends(get_current_user)):
    if "super_admin" in set(user.get("roles", [])):
        return {
            "workspace": {
                "kind": "platform",
                "user_id": user["id"],
                "organization_id": None,
                "membership_id": None,
                "role": "super_admin",
                "label": "Super Admin · Platform",
            }
        }

    """Return the workspace currently active on THIS session.

    Always re-derives from DB. if the underlying membership was
    revoked, the org was renamed, or the caller's role in that org
    changed, this endpoint reflects that immediately. Returns 200 with
    `workspace: null` when nothing has been activated yet, and 403
    when a workspace WAS activated but is no longer valid (membership
    revoked) so the caller can tell the two apart.
    """
    sid = getattr(request.state, "session_id", None)
    session = await db.sessions.find_one({"id": sid}, {"_id": 0}) if sid else None
    active = (session or {}).get("active_workspace")
    if not active:
        return {"workspace": None}
    organization_id = active.get("organization_id")
    # Personal workspace. audience only, always available.
    if organization_id is None:
        return {"workspace": _personal_workspace(user)}
    # Organization workspace. re-resolve against current membership.
    membership = await db.organization_members.find_one(
        {"user_id": user["id"], "organization_id": organization_id, "status": "active"},
        {"_id": 0},
    )
    if not membership:
        # Membership was revoked (or role changed to admin, or org
        # disabled) after activation. Do not silently downgrade. deny
        # so the caller must re-activate.
        raise HTTPException(status_code=403,
                            detail="Active workspace is no longer available")
    if membership.get("role") in _ADMIN_ROLES_BLOCKED_FROM_WORKSPACE:
        raise HTTPException(status_code=403,
                            detail="Active workspace is no longer available")
    org = await db.organizations.find_one(
        {"id": organization_id}, {"_id": 0, "id": 1, "name": 1}
    )
    org_name = (org or {}).get("name") or organization_id
    return {"workspace": _org_workspace(user["id"], membership, org_name)}


app.include_router(api)
from extras import extras as extras_router  # noqa: E402
app.include_router(extras_router)
from calendar_engine import calendar as calendar_router  # noqa: E402
app.include_router(calendar_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _normalize_user_roles(account: dict) -> Optional[Dict[str, Any]]:
    """Return the $set update needed to normalize this account, or None if
    no write is required.

    Behavior (STEP 3):
    - Keeps every role that is present in ``ROLES``, deduplicated while
      preserving original order. Roles not in ``ROLE_KEYS`` are dropped.
    - Uses the legacy scalar ``role`` field as the primary hint when it is
      valid; otherwise the first valid entry in ``roles`` becomes primary;
      when nothing valid exists at all, primary falls back to ``"audience"``.
    - The primary role is placed at the front of ``roles`` so any downstream
      code that reads ``roles[0]`` sees the same value as ``role``.
    - Never truncates ``roles`` to a single element. Multi-role users keep
      every valid role they had.
    - The scalar ``role`` field is preserved (only rewritten when it already
      exists and differs from the derived primary). No mass backfill on
      accounts that never had it.
    - Idempotent: applying the returned update and re-running yields ``None``.
    """
    raw_roles = list(account.get("roles") or [])
    legacy_role = account.get("role")
    has_role_field = "role" in account

    seen: set = set()
    valid_roles: List[str] = []
    for role in raw_roles:
        if role in ROLE_KEYS and role not in seen:
            seen.add(role)
            valid_roles.append(role)

    if isinstance(legacy_role, str) and legacy_role in ROLE_KEYS:
        primary = legacy_role
    elif valid_roles:
        primary = valid_roles[0]
    else:
        primary = "audience"

    if primary in valid_roles:
        valid_roles = [primary] + [role for role in valid_roles if role != primary]
    else:
        valid_roles = [primary] + valid_roles

    update: Dict[str, Any] = {}
    if raw_roles != valid_roles:
        update["roles"] = valid_roles
    if has_role_field and legacy_role != primary:
        update["role"] = primary
    return update or None


# ---------------------------------------------------------------- membership
# Minimal foundation (STEP 4) untuk relasi user <-> organization. Additive only:
# tidak menyentuh user.role / user.roles. Belum ada endpoint publik; helpers ini
# dipakai oleh test dan siap dipakai step berikutnya (invitation, switcher).

MEMBERSHIP_STATUSES = ("active",)  # sengaja minimal; state lain diperkenalkan di step selanjutnya


def _validate_membership_input(role: str, status: str) -> None:
    """Guard input untuk membership: role wajib salah satu ROLE_KEYS OKKAX,
    status wajib salah satu MEMBERSHIP_STATUSES. Dipisah dari operasi DB
    supaya bisa di-test murni tanpa I/O."""
    if role not in ROLE_KEYS:
        raise ValueError(
            f"Invalid membership role: {role!r}. Must be one of {list(ROLE_KEYS)!r}."
        )
    if status not in MEMBERSHIP_STATUSES:
        raise ValueError(
            f"Invalid membership status: {status!r}. Must be one of {list(MEMBERSHIP_STATUSES)!r}."
        )


async def add_organization_member(
    *, user_id: str, organization_id: str, role: str, status: str = "active",
) -> Dict[str, Any]:
    """Daftarkan user sebagai anggota organisasi dengan role tertentu.

    - Role wajib valid (`ROLE_KEYS`).
    - Duplikat pasangan (`user_id`, `organization_id`) dicegah di level DB
      lewat compound unique index (dibuat di startup). Percobaan insert
      duplikat diterjemahkan ke ValueError agar caller tidak perlu tahu
      driver-specific exceptions.
    - Bersifat additive: tidak menulis apa pun ke koleksi `users`. Legacy
      `user.role` dan `user.roles` tetap utuh.
    """
    _validate_membership_input(role=role, status=status)
    doc = {
        "id": nid(),
        "user_id": user_id,
        "organization_id": organization_id,
        "role": role,
        "status": status,
        "created_at": now_iso(),
    }
    try:
        await db.organization_members.insert_one(dict(doc))
    except DuplicateKeyError as exc:
        raise ValueError(
            f"User {user_id!r} already has membership in organization {organization_id!r}."
        ) from exc
    return doc


async def list_user_memberships(user_id: str) -> List[Dict[str, Any]]:
    """Semua membership milik satu user, terbaru dulu."""
    return await db.organization_members.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)


async def list_organization_members(organization_id: str) -> List[Dict[str, Any]]:
    """Semua anggota satu organisasi, terbaru dulu."""
    return await db.organization_members.find(
        {"organization_id": organization_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)


# ---------------------------------------------------------------- workspaces
# Step 5. Multi-Workspace Identity. Workspace = (user_id, organization_id, role).
# `organization_id=None + role=audience` = personal workspace (selalu ada untuk
# setiap user login). Workspace organisasi berasal dari `organization_members`
# dengan status='active' saja. Legacy `user.org_id` dan `user.roles` sengaja
# TIDAK di-surface di sini; migrasi ke membership eksplisit menyusul di
# step onboarding berikutnya.
#
# Admin (super_admin / platform_admin) sengaja tidak dapat diresolve lewat
# jalur membership: identitas admin tetap terikat pada `user.roles`, tidak
# per-organisasi. Ini mencegah privilege escalation lewat baris membership
# yang ditulis manual.

_PERSONAL_WORKSPACE_ROLE = "audience"
_ADMIN_ROLES_BLOCKED_FROM_WORKSPACE = {"super_admin", "platform_admin"}


def _personal_workspace(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "user_id": user["id"],
        "organization_id": None,
        "role": _PERSONAL_WORKSPACE_ROLE,
        "membership_id": None,
        "kind": "personal",
        "label": "Personal · Audience",
    }


def _org_workspace(user_id: str, membership: Dict[str, Any], org_name: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "organization_id": membership["organization_id"],
        "role": membership["role"],
        "membership_id": membership["id"],
        "kind": "organization",
        "label": f"{org_name} · {membership['role']}",
    }


async def list_available_workspaces(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Semua workspace yang dapat dimasuki user login.

    - Selalu memasukkan personal workspace (audience, organization_id=None).
    - Menambahkan satu workspace per membership `active` di
      `organization_members`.
    """
    result: List[Dict[str, Any]] = [_personal_workspace(user)]
    memberships = await db.organization_members.find(
        {"user_id": user["id"], "status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    if not memberships:
        return result
    org_ids = list({m["organization_id"] for m in memberships})
    org_docs = await db.organizations.find(
        {"id": {"$in": org_ids}}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    org_name_by_id = {doc["id"]: (doc.get("name") or doc["id"]) for doc in org_docs}
    for membership in memberships:
        org_name = org_name_by_id.get(membership["organization_id"], membership["organization_id"])
        result.append(_org_workspace(user["id"], membership, org_name))
    return result


async def resolve_active_workspace(
    user: Dict[str, Any],
    *,
    organization_id: Optional[str],
    role: str,
) -> Dict[str, Any]:
    """Validasi klaim workspace dari client. Kembalikan dict workspace bila
    valid, atau raise HTTPException(403) bila:

    - klaim ke workspace organisasi orang lain;
    - role yang tidak dimiliki di organisasi tersebut;
    - membership yang tidak `active`;
    - upaya privilege escalation ke role admin lewat baris membership.

    Pesan error sengaja disamakan (`"Workspace not available for this account"`)
    supaya tidak membocorkan apakah organisasi ada, apakah user pernah menjadi
    anggota di sana, atau role apa yang sebenarnya dia pegang.
    """
    if organization_id is None:
        if role != _PERSONAL_WORKSPACE_ROLE:
            raise HTTPException(status_code=403, detail="Personal workspace is audience-only")
        return _personal_workspace(user)

    # Defense-in-depth: tolak role di luar ROLE_KEYS dan role admin, apa pun
    # yang tertulis di membership.
    if role not in ROLE_KEYS or role in _ADMIN_ROLES_BLOCKED_FROM_WORKSPACE:
        raise HTTPException(status_code=403, detail="Workspace not available for this account")

    membership = await db.organization_members.find_one(
        {
            "user_id": user["id"],
            "organization_id": organization_id,
            "role": role,
            "status": "active",
        },
        {"_id": 0},
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Workspace not available for this account")

    org = await db.organizations.find_one(
        {"id": organization_id}, {"_id": 0, "id": 1, "name": 1}
    )
    org_name = (org or {}).get("name") or organization_id
    return _org_workspace(user["id"], membership, org_name)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.events.create_index("event_code")
    await db.tickets.create_index("qr_code")
    await db.booth_slots.create_index([("event_id", 1), ("status", 1)])
    await db.login_attempts.create_index("identifier")
    await db.calendar_entries.create_index([("resource_type", 1), ("resource_id", 1), ("start_at", 1)])
    await db.calendar_entries.create_index([("event_id", 1), ("start_at", 1)])
    await db.calendar_entries.create_index([("created_by", 1), ("start_at", 1)])
    # STEP 4. organization membership indexes
    await db.organization_members.create_index(
        [("user_id", 1), ("organization_id", 1)], unique=True, name="uniq_user_org"
    )
    await db.organization_members.create_index("user_id")
    await db.organization_members.create_index("organization_id")
    # Phase 01. server-authoritative session registry indexes.
    await db.sessions.create_index("id", unique=True, name="uniq_session_id")
    await db.sessions.create_index([("user_id", 1), ("revoked_at", 1)])
    # V5 Phase 02 Control Plane indexes.
    await db.control_requests.create_index("id", unique=True, name="uniq_control_request_id")
    await db.control_requests.create_index([("status", 1), ("created_at", -1)])
    await db.control_requests.create_index([("risk", 1), ("created_at", -1)])
    await db.control_evidence.create_index("id", unique=True, name="uniq_control_evidence_id")
    await db.control_evidence.create_index([("request_id", 1), ("created_at", 1)])
    await db.control_evidence.create_index([("risk", 1), ("created_at", -1)])
    res = await seed_data.seed(force=False)
    logger.info(f"OKKAX startup seed: {res}")
    memberships = await seed_data.ensure_demo_memberships()
    logger.info(f"OKKAX canonical demo memberships: {memberships}")
    users = await db.users.find({}, {"_id": 0, "id": 1, "roles": 1, "role": 1}).to_list(10000)
    normalized = 0
    for account in users:
        update = _normalize_user_roles(account)
        if update:
            await db.users.update_one({"id": account["id"]}, {"$set": update})
            normalized += 1
    logger.info(f"OKKAX role normalization: {normalized} account(s) updated")
    # Katalog event demo multi-kota selalu di-upsert (idempotent) agar tidak hilang di DB lama/produksi.
    from seed_events import seed_extra_events
    extra = await seed_extra_events()
    published = await db.events.count_documents({"status": {"$in": ["published", "live"]}})
    logger.info(f"OKKAX startup catalog upsert: {extra} · published events: {published}")


@app.on_event("shutdown")
async def shutdown():
    pass





