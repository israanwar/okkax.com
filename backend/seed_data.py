"""OKKAX demo seed. Semua data fiktif untuk keperluan demonstrasi kompetisi."""
import hashlib
import os
from core import db, hash_password

DISCLAIMER = ("Seluruh nama, organisasi, talent, harga, rider, transaksi, tiket, dan metrik pada mode demo "
              "merupakan data fiktif untuk keperluan demonstrasi kompetisi.")
SEED_TIMESTAMP = "2026-08-13T00:00:00+00:00"


def seed_id(*parts: object) -> str:
    """Return a stable ID for one seeded document."""
    raw = ":".join(str(part) for part in parts)
    return hashlib.sha256(f"okkax-demo:{raw}".encode("utf-8")).hexdigest()[:24]


def stable_int(value: str, modulo: int) -> int:
    """Avoid Python's process-randomized hash() in persisted demo data."""
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:16], 16) % modulo


async def upsert_seed(collection: str, document: dict):
    """Idempotently create or restore one deterministic demo document."""
    if not document.get("id"):
        raise ValueError(f"Seed document for {collection} requires a deterministic id")
    return await db[collection].update_one(
        {"id": document["id"]},
        {"$set": document},
        upsert=True,
    )

HERO = "/assets/discover-indonesia/aruna-bold-live-experience-2026.jpg"
HERO2 = "https://images.unsplash.com/photo-1674507738101-b4dbe86beea7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxtYXNzaXZlJTIwY29uY2VydCUyMGNyb3dkJTIwY2luZW1hdGljfGVufDB8fHx8MTc4NjUyMzE4N3ww&ixlib=rb-4.1.0&q=85"
HERO3 = "https://images.unsplash.com/photo-1783979384797-7a5d2ad23fc8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwY29ycG9yYXRlJTIwZXZlbnQlMjBzdGFnZXxlbnwwfHx8fDE3ODY1MjMxODd8MA&ixlib=rb-4.1.0&q=85"

RIDER_TEMPLATE = [
    ("Stage", "Main stage 16m x 12m x 1.6m", 1, "Roof system + barricade", True, 65000000),
    ("Audio", "Line array 24 box + subwoofer", 1, "Min 100 dB @ FOH, digital console 48ch", True, 85000000),
    ("Lighting", "Moving head wash & beam", 48, "DMX universe terpisah, follow spot 2 unit", True, 60000000),
    ("LED", "Main LED 12m x 6m P3.9", 1, "Processor + side wing 2 x 3m x 4m", True, 70000000),
    ("Multimedia", "Video switcher + 3 kamera", 1, "IMAG feed ke main LED", False, 25000000),
    ("Backline", "Drum set, bass amp, guitar amp", 1, "Sesuai spesifikasi band", True, 18000000),
    ("Power", "Genset 250 kVA + 150 kVA backup", 2, "Silent type, grounding standar", True, 42000000),
    ("Dressing Room", "Dressing room 3 ruang ber-AC", 3, "Mirror, sofa, private toilet", True, 6000000),
    ("Catering", "Meal crew & talent 3 kali", 60, "Halal, vegetarian option", True, 21000000),
    ("Hospitality", "Beverage & fruit platter", 1, "Tanpa alkohol", True, 5000000),
    ("Accommodation", "Hotel 4 bintang, twin & single", 12, "2 malam, breakfast included", True, 48000000),
    ("Flights", "Penerbangan CGK - UPG", 18, "Kelas standar, bagasi 30kg", True, 63000000),
    ("Baggage", "Extra baggage equipment", 6, "Instrumen musik", False, 9000000),
    ("Local Transport", "Hiace + van + truck", 4, "Standby 3 hari", True, 24000000),
    ("Security", "Personal security talent", 6, "Backstage & artist movement", True, 12000000),
    ("Medical", "Standby paramedic backstage", 2, "Termasuk emergency kit", True, 6000000),
    ("Soundcheck", "Soundcheck slot 120 menit", 1, "H-1 malam", True, 0),
]

TALENTS = [
    dict(id="tal-aksara", stage_name="Aksara Band", management="Nusantara Talent Works", category="Music Band",
         genre="Alternative Pop Rock", city="Jakarta", base_fee=400000000, fee_min=380000000, fee_max=520000000,
         fee_status="Verified Fee", team_size=18, duration_min=90, verified=True,
         bio="Band alternatif pop rock fiktif dengan 3 album studio dan reputasi panggung festival.",
         brand_restrictions=["Tembakau", "Minuman beralkohol keras"], age_restriction="13+",
         cancellation_policy="Pembatalan H-14: 50% fee non-refundable", delivery_score=94, portfolio=8),
    dict(id="tal-lantera", stage_name="Lantera Collective", management="Nusantara Talent Works", category="Music Group",
         genre="Electronic Soul", city="Bandung", base_fee=180000000, fee_min=160000000, fee_max=240000000,
         fee_status="Indicative Range", team_size=9, duration_min=60, verified=True,
         bio="Kolektif elektronik soul fiktif untuk slot sunset stage.", brand_restrictions=["Rokok"],
         age_restriction="All ages", cancellation_policy="Pembatalan H-21: 30% fee", delivery_score=88, portfolio=5),
    dict(id="tal-rani", stage_name="Rani Prawira", management="Independen", category="Speaker",
         genre="Brand & Consumer Strategy", city="Jakarta", base_fee=45000000, fee_min=35000000, fee_max=60000000,
         fee_status="Custom Quotation", team_size=2, duration_min=45, verified=True,
         bio="Pembicara fiktif bidang strategi brand dan perilaku konsumen.", brand_restrictions=[],
         age_restriction="All ages", cancellation_policy="Pembatalan H-7: 25% fee", delivery_score=91, portfolio=12),
    dict(id="tal-dimas", stage_name="Dimas Arka", management="Voice Republic", category="Host / MC",
         genre="Bilingual MC", city="Makassar", base_fee=25000000, fee_min=20000000, fee_max=35000000,
         fee_status="Verified Fee", team_size=1, duration_min=240, verified=True,
         bio="MC bilingual fiktif berbasis Makassar untuk panggung festival dan korporat.",
         brand_restrictions=[], age_restriction="All ages", cancellation_policy="Pembatalan H-3: 50% fee",
         delivery_score=96, portfolio=20),
    dict(id="tal-senja", stage_name="Senja Ansambel", management="Bumi Kreatif Management", category="Cultural Performance",
         genre="Traditional Fusion", city="Makassar", base_fee=60000000, fee_min=55000000, fee_max=90000000,
         fee_status="On Request", team_size=22, duration_min=30, verified=False,
         bio="Ansambel fusion tradisional fiktif dengan 22 penampil.", brand_restrictions=[],
         age_restriction="All ages", cancellation_policy="Pembatalan H-10: 40% fee", delivery_score=82, portfolio=4),
]

VENUES = [
    dict(id="ven-mch", name="Makassar Convention Hall", city="Makassar", address="Jl. Metro Tanjung Bunga No. 21",
         lat=-5.1719, lng=119.4045, indoor=True, standing_capacity=2500, seated_capacity=1800, area_sqm=3600,
         event_day_price=180000000, setup_day_price=75000000, deposit=90000000, power_kva=800,
         stage_dimension="18m x 14m", curfew="23:30", operating_hours="08:00 - 23:30",
         facilities=["AC central", "Loading dock", "Green room x4", "Parkir 600 mobil", "Genset backup"],
         accessibility=["Ramp", "Wheelchair seating", "Accessible toilet"], verified=True, delivery_score=93,
         event_types=["Konser", "Product Launch", "Conference", "Pameran"], sound_restriction="Max 105 dB",
         included_equipment=["Basic lighting", "House sound 20k watt"], required_vendors=["Security in-house"],
         prohibited=["Kembang api indoor"], image=HERO3),
    dict(id="ven-losari", name="Losari Open Ground", city="Makassar", address="Kawasan Pantai Losari",
         lat=-5.1450, lng=119.4070, indoor=False, standing_capacity=8000, seated_capacity=0, area_sqm=12000,
         event_day_price=120000000, setup_day_price=45000000, deposit=60000000, power_kva=0,
         stage_dimension="Custom build", curfew="22:00", operating_hours="06:00 - 22:00",
         facilities=["Open ground", "Akses jalan utama", "Public parking"],
         accessibility=["Ramp temporer"], verified=True, delivery_score=85,
         event_types=["Festival musik", "Festival kuliner", "Fun run"], sound_restriction="Max 100 dB, curfew 22:00",
         included_equipment=[], required_vendors=["Genset", "Toilet portable"], prohibited=["Alkohol"], image=HERO2),
    dict(id="ven-phoenix", name="Phoenix Grand Ballroom", city="Makassar", address="Jl. Boulevard Ruby No. 8",
         lat=-5.1560, lng=119.4380, indoor=True, standing_capacity=1200, seated_capacity=900, area_sqm=1400,
         event_day_price=95000000, setup_day_price=35000000, deposit=45000000, power_kva=400,
         stage_dimension="12m x 8m", curfew="00:00", operating_hours="08:00 - 00:00",
         facilities=["Ballroom pillarless", "Hotel attached", "Catering in-house"],
         accessibility=["Lift", "Ramp", "Accessible toilet"], verified=True, delivery_score=90,
         event_types=["Corporate gathering", "Product Launch", "Seminar"], sound_restriction="Max 95 dB",
         included_equipment=["House sound", "Basic stage"], required_vendors=["Catering in-house"],
         prohibited=["Outside catering"], image=HERO3),
    dict(id="ven-jkt-dome", name="Jakarta Kreatif Dome", city="Jakarta", address="Jl. Rasuna Selatan No. 3",
         lat=-6.2250, lng=106.8300, indoor=True, standing_capacity=6000, seated_capacity=4200, area_sqm=7800,
         event_day_price=340000000, setup_day_price=120000000, deposit=170000000, power_kva=1500,
         stage_dimension="24m x 16m", curfew="00:30", operating_hours="24 jam",
         facilities=["Rigging point 40 ton", "Dressing room x8", "VIP lounge"],
         accessibility=["Ramp", "Wheelchair seating", "Sign language desk"], verified=True, delivery_score=95,
         event_types=["Konser", "Esports", "Trade show"], sound_restriction="Tanpa batas khusus",
         included_equipment=["Rigging", "House power"], required_vendors=[], prohibited=[], image=HERO),
]

VENDORS = [
    ("ven-eo-1", "Kolaborasi Event Works", "Event Organizer", 180000000, 420000000, 96),
    ("ven-stage-1", "Baja Panggung Nusantara", "Stage", 45000000, 120000000, 92),
    ("ven-sound-1", "Sonic Timur Audio", "Sound", 55000000, 160000000, 94),
    ("ven-light-1", "Cahaya Sembilan Lighting", "Lighting", 35000000, 110000000, 90),
    ("ven-led-1", "Pixel Timur LED", "LED", 40000000, 130000000, 88),
    ("ven-multi-1", "Layar Sinema Multimedia", "Multimedia", 18000000, 60000000, 86),
    ("ven-dec-1", "Ruang Rupa Decoration", "Decoration", 25000000, 90000000, 84),
    ("ven-booth-1", "Bina Booth Contractor", "Booth Contractor", 60000000, 180000000, 89),
    ("ven-sec-1", "Garda Timur Security", "Security", 22000000, 85000000, 93),
    ("ven-med-1", "Sigap Medis Support", "Medical", 12000000, 40000000, 95),
    ("ven-cat-1", "Rasa Bahari Catering", "Catering", 18000000, 70000000, 87),
    ("ven-doc-1", "Frame Timur Documentation", "Videography", 15000000, 55000000, 91),
    ("ven-trans-1", "Anging Mammiri Transport", "Transportation", 12000000, 48000000, 90),
    ("ven-clean-1", "Bersih Kota Cleaning", "Cleaning", 8000000, 26000000, 85),
    ("ven-print-1", "Cetak Cepat Printing", "Printing", 6000000, 30000000, 83),
    ("ven-net-1", "Lintas Data Internet", "Internet Provider", 9000000, 35000000, 88),
]

WORKERS = [
    ("wkr-1", "Andi Saputra", "Stagehand", 350000, ["Rigging basic", "Load-in"], True),
    ("wkr-2", "Nurul Aisyah", "Usher", 275000, ["Crowd guiding", "Bahasa Inggris"], True),
    ("wkr-3", "Bimo Prasetyo", "Ticketing Crew", 300000, ["Scanner ops", "Cash handling"], True),
    ("wkr-4", "Citra Maharani", "Liaison Officer", 450000, ["Talent handling", "Bahasa Inggris"], True),
    ("wkr-5", "Rizal Hakim", "Security", 400000, ["Crowd control", "Pengalaman festival"], True),
    ("wkr-6", "Dewi Lestari", "Cleaning", 250000, ["Waste management"], False),
    ("wkr-7", "Fajar Nugroho", "Technician", 550000, ["Audio patching", "DMX"], True),
    ("wkr-8", "Halimah Zahra", "Tenant Coordinator", 400000, ["Vendor coordination"], True),
    ("wkr-9", "Yusuf Ramadhan", "Driver", 320000, ["SIM A", "Rute Makassar"], True),
    ("wkr-10", "Intan Permata", "Photographer", 600000, ["Event photography"], True),
    ("wkr-11", "Guntur Malik", "Backstage Crew", 350000, ["Backline handling"], False),
    ("wkr-12", "Sari Wulandari", "Medical Support", 500000, ["Paramedic certified"], True),
]

DEMO_USERS = [
    ("organizer@okkax.id", "Aruna Brand Team", ["organizer"], "org-aruna"),
    ("sponsor@okkax.id", "Sentra Digital Pay", ["sponsor"], "org-sentra"),
    ("tenant@okkax.id", "Kopi Rakit Makassar", ["tenant"], "org-koparakit"),
    ("audience@okkax.id", "Putri Amelia", ["audience"], None),
    ("talent@okkax.id", "Aksara Band Management", ["talent_management"], "org-nusantara"),
    ("venue@okkax.id", "Makassar Convention Hall", ["venue_manager"], "org-mch"),
    ("vendor@okkax.id", "Sonic Timur Audio", ["vendor"], "org-sonic"),
    ("worker@okkax.id", "Andi Saputra", ["worker"], None),
    ("finance@okkax.id", "Aruna Finance", ["finance_approver"], "org-aruna"),
    ("supervisor@okkax.id", "Ops Supervisor", ["supervisor"], "org-aruna"),
]

# links dari akun demo ke entitas katalog agar dashboard peran punya data nyata
DEMO_LINKS = {
    "talent@okkax.id": {"linked_talent_ids": ["tal-aksara", "tal-lantera"]},
    "venue@okkax.id": {"linked_venue_id": "ven-mch"},
    "vendor@okkax.id": {"linked_vendor_id": "ven-sound-1"},
    "worker@okkax.id": {"linked_worker_id": "wkr-1"},
}

ORGS = [
    ("org-aruna", "PT Aruna Consumer Indonesia", "Corporate Brand", "Makassar", True),
    ("org-sentra", "Sentra Digital Pay", "Sponsor / Fintech", "Jakarta", True),
    ("org-koparakit", "Kopi Rakit Makassar", "UMKM Lokal", "Makassar", True),
    ("org-nusantara", "Nusantara Talent Works", "Talent Management", "Jakarta", True),
    ("org-mch", "Makassar Convention Hall", "Venue", "Makassar", True),
    ("org-sonic", "Sonic Timur Audio", "Vendor Produksi", "Makassar", True),
]

EVENT_ID = "evt-aruna-2026"
EVENT_CODE = "EVT-MKS-2026-0001"

async def seed(force: bool = False):
    if not force and await db.events.count_documents({"id": EVENT_ID}) > 0:
        return {"seeded": False, "reason": "already seeded"}
    pwd = os.environ["DEMO_PASSWORD"]
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@okkax.id")
    admin_pwd = os.environ["ADMIN_PASSWORD"]

    for oid, name, otype, city, verified in ORGS:
        await upsert_seed("organizations", dict(
            id=oid, name=name, org_type=otype, city=city, verified=verified,
            address=f"{city}, Indonesia", contact_email=f"contact@{oid}.demo", website=f"https://{oid}.demo",
            description=f"{name} adalah organisasi fiktif untuk demonstrasi OKKAX.",
            currency="IDR", timezone="Asia/Makassar", language="id", document_status="Verified",
            created_at=SEED_TIMESTAMP))

    await upsert_seed("users", dict(
        id="usr-admin", email=admin_email, password_hash=hash_password(admin_pwd), name="OKKAX Super Admin",
        roles=["super_admin"], org_id=None, city="Jakarta", phone="+62-000-0000",
        terms_accepted=True, onboarded=True, created_at=SEED_TIMESTAMP))

    for i, (email, name, roles, org) in enumerate(DEMO_USERS):
        await upsert_seed("users", dict(
            id=f"usr-{i+1}", email=email, password_hash=hash_password(pwd), name=name, roles=roles,
            org_id=org, city="Makassar" if org in ("org-aruna", "org-koparakit", "org-mch", "org-sonic") else "Jakarta",
            phone="+62-000-0000", terms_accepted=True, onboarded=True, created_at=SEED_TIMESTAMP,
            **DEMO_LINKS.get(email, {})))

    for t in TALENTS:
        rider = [dict(category=c, item=i, quantity=q, specification=s, mandatory=m, estimated_cost=cost)
                 for (c, i, q, s, m, cost) in RIDER_TEMPLATE]
        await upsert_seed("talents", {**t, "rider_template": rider, "currency": "IDR",
                                     "availability": ["2026-08-14", "2026-08-15", "2026-08-16", "2026-09-05"],
                                     "created_at": SEED_TIMESTAMP})
    for v in VENUES:
        await upsert_seed("venues", {**v, "availability": ["2026-08-13", "2026-08-14", "2026-08-15"],
                                    "cancellation_policy": "Pembatalan H-30: deposit non-refundable",
                                    "created_at": SEED_TIMESTAMP})
    for vid, name, cat, pmin, pmax, score in VENDORS:
        await upsert_seed("vendors", dict(
            id=vid, name=name, category=cat, city="Makassar", service_cities=["Makassar", "Parepare", "Kendari"],
            price_min=pmin, price_max=pmax, delivery_score=score, verified=score >= 88,
            response_hours=4 if score >= 90 else 12, capabilities=[cat, "Event production"],
            document_status="Verified" if score >= 88 else "Pending", portfolio=score // 10,
            created_at=SEED_TIMESTAMP))
    for wid, name, cat, rate, skills, verified in WORKERS:
        await upsert_seed("workers", dict(
            id=wid, name=name, category=cat, city="Makassar", rate_per_day=rate, skills=skills,
            verified=verified, attendance_rate=95 if verified else 84, completed_events=stable_int(wid, 20) + 3,
            availability=["2026-08-13", "2026-08-14", "2026-08-15"], created_at=SEED_TIMESTAMP))

    await seed_demo_event()
    from seed_events import seed_extra_events
    await seed_extra_events()
    return {"seeded": True, "disclaimer": DISCLAIMER}


async def seed_demo_event():
    start = "2026-08-14"
    brief = dict(
        name="Aruna Bold Live Experience 2026", event_type="Product Launch & Music Festival",
        objective="Meluncurkan lini produk Aruna Bold sekaligus membangun pengalaman festival musik dua hari.",
        description="Product launch yang menyatu dengan festival musik, tenant kuliner lokal, dan aktivasi brand di Makassar.",
        organizer="PT Aruna Consumer Indonesia", brand="Aruna Bold", brand_category="Consumer Goods",
        city="Makassar", venue_preference="Indoor", start_date=start, days=2, setup_days=1, capacity=2000,
        audience_profile="Urban youth & young family, SES A-B", target_age="18-35", budget=2500000000,
        currency="IDR", talent_preference="Aksara Band", talent_category="Music Band",
        production_standard="Premium", attendance_format="Offline", ticketed=True,
        sponsor_requirement=True, tenant_requirement=True, workforce_requirement=True,
        accessibility="Ramp, wheelchair seating, accessible toilet", sustainability="Waste sorting & reusable cup",
        brand_restrictions="Tanpa brand tembakau dan alkohol keras", notes="Demo data kompetisi OKKAX.",
        event_id=EVENT_ID)

    await upsert_seed("events", dict(
        id=EVENT_ID, event_code=EVENT_CODE, name=brief["name"], event_type=brief["event_type"],
        city="Makassar", venue_name="Makassar Convention Hall", organizer_org_id="org-aruna",
        organizer_name="PT Aruna Consumer Indonesia", owner_user_id="usr-1", status="published",
        start_date=start, end_date="2026-08-15", start_time="16:00", timezone="Asia/Makassar",
        days=2, setup_days=1, capacity=2000, budget=2500000000, currency="IDR",
        description=brief["description"], objective=brief["objective"], audience_profile=brief["audience_profile"],
        age_limit="18+ (13+ dengan pendamping)", hero_image=HERO, is_demo=True,
        refund_policy="Refund penuh hingga H-14, 50% hingga H-7, tidak ada refund setelah H-3.",
        reschedule_policy="Tiket otomatis berlaku pada tanggal pengganti bila event dijadwalkan ulang.",
        accessibility="Ramp, wheelchair seating, accessible toilet, jalur prioritas",
        gate_info="Gate A (Regular), Gate B (VIP), buka 15:00 WITA",
        support_contact="support@okkax.demo", indoor=True, format="Offline",
        faq=[{"q": "Apakah tiket bisa dipindahtangankan?", "a": "Tiket Regular dapat dipindahtangankan hingga H-3 melalui dashboard OKKAX."},
             {"q": "Apakah tersedia area disabilitas?", "a": "Ya, tersedia wheelchair seating di zona depan Gate A."}],
        published_at=SEED_TIMESTAMP, created_at=SEED_TIMESTAMP))
    await upsert_seed("event_briefs", dict(
        id=seed_id("event-brief", EVENT_ID), event_id=EVENT_ID, payload=brief,
        created_at=SEED_TIMESTAMP))

    # Talent + rider
    talent = await db.talents.find_one({"id": "tal-aksara"})
    et_id = "evt-tal-1"
    rider_cost = 0
    for r in talent["rider_template"]:
        rider_cost += r["estimated_cost"]
        await upsert_seed("rider_items", dict(
            id=seed_id("rider-item", EVENT_ID, et_id, r["category"], r["item"]),
            event_id=EVENT_ID, event_talent_id=et_id, category=r["category"], item=r["item"],
            quantity=r["quantity"], specification=r["specification"], mandatory=r["mandatory"],
            responsible_party="Organizer", matched_provider=None,
            status="Matched" if r["category"] in ("Stage", "Audio", "Lighting", "LED", "Power") else "Requires Confirmation",
            estimated_cost=r["estimated_cost"], actual_cost=None, notes="", created_at=SEED_TIMESTAMP))
    fee = talent["base_fee"]
    tax = int(fee * 0.02)
    await upsert_seed("event_talents", dict(
        id=et_id, event_id=EVENT_ID, talent_id="tal-aksara", talent_name=talent["stage_name"],
        fee=fee, tax_estimate=tax, travel=63000000 + 9000000, accommodation=48000000, local_transport=24000000,
        security=12000000, rider_cost=rider_cost, hospitality=26000000,
        landed_cost=fee + tax + 72000000 + 48000000 + 24000000 + 12000000 + rider_cost + 26000000,
        status="Confirmed", performance_slot="2026-08-15 21:00", created_at=SEED_TIMESTAMP))
    await upsert_seed("event_talents", dict(
        id="evt-tal-2", event_id=EVENT_ID, talent_id="tal-dimas", talent_name="Dimas Arka",
        fee=25000000, tax_estimate=500000, travel=0, accommodation=0, local_transport=2000000,
        security=0, rider_cost=0, hospitality=1500000, landed_cost=29000000, status="Confirmed",
        performance_slot="2026-08-14 16:00", created_at=SEED_TIMESTAMP))

    # Venue
    venue = await db.venues.find_one({"id": "ven-mch"})
    venue_total = venue["event_day_price"] * 2 + venue["setup_day_price"]
    await upsert_seed("event_venues", dict(
        id="evt-ven-1", event_id=EVENT_ID, venue_id="ven-mch", venue_name=venue["name"],
        event_days=2, setup_days=1, total_cost=venue_total, deposit=venue["deposit"], status="Confirmed",
        compatibility={"score": 92, "reasons": [
            "Kapasitas standing 2.500 memenuhi target 2.000 pengunjung",
            "Power 800 kVA mendukung rider audio, lighting, dan LED",
            "Curfew 23:30 sesuai slot headliner 21:00",
            "Tersedia 4 green room untuk 18 anggota tim talent",
            "Aksesibilitas ramp dan wheelchair seating tersedia"]},
        created_at=SEED_TIMESTAMP))

    # Vendors
    vendor_plan = [("ven-eo-1", 280000000), ("ven-stage-1", 65000000), ("ven-sound-1", 85000000),
                   ("ven-light-1", 60000000), ("ven-led-1", 70000000), ("ven-dec-1", 45000000),
                   ("ven-booth-1", 120000000), ("ven-sec-1", 48000000), ("ven-med-1", 18000000),
                   ("ven-cat-1", 36000000), ("ven-doc-1", 28000000), ("ven-trans-1", 24000000)]
    for vid, cost in vendor_plan:
        v = await db.vendors.find_one({"id": vid})
        await upsert_seed("event_vendors", dict(
            id=seed_id("event-vendor", EVENT_ID, vid), event_id=EVENT_ID,
            vendor_id=vid, vendor_name=v["name"], category=v["category"],
            cost=cost, status="Confirmed" if cost > 40000000 else "Pending", created_at=SEED_TIMESTAMP))

    # Jobs & workers
    jobs = [("Usher", 24, "Show day 14:00-23:00", 275000), ("Ticketing Crew", 12, "Show day 13:00-22:00", 300000),
            ("Stagehand", 16, "Load-in & load-out", 350000), ("Liaison Officer", 6, "Show day", 450000),
            ("Security", 20, "Show day", 400000), ("Cleaning", 10, "Show day & post", 250000),
            ("Medical Support", 4, "Show day", 500000)]
    for role, need, shift, comp in jobs:
        jid = seed_id("event-job", EVENT_ID, role)
        await upsert_seed("event_jobs", dict(
            id=jid, event_id=EVENT_ID, role=role, needed=need, shift=shift, location="Makassar Convention Hall",
            compensation_per_day=comp, days=2, supervisor="Ops Supervisor", required_skills=[role],
            filled=need if role in ("Usher", "Security") else max(0, need - 4), status="In Progress",
            created_at=SEED_TIMESTAMP))
    for wid in ["wkr-1", "wkr-2", "wkr-3", "wkr-4", "wkr-5", "wkr-7", "wkr-12"]:
        w = await db.workers.find_one({"id": wid})
        await upsert_seed("event_workers", dict(
            id=seed_id("event-worker", EVENT_ID, wid), event_id=EVENT_ID,
            worker_id=wid, worker_name=w["name"], role=w["category"],
            status="Selected", check_in_at=None, payment_status="Scheduled", created_at=SEED_TIMESTAMP))

    # Sponsor packages
    packages = [
        ("Presenting Sponsor", "Presenting Sponsor", 500000000, 1, ["Naming Rights", "LED Exposure", "Stage Mention", "VIP Hospitality", "Data Capture dengan persetujuan"], "Fintech"),
        ("Main Sponsor", "Main Sponsor", 200000000, 2, ["LED Exposure", "Booth Activation", "Social Media Exposure"], "Open"),
        ("Supporting Sponsor", "Supporting Sponsor", 75000000, 5, ["Logo Placement", "Product Sampling"], "Open"),
        ("Category Partner", "Category Partner", 25000000, 5, ["Category Exclusivity", "Logo Placement"], "Open"),
    ]
    pkg_ids = {}
    for name, tier, price, qty, rights, excl in packages:
        pid = f"pkg-{tier.lower().replace(' ', '-')}"
        pkg_ids[tier] = pid
        await upsert_seed("sponsor_packages", dict(
            id=pid, event_id=EVENT_ID, name=name, tier=tier, price=price, quantity=qty, sold=0,
            rights=rights, exclusivity=excl, deadline="2026-07-15",
            deliverables=[{"item": r, "status": "Not Started"} for r in rights],
            audience_profile="Urban youth & young family, SES A-B", estimated_attendance=2000,
            status="Open", created_at=SEED_TIMESTAMP))

    # One confirmed sponsor commitment (demo)
    await upsert_seed("sponsor_interests", dict(
        id="spi-demo-1", event_id=EVENT_ID, package_id=pkg_ids["Main Sponsor"], package_name="Main Sponsor",
        sponsor_org_id="org-sentra", sponsor_user_id="usr-2", sponsor_name="Sentra Digital Pay",
        amount=200000000, message="Tertarik sebagai Main Sponsor dengan aktivasi booth pembayaran digital.",
        status="approved", created_at=SEED_TIMESTAMP))
    await upsert_seed("sponsor_commitments", dict(
        id="spc-demo-1", event_id=EVENT_ID, package_id=pkg_ids["Main Sponsor"], package_name="Main Sponsor",
        sponsor_org_id="org-sentra", sponsor_name="Sentra Digital Pay", amount=200000000,
        status="Confirmed", fulfillment_status="In Progress", created_at=SEED_TIMESTAMP))
    await db.sponsor_packages.update_one({"id": pkg_ids["Main Sponsor"]}, {"$inc": {"sold": 1}})

    # Tenant zones & booths
    zones = [("zn-fnb", "Food & Beverage Zone", "Food and Beverage", 480, 14, 7500000, 2200),
             ("zn-umkm", "Creative & UMKM Zone", "UMKM Lokal", 320, 10, 5000000, 1200),
             ("zn-brand", "Brand Activation Zone", "Sponsor Activation", 420, 6, 12000000, 3500)]
    for zid, name, cat, area, slots, price, watt in zones:
        await upsert_seed("tenant_zones", dict(
            id=zid, event_id=EVENT_ID, name=name, category=cat, area_sqm=area, slots=slots,
            utilities=["Electricity", "Water" if cat == "Food and Beverage" else "Lighting"],
            operating_hours="15:00 - 23:00", description=f"Zona {name} pada demo OKKAX.", created_at=SEED_TIMESTAMP))
        for i in range(slots):
            await upsert_seed("booth_slots", dict(
                id=f"{zid}-b{i+1}", event_id=EVENT_ID, zone_id=zid, zone_name=name,
                code=f"{zid.split('-')[1].upper()}-{i+1:02d}", size="3m x 3m", price=price,
                deposit=int(price * 0.2), electricity_watt=watt, furniture="1 meja, 2 kursi",
                position=f"Row {chr(65 + i // 5)}-{i % 5 + 1}", status="available", tenant_name=None,
                tenant_application_id=None, created_at=SEED_TIMESTAMP))
    # 8 booth pre-reserved demo
    booths = await db.booth_slots.find({"event_id": EVENT_ID}).sort("id", 1).to_list(100)
    for b in booths[:8]:
        await db.booth_slots.update_one({"id": b["id"]}, {"$set": {"status": "occupied", "tenant_name": "Tenant Demo UMKM"}})
        await upsert_seed("tenant_applications", dict(
            id=seed_id("tenant-application", EVENT_ID, b["id"]), event_id=EVENT_ID,
            booth_id=b["id"], booth_code=b["code"], zone_name=b["zone_name"],
            tenant_user_id="usr-3", tenant_org_id="org-koparakit", business_name="Tenant Demo UMKM",
            product_category=b["zone_name"], amount=b["price"], status="approved", payment_status="Simulated Paid",
            power_requirement=f"{b['electricity_watt']}W", staffing=2, checkin_status="Not Checked In",
            created_at=SEED_TIMESTAMP))

    # Ticket tiers
    tiers = [("Early Bird", "Early Bird", 250000, 400, "2026-05-01", "2026-06-30", ["Akses 2 hari", "Merch tote bag"]),
             ("Regular", "Regular", 375000, 1200, "2026-07-01", "2026-08-13", ["Akses 2 hari"]),
             ("VIP", "VIP", 950000, 200, "2026-05-01", "2026-08-13", ["Akses 2 hari", "VIP viewing deck", "Fast lane", "Welcome drink"])]
    tier_ids = []
    for name, ttype, price, qty, s, e, benefits in tiers:
        tid = f"tier-{name.lower().replace(' ', '-')}"
        tier_ids.append(tid)
        await upsert_seed("ticket_tiers", dict(
            id=tid, event_id=EVENT_ID, name=name, ticket_type=ttype, price=price, quantity=qty, sold=0,
            sale_start=s, sale_end=e, benefits=benefits, purchase_limit=4, age_rule="18+",
            transfer_rule="Dapat dipindahtangankan hingga H-3" if ttype == "Regular" else "Tidak dapat dipindahtangankan",
            refund_rule="Refund penuh hingga H-14", active=True, created_at=SEED_TIMESTAMP))

    # Budget & funding items (estimates not covered by linked components)
    extra_budget = [("Marketing", "Digital campaign & KOL", 180000000, "estimated"),
                    ("Documentation", "Aftermovie & photo", 28000000, "committed"),
                    ("Permit Estimate", "Izin keramaian & retribusi", 45000000, "estimated"),
                    ("Insurance Estimate", "Event liability insurance", 32000000, "estimated"),
                    ("Ticketing", "Ticketing ops & printing", 24000000, "estimated"),
                    ("Contingency", "Contingency 5%", 120000000, "estimated")]
    for cat, label, amt, state in extra_budget:
        await upsert_seed("budget_items", dict(
            id=seed_id("budget-item", EVENT_ID, cat, label), event_id=EVENT_ID,
            category=cat, label=label, amount=amt, state=state,
            source="manual", created_at=SEED_TIMESTAMP))
    await upsert_seed("funding_items", dict(
        id=seed_id("funding-item", EVENT_ID, "organizer-budget"), event_id=EVENT_ID,
        source="Organizer Budget", label="Aruna marketing budget",
        amount=1500000000, state="committed", created_at=SEED_TIMESTAMP))
    await upsert_seed("funding_items", dict(
        id=seed_id("funding-item", EVENT_ID, "partner-contributions"), event_id=EVENT_ID,
        source="Partner Contributions", label="Media partner barter",
        amount=80000000, state="committed", created_at=SEED_TIMESTAMP))

    # Milestones
    ms = [("Contract Signed", 30, "2026-06-01"), ("Technical Confirmation", 20, "2026-07-01"),
          ("Arrival Confirmed", 30, "2026-08-13"), ("Performance Completed", 20, "2026-08-16")]
    talent_landed = (await db.event_talents.find_one({"id": et_id}))["landed_cost"]
    for desc, pct, due in ms:
        await upsert_seed("payment_milestones", dict(
            id=seed_id("payment-milestone", EVENT_ID, et_id, desc), event_id=EVENT_ID,
            ref_type="talent", ref_id=et_id, ref_name="Aksara Band",
            description=desc, percentage=pct, amount=int(talent_landed * pct / 100), due_date=due,
            condition=f"{desc} terverifikasi supervisor", status="Simulated Paid" if pct == 30 and desc == "Contract Signed" else "Pending",
            created_at=SEED_TIMESTAMP))

    # Schedule (run of show)
    rows = [("15:00", "Gate open", "Gate A & B", "Ops Supervisor", "Security ready", "Not Started"),
            ("16:00", "Opening & MC Dimas Arka", "Main Stage", "Show Director", "Audio check done", "Not Started"),
            ("17:00", "Aruna Bold product reveal", "Main Stage", "Brand Team", "LED content loaded", "Not Started"),
            ("18:30", "Lantera Collective", "Sunset Stage", "Show Director", "Backline set", "Not Started"),
            ("21:00", "Aksara Band headline", "Main Stage", "Show Director", "Rider fulfilled", "Not Started"),
            ("22:45", "Closing & load-out brief", "Backstage", "Ops Supervisor", "Crowd dispersed", "Not Started")]
    for t, act, loc, owner, dep, st in rows:
        await upsert_seed("schedule_items", dict(
            id=seed_id("schedule-item", EVENT_ID, "2026-08-15", t, act), event_id=EVENT_ID,
            day="2026-08-15", time=t, activity=act, location=loc,
            owner=owner, dependency=dep, status=st, notes="", created_at=SEED_TIMESTAMP))

    # Risks & incident
    risks = [("Rider audio belum dikonfirmasi vendor cadangan", "High", "Kunci vendor cadangan H-30"),
             ("Curfew venue 23:30", "Medium", "Rundown headliner selesai 22:40"),
             ("Funding gap belum tertutup", "High", "Percepat sponsor & tenant closing"),
             ("Cuaca hujan pada load-in", "Medium", "Tenda load-in dan pelindung kabel")]
    for r, sev, mit in risks:
        await upsert_seed("risks", dict(id=seed_id("risk", EVENT_ID, r), event_id=EVENT_ID,
                                      risk=r, severity=sev, mitigation=mit,
                                      status="Open", created_at=SEED_TIMESTAMP))
    await upsert_seed("incidents", dict(
        id=seed_id("incident", EVENT_ID, "late-led-truck"), event_id=EVENT_ID,
        category="Production", severity="Low", time="2026-08-13 10:20",
        location="Loading dock", reporter="Ops Supervisor", description="Keterlambatan truk LED 40 menit.",
        owner="Pixel Timur LED", resolution="Truk tiba, jadwal load-in disesuaikan.", status="Resolved",
        created_at=SEED_TIMESTAMP))

    # Demo order + payment + refund example
    tier = await db.ticket_tiers.find_one({"id": "tier-regular"})
    order_id = "ord-demo-1"
    qty = 2
    gross = tier["price"] * qty
    fee = int(gross * 0.03)
    tax = int(gross * 0.11)
    total = gross + fee + tax
    await upsert_seed("ticket_orders", dict(
        id=order_id, order_code="OKX-ORD-000001", event_id=EVENT_ID, event_name=brief["name"],
        tier_id=tier["id"], tier_name=tier["name"], user_id="usr-4", buyer_name="Putri Amelia",
        buyer_email="audience@okkax.id", quantity=qty, attendees=[{"name": "Putri Amelia"}, {"name": "Rangga Wibowo"}],
        gross=gross, platform_fee=fee, tax=tax, total=total, currency="IDR", status="paid",
        payment_id="pay-demo-1", created_at=SEED_TIMESTAMP))
    await upsert_seed("payments", dict(
        id="pay-demo-1", payment_ref="OKX-PAY-000001", order_id=order_id, event_id=EVENT_ID,
        payer_user_id="usr-4", payer_name="Putri Amelia", payee="OKKAX Sandbox Settlement",
        purpose="Ticket purchase", gross=gross, discount=0, tax_estimate=tax, platform_fee=fee,
        gateway_fee=4000, net=total - fee - 4000, currency="IDR", method="virtual_account",
        method_channel="BCA Virtual Account", status="Simulated Paid", created_at=SEED_TIMESTAMP,
        due_date=SEED_TIMESTAMP, paid_at=SEED_TIMESTAMP, expired_at=None, refund_status=None,
        reference_number="8808123456789012",
        audit=[{"at": SEED_TIMESTAMP, "action": "created"}, {"at": SEED_TIMESTAMP, "action": "simulated_paid"}]))
    for i in range(qty):
        tno = f"OKX-TIX-{i+1:06d}"
        await upsert_seed("tickets", dict(
            id=seed_id("ticket", order_id, tno), ticket_number=tno,
            qr_code=f"OKKAX|{EVENT_CODE}|{tno}", order_id=order_id,
            event_id=EVENT_ID, event_name=brief["name"], tier_id=tier["id"], tier_name=tier["name"],
            attendee_name=["Putri Amelia", "Rangga Wibowo"][i], user_id="usr-4", status="valid",
            used_at=None, created_at=SEED_TIMESTAMP))
    await db.ticket_tiers.update_one({"id": tier["id"]}, {"$inc": {"sold": qty}})

    # Refund example (separate cancelled order)
    await upsert_seed("ticket_orders", dict(
        id="ord-demo-2", order_code="OKX-ORD-000002", event_id=EVENT_ID, event_name=brief["name"],
        tier_id="tier-early-bird", tier_name="Early Bird", user_id="usr-4", buyer_name="Putri Amelia",
        buyer_email="audience@okkax.id", quantity=1, attendees=[{"name": "Putri Amelia"}],
        gross=250000, platform_fee=7500, tax=27500, total=285000, currency="IDR", status="refunded",
        payment_id="pay-demo-2", created_at=SEED_TIMESTAMP))
    await upsert_seed("payments", dict(
        id="pay-demo-2", payment_ref="OKX-PAY-000002", order_id="ord-demo-2", event_id=EVENT_ID,
        payer_user_id="usr-4", payer_name="Putri Amelia", payee="OKKAX Sandbox Settlement",
        purpose="Ticket purchase", gross=250000, discount=0, tax_estimate=27500, platform_fee=7500,
        gateway_fee=2000, net=250000, currency="IDR", method="ewallet", method_channel="GoPay",
        status="Refunded", created_at=SEED_TIMESTAMP, paid_at=SEED_TIMESTAMP, refund_status="Refunded",
        reference_number="GP-9981726354", audit=[{"at": SEED_TIMESTAMP, "action": "refunded"}]))
    await upsert_seed("refunds", dict(
        id=seed_id("refund", "pay-demo-2"), payment_id="pay-demo-2",
        order_id="ord-demo-2", event_id=EVENT_ID,
        reason="Pembeli berhalangan hadir (contoh refund sandbox)", policy="Refund penuh hingga H-14",
        amount=285000, requested_by="usr-4", approved_by="usr-1", status="Processed",
        processed_date=SEED_TIMESTAMP, created_at=SEED_TIMESTAMP))

    # Blueprint from deterministic compiler
    from compiler import _fallback
    bp = _fallback(brief)
    bp["source"] = "seed_rule_based"
    await upsert_seed("event_blueprints", dict(
        id=seed_id("event-blueprint", EVENT_ID), event_id=EVENT_ID, **bp,
        created_at=SEED_TIMESTAMP))

    await upsert_seed("notifications", dict(
        id=seed_id("notification", EVENT_ID, "sponsor-confirmed"), user_id="usr-1",
        event_id=EVENT_ID, title="Sponsor commitment dikonfirmasi",
        body="Sentra Digital Pay mengonfirmasi Main Sponsor Rp200.000.000.", kind="success",
        read=False, created_at=SEED_TIMESTAMP))
    await upsert_seed("notifications", dict(
        id=seed_id("notification", EVENT_ID, "funding-gap"), user_id="usr-1",
        event_id=EVENT_ID, title="Funding gap perlu perhatian",
        body="Funding gap masih terbuka. Percepat sponsor dan tenant closing.", kind="warning",
        read=False, created_at=SEED_TIMESTAMP))
