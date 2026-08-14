"""Shared Calendar & Scheduling Engine for public discovery and role workspaces.

The engine deliberately derives its baseline from the existing OKKAX event graph
collections. User-created exceptions live in ``calendar_entries`` so the public
calendar and every role calendar keep one source of truth without duplicating
event, booking, or assignment data.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core import (assert_event_access, audit, clean, db, get_current_user,
                  get_event_or_404, is_admin, nid, now_iso)


calendar = APIRouter(prefix="/api/calendar", tags=["calendar"])

PUBLIC_STATUS_LABELS = {
    "upcoming": "Akan berlangsung",
    "ongoing": "Sedang berlangsung",
    "completed": "Telah selesai",
    "rescheduled": "Dijadwalkan ulang",
    "postponed": "Ditunda",
    "cancelled": "Dibatalkan",
    "tickets_on_sale": "Tiket mulai dijual",
    "tenant_open": "Membuka tenant",
    "sponsor_open": "Mencari sponsor",
    "workforce_open": "Merekrut workforce",
}

ROLE_CALENDARS = {
    "organizer": ["Persiapan", "Venue deadline", "Talent hold", "Kontrak", "DP & pelunasan",
                  "Perizinan", "Penjualan tiket", "Periode sponsor", "Pendaftaran tenant",
                  "Rekrutmen pekerja", "Produksi materi", "Perjalanan talent", "Loading",
                  "Soundcheck", "Rehearsal", "Showtime", "Dismantling", "Settlement",
                  "Laporan pasca-event"],
    "talent": ["Available", "Inquiry", "First Hold", "Second Hold", "Challenging Hold", "Confirmed",
               "Travel Day", "Rehearsal", "Performance", "Rest Day", "Unavailable",
               "Private Availability"],
    "venue": ["Tersedia", "Site Visit", "Tentative Hold", "Confirmed Booking", "Loading", "Setup",
              "Rehearsal", "Event", "Dismantling", "Maintenance", "Blackout Date"],
    "vendor": ["Ketersediaan inventaris", "Jadwal kru", "Mobilisasi", "Instalasi", "Testing", "Show",
               "Pembongkaran", "Pengembalian inventaris", "Maintenance"],
    "freelancer": ["Jadwal tersedia", "Undangan kerja", "Shift", "Check-in", "Check-out", "Overtime",
                   "Cuti", "Pekerjaan tumpang tindih"],
    "partner": ["Batas pengajuan", "Negosiasi", "Pembayaran", "Produksi materi", "Instalasi booth",
                "Aktivasi", "Pengumpulan laporan", "Pengembalian fasilitas"],
}

CITY_COORDS = {
    "Jakarta": (-6.2088, 106.8456), "Bandung": (-6.9175, 107.6191),
    "Surabaya": (-7.2575, 112.7521), "Yogyakarta": (-7.7956, 110.3695),
    "Denpasar": (-8.6705, 115.2126), "Medan": (3.5952, 98.6722),
    "Semarang": (-6.9667, 110.4167), "Palembang": (-2.9909, 104.7566),
    "Balikpapan": (-1.2379, 116.8529), "Manado": (1.4748, 124.8421),
    "Padang": (-0.9471, 100.4172), "Batam": (1.0456, 104.0305),
    "Malang": (-7.9666, 112.6326), "Pontianak": (-0.0263, 109.3425),
    "Makassar": (-5.1477, 119.4327),
}

EDIT_ROLES = {"organizer", "event_organizer", "promoter", "supervisor", "finance_approver",
              "talent", "talent_management", "venue_manager", "vendor", "worker", "sponsor", "tenant"}


def _dt(value: Any, *, end: bool = False) -> Optional[datetime]:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time.max if end else time.min)
    elif value:
        raw = str(value).strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone(timedelta(hours=7)))
    return parsed.astimezone(timezone.utc)


def _date(value: Any) -> Optional[date]:
    if isinstance(value, str) and len(value) >= 10:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            pass
    parsed = _dt(value)
    return parsed.date() if parsed else None


def _at(day: date | str, clock: str = "09:00") -> str:
    d = day if isinstance(day, date) else date.fromisoformat(str(day)[:10])
    clean_clock = clock[:5] if clock else "09:00"
    return f"{d.isoformat()}T{clean_clock}:00+07:00"


def _shift(day: date | str, amount: int) -> date:
    d = day if isinstance(day, date) else date.fromisoformat(str(day)[:10])
    return d + timedelta(days=amount)


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


def _contains(value: Any, needle: str) -> bool:
    return not needle or needle.casefold() in str(value or "").casefold()


def _event_lifecycle(event: dict, today: date) -> str:
    override = event.get("calendar_status")
    if override in {"rescheduled", "postponed", "cancelled"}:
        return override
    start = date.fromisoformat(event["start_date"][:10])
    end = date.fromisoformat((event.get("end_date") or event["start_date"])[:10])
    if start <= today <= end:
        return "ongoing"
    if today < start:
        return "upcoming"
    return "completed"


def _entry(event: dict, suffix: str, title: str, kind: str, status: str,
           start_at: str, end_at: str, **extra: Any) -> dict:
    return {
        "id": f"cal-{event['id']}-{suffix}", "event_id": event["id"],
        "event_code": event.get("event_code"), "event_name": event.get("name"),
        "title": title, "entry_type": kind, "status": status,
        "status_label": PUBLIC_STATUS_LABELS.get(status, status),
        "start_at": start_at, "end_at": end_at, "timezone": event.get("timezone", "Asia/Jakarta"),
        "city": event.get("city"), "country": event.get("country", "Indonesia"),
        "location": event.get("venue_name") or event.get("city"),
        "format": event.get("format") or "Offline", "source_type": "event_graph",
        **extra,
    }


def _overlaps(entry: dict, date_from: str = "", date_to: str = "") -> bool:
    start, end = _date(entry.get("start_at")), _date(entry.get("end_at"))
    lo, hi = _date(date_from), _date(date_to)
    if not start or not end:
        return False
    return not ((lo and end < lo) or (hi and start > hi))


def detect_conflicts(entries: Iterable[dict]) -> list[dict]:
    """Return deterministic, actionable conflicts for visible calendar entries."""
    rows = [dict(item) for item in entries]
    conflicts: list[dict] = []
    seen: set[str] = set()
    by_resource: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_id = {str(item.get("id")): item for item in rows if item.get("id")}
    now = datetime.now(timezone.utc)

    for item in rows:
        resource = (str(item.get("resource_type") or ""), str(item.get("resource_id") or ""))
        if all(resource):
            by_resource[resource].append(item)
        start, end = _dt(item.get("start_at")), _dt(item.get("end_at"))
        if item.get("resource_type") in {"worker", "freelancer"} and start and end and end - start > timedelta(hours=12):
            cid = f"overtime:{item.get('id')}"
            if cid not in seen:
                seen.add(cid)
                conflicts.append({"id": cid, "severity": "medium", "kind": "overtime",
                    "title": "Durasi shift melebihi 12 jam", "entry_ids": [item.get("id")],
                    "resource_name": item.get("resource_name"),
                    "reason": f"{item.get('title')} berpotensi menghasilkan overtime dan waktu istirahat yang tidak cukup.",
                    "action": "Pecah shift, tambahkan kru pengganti, atau konfirmasi overtime."})
        for dependency_id in item.get("dependency_ids") or []:
            dependency = by_id.get(str(dependency_id))
            if not dependency or dependency.get("status") not in {"Completed", "Confirmed"}:
                cid = f"dependency:{item.get('id')}:{dependency_id}"
                if cid not in seen:
                    seen.add(cid)
                    conflicts.append({"id": cid, "severity": "high", "kind": "dependency",
                        "title": "Dependensi belum siap", "entry_ids": [item.get("id"), dependency_id],
                        "resource_name": item.get("resource_name"),
                        "reason": f"{item.get('title')} menunggu komponen {dependency_id} yang belum terkonfirmasi.",
                        "action": "Konfirmasi pemilik dependensi sebelum aktivitas dimulai."})

    for (resource_type, resource_id), items in by_resource.items():
        ordered = sorted(items, key=lambda x: _dt(x.get("start_at")) or datetime.max.replace(tzinfo=timezone.utc))
        for index, left in enumerate(ordered):
            left_start, left_end = _dt(left.get("start_at")), _dt(left.get("end_at"), end=True)
            if not left_start or not left_end or left_end < now - timedelta(days=1):
                continue
            for right in ordered[index + 1:]:
                right_start, right_end = _dt(right.get("start_at")), _dt(right.get("end_at"), end=True)
                if not right_start or not right_end or right_start >= left_end:
                    break
                if left.get("event_id") == right.get("event_id") and left.get("entry_type") != "custom":
                    continue
                pair = sorted([str(left.get("id")), str(right.get("id"))])
                cid = f"overlap:{resource_type}:{resource_id}:{':'.join(pair)}"
                if cid in seen:
                    continue
                seen.add(cid)
                label = {"talent": "talent/hold", "venue": "booking venue", "vendor": "kru atau inventaris vendor",
                         "worker": "shift freelancer", "freelancer": "shift freelancer"}.get(resource_type, "resource")
                conflicts.append({"id": cid, "severity": "high", "kind": "overlap",
                    "title": f"Benturan {label}", "entry_ids": pair,
                    "resource_name": left.get("resource_name") or right.get("resource_name"),
                    "reason": f"{left.get('title')} bertumpang tindih dengan {right.get('title')}.",
                    "action": "Pindahkan waktu, ubah hold, atau tetapkan resource pengganti."})

            # A talent needs a travel buffer between different cities even without overlap.
            if resource_type == "talent" and index + 1 < len(ordered):
                right = ordered[index + 1]
                right_start = _dt(right.get("start_at"))
                if left_end and right_start and left.get("city") and right.get("city") \
                        and left.get("city") != right.get("city") and timedelta(0) <= right_start - left_end < timedelta(hours=12):
                    cid = f"travel:{resource_id}:{left.get('id')}:{right.get('id')}"
                    if cid not in seen:
                        seen.add(cid)
                        conflicts.append({"id": cid, "severity": "medium", "kind": "travel_buffer",
                            "title": "Waktu perjalanan talent terlalu sempit",
                            "entry_ids": [left.get("id"), right.get("id")],
                            "resource_name": left.get("resource_name"),
                            "reason": f"Perpindahan {left.get('city')} ke {right.get('city')} tersedia kurang dari 12 jam.",
                            "action": "Tambahkan Travel Day atau ubah slot performance."})
    return conflicts


async def _public_context(events: list[dict]) -> dict[str, dict[str, list[dict]]]:
    ids = [event["id"] for event in events]
    names = ["ticket_tiers", "event_talents", "event_venues", "sponsor_packages", "booth_slots", "event_jobs"]
    context: dict[str, dict[str, list[dict]]] = {}
    for name in names:
        rows = await db[name].find({"event_id": {"$in": ids}}, {"_id": 0}).to_list(5000)
        grouped: dict[str, list[dict]] = defaultdict(list)
        for row in rows:
            grouped[row["event_id"]].append(row)
        context[name] = grouped
    return context


def _public_entries_for_event(event: dict, context: dict, today: date) -> list[dict]:
    event_id = event["id"]
    tiers = context["ticket_tiers"].get(event_id, [])
    talents = context["event_talents"].get(event_id, [])
    venues = context["event_venues"].get(event_id, [])
    packages = context["sponsor_packages"].get(event_id, [])
    booths = context["booth_slots"].get(event_id, [])
    jobs = context["event_jobs"].get(event_id, [])
    start = date.fromisoformat(event["start_date"][:10])
    end = date.fromisoformat((event.get("end_date") or event["start_date"])[:10])
    clock = event.get("start_time") or "18:00"
    lifecycle = _event_lifecycle(event, today)
    prices = [int(tier.get("price") or 0) for tier in tiers]
    sold = sum(int(tier.get("sold") or 0) for tier in tiers)
    quantity = sum(int(tier.get("quantity") or 0) for tier in tiers)
    location = (venues[0].get("venue_name") if venues else None) or event.get("venue_name")
    lat, lng = CITY_COORDS.get(event.get("city"), (None, None))
    common = {
        "category": event.get("event_type"), "artists": [row.get("talent_name") for row in talents],
        "venue": location, "organizer": event.get("organizer_name"), "capacity": event.get("capacity", 0),
        "age_limit": event.get("age_limit") or "All ages", "min_price": min(prices) if prices else 0,
        "max_price": max(prices) if prices else 0, "free": bool(prices) and min(prices) == 0,
        "tickets_sold": sold, "ticket_capacity": quantity, "lat": lat, "lng": lng,
        "hero_image": event.get("hero_image"), "public_url": f"/events/{event_id}",
    }
    rows = [_entry(event, "event", event["name"], "event", lifecycle,
                   _at(start, clock), _at(end + timedelta(days=1), "00:00"), **common)]
    if lifecycle == "cancelled":
        return rows
    if tiers:
        sale_start = min((tier.get("sale_start") or event["start_date"])[:10] for tier in tiers)
        sale_end = max((tier.get("sale_end") or event["start_date"])[:10] for tier in tiers)
        rows.append(_entry(event, "ticket-sale", f"Penjualan tiket · {event['name']}", "ticketing",
                           "tickets_on_sale", _at(sale_start), _at(sale_end, "23:59"), **common))
    if any(pkg.get("status") == "Open" and int(pkg.get("sold") or 0) < int(pkg.get("quantity") or 0) for pkg in packages):
        rows.append(_entry(event, "sponsor-open", f"Sponsor dibuka · {event['name']}", "sponsor",
                           "sponsor_open", _at(_shift(start, -120)), _at(_shift(start, -30), "23:59"), **common))
    if any(booth.get("status") == "available" for booth in booths):
        rows.append(_entry(event, "tenant-open", f"Pendaftaran tenant · {event['name']}", "tenant",
                           "tenant_open", _at(_shift(start, -90)), _at(_shift(start, -7), "23:59"), **common))
    if any(int(job.get("filled") or 0) < int(job.get("needed") or 0) for job in jobs):
        rows.append(_entry(event, "workforce-open", f"Rekrutmen workforce · {event['name']}", "workforce",
                           "workforce_open", _at(_shift(start, -60)), _at(_shift(start, -7), "23:59"), **common))
    return rows


@calendar.get("/public")
async def public_calendar(
    date_from: str = "", date_to: str = "", city: str = "", country: str = "",
    category: str = "", artist: str = "", venue: str = "", organizer: str = "",
    min_price: Optional[int] = Query(None, ge=0), max_price: Optional[int] = Query(None, ge=0),
    min_capacity: Optional[int] = Query(None, ge=0), max_capacity: Optional[int] = Query(None, ge=0),
    age: str = "", sale_status: str = "", pricing: str = "", format: str = "", status: str = "",
    lat: Optional[float] = None, lng: Optional[float] = None,
    radius_km: Optional[float] = Query(None, gt=0, le=2000), q: str = "",
    limit: int = Query(600, ge=1, le=1500),
):
    events = await db.events.find({"status": {"$in": ["published", "live"]}, "deleted": {"$ne": True}},
                                  {"_id": 0}).to_list(500)
    context = await _public_context(events)
    today = datetime.now(timezone(timedelta(hours=7))).date()
    requested_status = {part.strip() for part in status.split(",") if part.strip()}
    items: list[dict] = []
    for event in events:
        eid = event["id"]
        tiers = context["ticket_tiers"].get(eid, [])
        talents = context["event_talents"].get(eid, [])
        venue_links = context["event_venues"].get(eid, [])
        prices = [int(t.get("price") or 0) for t in tiers]
        event_min, event_max = (min(prices), max(prices)) if prices else (0, 0)
        event_venue = (venue_links[0].get("venue_name") if venue_links else None) or event.get("venue_name")
        event_artists = ", ".join(row.get("talent_name", "") for row in talents)
        lat2, lng2 = CITY_COORDS.get(event.get("city"), (None, None))
        active_tiers = [t for t in tiers if t.get("active", True)]
        sold_out = bool(active_tiers) and all(int(t.get("sold") or 0) >= int(t.get("quantity") or 0) for t in active_tiers)
        sale_state = "sold_out" if sold_out else "on_sale" if active_tiers else "closed"
        if not (_contains(event.get("city"), city) and _contains(event.get("country", "Indonesia"), country)
                and _contains(event.get("event_type"), category) and _contains(event_artists, artist)
                and _contains(event_venue, venue) and _contains(event.get("organizer_name"), organizer)
                and _contains(event.get("age_limit"), age) and _contains(event.get("format", "Offline"), format)):
            continue
        if q and not any(_contains(value, q) for value in (event.get("name"), event.get("city"), event.get("event_type"),
                                                           event_artists, event_venue, event.get("organizer_name"))):
            continue
        if min_price is not None and event_max < min_price:
            continue
        if max_price is not None and event_min > max_price:
            continue
        if min_capacity is not None and int(event.get("capacity") or 0) < min_capacity:
            continue
        if max_capacity is not None and int(event.get("capacity") or 0) > max_capacity:
            continue
        if pricing == "free" and event_min != 0:
            continue
        if pricing == "paid" and event_max <= 0:
            continue
        if sale_status and sale_status != sale_state:
            continue
        if None not in (lat, lng, radius_km) and lat2 is not None and _haversine(lat, lng, lat2, lng2) > radius_km:
            continue
        generated = _public_entries_for_event(event, context, today)
        for item in generated:
            if requested_status and item["status"] not in requested_status:
                continue
            if _overlaps(item, date_from, date_to):
                item["sale_status"] = sale_state
                if lat is not None and lng is not None and lat2 is not None:
                    item["distance_km"] = round(_haversine(lat, lng, lat2, lng2), 1)
                items.append(item)

    items.sort(key=lambda item: (item["start_at"], item["event_name"], item["entry_type"]))
    facets = {
        "cities": sorted({event.get("city") for event in events if event.get("city")}),
        "countries": sorted({event.get("country", "Indonesia") for event in events}),
        "categories": sorted({event.get("event_type") for event in events if event.get("event_type")}),
        "artists": sorted({row.get("talent_name") for rows in context["event_talents"].values() for row in rows if row.get("talent_name")}),
        "venues": sorted({event.get("venue_name") for event in events if event.get("venue_name")}),
        "organizers": sorted({event.get("organizer_name") for event in events if event.get("organizer_name")}),
        "formats": sorted({event.get("format", "Offline") for event in events}),
        "statuses": [{"value": key, "label": label} for key, label in PUBLIC_STATUS_LABELS.items()],
    }
    return {"items": items[:limit], "total": len(items), "facets": facets,
            "source": "OKKAX Event Graph", "generated_at": now_iso()}


def _phase_state(start_at: str, end_at: str) -> str:
    now, start, end = datetime.now(timezone.utc), _dt(start_at), _dt(end_at, end=True)
    if end and end < now:
        return "Completed"
    if start and start <= now <= (end or start):
        return "Confirmed"
    return "Pending"


def _internal_entry(event: dict, suffix: str, title: str, entry_type: str,
                    start_at: str, end_at: str, status: str = "", **extra: Any) -> dict:
    return _entry(event, f"internal-{suffix}", title, entry_type, status or _phase_state(start_at, end_at),
                  start_at, end_at, visibility="private", **extra)


async def _scope_events(user: dict) -> tuple[list[dict], str]:
    roles = set(user.get("roles") or [])
    event_ids: set[str] = set()
    primary = "audience"
    if is_admin(user) or roles & {"organizer", "event_organizer", "promoter", "supervisor", "finance_approver"}:
        primary = "organizer"
        query: dict = {"deleted": {"$ne": True}}
        if not is_admin(user):
            query["$or"] = [{"owner_user_id": user["id"]}]
            if user.get("org_id"):
                query["$or"].append({"organizer_org_id": user["org_id"]})
        return await db.events.find(query, {"_id": 0}).to_list(500), primary
    if roles & {"talent", "talent_management"}:
        primary = "talent"
        linked = user.get("linked_talent_ids") or []
        rows = await db.event_talents.find({"talent_id": {"$in": linked}}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in rows)
    elif "venue_manager" in roles:
        primary = "venue"
        rows = await db.event_venues.find({"venue_id": user.get("linked_venue_id")}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in rows)
    elif "vendor" in roles:
        primary = "vendor"
        rows = await db.event_vendors.find({"vendor_id": user.get("linked_vendor_id")}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in rows)
    elif "worker" in roles:
        primary = "freelancer"
        rows = await db.event_workers.find({"worker_id": user.get("linked_worker_id")}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in rows)
    elif "sponsor" in roles:
        primary = "partner"
        rows = await db.sponsor_commitments.find({"sponsor_org_id": user.get("org_id")}, {"_id": 0}).to_list(500)
        interests = await db.sponsor_interests.find({"sponsor_user_id": user["id"]}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in rows + interests)
    elif "tenant" in roles:
        primary = "partner"
        rows = await db.tenant_applications.find({"tenant_user_id": user["id"]}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in rows)
    else:
        orders = await db.ticket_orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
        event_ids.update(row["event_id"] for row in orders)
    events = await db.events.find({"id": {"$in": list(event_ids)}, "deleted": {"$ne": True}}, {"_id": 0}).to_list(500)
    return events, primary


async def _role_entries(user: dict, events: list[dict], primary: str) -> list[dict]:
    if not events:
        return []
    context = await _public_context(events)
    event_map = {event["id"]: event for event in events}
    result: list[dict] = []
    roles = set(user.get("roles") or [])

    if primary == "organizer":
        phases = [
            ("prep", "Masa persiapan", "preparation", -120, -1, "09:00", "18:00"),
            ("venue-deadline", "Tenggat venue", "venue_deadline", -90, -90, "09:00", "10:00"),
            ("talent-hold", "Talent hold", "talent_hold", -75, -75, "10:00", "11:00"),
            ("contract", "Kontrak", "contract", -65, -65, "09:00", "11:00"),
            ("deposit", "DP & pelunasan", "payment", -60, -7, "09:00", "17:00"),
            ("permit", "Perizinan", "permit", -45, -20, "09:00", "17:00"),
            ("sponsor", "Periode sponsor", "sponsor", -120, -30, "09:00", "17:00"),
            ("tenant", "Pendaftaran tenant", "tenant", -90, -7, "09:00", "17:00"),
            ("workforce", "Rekrutmen pekerja", "workforce", -60, -7, "09:00", "17:00"),
            ("materials", "Produksi materi", "production", -45, -7, "09:00", "18:00"),
            ("travel", "Perjalanan talent", "travel", -1, -1, "08:00", "20:00"),
            ("loading", "Loading", "loading", -2, -1, "08:00", "22:00"),
            ("soundcheck", "Soundcheck", "soundcheck", 0, 0, "12:00", "14:00"),
            ("rehearsal", "Rehearsal", "rehearsal", 0, 0, "14:00", "16:00"),
            ("showtime", "Showtime", "showtime", 0, 0, "18:00", "23:00"),
            ("dismantling", "Dismantling", "dismantling", 1, 1, "00:30", "10:00"),
            ("settlement", "Settlement", "settlement", 7, 7, "09:00", "12:00"),
            ("report", "Laporan pasca-event", "post_event_report", 14, 14, "09:00", "12:00"),
        ]
        for event in events:
            start = date.fromisoformat(event["start_date"][:10])
            venue_link = (context["event_venues"].get(event["id"]) or [{}])[0]
            for suffix, label, kind, start_delta, end_delta, start_clock, end_clock in phases:
                start_at, end_at = _at(_shift(start, start_delta), start_clock), _at(_shift(start, end_delta), end_clock)
                resource_type, resource_id, resource_name = "event", event["id"], event["name"]
                if kind in {"venue_deadline", "loading", "soundcheck", "rehearsal", "showtime", "dismantling"}:
                    resource_type = "venue"
                    resource_id = venue_link.get("venue_id") or event.get("venue_name")
                    resource_name = venue_link.get("venue_name") or event.get("venue_name")
                result.append(_internal_entry(event, suffix, f"{label} · {event['name']}", kind,
                    start_at, end_at, resource_type=resource_type, resource_id=resource_id,
                    resource_name=resource_name, owner=event.get("organizer_name")))
            tiers = context["ticket_tiers"].get(event["id"], [])
            if tiers:
                result.append(_internal_entry(event, "ticket-sales", f"Penjualan tiket · {event['name']}", "ticketing",
                    _at(min(t["sale_start"] for t in tiers)), _at(max(t["sale_end"] for t in tiers), "23:59"),
                    resource_type="event", resource_id=event["id"], resource_name=event["name"],
                    owner="Ticketing Lead"))
        # Existing run-of-show items remain authoritative and are adapted into
        # the shared calendar instead of being migrated or duplicated.
        schedule_rows = await db.schedule_items.find({"event_id": {"$in": list(event_map)}}, {"_id": 0}).to_list(3000)
        for row in schedule_rows:
            event = event_map.get(row.get("event_id"))
            if not event:
                continue
            begin = _dt(_at(row.get("day") or event["start_date"], row.get("time") or "09:00"))
            finish = begin + timedelta(hours=1) if begin else None
            status_map = {"Not Started": "Pending", "In Progress": "Confirmed", "Done": "Completed"}
            result.append(_internal_entry(event, f"run-{row['id']}", row.get("activity") or "Run of show",
                "run_of_show", begin.isoformat() if begin else _at(event["start_date"]),
                finish.isoformat() if finish else _at(event["start_date"], "10:00"),
                status=status_map.get(row.get("status"), row.get("status") or "Pending"),
                resource_type="event", resource_id=event["id"], resource_name=event["name"],
                owner=row.get("owner"), location=row.get("location"), notes=row.get("notes"),
                dependency=row.get("dependency"), source_type="schedule_items"))

    if primary == "talent":
        linked = set(user.get("linked_talent_ids") or [])
        bookings = [row for rows in context["event_talents"].values() for row in rows if row.get("talent_id") in linked]
        for booking in bookings:
            event = event_map[booking["event_id"]]
            start = date.fromisoformat(event["start_date"][:10])
            base = {"resource_type": "talent", "resource_id": booking["talent_id"],
                    "resource_name": booking.get("talent_name"), "owner": user.get("name")}
            result.extend([
                _internal_entry(event, f"{booking['id']}-confirmed", f"Confirmed · {event['name']}", "booking",
                    _at(_shift(start, -75)), _at(_shift(start, -1), "23:59"), status=booking.get("status", "Confirmed"), **base),
                _internal_entry(event, f"{booking['id']}-travel", f"Travel Day · {event['name']}", "travel",
                    _at(_shift(start, -1), "08:00"), _at(_shift(start, -1), "20:00"), status="Travel Day", **base),
                _internal_entry(event, f"{booking['id']}-rehearsal", f"Rehearsal · {event['name']}", "rehearsal",
                    _at(start, "14:00"), _at(start, "16:00"), status="Rehearsal", **base),
                _internal_entry(event, f"{booking['id']}-performance", f"Performance · {event['name']}", "performance",
                    _at(start, "20:00"), _at(start, "22:00"), status="Performance", **base),
                _internal_entry(event, f"{booking['id']}-rest", f"Rest Day · {event['name']}", "rest",
                    _at(_shift(start, 1)), _at(_shift(start, 1), "23:59"), status="Rest Day", **base),
            ])

    if primary == "venue":
        venue_id = user.get("linked_venue_id")
        links = [row for rows in context["event_venues"].values() for row in rows if row.get("venue_id") == venue_id]
        for link in links:
            event, start = event_map[link["event_id"]], date.fromisoformat(event_map[link["event_id"]]["start_date"][:10])
            base = {"resource_type": "venue", "resource_id": venue_id, "resource_name": link.get("venue_name"), "owner": user.get("name")}
            for suffix, label, kind, delta, begin, finish, state in [
                ("site", "Site Visit", "site_visit", -90, "10:00", "12:00", "Site Visit"),
                ("hold", "Tentative Hold", "tentative_hold", -89, "09:00", "17:00", "Tentative Hold"),
                ("booking", "Confirmed Booking", "booking", -60, "09:00", "17:00", "Confirmed Booking"),
                ("loading", "Loading", "loading", -2, "08:00", "22:00", "Loading"),
                ("setup", "Setup", "setup", -1, "08:00", "22:00", "Setup"),
                ("rehearsal", "Rehearsal", "rehearsal", 0, "14:00", "16:00", "Rehearsal"),
                ("event", "Event", "event", 0, "16:00", "23:00", "Event"),
                ("dismantling", "Dismantling", "dismantling", 1, "00:30", "10:00", "Dismantling")]:
                result.append(_internal_entry(event, f"{link['id']}-{suffix}", f"{label} · {event['name']}", kind,
                    _at(_shift(start, delta), begin), _at(_shift(start, delta), finish), status=state, **base))

    if primary == "vendor":
        vendor_id = user.get("linked_vendor_id")
        assignments = await db.event_vendors.find({"vendor_id": vendor_id, "event_id": {"$in": list(event_map)}}, {"_id": 0}).to_list(500)
        for assignment in assignments:
            event, start = event_map[assignment["event_id"]], date.fromisoformat(event_map[assignment["event_id"]]["start_date"][:10])
            base = {"resource_type": "vendor", "resource_id": vendor_id, "resource_name": assignment.get("vendor_name"),
                    "owner": user.get("name"), "inventory_group": assignment.get("category")}
            for suffix, label, kind, delta, begin, finish in [
                ("crew", "Jadwal kru", "crew", -3, "09:00", "17:00"), ("mobilization", "Mobilisasi", "mobilization", -2, "06:00", "14:00"),
                ("installation", "Instalasi", "installation", -2, "14:00", "22:00"), ("testing", "Testing", "testing", -1, "10:00", "18:00"),
                ("show", "Show", "show", 0, "16:00", "23:00"), ("dismantling", "Pembongkaran", "dismantling", 1, "00:30", "08:00"),
                ("return", "Pengembalian inventaris", "inventory_return", 1, "09:00", "15:00")]:
                result.append(_internal_entry(event, f"{assignment['id']}-{suffix}", f"{label} · {event['name']}", kind,
                    _at(_shift(start, delta), begin), _at(_shift(start, delta), finish), **base))

    if primary == "freelancer":
        worker_id = user.get("linked_worker_id")
        assignments = await db.event_workers.find({"worker_id": worker_id, "event_id": {"$in": list(event_map)}}, {"_id": 0}).to_list(500)
        for assignment in assignments:
            event, start = event_map[assignment["event_id"]], date.fromisoformat(event_map[assignment["event_id"]]["start_date"][:10])
            base = {"resource_type": "worker", "resource_id": worker_id, "resource_name": assignment.get("worker_name"), "owner": user.get("name")}
            result.extend([
                _internal_entry(event, f"{assignment['id']}-invite", f"Undangan kerja · {event['name']}", "work_invitation",
                    _at(_shift(start, -21)), _at(_shift(start, -14), "23:59"), status=assignment.get("status", "Pending"), **base),
                _internal_entry(event, f"{assignment['id']}-shift", f"Shift {assignment.get('role')} · {event['name']}", "shift",
                    _at(start, "13:00"), _at(start, "23:30"), status="Confirmed", **base),
                _internal_entry(event, f"{assignment['id']}-checkin", f"Check-in · {event['name']}", "check_in",
                    _at(start, "12:30"), _at(start, "13:00"), status="Pending", **base),
                _internal_entry(event, f"{assignment['id']}-checkout", f"Check-out · {event['name']}", "check_out",
                    _at(start, "23:30"), _at(_shift(start, 1), "00:00"), status="Pending", **base),
            ])

    if primary == "partner":
        if "sponsor" in roles:
            records = await db.sponsor_commitments.find({"sponsor_org_id": user.get("org_id"), "event_id": {"$in": list(event_map)}}, {"_id": 0}).to_list(500)
            partner_type = "sponsor"
        else:
            records = await db.tenant_applications.find({"tenant_user_id": user["id"], "event_id": {"$in": list(event_map)}}, {"_id": 0}).to_list(500)
            partner_type = "tenant"
        for record in records:
            event, start = event_map[record["event_id"]], date.fromisoformat(event_map[record["event_id"]]["start_date"][:10])
            name = record.get("sponsor_name") or record.get("business_name") or user.get("name")
            base = {"resource_type": partner_type, "resource_id": user.get("org_id") or user["id"], "resource_name": name, "owner": name}
            for suffix, label, kind, delta in [("proposal", "Batas pengajuan", "proposal_deadline", -60),
                                                ("negotiation", "Negosiasi", "negotiation", -50),
                                                ("payment", "Pembayaran", "payment", -30),
                                                ("material", "Produksi materi", "material_production", -14),
                                                ("installation", "Instalasi booth", "booth_installation", -1),
                                                ("activation", "Aktivasi", "activation", 0),
                                                ("report", "Pengumpulan laporan", "report", 7),
                                                ("return", "Pengembalian fasilitas", "facility_return", 1)]:
                result.append(_internal_entry(event, f"{record['id']}-{suffix}", f"{label} · {event['name']}", kind,
                    _at(_shift(start, delta), "09:00"), _at(_shift(start, delta), "17:00"), **base))
    return result


async def _custom_entries_for(user: dict, event_ids: list[str]) -> list[dict]:
    clauses: list[dict] = [{"created_by": user["id"]}, {"owner_user_id": user["id"]}]
    if event_ids:
        clauses.append({"event_id": {"$in": event_ids}})
    if user.get("linked_talent_ids"):
        clauses.append({"resource_type": "talent", "resource_id": {"$in": user["linked_talent_ids"]}})
    for user_key, resource in (("linked_venue_id", "venue"), ("linked_vendor_id", "vendor"), ("linked_worker_id", "worker")):
        if user.get(user_key):
            clauses.append({"resource_type": resource, "resource_id": user[user_key]})
    return await db.calendar_entries.find({"$or": clauses}, {"_id": 0}).to_list(2000)


@calendar.get("/me")
async def my_calendar(date_from: str = "", date_to: str = "", event_id: str = "",
                      resource_type: str = "", status: str = "",
                      user: dict = Depends(get_current_user)):
    events, primary = await _scope_events(user)
    if event_id:
        events = [event for event in events if event["id"] == event_id]
    items = await _role_entries(user, events, primary)
    items.extend(await _custom_entries_for(user, [event["id"] for event in events]))
    items = [item for item in items if _overlaps(item, date_from, date_to)
             and (not resource_type or item.get("resource_type") == resource_type)
             and (not status or item.get("status") == status)]
    items.sort(key=lambda item: (item.get("start_at", ""), item.get("title", "")))
    conflicts = detect_conflicts(items)
    counts = defaultdict(int)
    for conflict in conflicts:
        counts[conflict["severity"]] += 1
    return {"items": items, "total": len(items), "conflicts": conflicts,
            "conflict_summary": dict(counts), "calendar_type": primary,
            "available_types": ROLE_CALENDARS.get(primary, []), "generated_at": now_iso()}


async def _can_manage(user: dict, body: dict) -> bool:
    if is_admin(user):
        return True
    roles = set(user.get("roles") or [])
    if not roles & EDIT_ROLES:
        return False
    event_id = body.get("event_id")
    if not event_id and roles & {"organizer", "event_organizer", "promoter", "supervisor", "finance_approver"}:
        return True
    if event_id and roles & {"organizer", "event_organizer", "promoter", "supervisor", "finance_approver"}:
        try:
            await assert_event_access(await get_event_or_404(event_id), user, write=True)
            return True
        except HTTPException:
            return False
    resource_type, resource_id = body.get("resource_type"), body.get("resource_id")
    if roles & {"talent", "talent_management"} and resource_type == "talent":
        return resource_id in (user.get("linked_talent_ids") or [])
    if "venue_manager" in roles and resource_type == "venue":
        return resource_id == user.get("linked_venue_id")
    if "vendor" in roles and resource_type == "vendor":
        return resource_id == user.get("linked_vendor_id")
    if "worker" in roles and resource_type in {"worker", "freelancer"}:
        return resource_id == user.get("linked_worker_id")
    if "sponsor" in roles and resource_type == "sponsor":
        return resource_id in {user.get("org_id"), user.get("id")}
    if "tenant" in roles and resource_type == "tenant":
        return resource_id in {user.get("org_id"), user.get("id")}
    return False


def _normalise_custom(body: Dict[str, Any], user: dict, current: Optional[dict] = None) -> dict:
    merged = {**(current or {}), **body}
    required = ["title", "start_at", "end_at", "resource_type", "resource_id"]
    missing = [key for key in required if not merged.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Field wajib: {', '.join(missing)}")
    start, end = _dt(merged["start_at"]), _dt(merged["end_at"], end=True)
    if not start or not end or end <= start:
        raise HTTPException(status_code=400, detail="Waktu selesai harus setelah waktu mulai")
    allowed = {"event_id", "title", "entry_type", "resource_type", "resource_id", "resource_name",
               "start_at", "end_at", "timezone", "status", "visibility", "city", "country", "location",
               "owner", "notes", "dependency_ids", "inventory_group"}
    return {key: value for key, value in merged.items() if key in allowed} | {
        "entry_type": merged.get("entry_type", "custom"), "status": merged.get("status", "Pending"),
        "visibility": merged.get("visibility", "private"), "timezone": merged.get("timezone", "Asia/Jakarta"),
        "source_type": "calendar_entry", "created_by": (current or {}).get("created_by", user["id"]),
        "owner_user_id": (current or {}).get("owner_user_id", user["id"]),
    }


@calendar.post("/entries")
async def create_entry(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    if not await _can_manage(user, body):
        raise HTTPException(status_code=403, detail="Anda tidak dapat mengelola resource kalender ini")
    doc = {"id": nid(), **_normalise_custom(body, user), "created_at": now_iso(), "updated_at": now_iso()}
    related = await db.calendar_entries.find({"resource_type": doc["resource_type"],
                                              "resource_id": doc["resource_id"]}, {"_id": 0}).to_list(1000)
    conflicts = detect_conflicts([*related, doc])
    await db.calendar_entries.insert_one(doc)
    await audit(doc.get("event_id"), user, "calendar.entry.create", {"id": doc["id"], "conflicts": len(conflicts)})
    return {"item": clean(doc), "conflicts": [c for c in conflicts if doc["id"] in c.get("entry_ids", [])]}


@calendar.patch("/entries/{entry_id}")
async def update_entry(entry_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    current = await db.calendar_entries.find_one({"id": entry_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Entri kalender tidak ditemukan")
    if current.get("created_by") != user["id"] and not await _can_manage(user, current):
        raise HTTPException(status_code=403, detail="Anda tidak dapat mengubah entri ini")
    updated = _normalise_custom(body, user, current)
    updated["updated_at"] = now_iso()
    await db.calendar_entries.update_one({"id": entry_id}, {"$set": updated})
    merged = {**current, **updated}
    related = await db.calendar_entries.find({"resource_type": merged["resource_type"],
                                              "resource_id": merged["resource_id"], "id": {"$ne": entry_id}},
                                             {"_id": 0}).to_list(1000)
    conflicts = detect_conflicts([*related, merged])
    await audit(merged.get("event_id"), user, "calendar.entry.update", {"id": entry_id, "conflicts": len(conflicts)})
    return {"item": merged, "conflicts": [c for c in conflicts if entry_id in c.get("entry_ids", [])]}


@calendar.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_current_user)):
    current = await db.calendar_entries.find_one({"id": entry_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Entri kalender tidak ditemukan")
    if current.get("created_by") != user["id"] and not await _can_manage(user, current):
        raise HTTPException(status_code=403, detail="Anda tidak dapat menghapus entri ini")
    await db.calendar_entries.delete_one({"id": entry_id})
    await audit(current.get("event_id"), user, "calendar.entry.delete", {"id": entry_id})
    return {"ok": True, "id": entry_id}


@calendar.get("/availability")
async def resource_availability(resource_type: str, resource_id: str, date_from: str, date_to: str,
                                user: dict = Depends(get_current_user)):
    probe = {"resource_type": resource_type, "resource_id": resource_id}
    if not await _can_manage(user, probe):
        raise HTTPException(status_code=403, detail="Resource ini tidak terhubung ke akun Anda")
    events, primary = await _scope_events(user)
    items = await _role_entries(user, events, primary)
    items.extend(await _custom_entries_for(user, [event["id"] for event in events]))
    busy = [item for item in items if item.get("resource_type") == resource_type
            and item.get("resource_id") == resource_id and _overlaps(item, date_from, date_to)]
    return {"resource_type": resource_type, "resource_id": resource_id, "busy": busy,
            "conflicts": detect_conflicts(busy), "available": not busy}
