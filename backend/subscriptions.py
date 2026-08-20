"""OKKAX Subscription Monetization — Pro/Max checkout sandbox.

Mirrors the existing ticket checkout contract (POST /checkout,
POST /payments/{id}/simulate in server.py) for subscription plans
instead of event tickets: same order+payment shape, same sandbox
simulate-success/simulate-fail flow, same `notify()` helper for the
activation notification, and the same PAYMENT_METHODS sandbox list.
No new payment gateway or notification engine — this is the ticket
checkout pattern applied to a different purchasable (a subscription
plan instead of a ticket tier).

Entitlement is stored as `users.subscription` (additive field, does
not touch any other user field) and is the single source of truth a
paid role's active plan is read from.
"""
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, nid, now_iso, clean, get_current_user, notify, audit

subscriptions = APIRouter(prefix="/api")

# Authoritative subscription prices, mirroring frontend/src/lib/pricing.js
# PRICE_TABLE. Kept authoritative here so a client cannot dictate its own
# price — the checkout endpoint looks the total up from this table by
# (role, plan, billing), it never trusts a total sent by the client.
SUBSCRIPTION_PRICE_TABLE = {
    "organizer": {"proMonthly": 99000, "maxMonthly": 199000, "proYearly": 990000, "maxYearly": 1990000},
    "sponsor":   {"proMonthly": 99000, "maxMonthly": 199000, "proYearly": 990000, "maxYearly": 1990000},
    "venue":     {"proMonthly": 69000, "maxMonthly": 139000, "proYearly": 690000, "maxYearly": 1390000},
    "vendor":    {"proMonthly": 59000, "maxMonthly": 119000, "proYearly": 590000, "maxYearly": 1190000},
    "talent":    {"proMonthly": 39000, "maxMonthly":  79000, "proYearly": 390000, "maxYearly":  790000},
    "tenant":    {"proMonthly": 29000, "maxMonthly":  59000, "proYearly": 290000, "maxYearly":  590000},
    "workforce": {"proMonthly": 19000, "maxMonthly":  39000, "proYearly": 190000, "maxYearly":  390000},
}

# Same alias mapping notifications.py uses for notification_role, so a
# member holding a role alias (e.g. "event_organizer") resolves to the
# same pricing-table key their notifications are already scoped to.
_ROLE_ALIASES = {
    "event_organizer": "organizer", "supervisor": "organizer", "finance_approver": "organizer", "promoter": "organizer",
    "talent_management": "talent", "artist": "talent", "band": "talent",
    "worker": "workforce", "crew": "workforce",
    "supplier": "vendor",
    "venue_manager": "venue",
}


def resolve_billable_role(user: dict) -> str:
    """Resolve the caller's active-workspace role to a pricing-table key.

    Personal workspace (no organization context) is always "audience" —
    audience accounts have no seat in SUBSCRIPTION_PRICE_TABLE, which is
    what blocks the purchase.
    """
    ctx = user.get("_workspace_ctx") or {}
    if ctx.get("kind") == "personal":
        return "audience"
    role = ctx.get("role") or (user.get("roles") or ["audience"])[0]
    role = str(role).lower()
    return _ROLE_ALIASES.get(role, role)


class SubscriptionCheckoutIn(BaseModel):
    plan: str
    billing: str = "monthly"
    method: str
    method_channel: str


@subscriptions.post("/subscription/checkout")
async def subscription_checkout(payload: SubscriptionCheckoutIn, user: dict = Depends(get_current_user)):
    role = resolve_billable_role(user)
    if role == "audience":
        raise HTTPException(status_code=403, detail="Akun Audience tidak dapat membeli paket Pro/Max")
    price_row = SUBSCRIPTION_PRICE_TABLE.get(role)
    if not price_row:
        raise HTTPException(status_code=400, detail="Peran ini tidak memiliki paket berlangganan")
    if payload.plan not in ("pro", "max"):
        raise HTTPException(status_code=400, detail="Paket tidak valid")
    if payload.billing not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="Periode billing tidak valid")

    from server import PAYMENT_METHODS  # deferred import: avoids a circular import at module load
    method_valid = any(m["key"] == payload.method and m["available"] for m in PAYMENT_METHODS)
    if not method_valid:
        raise HTTPException(status_code=400, detail="Metode pembayaran belum tersedia pada MVP sandbox")

    key = payload.plan + ("Yearly" if payload.billing == "yearly" else "Monthly")
    total = price_row[key]

    count = await db.subscription_orders.count_documents({}) + 1
    order_id, payment_id = nid(), nid()
    order = {
        "id": order_id, "order_code": f"OKX-SUB-{count:06d}", "user_id": user["id"],
        "buyer_name": user["name"], "buyer_email": user["email"],
        "role": role, "plan": payload.plan, "billing": payload.billing,
        "total": total, "currency": "IDR",
        "status": "awaiting_payment", "payment_id": payment_id, "created_at": now_iso(),
    }
    await db.subscription_orders.insert_one(dict(order))
    payment = {
        "id": payment_id, "payment_ref": f"OKX-SUBPAY-{count:06d}", "order_id": order_id,
        "payer_user_id": user["id"], "payer_name": user["name"], "payee": "OKKAX Sandbox Settlement",
        "purpose": f"Subscription {payload.plan} ({role})", "gross": total, "net": total,
        "currency": "IDR", "method": payload.method, "method_channel": payload.method_channel,
        "status": "Awaiting Payment", "created_at": now_iso(),
        "reference_number": f"{payload.method[:3].upper()}-{secrets.randbelow(9999999999):010d}",
        "paid_at": None, "audit": [{"at": now_iso(), "action": "created", "by": user["email"]}],
    }
    await db.subscription_payments.insert_one(dict(payment))
    await audit(None, user, "subscription.order.create", {"order": order["order_code"], "plan": payload.plan, "total": total})
    return {"order": clean(order), "payment": clean(payment)}


@subscriptions.post("/subscription/payments/{payment_id}/simulate")
async def simulate_subscription_payment(payment_id: str, body: dict = None, user: dict = Depends(get_current_user)):
    body = body or {}
    pay = await db.subscription_payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment tidak ditemukan")
    if pay["payer_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pembayaran Anda")
    if pay["status"] == "Simulated Paid":
        return {"payment": pay, "already": True}

    outcome = body.get("outcome", "success")
    order = await db.subscription_orders.find_one({"id": pay["order_id"]}, {"_id": 0})

    if outcome == "fail":
        await db.subscription_payments.update_one({"id": payment_id}, {
            "$set": {"status": "Failed"},
            "$push": {"audit": {"at": now_iso(), "action": "failed"}},
        })
        # Entitlement is untouched on failure — no subscription field write.
        await db.subscription_orders.update_one({"id": order["id"]}, {"$set": {"status": "failed"}})
        return {"payment": {**pay, "status": "Failed"}}

    await db.subscription_payments.update_one({"id": payment_id}, {
        "$set": {"status": "Simulated Paid", "paid_at": now_iso()},
        "$push": {"audit": {"at": now_iso(), "action": "simulated_paid", "channel": pay["method_channel"]}},
    })
    await db.subscription_orders.update_one({"id": order["id"]}, {"$set": {"status": "paid"}})

    period_days = 365 if order["billing"] == "yearly" else 30
    activated_at = now_iso()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=period_days)).isoformat()
    entitlement = {
        "plan": order["plan"], "role": order["role"], "billing": order["billing"],
        "status": "active", "order_id": order["id"],
        "activated_at": activated_at, "expires_at": expires_at,
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription": entitlement}})

    plan_label = "Max" if order["plan"] == "max" else "Pro"
    billing_label = "tahunan" if order["billing"] == "yearly" else "bulanan"
    await notify(
        user["id"],
        f"Paket {plan_label} berhasil diaktifkan",
        f"Role {order['role'].title()} · Periode {billing_label} · Total Rp{order['total']:,} · Aktif sejak {activated_at[:10]}.",
        "success",
        notif_type="subscription_activated",
        destination="/app/settings",
        metadata={"plan": order["plan"], "role": order["role"], "billing": order["billing"], "total": order["total"], "expires_at": expires_at},
        notification_role=order["role"],
    )
    await audit(None, user, "subscription.payment.simulated_paid", {"payment_ref": pay["payment_ref"], "plan": order["plan"]})
    return {"payment": {**pay, "status": "Simulated Paid"}, "entitlement": entitlement}


@subscriptions.get("/my/subscription")
async def my_subscription(user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "subscription": 1})
    return {"subscription": (doc or {}).get("subscription")}


@subscriptions.get("/my/subscription-orders")
async def my_subscription_orders(user: dict = Depends(get_current_user)):
    items = await db.subscription_orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"items": [clean(i) for i in items]}
