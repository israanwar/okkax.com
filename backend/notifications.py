"""OKKAX Notification Management System.

Provides:
1. Deterministic role-aware seeding (>=105 notifications per user/role).
2. Presentation-layer deduplication & aggregation for high-frequency events.
3. Pagination and category filtering.
4. Single and bulk mark-as-read operations.
5. Workspace and user isolation.
"""
from datetime import datetime, timezone, timedelta
import hashlib
from typing import List, Dict, Any, Optional
from core import db, now_iso, clean


SEED_VERSION = 2

AUDIENCE_NOTIFICATION_TYPES = frozenset({
    "ticket_issue",
    "ticket_order",
    "order_update",
    "payment",
    "refund",
    "event_reminder",
    "event_update",
    "event_change",
    "schedule_update",
    "gate_update",
    "gate_access",
    "access_update",
})


def _normalize_notification_role(role: Optional[str]) -> str:
    role = (role or "audience").lower()
    if role in {"event_organizer", "supervisor", "finance_approver"}:
        return "organizer"
    if role in {"talent_management", "artist", "band"}:
        return "talent"
    if role in {"worker", "crew"}:
        return "workforce"
    if role in {"supplier"}:
        return "vendor"
    if role in {"venue_manager"}:
        return "venue"
    return role


def notification_role_for_user(user: dict) -> str:
    """Resolve notification scope from the authoritative active workspace."""
    workspace = user.get("_workspace_ctx") or {}
    if workspace.get("kind") == "personal":
        return "audience"
    if workspace.get("role"):
        return _normalize_notification_role(workspace["role"])
    roles = user.get("roles") or []
    return _normalize_notification_role(roles[0] if roles else "audience")


def notification_scope_query(user: dict) -> Dict[str, Any]:
    """Build a role-safe Mongo query, including constrained legacy rows."""
    role = notification_role_for_user(user)
    primary_role = _normalize_notification_role((user.get("roles") or ["audience"])[0])
    query: Dict[str, Any] = {"user_id": user["id"]}

    if role == "audience":
        allowed_destinations = ["/app/tickets", "/app/orders", "/app/discover"]
        query["type"] = {"$in": sorted(AUDIENCE_NOTIFICATION_TYPES)}
        query["$or"] = [
            {"notification_role": "audience"},
            {
                "notification_role": {"$exists": False},
                "$or": [
                    {"destination": {"$in": allowed_destinations}},
                    {"destination": {"$regex": r"^/app/discover/events/"}},
                ],
            },
        ]
    elif role != primary_role:
        # A workspace switch must never inherit unscoped rows from the
        # account's primary role.
        query["notification_role"] = role
    else:
        query["$or"] = [
            {"notification_role": role},
            {"notification_role": {"$exists": False}},
        ]
    return query


def seed_notif_id(user_id: str, index: int, extra: str = "") -> str:
    """Generate a deterministic, stable ID for seeded notifications."""
    raw = f"notif:{user_id}:{index}:{extra}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _format_time_offset(minutes_ago: int) -> str:
    """Return ISO string for a given time offset from now."""
    dt = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    return dt.isoformat()


# Role-specific notification templates
def _generate_organizer_templates(events: list) -> list:
    ev_main = events[0] if events else {"id": "evt-aruna-2026", "name": "Aruna Bold Live Experience 2026"}
    ev_second = events[1] if len(events) > 1 else {"id": "evt-bandung-indie", "name": "Bandung Indie District 2026"}
    ev_third = events[2] if len(events) > 2 else {"id": "evt-b-nusantara-sound-fest", "name": "Nusantara Sound Fest"}

    templates = [
        # Recent high-frequency ticket sales (for aggregation demonstration)
        {"type": "ticket_sale", "title": "Penjualan tiket baru", "body": "2 tiket Presale terjual.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/tickets",
         "metadata": {"quantity": 2, "tier_name": "Presale", "amount": 500000}, "mins": 3, "read": False},
        {"type": "ticket_sale", "title": "Penjualan tiket baru", "body": "3 tiket Presale terjual.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/tickets",
         "metadata": {"quantity": 3, "tier_name": "Presale", "amount": 750000}, "mins": 8, "read": False},
        {"type": "ticket_sale", "title": "Penjualan tiket baru", "body": "1 tiket Regular terjual.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/tickets",
         "metadata": {"quantity": 1, "tier_name": "Regular", "amount": 350000}, "mins": 14, "read": False},
        {"type": "ticket_sale", "title": "Penjualan tiket baru", "body": "2 tiket VIP terjual.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/tickets",
         "metadata": {"quantity": 2, "tier_name": "VIP", "amount": 1500000}, "mins": 25, "read": False},
        {"type": "ticket_sale", "title": "Penjualan tiket baru", "body": "1 tiket Presale terjual.", "kind": "info",
         "event_id": ev_second["id"], "event_name": ev_second["name"], "destination": f"/app/events/{ev_second['id']}/tickets",
         "metadata": {"quantity": 1, "tier_name": "Presale", "amount": 250000}, "mins": 35, "read": False},

        # Talent & Rider
        {"type": "talent_confirmation", "title": "Rider talent dikonfirmasi", "body": "Aksara Band menyetujui Hospitality & Backline Rider.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/talent",
         "metadata": {"talent_name": "Aksara Band", "status": "approved"}, "mins": 55, "read": False},
        {"type": "talent_booking", "title": "Penawaran talent diterima", "body": "Lantera Collective mengonfirmasi slot Sunset Stage.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/talent",
         "metadata": {"talent_name": "Lantera Collective", "fee": 180000000}, "mins": 110, "read": False},

        # Sponsor & Commercial
        {"type": "sponsor_confirmed", "title": "Sponsor commitment dikonfirmasi", "body": "Sentra Digital Pay mengonfirmasi Main Sponsor Rp200.000.000.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/sponsors",
         "metadata": {"sponsor_name": "Sentra Digital Pay", "tier": "Main Sponsor", "amount": 200000000}, "mins": 180, "read": False},
        {"type": "sponsor_interest", "title": "Peluang sponsor baru", "body": "Telko Prima mengajukan Letter of Intent untuk Official Telco.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/sponsors",
         "metadata": {"sponsor_name": "Telko Prima", "tier": "Official Telco"}, "mins": 260, "read": False},

        # Tenant & Bazaar
        {"type": "tenant_application", "title": "Aplikasi booth tenant baru", "body": "Kopi Rakit Makassar mengajukan booth F&B FNB-02.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/tenants",
         "metadata": {"tenant_name": "Kopi Rakit Makassar", "booth": "FNB-02"}, "mins": 340, "read": False},
        {"type": "tenant_payment", "title": "Pelunasan booth tenant diterima", "body": "Pembayaran sewa booth FNB-01 Rp15.000.000 terverifikasi.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/tenants",
         "metadata": {"amount": 15000000, "booth": "FNB-01"}, "mins": 420, "read": False},

        # Venue & Permits
        {"type": "venue_permit", "title": "Izin keramaian diterbitkan", "body": "Polda Sulsel menerbitkan surat izin keramaian untuk Makassar Convention Hall.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/venue",
         "metadata": {"authority": "Polda Sulsel", "status": "issued"}, "mins": 540, "read": False},
        {"type": "venue_booking", "title": "Jadwal loading dock dikunci", "body": "Makassar Convention Hall mengonfirmasi slot loading H-2 mulai 08:00 WITA.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/venue",
         "metadata": {"slot": "H-2 08:00 WITA"}, "mins": 720, "read": False},

        # Vendor & Production
        {"type": "vendor_quotation", "title": "Quotation vendor sound disetujui", "body": "Sonic Timur Audio mengirimkan finalized tech rider quote Rp55.000.000.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/vendors",
         "metadata": {"vendor_name": "Sonic Timur Audio", "amount": 55000000}, "mins": 900, "read": False},
        {"type": "vendor_loading", "title": "Jadwal instalasi rigging panggung", "body": "Baja Panggung Nusantara memulai pemasangan rigging H-1.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/vendors",
         "metadata": {"vendor_name": "Baja Panggung Nusantara"}, "mins": 1100, "read": False},

        # Workforce & Shifts
        {"type": "workforce_assignment", "title": "Penugasan crew ticketing selesai", "body": "12 staff gate & validator telah menerima jadwal shift.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/workforce",
         "metadata": {"count": 12, "role": "Ticketing Crew"}, "mins": 1300, "read": False},

        # Budget & Financial Operations
        {"type": "budget_alert", "title": "Funding gap teratasi 82%", "body": "Pemasukan tiket dan sponsor menutup 82% estimasi OPEX.", "kind": "info",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/budget",
         "metadata": {"coverage": "82%"}, "mins": 1500, "read": False},
        {"type": "payment", "title": "Disbursement termin 1 vendor selesai", "body": "Pembayaran DP Rp27.500.000 ke Sonic Timur Audio telah sukses diproses.", "kind": "success",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": f"/app/events/{ev_main['id']}/payments",
         "metadata": {"amount": 27500000, "recipient": "Sonic Timur Audio"}, "mins": 1800, "read": False},

        # Calendar & Operations
        {"type": "calendar_conflict", "title": "Jadwal soundcheck dimajukan", "body": "Soundcheck Dimas Arka & MC bergeser 30 menit untuk sinkronisasi live stream.", "kind": "warning",
         "event_id": ev_main["id"], "event_name": ev_main["name"], "destination": "/app/calendar",
         "metadata": {"shift_minutes": 30}, "mins": 2200, "read": False},
    ]

    # Historical entries to complete >= 105 records
    historical_bases = [
        ("ticket_sale", "Penjualan tiket", "1 tiket Regular terjual.", "info", f"/app/events/{ev_main['id']}/tickets", {"quantity": 1, "tier_name": "Regular", "amount": 350000}),
        ("ticket_sale", "Penjualan tiket", "2 tiket Presale terjual.", "info", f"/app/events/{ev_second['id']}/tickets", {"quantity": 2, "tier_name": "Presale", "amount": 500000}),
        ("ticket_sale", "Penjualan tiket", "4 tiket Early Bird terjual.", "info", f"/app/events/{ev_third['id']}/tickets", {"quantity": 4, "tier_name": "Early Bird", "amount": 800000}),
        ("payment", "Pembayaran tiket terverifikasi", "Transaksi Midtrans sandbox Rp750.000 berhasil.", "success", f"/app/events/{ev_main['id']}/payments", {"amount": 750000}),
        ("tenant_application", "Pengajuan tenant baru", "Tenant kuliner lokal mendaftar zona UMKM.", "info", f"/app/events/{ev_main['id']}/tenants", {}),
        ("vendor_quotation", "Penawaran vendor diterima", "Cahaya Sembilan Lighting mengirim penawaran.", "info", f"/app/events/{ev_main['id']}/vendors", {}),
        ("workforce_shift", "Check-in workforce", "Staff liaison officer telah melengkapi konfirmasi kehadiran.", "info", f"/app/events/{ev_main['id']}/workforce", {}),
        ("sponsor_interest", "Interaksi sponsor baru", "Brand otomotif mengunduh sponsorship deck.", "info", f"/app/events/{ev_main['id']}/sponsors", {}),
        ("schedule_update", "Pembaruan rundown", "Durasi pembukaan dimutakhirkan pada Calendar Engine.", "info", "/app/calendar", {}),
        ("budget_alert", "Pencatatan realisasi biaya", "Biaya cetak ID card & wristband tercatat pada ledger.", "info", f"/app/events/{ev_main['id']}/budget", {}),
        ("talent_rider", "Review spesifikasi teknis", "Tech rider LED & Multimedia diverifikasi tim produksi.", "info", f"/app/events/{ev_main['id']}/talent", {}),
        ("venue_permit", "Koordinasi keamanan Dishub", "Rekayasa lalu lintas area parkir disepakati.", "info", f"/app/events/{ev_main['id']}/venue", {}),
    ]

    for i in range(len(templates), 110):
        base = historical_bases[i % len(historical_bases)]
        day_offset = (i // len(historical_bases)) + 2
        min_offset = day_offset * 1440 + (i * 37)
        templates.append({
            "type": base[0],
            "title": f"{base[1]} #{i+1}",
            "body": f"{base[2]} (Arsip operasional #{i+1})",
            "kind": base[3],
            "event_id": ev_main["id"] if i % 2 == 0 else ev_second["id"],
            "event_name": ev_main["name"] if i % 2 == 0 else ev_second["name"],
            "destination": base[4],
            "metadata": base[5],
            "mins": min_offset,
            "read": True,  # Historical are read
        })

    return templates


def _generate_talent_templates() -> list:
    templates = [
        {"type": "talent_booking", "title": "Undangan perform baru", "body": "Aruna Bold Live Experience 2026 mengundang Aksara Band untuk Main Stage 90 menit.", "kind": "info",
         "destination": "/app/me", "metadata": {"fee": 400000000, "duration": "90m"}, "mins": 5, "read": False},
        {"type": "talent_rider", "title": "Pembaruan status rider", "body": "Panitia menyetujui pemenuhan Audio Line Array & Green Room AC.", "kind": "success",
         "destination": "/app/me", "metadata": {"status": "approved"}, "mins": 25, "read": False},
        {"type": "payment", "title": "DP Fee Performance diterima", "body": "Transfer termin 1 Rp200.000.000 telah masuk rekening manajemen.", "kind": "success",
         "destination": "/app/me", "metadata": {"amount": 200000000}, "mins": 60, "read": False},
        {"type": "schedule_update", "title": "Jadwal soundcheck dikonfirmasi", "body": "Slot soundcheck ditetapkan Jumat, 14 Agustus pukul 16:00 WITA.", "kind": "info",
         "destination": "/app/calendar", "metadata": {"time": "16:00 WITA"}, "mins": 120, "read": False},
        {"type": "talent_booking", "title": "Permintaan ketersediaan tanggal", "body": "Bandung Indie District 2026 menanyakan ketersediaan 22 Agustus 2026.", "kind": "info",
         "destination": "/app/me", "metadata": {"date": "2026-08-22"}, "mins": 240, "read": False},
    ]
    # Add historical records up to 105
    for i in range(len(templates), 108):
        templates.append({
            "type": "talent_update",
            "title": f"Pembaruan logistik perform #{i+1}",
            "body": f"Informasi akomodasi hotel dan transportasi bandara Makassar #{i+1} diverifikasi.",
            "kind": "info",
            "destination": "/app/me",
            "metadata": {"batch": i},
            "mins": (i * 200) + 300,
            "read": i >= 18,
        })
    return templates


def _generate_sponsor_templates() -> list:
    templates = [
        {"type": "sponsor_confirmed", "title": "Proposal sponsorship disetujui", "body": "Paket Main Sponsor untuk Aruna Bold Live Experience 2026 telah aktif.", "kind": "success",
         "destination": "/app/sponsor", "metadata": {"package": "Main Sponsor"}, "mins": 10, "read": False},
        {"type": "sponsor_interest", "title": "Peluang aktivasi booth VIP", "body": "Denah aktivasi brand experience booth 6x6m siap untuk ditinjau.", "kind": "info",
         "destination": "/app/sponsor", "metadata": {"booth_size": "6x6m"}, "mins": 45, "read": False},
        {"type": "payment", "title": "Faktur invoice sponsorship diterbitkan", "body": "Invoice termin 1 Rp100.000.000 tersedia untuk pembayaran.", "kind": "info",
         "destination": "/app/sponsor", "metadata": {"invoice_no": "INV-SPO-001"}, "mins": 90, "read": False},
        {"type": "schedule_update", "title": "Jadwal technical meeting sponsor", "body": "Sesi briefing aktivasi brand dijadwalkan H-7 via Google Meet.", "kind": "info",
         "destination": "/app/calendar", "metadata": {}, "mins": 180, "read": False},
    ]
    for i in range(len(templates), 108):
        templates.append({
            "type": "sponsor_report",
            "title": f"Laporan jangkauan media #{i+1}",
            "body": f"Rekap estimasi impresi digital dan brand exposure kampanye #{i+1}.",
            "kind": "info",
            "destination": "/app/sponsor",
            "metadata": {"report_id": i},
            "mins": (i * 210) + 350,
            "read": i >= 16,
        })
    return templates


def _generate_tenant_templates() -> list:
    templates = [
        {"type": "tenant_application", "title": "Aplikasi booth disetujui", "body": "Booth FNB-02 Aruna Bold Live Experience 2026 telah disetujui panitia.", "kind": "success",
         "destination": "/app/tenant", "metadata": {"booth": "FNB-02"}, "mins": 8, "read": False},
        {"type": "tenant_booth", "title": "Instruksi loading tenant", "body": "Akses loading barang tenant dibuka mulai Kamis pukul 14:00 WITA.", "kind": "info",
         "destination": "/app/tenant", "metadata": {"loading_gate": "Gate 3"}, "mins": 30, "read": False},
        {"type": "payment", "title": "Kwitansi sewa booth terverifikasi", "body": "Pembayaran sewa booth telah lunas dan tercatat di sistem.", "kind": "success",
         "destination": "/app/tenant", "metadata": {"amount": 15000000}, "mins": 75, "read": False},
    ]
    for i in range(len(templates), 108):
        templates.append({
            "type": "tenant_notice",
            "title": f"Pembaruan regulasi bazaar #{i+1}",
            "body": f"Panduan kebersihan, kelistrikan standar, dan SOP tenant #{i+1}.",
            "kind": "info",
            "destination": "/app/tenant",
            "metadata": {},
            "mins": (i * 220) + 300,
            "read": i >= 15,
        })
    return templates


def _generate_audience_templates() -> list:
    templates = [
        {"type": "ticket_issue", "title": "E-Ticket siap digunakan", "body": "E-Ticket Presale Aruna Bold Live Experience 2026 dengan QR Code telah terbit.", "kind": "success",
         "destination": "/app/tickets", "metadata": {"event": "Aruna Bold Live Experience 2026"}, "mins": 6, "read": False},
        {"type": "schedule_update", "title": "Pengumuman gate opening", "body": "Pintu masuk utama dibuka pukul 15:00 WITA. Siapkan QR code pada aplikasi.", "kind": "info",
         "destination": "/app/tickets", "metadata": {"gate_time": "15:00 WITA"}, "mins": 40, "read": False},
        {"type": "payment", "title": "Pembayaran tiket berhasil", "body": "Pembayaran pesanan OKX-ORD-0001 berhasil diverifikasi.", "kind": "success",
         "destination": "/app/orders", "metadata": {"order_code": "OKX-ORD-0001"}, "mins": 80, "read": False},
    ]
    for i in range(len(templates), 108):
        templates.append({
            "type": "event_reminder",
            "title": f"Panduan penonton event #{i+1}",
            "body": f"Informasi akses transportasi umum dan shuttle bus menuju venue #{i+1}.",
            "kind": "info",
            "destination": "/app/tickets",
            "metadata": {},
            "mins": (i * 230) + 300,
            "read": i >= 14,
        })
    return templates


def _generate_generic_role_templates(role: str) -> list:
    templates = [
        {"type": "system_notice", "title": f"Selamat datang di portal {role}", "body": f"Workspace {role} Anda siap digunakan untuk operasional live event.", "kind": "info",
         "destination": "/app/me" if role in ("venue", "vendor", "worker") else "/app", "metadata": {}, "mins": 5, "read": False},
        {"type": "schedule_update", "title": "Sinkronisasi kalender operasional", "body": "Jadwal dan assignment event terhubung ke Calendar Engine.", "kind": "success",
         "destination": "/app/calendar", "metadata": {}, "mins": 35, "read": False},
        {"type": "verification", "title": "Verifikasi profil terkonfirmasi", "body": "Dokumen dan profil operasional Anda terverifikasi oleh platform OKKAX.", "kind": "success",
         "destination": "/app/me" if role in ("venue", "vendor", "worker") else "/app", "metadata": {}, "mins": 70, "read": False},
    ]
    for i in range(len(templates), 108):
        templates.append({
            "type": "operational_notice",
            "title": f"Pembaruan operasional #{i+1}",
            "body": f"Catatan log operasional #{i+1} untuk sinkronisasi penugasan dan deliverable.",
            "kind": "info",
            "destination": "/app/me" if role in ("venue", "vendor", "worker") else "/app",
            "metadata": {},
            "mins": (i * 240) + 300,
            "read": i >= 16,
        })
    return templates


async def ensure_user_notifications(user: dict, force: bool = False) -> int:
    """Ensure user has at least 100 role-aware notifications initialized idempotently."""
    user_id = user.get("id")
    if not user_id:
        return 0

    # Fast O(1) idempotency check
    notification_role = notification_role_for_user(user)
    db_user = await db.users.find_one({"id": user_id}, {"notification_seed_versions": 1})
    seeded_versions = (db_user or {}).get("notification_seed_versions") or {}
    if not force and seeded_versions.get(notification_role, 0) >= SEED_VERSION:
        return await db.notifications.count_documents(notification_scope_query(user))

    # Fetch events for context
    events = await db.events.find({"deleted": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1}).to_list(10)

    if notification_role in ("organizer", "promoter"):
        template_list = _generate_organizer_templates(events)
    elif notification_role == "talent":
        template_list = _generate_talent_templates()
    elif notification_role == "sponsor":
        template_list = _generate_sponsor_templates()
    elif notification_role == "tenant":
        template_list = _generate_tenant_templates()
    elif notification_role == "audience":
        template_list = _generate_audience_templates()
    else:
        template_list = _generate_generic_role_templates(notification_role)

    docs = []
    for idx, item in enumerate(template_list):
        notif_id = seed_notif_id(user_id, idx, item.get("type", "general"))
        created_iso = _format_time_offset(item.get("mins", 60))
        doc = {
            "id": notif_id,
            "user_id": user_id,
            "organization_id": (user.get("_workspace_ctx") or {}).get("organization_id"),
            "notification_role": notification_role,
            "event_id": item.get("event_id"),
            "event_name": item.get("event_name"),
            "type": item.get("type", "general"),
            "title": item.get("title", "Notifikasi"),
            "body": item.get("body", ""),
            "kind": item.get("kind", "info"),
            "read": bool(item.get("read", False)),
            "destination": item.get("destination", "/app"),
            "metadata": item.get("metadata", {}),
            "created_at": created_iso,
        }
        docs.append(doc)

    # Bulk upsert to avoid duplicate errors while maintaining idempotency
    for d in docs:
        await db.notifications.update_one(
            {"id": d["id"]},
            {"$set": d},
            upsert=True
        )

    # Mark user as seeded
    await db.users.update_one(
        {"id": user_id},
        {"$set": {f"notification_seed_versions.{notification_role}": SEED_VERSION}}
    )

    return len(docs)


def aggregate_notifications(raw_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate and aggregate high-frequency events for presentation layer."""
    if not raw_items:
        return []

    aggregated = []
    # Group ticket sales by event_id if multiple exist
    ticket_sales_by_event: Dict[str, List[Dict[str, Any]]] = {}
    
    for item in raw_items:
        ntype = item.get("type")
        eid = item.get("event_id")

        if ntype == "ticket_sale" and eid:
            ticket_sales_by_event.setdefault(eid, []).append(item)
        else:
            aggregated.append(item)

    # Process aggregated ticket sales
    for eid, sales in ticket_sales_by_event.items():
        if len(sales) == 1:
            aggregated.append(sales[0])
            continue

        # Multiple sales: aggregate into single card
        total_qty = sum(s.get("metadata", {}).get("quantity", 1) for s in sales)
        total_amount = sum(s.get("metadata", {}).get("amount", 0) for s in sales)
        tier_counts = {}
        for s in sales:
            tname = s.get("metadata", {}).get("tier_name", "Tiket")
            qty = s.get("metadata", {}).get("quantity", 1)
            tier_counts[tname] = tier_counts.get(tname, 0) + qty

        tier_summary = " · ".join(f"{qty} {name}" for name, qty in tier_counts.items())
        any_unread = any(not s.get("read") for s in sales)
        latest_sale = max(sales, key=lambda s: s.get("created_at", ""))

        amount_str = f"Rp{total_amount:,}".replace(",", ".") if total_amount > 0 else ""
        body_parts = [f"{total_qty} tiket terjual", tier_summary]
        if amount_str:
            body_parts.append(amount_str)

        agg_item = {
            "id": f"agg-tickets-{eid}-{latest_sale['id'][:8]}",
            "user_id": latest_sale.get("user_id"),
            "event_id": eid,
            "event_name": latest_sale.get("event_name"),
            "type": "ticket_sale_aggregated",
            "title": "Penjualan tiket",
            "body": " · ".join(body_parts),
            "kind": "info",
            "read": not any_unread,
            "destination": latest_sale.get("destination", f"/app/events/{eid}/tickets"),
            "metadata": {
                "total_quantity": total_qty,
                "total_amount": total_amount,
                "tier_counts": tier_counts,
                "child_ids": [s["id"] for s in sales],
                "count": len(sales),
            },
            "created_at": latest_sale.get("created_at"),
        }
        aggregated.append(agg_item)

    # Sort descending by created_at
    aggregated.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return aggregated


async def get_user_notifications_payload(
    user: dict,
    limit: int = 12,
    page: int = 1,
    unread_only: bool = False,
    category: Optional[str] = None,
    aggregate: bool = True,
) -> Dict[str, Any]:
    """Retrieve user notifications with aggregation and unread counts."""
    await ensure_user_notifications(user)
    user_id = user["id"]

    role = notification_role_for_user(user)
    query = notification_scope_query(user)
    if unread_only:
        query["read"] = False
    if category and category != "all":
        query["type"] = category if role != "audience" or category in AUDIENCE_NOTIFICATION_TYPES else "__forbidden__"

    total_count = await db.notifications.count_documents(query)
    unread_count = await db.notifications.count_documents({**notification_scope_query(user), "read": False})

    skip = (page - 1) * limit if page > 1 else 0

    if aggregate:
        fetch_limit = limit * 2 if limit <= 20 else limit
        cursor = db.notifications.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(fetch_limit)
        raw_rows = await cursor.to_list(fetch_limit)
        aggregated_rows = aggregate_notifications(raw_rows)
        final_items = aggregated_rows[:limit]
    else:
        cursor = db.notifications.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        final_items = await cursor.to_list(limit)

    return {
        "items": final_items,
        "unread": unread_count,
        "total": total_count,
        "page": page,
        "limit": limit,
        "has_more": total_count > (skip + len(final_items)),
    }


async def mark_single_notification_read(user: dict, notification_id: str) -> bool:
    """Mark a single notification (or aggregated group) as read."""
    user_id = user["id"]
    if notification_id.startswith("agg-tickets-"):
        # Handle aggregated group
        parts = notification_id.split("-")
        eid = parts[2] if len(parts) >= 3 else None
        if eid:
            await db.notifications.update_many(
                {**notification_scope_query(user), "event_id": eid, "type": "ticket_sale"},
                {"$set": {"read": True}}
            )
            return True

    res = await db.notifications.update_one(
        {**notification_scope_query(user), "id": notification_id},
        {"$set": {"read": True}}
    )
    return res.modified_count > 0


async def mark_all_user_notifications_read(user: dict) -> int:
    """Mark all notifications for a given user as read."""
    res = await db.notifications.update_many(
        {**notification_scope_query(user), "read": False},
        {"$set": {"read": True}}
    )
    return res.modified_count
