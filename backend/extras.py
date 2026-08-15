"""OKKAX extras: Emergent Google auth, Stripe test-mode checkout, role workspaces, PDF documents."""
import os
import io
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from core import (db, nid, now_iso, create_access_token, issue_access_token, clean,
                  get_current_user, is_admin, is_demo_mode, ensure_account_active,
                  get_event_or_404, assert_event_access, audit, notify, ROLE_KEYS)

logger = logging.getLogger("okkax.extras")
extras = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
IDR_PER_USD = float(os.environ.get("STRIPE_IDR_USD_RATE", "16000"))
ACCENT = colors.HexColor("#FF4500")
INK = colors.HexColor("#0A0A0A")


# ------------------------------------------------------------------ Google auth
@extras.post("/auth/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header wajib ada")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session Google tidak valid atau kedaluwarsa")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Email Google tidak tersedia")

    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": nid(), "email": email, "password_hash": None, "name": data.get("name") or email,
            "picture": data.get("picture"), "roles": ["organizer"],
            "org_id": None, "city": "", "terms_accepted": True, "onboarded": True,
            "auth_provider": "google", "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        await notify(user["id"], "Selamat datang di OKKAX",
                     "Akun Google Anda terhubung. Mulai dari Event Studio atau demo terpandu.", "success")
    else:
        ensure_account_active(user)
        existing_roles = [role for role in (user.get("roles") or []) if role in ROLE_KEYS] or ["audience"]
        if "super_admin" in existing_roles:
            normalized_roles = ["super_admin"]
        elif "platform_admin" in existing_roles:
            normalized_roles = ["platform_admin"]
        else:
            normalized_roles = [existing_roles[0]]
        await db.users.update_one({"id": user["id"]},
                                  {"$set": {"picture": data.get("picture"), "auth_provider": "google",
                                            "roles": normalized_roles}})
        user["roles"] = normalized_roles
    user = clean(user)

    await db.user_sessions.insert_one({
        "id": nid(), "user_id": user["id"], "session_token": data.get("session_token"),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": now_iso()})
    token, _ = await issue_access_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none",
                        path="/", max_age=7 * 24 * 3600)
    await audit(None, user, "auth.google_login")
    return {"token": token, "user": user}


# ------------------------------------------------------------------ Stripe (test mode)
class StripeCheckoutIn(BaseModel):
    event_id: str
    tier_id: str
    quantity: int = 1
    attendees: list = []
    origin_url: str


async def fulfill_stripe_order(order_id: str, session_id: str) -> Dict[str, Any]:
    """Idempotent fulfillment: mark payment paid, reduce inventory, issue QR tickets."""
    order = await db.ticket_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return {"fulfilled": False}
    if order["status"] == "paid":
        tickets = await db.tickets.find({"order_id": order_id}, {"_id": 0}).to_list(50)
        return {"fulfilled": True, "already": True, "tickets": tickets}
    tier = await db.ticket_tiers.find_one({"id": order["tier_id"]}, {"_id": 0})
    ev = await db.events.find_one({"id": order["event_id"]}, {"_id": 0})
    if not tier or not ev:
        return {"fulfilled": False}
    await db.ticket_orders.update_one({"id": order_id}, {"$set": {"status": "paid"}})
    await db.payments.update_one({"id": order["payment_id"]}, {
        "$set": {"status": "Simulated Paid", "paid_at": now_iso(), "stripe_session_id": session_id},
        "$push": {"audit": {"at": now_iso(), "action": "stripe_test_paid", "session": session_id}}})
    await db.ticket_tiers.update_one({"id": tier["id"]}, {"$inc": {"sold": order["quantity"]}})
    total = await db.tickets.count_documents({})
    tickets = []
    for i in range(order["quantity"]):
        tno = f"OKX-TIX-{total + i + 1:06d}"
        att = order["attendees"][i]["name"] if i < len(order["attendees"]) else order["buyer_name"]
        t = {"id": nid(), "ticket_number": tno, "qr_code": f"OKKAX|{ev['event_code']}|{tno}",
             "order_id": order_id, "event_id": ev["id"], "event_name": ev["name"], "tier_id": tier["id"],
             "tier_name": tier["name"], "attendee_name": att, "user_id": order["user_id"],
             "status": "valid", "used_at": None, "created_at": now_iso()}
        await db.tickets.insert_one(dict(t))
        tickets.append(t)
    await notify(order["user_id"], "Pembayaran kartu (Stripe test mode) berhasil",
                 f"{order['quantity']} tiket {tier['name']} untuk {ev['name']} telah diterbitkan.", "success", ev["id"])
    await notify(ev["owner_user_id"], "Penjualan tiket baru",
                 f"{order['quantity']} tiket {tier['name']} terjual via kartu (Stripe test mode).", "info", ev["id"])
    return {"fulfilled": True, "tickets": tickets}


def _stripe_checkout(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    host_url = str(request.base_url)
    return StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{host_url}api/webhook/stripe")


@extras.post("/payments/stripe/checkout")
async def stripe_create_checkout(payload: StripeCheckoutIn, request: Request,
                                 user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

    ev = await get_event_or_404(payload.event_id)
    tier = await db.ticket_tiers.find_one({"id": payload.tier_id, "event_id": ev["id"]}, {"_id": 0})
    if not tier:
        raise HTTPException(status_code=404, detail="Ticket tier tidak ditemukan")
    qty = max(1, min(payload.quantity, tier.get("purchase_limit", 4)))
    remaining = tier["quantity"] - tier["sold"]
    if qty > remaining:
        raise HTTPException(status_code=400, detail=f"Sisa tiket hanya {remaining}")

    gross = tier["price"] * qty
    platform_fee = int(gross * 0.03)
    tax = int(gross * 0.11)
    total_idr = gross + platform_fee + tax
    amount_usd = round(total_idr / IDR_PER_USD, 2)
    if amount_usd < 0.5:
        amount_usd = 0.5

    count = await db.ticket_orders.count_documents({}) + 1
    order_id, payment_id = nid(), nid()
    order = {"id": order_id, "order_code": f"OKX-ORD-{count:06d}", "event_id": ev["id"], "event_name": ev["name"],
             "tier_id": tier["id"], "tier_name": tier["name"], "user_id": user["id"], "buyer_name": user["name"],
             "buyer_email": user["email"], "quantity": qty,
             "attendees": payload.attendees or [{"name": user["name"]}], "gross": gross,
             "platform_fee": platform_fee, "tax": tax, "total": total_idr, "currency": "IDR",
             "status": "awaiting_payment", "payment_id": payment_id, "created_at": now_iso()}
    await db.ticket_orders.insert_one(dict(order))
    payment = {"id": payment_id, "payment_ref": f"OKX-PAY-{count:06d}", "order_id": order_id, "event_id": ev["id"],
               "payer_user_id": user["id"], "payer_name": user["name"], "payee": "OKKAX Sandbox Settlement",
               "purpose": "Ticket purchase", "gross": gross, "discount": 0, "tax_estimate": tax,
               "platform_fee": platform_fee, "gateway_fee": 0, "net": total_idr - platform_fee,
               "currency": "IDR", "method": "card", "method_channel": "Stripe test mode (kartu)",
               "status": "Awaiting Payment", "created_at": now_iso(), "paid_at": None, "refund_status": None,
               "reference_number": f"STRIPE-TEST-{count:06d}", "charged_usd": amount_usd,
               "audit": [{"at": now_iso(), "action": "created", "by": user["email"]}]}
    await db.payments.insert_one(dict(payment))

    checkout = _stripe_checkout(request)
    success_url = f"{payload.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{payload.origin_url}/payment/cancel"
    session = await checkout.create_checkout_session(CheckoutSessionRequest(
        amount=amount_usd, currency="usd", success_url=success_url, cancel_url=cancel_url,
        metadata={"order_id": order_id, "event_id": ev["id"], "user_id": user["id"],
                  "total_idr": str(total_idr)}))
    await db.payment_transactions.insert_one({
        "id": nid(), "session_id": session.session_id, "order_id": order_id, "user_id": user["id"],
        "event_id": ev["id"], "amount_usd": amount_usd, "amount_idr": total_idr, "currency": "usd",
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)})
    await audit(ev["id"], user, "stripe.checkout_created", {"order": order["order_code"], "usd": amount_usd})
    return {"checkout_url": session.url, "session_id": session.session_id, "order": clean(order),
            "amount_usd": amount_usd, "amount_idr": total_idr,
            "note": f"Stripe test mode. Nilai Rp{total_idr:,} dikonversi ke USD {amount_usd} pada kurs indikatif "
                    f"Rp{int(IDR_PER_USD):,}/USD. Gunakan kartu uji 4242 4242 4242 4242."}


@extras.get("/payments/stripe/status/{session_id}")
async def stripe_status(session_id: str, request: Request):
    rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if rec.get("payment_status") != "paid":
        try:
            checkout = _stripe_checkout(request)
            st = await checkout.get_checkout_status(session_id)
            if st.payment_status == "paid" or st.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "updated_at": datetime.now(timezone.utc)}})
                await fulfill_stripe_order(rec["order_id"], session_id)
                rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except Exception as e:
            logger.warning(f"stripe status check failed: {e}")
    tickets = await db.tickets.find({"order_id": rec["order_id"]}, {"_id": 0}).to_list(50)
    order = await db.ticket_orders.find_one({"id": rec["order_id"]}, {"_id": 0})
    return {"session_id": session_id, "status": rec["status"], "payment_status": rec["payment_status"],
            "tickets": tickets, "order": order}


@extras.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    checkout = _stripe_checkout(request)
    try:
        res = await checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook tidak valid: {e}")
    if res.payment_status == "paid" and res.session_id:
        rec = await db.payment_transactions.find_one({"session_id": res.session_id}, {"_id": 0})
        if rec and rec.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": res.session_id, "payment_status": {"$ne": "paid"}},
                {"$set": {"status": "completed", "payment_status": "paid",
                          "updated_at": datetime.now(timezone.utc)}})
            await fulfill_stripe_order(rec["order_id"], res.session_id)
    return {"status": "ok"}


# ------------------------------------------------------------------ role workspaces
@extras.get("/demo/summary")
async def demo_summary():
    """Angka kunci publik untuk halaman Platform Demo — semuanya dari database demo."""
    import seed_data
    from server import compute_budget

    ev = await db.events.find_one({"id": seed_data.EVENT_ID}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event demo belum tersedia. Jalankan reset data demo.")
    b = await compute_budget(ev["id"])
    tiers = await db.ticket_tiers.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    orders = await db.ticket_orders.find({"event_id": ev["id"], "status": "paid"}, {"_id": 0}).to_list(1000)
    tenants = await db.tenant_applications.find({"event_id": ev["id"], "status": "approved"}, {"_id": 0}).to_list(300)
    vendors = await db.event_vendors.count_documents({"event_id": ev["id"]})
    talents = await db.event_talents.count_documents({"event_id": ev["id"]})
    booths = await db.booth_slots.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    jobs = await db.event_jobs.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    riders = await db.rider_items.find({"event_id": ev["id"]}, {"_id": 0}).to_list(500)
    sponsors = await db.sponsor_commitments.find({"event_id": ev["id"], "status": "Confirmed"}, {"_id": 0}).to_list(50)
    ticket_gmv = sum(o["total"] for o in orders)
    tenant_revenue = sum(t["amount"] for t in tenants)

    et = await db.event_talents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    headliner = max(et, key=lambda x: x["landed_cost"]) if et else None
    evendors = await db.event_vendors.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)
    venue = await db.event_venues.find_one({"event_id": ev["id"]}, {"_id": 0})
    milestones = await db.payment_milestones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)
    incidents = await db.incidents.find({"event_id": ev["id"]}, {"_id": 0}).to_list(100)
    packages = await db.sponsor_packages.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
    rider_matched = len([r for r in riders if r["status"] == "Matched"])
    workforce_filled = sum(j["filled"] for j in jobs)
    workforce_needed = sum(j["needed"] for j in jobs)
    vendors_confirmed = len([v for v in evendors if v["status"] == "Confirmed"])
    checks = [
        any(t["status"] == "Confirmed" for t in et),
        bool(venue and venue["status"] == "Confirmed"),
        rider_matched / max(1, len(riders)) > 0.5,
        vendors_confirmed / max(1, len(evendors)) > 0.5,
        workforce_filled / max(1, workforce_needed) > 0.5,
        any(t.get("active") for t in tiers),
        len([x for x in booths if x["status"] == "occupied"]) > 0,
        len(sponsors) > 0,
    ]
    readiness = int(100 * sum(1 for c in checks if c) / len(checks))
    vendor_payout = sum(v["cost"] for v in evendors)
    workforce_payout = sum(j["needed"] * j["compensation_per_day"] * j.get("days", 1) for j in jobs)

    personas = [
        {"label": "Penyelenggara", "email": "organizer@okkax.id", "scope": "Event Studio, Event Graph, budget, sponsor, tenant, ticketing"},
        {"label": "Sponsor", "email": "sponsor@okkax.id", "scope": "Sponsor Exchange, express interest, commitments"},
        {"label": "Tenant", "email": "tenant@okkax.id", "scope": "Tenant Exchange, pilih booth, aplikasi"},
        {"label": "Pengunjung", "email": "audience@okkax.id", "scope": "Discover, checkout sandbox, QR ticket, refund"},
        {"label": "Supervisor", "email": "supervisor@okkax.id", "scope": "Command Center, run of show, incident"},
    ]
    return {
        "event": {"id": ev["id"], "event_code": ev["event_code"], "name": ev["name"], "city": ev["city"],
                  "start_date": ev["start_date"], "end_date": ev.get("end_date"), "capacity": ev["capacity"],
                  "event_type": ev["event_type"], "organizer_name": ev.get("organizer_name"),
                  "venue_name": ev.get("venue_name"), "status": ev["status"]},
        "key_numbers": {
            "total_event_cost": b["total_cost"],
            "confirmed_funding": b["confirmed_funding"],
            "funding_gap": b["funding_gap"],
            "economic_activity": b["total_cost"] + ticket_gmv + tenant_revenue,
        },
        "network": {
            "talents": talents, "vendors": vendors, "rider_items": len(riders),
            "sponsor_commitments": len(sponsors), "sponsor_value": sum(s["amount"] for s in sponsors),
            "booths_total": len(booths), "booths_occupied": len([x for x in booths if x["status"] == "occupied"]),
            "tenant_revenue": tenant_revenue, "workforce_needed": sum(j["needed"] for j in jobs),
            "tickets_sold": sum(t["sold"] for t in tiers), "ticket_capacity": sum(t["quantity"] for t in tiers),
            "ticket_gmv": ticket_gmv, "break_even_tickets": b["break_even_tickets"],
        },
        "personas": personas,
        "sandbox_login": "POST /api/demo/persona-login {\"label\": \"Penyelenggara\"}",
        "brief": {
            "city": ev["city"], "days": ev["days"], "setup_days": ev["setup_days"],
            "capacity": ev["capacity"], "budget": ev["budget"], "objective": ev.get("objective"),
            "headliner": (headliner or {}).get("talent_name"),
            "headliner_landed_cost": (headliner or {}).get("landed_cost", 0),
            "headliner_fee": (headliner or {}).get("fee", 0),
            "booths": len(booths), "sponsor_tiers": len(packages),
            "audience_profile": ev.get("audience_profile"),
        },
        "operations": {
            "readiness": readiness,
            "rider_matched": rider_matched, "rider_total": len(riders),
            "workforce_filled": workforce_filled, "workforce_needed": workforce_needed,
            "vendors_confirmed": vendors_confirmed, "vendors_total": len(evendors),
            "milestones_paid": len([m for m in milestones if m["status"] == "Simulated Paid"]),
            "milestones_total": len(milestones),
            "milestones_pending_amount": sum(m["amount"] for m in milestones if m["status"] != "Simulated Paid"),
            "incidents_open": len([i for i in incidents if i["status"] != "Resolved"]),
            "incidents_total": len(incidents),
            "tickets_sold": sum(t["sold"] for t in tiers), "ticket_capacity": sum(t["quantity"] for t in tiers),
        },
        "ripple": {
            "businesses_activated": len(evendors) + len(tenants) + (1 if venue else 0) + len(et),
            "workers_activated": workforce_needed,
            "vendor_payout": vendor_payout,
            "workforce_payout": workforce_payout,
            "venue_income": (venue or {}).get("total_cost", 0),
            "ticket_gmv": ticket_gmv,
            "economic_activity": b["total_cost"] + ticket_gmv + tenant_revenue,
        },
        "demo_password": None,
        "sample_qr": "OKKAX|" + ev["event_code"] + "|OKX-TIX-000001",
        "disclaimer": seed_data.DISCLAIMER,
    }



@extras.get("/me/workspace")
async def my_workspace(user: dict = Depends(get_current_user)):
    roles = set(user.get("roles", []))
    out: Dict[str, Any] = {"roles": sorted(roles), "sections": []}

    async def event_name(eid):
        ev = await db.events.find_one({"id": eid}, {"_id": 0})
        return (ev or {}).get("name", "—")

    if roles & {"talent", "talent_management"}:
        talent_ids = user.get("linked_talent_ids") or []
        bookings = await db.event_talents.find({"talent_id": {"$in": talent_ids}}, {"_id": 0}).to_list(100)
        rows = []
        for b in bookings:
            riders = await db.rider_items.find({"event_talent_id": b["id"]}, {"_id": 0}).to_list(200)
            ms = await db.payment_milestones.find({"ref_type": "talent", "ref_id": b["id"]}, {"_id": 0}).to_list(50)
            rows.append({**b, "event_name": await event_name(b["event_id"]),
                         "rider_total": len(riders),
                         "rider_matched": len([r for r in riders if r["status"] == "Matched"]),
                         "milestones": ms})
        out["sections"].append({"kind": "talent", "title": "Booking talent saya", "items": rows})

    if "venue_manager" in roles:
        vid = user.get("linked_venue_id")
        rows = await db.event_venues.find({"venue_id": vid}, {"_id": 0}).to_list(100) if vid else []
        for r in rows:
            r["event_name"] = await event_name(r["event_id"])
        out["sections"].append({"kind": "venue", "title": "Booking venue saya", "items": rows})

    if "vendor" in roles:
        vid = user.get("linked_vendor_id")
        rows = await db.event_vendors.find({"vendor_id": vid}, {"_id": 0}).to_list(100) if vid else []
        for r in rows:
            r["event_name"] = await event_name(r["event_id"])
        out["sections"].append({"kind": "vendor", "title": "Penugasan vendor saya", "items": rows})

    if "worker" in roles:
        wid = user.get("linked_worker_id")
        rows = await db.event_workers.find({"worker_id": wid}, {"_id": 0}).to_list(100) if wid else []
        for r in rows:
            r["event_name"] = await event_name(r["event_id"])
            job = await db.event_jobs.find_one({"id": r.get("job_id")}, {"_id": 0}) if r.get("job_id") else None
            if not job:
                job = await db.event_jobs.find_one({"event_id": r["event_id"], "role": r["role"]}, {"_id": 0})
            r["job"] = job
            r["earning"] = (job or {}).get("compensation_per_day", 0) * (job or {}).get("days", 1)
        out["sections"].append({"kind": "worker", "title": "Shift & pembayaran saya", "items": rows})

    if roles & {"finance_approver", "supervisor"} and user.get("org_id"):
        events = await db.events.find({"organizer_org_id": user["org_id"]}, {"_id": 0}).to_list(50)
        rows = []
        for ev in events:
            ms = await db.payment_milestones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)
            rows.append({"event_id": ev["id"], "event_name": ev["name"],
                         "pending": len([m for m in ms if m["status"] != "Simulated Paid"]),
                         "pending_amount": sum(m["amount"] for m in ms if m["status"] != "Simulated Paid"),
                         "milestones": ms[:8]})
        out["sections"].append({"kind": "finance", "title": "Persetujuan pembayaran", "items": rows})

    return out


PERSONA_EMAILS = {
    "Penyelenggara": "organizer@okkax.id",
    "Sponsor": "sponsor@okkax.id",
    "Tenant": "tenant@okkax.id",
    "Pengunjung": "audience@okkax.id",
    "Supervisor": "supervisor@okkax.id",
}


@extras.post("/demo/persona-login")
async def persona_login(body: Dict[str, Any], response: Response):
    """Masuk sekali klik sebagai persona sandbox. Persona administrator tidak diizinkan.

    Endpoint ini hanya aktif ketika `OKKAX_DEMO_MODE=true` (default true selama
    kompetisi berjalan). Ketika demo mode dimatikan, endpoint mengembalikan 404
    sehingga tidak dapat dieksploitasi untuk bypass password di produksi."""
    if not is_demo_mode():
        raise HTTPException(status_code=404, detail="Not found")
    email = PERSONA_EMAILS.get(body.get("label"))
    if not email:
        raise HTTPException(status_code=400, detail="Persona demo tidak dikenali")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Persona demo belum diseed. Jalankan reset data demo.")
    if {"super_admin", "platform_admin"}.intersection(set(user.get("roles", []))):
        raise HTTPException(status_code=403, detail="Persona administrator tidak tersedia pada mode demo")
    ensure_account_active(user)
    user = clean(user)
    token, _ = await issue_access_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none",
                        path="/", max_age=7 * 24 * 3600)
    await audit(None, user, "demo.persona_login", {"label": body.get("label")})
    return {"token": token, "user": user}



@extras.post("/me/workspace/confirm")
async def confirm_assignment(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    kind, item_id = body.get("kind"), body.get("id")
    status = body.get("status", "Confirmed")
    coll = {"talent": "event_talents", "venue": "event_venues", "vendor": "event_vendors"}.get(kind)
    if not coll:
        raise HTTPException(status_code=400, detail="Jenis penugasan tidak dikenali")
    linked = {"talent": user.get("linked_talent_ids") or [], "venue": [user.get("linked_venue_id")],
              "vendor": [user.get("linked_vendor_id")]}[kind]
    key = {"talent": "talent_id", "venue": "venue_id", "vendor": "vendor_id"}[kind]
    doc = await db[coll].find_one({"id": item_id}, {"_id": 0})
    if not doc or doc.get(key) not in linked:
        raise HTTPException(status_code=403, detail="Penugasan ini bukan milik Anda")
    await db[coll].update_one({"id": item_id}, {"$set": {"status": status}})
    await audit(doc["event_id"], user, f"{kind}.self_confirm", {"id": item_id, "status": status})
    return {"ok": True}


# ------------------------------------------------------------------ documents (PDF)
def _header(c, title: str, subtitle: str):
    c.setFillColor(INK)
    c.rect(0, 277 * mm, 210 * mm, 20 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(15 * mm, 283 * mm, 8 * mm, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(17 * mm, 285.6 * mm, "O")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(26 * mm, 285.6 * mm, "OKKAX")
    c.setFont("Helvetica", 7.5)
    c.drawString(60 * mm, 285.6 * mm, "Live Event Operating Network")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 19)
    c.drawString(15 * mm, 262 * mm, title)
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#52525b"))
    c.drawString(15 * mm, 256 * mm, subtitle)
    c.setStrokeColor(colors.HexColor("#d4d4d8"))
    c.line(15 * mm, 252 * mm, 195 * mm, 252 * mm)


def _footer(c, note: str):
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.HexColor("#71717a"))
    text = c.beginText(15 * mm, 24 * mm)
    for line in note.split("\n"):
        text.textLine(line)
    c.drawText(text)
    c.setFillColor(ACCENT)
    c.rect(15 * mm, 12 * mm, 180 * mm, 1, fill=1, stroke=0)


def _rows(c, y, rows, col2=120 * mm, bold_last=False):
    c.setFont("Helvetica", 9.5)
    for i, (k, v) in enumerate(rows):
        last = bold_last and i == len(rows) - 1
        if y < 34 * mm and not last:
            continue
        if y < 30 * mm:
            break
        c.setFont("Helvetica-Bold" if last else "Helvetica", 10.5 if last else 9.5)
        c.setFillColor(INK if last else colors.HexColor("#3f3f46"))
        c.drawString(15 * mm, y, str(k))
        c.setFillColor(INK)
        c.drawRightString(195 * mm, y, str(v))
        c.setStrokeColor(colors.HexColor("#e4e4e7"))
        c.line(15 * mm, y - 2 * mm, 195 * mm, y - 2 * mm)
        y -= 8 * mm
    return y


def _rp(v):
    return "Rp" + f"{int(v or 0):,}".replace(",", ".")


def _pdf_response(build, filename: str):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    build(c)
    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


DEMO_NOTE = ("Dokumen ini dihasilkan otomatis oleh OKKAX pada mode demo kompetisi.\n"
             "Seluruh nama, organisasi, harga, dan transaksi merupakan data fiktif. Pembayaran bersifat sandbox —\n"
             "tidak ada uang nyata yang ditagihkan. Estimasi pajak memerlukan verifikasi profesional dan bukan nasihat pajak.")


@extras.get("/documents/invoice/{order_id}")
async def invoice_pdf(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.ticket_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if order["user_id"] != user["id"] and not is_admin(user):
        ev = await get_event_or_404(order["event_id"])
        await assert_event_access(ev, user, write=True)
    payment = await db.payments.find_one({"id": order.get("payment_id")}, {"_id": 0}) or {}
    tickets = await db.tickets.find({"order_id": order_id}, {"_id": 0}).to_list(50)

    def build(c):
        _header(c, f"Invoice {order['order_code']}",
                f"{order['event_name']} · diterbitkan {now_iso()[:10]}")
        y = 240 * mm
        y = _rows(c, y, [
            ("Ditagihkan kepada", f"{order['buyer_name']} ({order['buyer_email']})"),
            ("Event", order["event_name"]),
            ("Ticket tier", f"{order['tier_name']} × {order['quantity']}"),
            ("Metode pembayaran", payment.get("method_channel", "—")),
            ("Nomor referensi", payment.get("reference_number", "—")),
            ("Status pembayaran", payment.get("status", order["status"])),
        ])
        y -= 6 * mm
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(15 * mm, y, "Rincian biaya")
        y -= 8 * mm
        y = _rows(c, y, [
            ("Subtotal tiket", _rp(order["gross"])),
            ("Platform fee OKKAX (3%)", _rp(order["platform_fee"])),
            ("Estimasi pajak (11%)", _rp(order["tax"])),
            ("Total", _rp(order["total"])),
        ], bold_last=True)
        y -= 6 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(15 * mm, y, f"Tiket diterbitkan ({len(tickets)})")
        y -= 7 * mm
        c.setFont("Helvetica", 9)
        for t in tickets:
            c.setFillColor(colors.HexColor("#3f3f46"))
            c.drawString(15 * mm, y, f"{t['ticket_number']} — {t['attendee_name']} ({t['status']})")
            y -= 6 * mm
        _footer(c, DEMO_NOTE)

    await audit(order["event_id"], user, "document.invoice", {"order": order["order_code"]})
    return _pdf_response(build, f"OKKAX-Invoice-{order['order_code']}.pdf")


@extras.get("/documents/quotation/{event_id}")
async def quotation_pdf(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    from server import compute_budget
    b = await compute_budget(ev["id"])
    by_cat = sorted(b["cost_by_category"].items(), key=lambda x: -x[1])[:11]

    def build(c):
        _header(c, f"Quotation {ev['event_code']}", f"{ev['name']} · {ev['city']} · {ev['start_date']}")
        y = 240 * mm
        y = _rows(c, y, [
            ("Penyelenggara", ev.get("organizer_name") or "—"),
            ("Jenis event", ev["event_type"]),
            ("Venue", ev.get("venue_name") or "Belum dikonfirmasi"),
            ("Durasi", f"{ev['days']} hari event + {ev['setup_days']} setup day"),
            ("Kapasitas", f"{ev['capacity']:,}".replace(",", ".")),
        ])
        y -= 6 * mm
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(15 * mm, y, "Estimasi biaya per kategori (11 kategori terbesar)")
        y -= 8 * mm
        y = _rows(c, y, [(k, _rp(v)) for k, v in by_cat] + [("Total Event Cost", _rp(b["total_cost"]))],
                  bold_last=True)
        y -= 4 * mm
        y = _rows(c, y, [
            ("Confirmed Funding", _rp(b["confirmed_funding"])),
            ("Funding Gap", _rp(b["funding_gap"])),
            ("Projected ticket revenue", _rp(b["projected_ticket_revenue"])),
            ("Break-even tickets", f"{b['break_even_tickets'] or 0:,}".replace(",", ".")),
        ])
        _footer(c, DEMO_NOTE)

    await audit(ev["id"], user, "document.quotation")
    return _pdf_response(build, f"OKKAX-Quotation-{ev['event_code']}.pdf")


@extras.get("/documents/payment-schedule/{event_id}")
async def payment_schedule_pdf(event_id: str, user: dict = Depends(get_current_user)):
    ev = await get_event_or_404(event_id)
    await assert_event_access(ev, user, write=True)
    ms = await db.payment_milestones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(200)

    def build(c):
        _header(c, f"Payment Schedule {ev['event_code']}", f"{ev['name']} · {len(ms)} milestone")
        y = 240 * mm
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(colors.HexColor("#52525b"))
        for label, x in [("PENERIMA", 15), ("MILESTONE", 62), ("JATUH TEMPO", 115), ("%", 145), ("JUMLAH", 195)]:
            (c.drawRightString if label in ("JUMLAH",) else c.drawString)(x * mm, y, label)
        y -= 6 * mm
        c.setFont("Helvetica", 8.5)
        total = 0
        for m in ms:
            total += m["amount"]
            c.setFillColor(colors.HexColor("#3f3f46"))
            c.drawString(15 * mm, y, str(m["ref_name"])[:26])
            c.drawString(62 * mm, y, f"{m['description']} ({m['status']})"[:32])
            c.drawString(115 * mm, y, str(m["due_date"]))
            c.drawString(145 * mm, y, f"{m['percentage']}%")
            c.setFillColor(INK)
            c.drawRightString(195 * mm, y, _rp(m["amount"]))
            c.setStrokeColor(colors.HexColor("#e4e4e7"))
            c.line(15 * mm, y - 2 * mm, 195 * mm, y - 2 * mm)
            y -= 7 * mm
            if y < 40 * mm:
                break
        y -= 4 * mm
        _rows(c, y, [("Total milestone terjadwal", _rp(total))], bold_last=True)
        _footer(c, DEMO_NOTE)

    await audit(ev["id"], user, "document.payment_schedule")
    return _pdf_response(build, f"OKKAX-Payment-Schedule-{ev['event_code']}.pdf")
