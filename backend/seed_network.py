"""OKKAX Network catalog expansion.

Deterministic, upsert-safe expansion of talent, venue, vendor, workforce,
sponsor opportunity, and tenant zone catalogs. Every document uses a
stable ID derived from its inputs so re-running seed does not create
duplicates and does not shift existing IDs.

All data is fictitious demo material for competition mode. Provenance is
set to `demo_catalog` on every generated document so the origin is never
mistaken for a real partnership.
"""
import hashlib
from datetime import date, timedelta

from core import db

SEED_TIMESTAMP = "2026-08-13T00:00:00+00:00"
SEED_BASE_DATE = date(2026, 8, 13)
PROVENANCE = "demo_catalog"


def stable_int(value: str, modulo: int) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:16], 16) % modulo


def stable_pick(seed: str, options):
    return options[stable_int(seed, len(options))]


def stable_rating(seed: str, low: float = 4.4, high: float = 5.0) -> float:
    span = int(round((high - low) * 10)) + 1
    return round(low + stable_int(seed, span) / 10.0, 1)


# ------------------------------------------------------------------
# Provinsi + kota utama Indonesia. Cakupan sengaja luas untuk membuat
# katalog terasa nasional; tidak semua kota terisi merata karena data
# dibangkitkan secara deterministik dari kombinasi seed.
# ------------------------------------------------------------------
NATIONAL_CITIES = [
    # Jawa
    ("Jakarta", "DKI Jakarta"), ("Bekasi", "Jawa Barat"), ("Depok", "Jawa Barat"),
    ("Bogor", "Jawa Barat"), ("Tangerang", "Banten"), ("Serang", "Banten"),
    ("Bandung", "Jawa Barat"), ("Cirebon", "Jawa Barat"), ("Sukabumi", "Jawa Barat"),
    ("Semarang", "Jawa Tengah"), ("Surakarta", "Jawa Tengah"), ("Yogyakarta", "DI Yogyakarta"),
    ("Surabaya", "Jawa Timur"), ("Malang", "Jawa Timur"), ("Kediri", "Jawa Timur"),
    ("Jember", "Jawa Timur"),
    # Sumatera
    ("Medan", "Sumatera Utara"), ("Pematangsiantar", "Sumatera Utara"),
    ("Padang", "Sumatera Barat"), ("Bukittinggi", "Sumatera Barat"),
    ("Pekanbaru", "Riau"), ("Batam", "Kepulauan Riau"),
    ("Palembang", "Sumatera Selatan"), ("Bandar Lampung", "Lampung"),
    ("Jambi", "Jambi"), ("Bengkulu", "Bengkulu"), ("Banda Aceh", "Aceh"),
    ("Pangkalpinang", "Kepulauan Bangka Belitung"),
    # Bali + Nusa Tenggara
    ("Denpasar", "Bali"), ("Ubud", "Bali"), ("Mataram", "NTB"),
    ("Kupang", "NTT"), ("Labuan Bajo", "NTT"),
    # Kalimantan
    ("Pontianak", "Kalimantan Barat"), ("Banjarmasin", "Kalimantan Selatan"),
    ("Balikpapan", "Kalimantan Timur"), ("Samarinda", "Kalimantan Timur"),
    ("Palangka Raya", "Kalimantan Tengah"),
    # Sulawesi
    ("Makassar", "Sulawesi Selatan"), ("Parepare", "Sulawesi Selatan"),
    ("Manado", "Sulawesi Utara"), ("Palu", "Sulawesi Tengah"),
    ("Kendari", "Sulawesi Tenggara"), ("Gorontalo", "Gorontalo"),
    # Maluku + Papua
    ("Ambon", "Maluku"), ("Ternate", "Maluku Utara"),
    ("Sorong", "Papua Barat Daya"), ("Manokwari", "Papua Barat"),
    ("Jayapura", "Papua"),
]
CITY_NAMES = [c for c, _ in NATIONAL_CITIES]
CITY_PROVINCE = dict(NATIONAL_CITIES)


# ------------------------------------------------------------------
# TALENT expansion
# ------------------------------------------------------------------
NATIONAL_TALENT_ROOTS = [
    "Aksara", "Bara", "Cendana", "Damar", "Ekliptik", "Fanaka", "Gemilang", "Halilintar",
    "Ikat", "Jiwa", "Kirana", "Laksana", "Mustika", "Naga", "Ombak", "Palasik",
    "Rentang", "Sengkarut", "Tapak", "Umbara", "Vira", "Wanara", "Xanthe", "Yala",
    "Zenit", "Angkasa", "Bumi", "Cahaya", "Desir", "Eloka", "Fajar", "Gerhana",
]
NATIONAL_TALENT_SUFFIXES = [
    "Nusantara", "Bahari", "Ansambel", "Kolektif", "Movement", "Institute", "Sinergi",
    "Attention", "Republic", "Society", "Union",
]
NATIONAL_GENRES = [
    ("Indie Rock", "Music Band"), ("Alternative Pop", "Music Band"),
    ("Electronic Pop", "Music Band"), ("Folk Fusion", "Music Group"),
    ("Traditional Fusion", "Cultural Performance"), ("R&B Neo Soul", "Music Group"),
    ("Hip Hop", "Music Group"), ("Jazz Ensemble", "Music Group"),
    ("Reggae Ska", "Music Band"), ("Punk Rock", "Music Band"),
    ("Metal", "Music Band"), ("Dangdut Modern", "Music Group"),
    ("Pop Melayu", "Music Band"), ("Keroncong Kontemporer", "Music Group"),
    ("Gamelan Digital", "Cultural Performance"), ("Reog & Barongan", "Cultural Performance"),
    ("Tari Modern", "Cultural Performance"), ("Standup Comedy", "Comedy Act"),
    ("Sketsa Panggung", "Comedy Act"), ("Illusionist", "Specialty Act"),
    ("Motivational Speaker", "Speaker"), ("Tech Keynote", "Speaker"),
    ("Business Strategy", "Speaker"), ("Sustainability Talk", "Speaker"),
    ("Bilingual MC", "Host / MC"), ("Festival Host", "Host / MC"),
    ("Wedding MC", "Host / MC"), ("Sports Announcer", "Host / MC"),
    ("DJ Open Format", "DJ"), ("DJ House Techno", "DJ"),
    ("DJ Wedding", "DJ"), ("Beatbox", "Specialty Act"),
]


def _talent_specs():
    """Bangkitkan katalog talent nasional deterministik.

    Setiap kombinasi (root, suffix, city_offset) menghasilkan satu
    identitas panggung stabil. Fee, verifikasi, dan availability dipetakan
    dari seed sehingga sort/filter tetap konsisten.
    """
    specs = []
    ordinal = 0
    for r_i, root in enumerate(NATIONAL_TALENT_ROOTS):
        for s_i, suffix in enumerate(NATIONAL_TALENT_SUFFIXES):
            ordinal += 1
            seed_key = f"talent:{root}:{suffix}"
            genre, category = NATIONAL_GENRES[(r_i * 3 + s_i) % len(NATIONAL_GENRES)]
            city = CITY_NAMES[(r_i * 5 + s_i * 7) % len(CITY_NAMES)]
            # Fee band bergantung pada kategori dasar.
            base_fee = {
                "Music Band": 55000000, "Music Group": 45000000,
                "Cultural Performance": 32000000, "Speaker": 28000000,
                "Host / MC": 18000000, "Comedy Act": 26000000,
                "DJ": 22000000, "Specialty Act": 25000000,
            }[category] + (stable_int(seed_key + ":fee", 22) - 10) * 2500000
            base_fee = max(8000000, base_fee)
            fee_min = int(base_fee * 0.85)
            fee_max = int(base_fee * 1.35)
            verified = stable_int(seed_key + ":ver", 100) > 22
            delivery_score = 78 + stable_int(seed_key + ":ds", 22)
            rating = stable_rating(seed_key + ":rating")
            reviews = 6 + stable_int(seed_key + ":rev", 240)
            completed = 4 + stable_int(seed_key + ":cmp", 120)
            experience_years = 2 + stable_int(seed_key + ":exp", 18)
            service_cities = [city] + [
                CITY_NAMES[(r_i * 11 + s_i * 13 + k) % len(CITY_NAMES)] for k in range(3)
            ]
            avail_offset = stable_int(seed_key + ":av", 40)
            availability = [
                (SEED_BASE_DATE + timedelta(days=avail_offset + k * 14)).isoformat()
                for k in range(4)
            ]
            specs.append(dict(
                id=f"tal-net-{ordinal:04d}",
                stage_name=f"{root} {suffix}",
                management=stable_pick(seed_key + ":mgmt", [
                    "OKKAX Artist Network", "Nusantara Talent Works",
                    "Bumi Kreatif Management", "Voice Republic", "Independen",
                ]),
                category=category, genre=genre, city=city,
                province=CITY_PROVINCE.get(city, "Indonesia"),
                service_cities=sorted(set(service_cities)),
                base_fee=base_fee, fee_min=fee_min, fee_max=fee_max,
                fee_status=stable_pick(seed_key + ":fs", [
                    "Indicative Range", "Custom Quotation", "Verified Fee", "On Request",
                ]),
                team_size=3 + stable_int(seed_key + ":ts", 20),
                duration_min=45 + 15 * stable_int(seed_key + ":dm", 8),
                verified=verified, delivery_score=delivery_score,
                rating=rating, review_count=reviews, completed_events=completed,
                experience_years=experience_years, portfolio=3 + stable_int(seed_key + ":pf", 20),
                bio=f"Talent fiktif {root} {suffix} dari {city} untuk katalog demo OKKAX.",
                brand_restrictions=[], age_restriction="All ages",
                cancellation_policy="Pembatalan H-14: 40% fee",
                availability=availability,
                currency="IDR", rider_template=[],
                provenance=PROVENANCE, is_demo=True,
                created_at=SEED_TIMESTAMP,
            ))
    return specs


# ------------------------------------------------------------------
# VENUE expansion
# ------------------------------------------------------------------
VENUE_TYPE_SPECS = [
    # (venue_type, indoor, capacity_min, capacity_max, price_min, price_max)
    ("Convention Hall", True, 1200, 4500, 90000000, 320000000),
    ("Grand Ballroom", True, 800, 2200, 65000000, 220000000),
    ("Stadium", False, 15000, 45000, 480000000, 950000000),
    ("Arena", True, 4000, 12000, 220000000, 680000000),
    ("Exhibition Hall", True, 2500, 8500, 120000000, 380000000),
    ("Theater", True, 400, 1800, 55000000, 180000000),
    ("Hotel Ballroom", True, 500, 1500, 60000000, 190000000),
    ("Outdoor Ground", False, 3000, 12000, 60000000, 190000000),
    ("Beachfront Ground", False, 2500, 8000, 90000000, 260000000),
    ("Creative Space", True, 250, 900, 25000000, 95000000),
    ("Rooftop Venue", True, 400, 1200, 55000000, 160000000),
    ("Amphitheater", False, 1500, 5000, 60000000, 210000000),
    ("Warehouse Loft", True, 600, 2500, 45000000, 155000000),
    ("University Auditorium", True, 500, 1800, 30000000, 110000000),
]


def _venue_specs():
    specs = []
    ordinal = 0
    for city_index, (city, _prov) in enumerate(NATIONAL_CITIES):
        for type_index, (vtype, indoor, cap_min, cap_max, pr_min, pr_max) in enumerate(VENUE_TYPE_SPECS):
            # Sengaja tidak menaruh semua venue di semua kota; distribusi
            # dijaga tetap luas namun realistis dengan mod-based skip.
            if (city_index + type_index) % 3 == 0 and type_index >= 3:
                continue
            ordinal += 1
            seed_key = f"venue:{city}:{vtype}"
            capacity = cap_min + stable_int(seed_key + ":cap", cap_max - cap_min + 1)
            event_day_price = pr_min + stable_int(seed_key + ":price", pr_max - pr_min + 1)
            setup_day_price = int(event_day_price * 0.35)
            deposit = int(event_day_price * 0.5)
            power_kva = 0 if not indoor else (200 + 100 * stable_int(seed_key + ":kva", 18))
            rating = stable_rating(seed_key + ":rating")
            reviews = 12 + stable_int(seed_key + ":rev", 220)
            completed = 8 + stable_int(seed_key + ":cmp", 90)
            verified = stable_int(seed_key + ":ver", 100) > 15
            delivery_score = 82 + stable_int(seed_key + ":ds", 16)
            avail_offset = stable_int(seed_key + ":av", 30)
            availability = [
                (SEED_BASE_DATE + timedelta(days=avail_offset + k * 10)).isoformat()
                for k in range(6)
            ]
            facilities_pool = [
                "Loading dock", "Green room", "AC central", "House sound",
                "Rigging point", "VIP lounge", "Backstage catering", "Parkir luas",
                "Genset backup", "Truck bay", "Kids corner", "Prayer room",
            ]
            facilities = [facilities_pool[(city_index + type_index + k) % len(facilities_pool)] for k in range(5)]
            slug_type = "".join(ch for ch in vtype.lower().replace(" ", "-") if ch.isalnum() or ch == "-")
            slug_city = "".join(ch for ch in city.lower().replace(" ", "-") if ch.isalnum() or ch == "-")
            specs.append(dict(
                id=f"ven-net-{slug_city}-{slug_type}-{ordinal:04d}",
                name=f"{city} {vtype}",
                city=city, province=CITY_PROVINCE.get(city, "Indonesia"),
                address=f"Kawasan {city}, Indonesia",
                venue_type=vtype, indoor=indoor,
                standing_capacity=capacity,
                seated_capacity=int(capacity * (0.75 if indoor else 0.3)),
                area_sqm=int(capacity * 1.4),
                event_day_price=event_day_price,
                setup_day_price=setup_day_price,
                deposit=deposit, power_kva=power_kva,
                curfew=("00:00" if indoor else "22:00"),
                operating_hours=("07:00 - 00:00" if indoor else "06:00 - 22:00"),
                stage_dimension=f"{max(6, capacity // 400)}m x {max(4, capacity // 500)}m",
                facilities=facilities,
                accessibility=["Ramp", "Wheelchair seating", "Accessible toilet"],
                verified=verified, delivery_score=delivery_score,
                rating=rating, review_count=reviews, completed_events=completed,
                event_types={
                    "Convention Hall": ["Konferensi", "Trade show", "Product Launch"],
                    "Grand Ballroom": ["Wedding Expo", "Corporate gathering", "Fashion Week"],
                    "Stadium": ["Konser", "Sports"],
                    "Arena": ["Konser", "Esports"],
                    "Exhibition Hall": ["Trade show", "Expo", "Pameran"],
                    "Theater": ["Theater", "Konser Akustik"],
                    "Hotel Ballroom": ["Corporate gathering", "Product Launch"],
                    "Outdoor Ground": ["Festival musik", "Festival kuliner", "Fun run"],
                    "Beachfront Ground": ["Festival musik", "Wellness"],
                    "Creative Space": ["Community event", "Workshop"],
                    "Rooftop Venue": ["Product Launch", "Private event"],
                    "Amphitheater": ["Konser", "Cultural performance"],
                    "Warehouse Loft": ["Fashion show", "Underground music"],
                    "University Auditorium": ["Seminar", "Workshop"],
                }[vtype],
                sound_restriction="Sesuai kebijakan venue",
                included_equipment=["House sound"] if indoor else [],
                required_vendors=[] if indoor else ["Genset", "Toilet portable"],
                prohibited=[],
                cancellation_policy="Pembatalan H-30: deposit non-refundable",
                availability=availability,
                provenance=PROVENANCE, is_demo=True,
                image="/assets/discover-indonesia/aruna-bold-live-experience-2026.jpg",
                created_at=SEED_TIMESTAMP,
            ))
    return specs


# ------------------------------------------------------------------
# VENDOR expansion
# ------------------------------------------------------------------
VENDOR_CATEGORY_SPECS = [
    # (category, price_min, price_max, sample_capability)
    ("Sound", 28000000, 220000000, "Line array + monitor + digital console"),
    ("Lighting", 22000000, 180000000, "Moving head wash + beam + follow spot"),
    ("LED", 30000000, 250000000, "Outdoor P3.9 + processor + backup"),
    ("Stage", 18000000, 150000000, "Truss roof + risers + custom fabrication"),
    ("Rigging", 15000000, 90000000, "Chain hoist + certified rigger"),
    ("Power / Generator", 12000000, 120000000, "Silent genset + auto sync"),
    ("Multimedia", 14000000, 95000000, "Video switcher + 3 kamera + IMAG"),
    ("Livestream", 18000000, 120000000, "Multi-platform 4K livestream"),
    ("Photography", 6000000, 42000000, "Editorial + coverage 2 day + turnaround 48h"),
    ("Videography", 12000000, 80000000, "Highlight reel 3 min + livestream ready"),
    ("Decoration", 15000000, 120000000, "Custom set + florals + lounge"),
    ("Security", 10000000, 75000000, "Trained guards + K9 + CCTV"),
    ("Medical / Paramedic", 6000000, 45000000, "Standby paramedic + ambulance"),
    ("Transport / Logistics", 8000000, 90000000, "Hiace + truck + coordinator"),
    ("Catering", 15000000, 220000000, "Halal certified + vegan option + service crew"),
    ("Printing", 3500000, 25000000, "Banner + wayfinding + ID card same day"),
    ("Ticketing Equipment", 5000000, 30000000, "Scanner + WiFi mesh + counter"),
    ("Wristband / RFID", 4000000, 28000000, "RFID cashless + wristband bundle"),
    ("Barricade / Crowd Control", 6000000, 45000000, "Steel barricade + queue line"),
    ("Toilet Portable", 4000000, 32000000, "Portable toilet + servicing"),
    ("Cleaning / Waste", 5000000, 32000000, "Cleaning crew + waste sorting"),
    ("Internet / Network", 6000000, 45000000, "Fiber temporary + WiFi mesh + 4G bonded"),
    ("Production Crew", 10000000, 75000000, "SM + PM + stage manager + runners"),
    ("Event Organizer", 60000000, 480000000, "Full end-to-end EO"),
    ("Booth Contractor", 25000000, 220000000, "Custom booth build + graphics"),
    ("Talent Management", 8000000, 60000000, "Riders coordination + LO"),
    ("Sustainability Partner", 6000000, 45000000, "Reusable cup + carbon offset"),
    ("Sponsorship Activation", 12000000, 90000000, "Brand booth ops + sampling crew"),
    ("Interpreter / Translator", 4000000, 25000000, "Simultaneous ID/EN + booth"),
    ("Payment Terminal", 4000000, 22000000, "EDC + QRIS integration"),
    ("Insurance / Bond", 8000000, 60000000, "Event public liability + cancellation"),
    ("Signage / Wayfinding", 4000000, 26000000, "Wayfinding + directional"),
]

VENDOR_BRAND_ROOTS = [
    "Nusantara", "Bahari", "Bumi", "Cakrawala", "Derap", "Ekuator", "Fajar", "Gema",
    "Harmoni", "Ikat", "Jelajah", "Khatulistiwa", "Lintas", "Mahakam", "Nirmala", "Oemar",
    "Panggung", "Rimba", "Selat", "Timur", "Ufuk", "Wana",
]
VENDOR_BRAND_SUFFIXES = [
    "Works", "Production", "Group", "Studio", "Collective", "Kreasi",
    "Nusantara", "Solutions", "Partner", "Company",
]


def _vendor_specs():
    specs = []
    ordinal = 0
    for cat_index, (category, pr_min, pr_max, capability) in enumerate(VENDOR_CATEGORY_SPECS):
        # 6-9 vendor per kategori dari kota berbeda.
        per_category = 6 + (cat_index % 4)
        for k in range(per_category):
            ordinal += 1
            root = VENDOR_BRAND_ROOTS[(cat_index * 3 + k) % len(VENDOR_BRAND_ROOTS)]
            suffix = VENDOR_BRAND_SUFFIXES[(cat_index + k * 2) % len(VENDOR_BRAND_SUFFIXES)]
            city = CITY_NAMES[(cat_index * 5 + k * 11) % len(CITY_NAMES)]
            seed_key = f"vendor:{category}:{k}"
            price_min = pr_min + stable_int(seed_key + ":pmin", (pr_max - pr_min) // 3)
            price_max = pr_max - stable_int(seed_key + ":pmax", (pr_max - pr_min) // 3)
            delivery_score = 82 + stable_int(seed_key + ":ds", 16)
            rating = stable_rating(seed_key + ":rating")
            reviews = 24 + stable_int(seed_key + ":rev", 340)
            completed = 12 + stable_int(seed_key + ":cmp", 180)
            experience_years = 3 + stable_int(seed_key + ":exp", 22)
            verified = stable_int(seed_key + ":ver", 100) > 18
            service_pool = [city] + [
                CITY_NAMES[(cat_index * 7 + k * 13 + j) % len(CITY_NAMES)] for j in range(4)
            ]
            avail_offset = stable_int(seed_key + ":av", 40)
            availability = [
                (SEED_BASE_DATE + timedelta(days=avail_offset + j * 12)).isoformat()
                for j in range(5)
            ]
            slug_cat = "".join(ch for ch in category.lower().replace(" / ", "-").replace(" ", "-")
                               if ch.isalnum() or ch == "-")
            specs.append(dict(
                id=f"vnd-net-{slug_cat}-{ordinal:04d}",
                name=f"{root} {suffix} {city}",
                category=category, city=city,
                province=CITY_PROVINCE.get(city, "Indonesia"),
                service_cities=sorted(set(service_pool)),
                price_min=price_min, price_max=price_max,
                capabilities=[category, capability],
                document_status=("Verified" if verified else "Pending"),
                response_hours=(3 if delivery_score >= 92 else 6 if delivery_score >= 88 else 12),
                delivery_score=delivery_score, verified=verified,
                rating=rating, review_count=reviews,
                completed_events=completed, experience_years=experience_years,
                portfolio=6 + stable_int(seed_key + ":pf", 18),
                availability=availability,
                event_history=[
                    {"event_name": f"{city} Live {2024 + (i % 3)}",
                     "role": category, "year": 2024 + (i % 3)}
                    for i in range(3)
                ],
                provenance=PROVENANCE, is_demo=True,
                created_at=SEED_TIMESTAMP,
            ))
    return specs


# ------------------------------------------------------------------
# WORKFORCE expansion
# ------------------------------------------------------------------
WORKER_ROLES = [
    ("Usher", 250000, ["Crowd guiding", "Bahasa Inggris"]),
    ("Security", 400000, ["Crowd control", "Pengalaman festival"]),
    ("Stagehand", 350000, ["Rigging basic", "Load-in"]),
    ("Ticketing Crew", 300000, ["Scanner ops", "Cash handling"]),
    ("Liaison Officer", 450000, ["Talent handling", "Bahasa Inggris"]),
    ("Photographer", 600000, ["Event photography"]),
    ("Videographer", 700000, ["Cinematography", "Editing"]),
    ("Livestream Operator", 750000, ["Multi-cam", "OBS/vMix"]),
    ("Technician Audio", 650000, ["Audio patching", "Digital console"]),
    ("Technician Lighting", 650000, ["DMX programming"]),
    ("Technician LED", 650000, ["Processor LED", "Video mapping"]),
    ("Rigger", 800000, ["Chain hoist", "Certified rigger"]),
    ("Backstage Crew", 350000, ["Backline handling"]),
    ("Tenant Coordinator", 450000, ["Vendor coordination"]),
    ("Sponsor Coordinator", 500000, ["Brand liaison"]),
    ("Driver", 320000, ["SIM A", "Rute lokal"]),
    ("Runner", 250000, ["Fisik prima", "Bahasa Inggris"]),
    ("Cleaning", 250000, ["Waste management"]),
    ("Medical Support", 500000, ["Paramedic certified"]),
    ("Interpreter", 550000, ["EN-ID Bilingual"]),
    ("MC Support / Emcee", 500000, ["Pengalaman panggung"]),
    ("Set Designer", 700000, ["Custom set fabrication"]),
    ("Wardrobe Stylist", 550000, ["Runway wardrobe"]),
    ("Content Creator", 600000, ["Short form content", "Editing"]),
    ("Social Media On-site", 450000, ["Livesocial", "Community engagement"]),
    ("Fire Marshal", 550000, ["Sertifikasi K3"]),
    ("Waste Sorting Crew", 260000, ["Sustainability"]),
    ("Food Handler", 320000, ["Higienitas", "BPOM basic"]),
]

WORKER_FIRST_NAMES = [
    "Andi", "Bimo", "Citra", "Dewi", "Eka", "Farhan", "Gita", "Hana", "Ibrahim", "Julia",
    "Kirana", "Lutfi", "Maulana", "Nurul", "Okta", "Prasetyo", "Qori", "Rizal", "Sari",
    "Toto", "Umi", "Vira", "Wisnu", "Xaviera", "Yusuf", "Zaenab", "Ayu", "Bagus",
    "Chandra", "Damar", "Elang", "Feby", "Guntur", "Hilda", "Intan", "Jaka", "Krisna",
    "Lestari", "Made", "Nyoman", "Oskar", "Putri", "Ratna", "Sinta", "Tantri", "Ulfa",
    "Vania", "Wahyu", "Yani", "Zulkifli",
]
WORKER_LAST_NAMES = [
    "Saputra", "Prasetya", "Wibowo", "Ramadhan", "Nugroho", "Setiawan", "Hakim",
    "Prawira", "Anggraini", "Maharani", "Wulandari", "Kusuma", "Pradana", "Santoso",
    "Prasetyo", "Halim", "Adnan", "Dewanto", "Sasmita", "Cahyadi", "Ardhana",
    "Salsabila", "Wijaya", "Nasution", "Simanjuntak", "Manullang", "Sianturi",
    "Sinaga", "Latupono", "Wondiwoy", "Rumbewas",
]


def _worker_specs():
    specs = []
    ordinal = 0
    for role_index, (role, base_rate, skills) in enumerate(WORKER_ROLES):
        per_role = 8 + (role_index % 3)
        for k in range(per_role):
            ordinal += 1
            city = CITY_NAMES[(role_index * 3 + k * 5) % len(CITY_NAMES)]
            seed_key = f"worker:{role}:{k}"
            first = WORKER_FIRST_NAMES[(role_index * 5 + k) % len(WORKER_FIRST_NAMES)]
            last = WORKER_LAST_NAMES[(role_index * 7 + k * 3) % len(WORKER_LAST_NAMES)]
            rate = base_rate + stable_int(seed_key + ":r", 80) * 5000
            verified = stable_int(seed_key + ":ver", 100) > 15
            attendance = 90 + stable_int(seed_key + ":att", 10)
            rating = stable_rating(seed_key + ":rating")
            reviews = 8 + stable_int(seed_key + ":rev", 180)
            completed = 6 + stable_int(seed_key + ":cmp", 120)
            experience_years = 1 + stable_int(seed_key + ":exp", 15)
            service_pool = [city] + [
                CITY_NAMES[(role_index * 11 + k * 13 + j) % len(CITY_NAMES)] for j in range(3)
            ]
            avail_offset = stable_int(seed_key + ":av", 45)
            availability = [
                (SEED_BASE_DATE + timedelta(days=avail_offset + j * 7)).isoformat()
                for j in range(8)
            ]
            history = [
                {"event_name": f"{city} Live {2023 + (i % 4)}",
                 "role": role, "year": 2023 + (i % 4)}
                for i in range(min(4, completed))
            ]
            slug_role = "".join(ch for ch in role.lower().replace(" / ", "-").replace(" ", "-")
                                if ch.isalnum() or ch == "-")
            specs.append(dict(
                id=f"wkr-net-{slug_role}-{ordinal:04d}",
                name=f"{first} {last}",
                category=role, role=role,
                city=city, province=CITY_PROVINCE.get(city, "Indonesia"),
                service_cities=sorted(set(service_pool)),
                rate_per_day=rate, skills=skills,
                verified=verified,
                attendance_rate=attendance,
                completed_events=completed,
                experience_years=experience_years,
                rating=rating, review_count=reviews,
                availability=availability,
                event_history=history,
                provenance=PROVENANCE, is_demo=True,
                created_at=SEED_TIMESTAMP,
            ))
    return specs


# ------------------------------------------------------------------
# SPONSOR opportunity expansion
#
# Sponsor tetap menempati model existing (sponsor_packages per event).
# Kita perkaya package dengan metadata industry, budget band, target
# audience, deadline, dan preferred_event_categories agar tampilan
# Sponsor Portal informatif secara nasional.
# ------------------------------------------------------------------
SPONSOR_INDUSTRIES = [
    ("FMCG", ["Konser", "Festival musik", "Festival kuliner"]),
    ("Banking", ["Konferensi", "Trade Expo", "Product Launch"]),
    ("Fintech", ["Product Launch", "Konferensi Teknologi", "Esports"]),
    ("Telco", ["Esports", "Festival musik", "Konferensi Teknologi"]),
    ("Automotive", ["Product Launch", "Festival musik", "Trade Expo"]),
    ("Technology", ["Konferensi Teknologi", "Product Launch", "Esports"]),
    ("Hospitality", ["Wedding Expo", "Fashion Week", "Konferensi"]),
    ("Airline / Travel", ["Wedding Expo", "Fashion Week", "Festival musik"]),
    ("Fashion", ["Fashion Week", "Product Launch"]),
    ("Beauty", ["Fashion Week", "Konser", "Product Launch"]),
    ("Food & Beverage", ["Festival kuliner", "Konser"]),
    ("Media", ["Konferensi", "Festival musik", "Fashion Week"]),
    ("Property", ["Trade Expo", "Konferensi", "Wedding Expo"]),
    ("Government-linked Enterprise", ["Konferensi", "Trade Expo"]),
    ("Local Business", ["Festival kuliner", "Pameran UMKM"]),
]

SPONSOR_TIERS = [
    ("Presenting Sponsor", 1.0, 1),
    ("Main Sponsor", 0.45, 2),
    ("Category Partner", 0.25, 3),
    ("Supporting Sponsor", 0.12, 6),
]


async def _enrich_sponsor_packages():
    """Tambahkan metadata industry + budget band + audience pada
    seluruh sponsor_packages katalog demo. Idempotent: hanya menulis
    field baru bila tidak ada, sehingga package yang sudah dibuat oleh
    interaksi user tidak tertimpa."""
    events = await db.events.find({"is_demo": True}, {"_id": 0}).to_list(500)
    for ev_index, ev in enumerate(events):
        packages = await db.sponsor_packages.find({"event_id": ev["id"]}, {"_id": 0}).to_list(50)
        for pkg in packages:
            industry, preferred = SPONSOR_INDUSTRIES[
                stable_int(pkg["id"] + ":ind", len(SPONSOR_INDUSTRIES))
            ]
            update = {
                "industry": pkg.get("industry") or industry,
                "preferred_event_categories": pkg.get("preferred_event_categories") or preferred,
                "indicative_budget_min": pkg.get("indicative_budget_min") or int(pkg["price"] * 0.85),
                "indicative_budget_max": pkg.get("indicative_budget_max") or int(pkg["price"] * 1.5),
                "target_audience": pkg.get("target_audience") or ev.get("audience_profile") or "Urban 18-45",
                "geography": pkg.get("geography") or [ev.get("city", "Indonesia")],
                "deadline": pkg.get("deadline") or ev.get("start_date"),
                "provenance": pkg.get("provenance") or PROVENANCE,
                "is_demo": True,
            }
            await db.sponsor_packages.update_one(
                {"id": pkg["id"]}, {"$set": update},
            )
    return len(events)


# ------------------------------------------------------------------
# TENANT expansion (zone + booth + tenants catalog)
#
# Model existing:
#   tenant_zones      -> satu zona per event (nama, kategori, area, slots)
#   booth_slots       -> per booth (kapasitas listrik, price, status)
#   tenant_applications -> pengajuan tenant ke booth
#
# Kita perkaya tenant_zones dengan category, city_coverage, requirements,
# deadline sehingga bisa berperan sebagai "tenant opportunity" yang bisa
# disiarkan organizer.
# ------------------------------------------------------------------
TENANT_ZONE_CATEGORIES = [
    ("Food & Beverage", "Kuliner Nusantara", ["Halal", "BPOM basic", "Reusable cup"]),
    ("Fashion", "Fashion & Lifestyle", ["Ready to wear", "Look book"]),
    ("Merchandise", "Merchandise & Retail", ["POS"]),
    ("Beauty", "Beauty & Wellness", ["Product safety", "Sampling ready"]),
    ("Craft / UMKM", "Craft & UMKM", ["Local craft"]),
    ("Technology", "Technology Zone", ["Demo unit", "WiFi mesh"]),
    ("Gaming", "Gaming Zone", ["Stream ready", "Console/PC"]),
    ("Automotive", "Automotive Zone", ["Test drive area optional"]),
    ("Services", "Services & Financial", ["Compliance OJK/BI"]),
    ("Lifestyle", "Lifestyle Pop-up", ["Pop-up ready"]),
    ("Local Brand", "Local Brand Showcase", ["Story-driven brand"]),
]


async def _enrich_tenant_zones():
    """Perkaya zona tenant existing dengan field opportunity."""
    events = await db.events.find({"is_demo": True}, {"_id": 0}).to_list(500)
    total = 0
    for ev in events:
        zones = await db.tenant_zones.find({"event_id": ev["id"]}, {"_id": 0}).to_list(20)
        for zone_index, zone in enumerate(zones):
            cat_index = stable_int(zone["id"] + ":cat", len(TENANT_ZONE_CATEGORIES))
            category, human_category, requirements = TENANT_ZONE_CATEGORIES[cat_index]
            update = {
                "category_key": zone.get("category_key") or category,
                "category": zone.get("category") or human_category,
                "city_coverage": zone.get("city_coverage") or [ev.get("city", "Indonesia")],
                "requirements": zone.get("requirements") or requirements,
                "operational_notes": zone.get("operational_notes") or "Loading H-1, teardown H+1",
                "power_per_booth_watt": zone.get("power_per_booth_watt") or 2000,
                "staffing_required": zone.get("staffing_required") or 2,
                "deadline": zone.get("deadline") or ev.get("start_date"),
                "provenance": zone.get("provenance") or PROVENANCE,
                "broadcast_status": zone.get("broadcast_status") or "open",
                "is_demo": True,
            }
            await db.tenant_zones.update_one({"id": zone["id"]}, {"$set": update})
            total += 1
    return total


TENANT_BRANDS = [
    ("Kopi Rakit", "Food & Beverage", "Specialty coffee & pastry"),
    ("Sate Sultan", "Food & Beverage", "Sate premium"),
    ("Warung Nusantara", "Food & Beverage", "Kuliner tradisional"),
    ("Bumbu Ibu", "Food & Beverage", "Rendang & sambal packed"),
    ("Es Nusantara", "Food & Beverage", "Beverage tradisional"),
    ("Batik Rumah", "Fashion", "Batik ready to wear"),
    ("Tenun Timur", "Fashion", "Tenun ikat kontemporer"),
    ("Denim Bengkel", "Fashion", "Denim workshop wear"),
    ("Sepatu Sudut", "Fashion", "Handmade footwear"),
    ("Kriya Barat", "Craft / UMKM", "Homeware kriya"),
    ("Anyam Bumi", "Craft / UMKM", "Anyaman rotan"),
    ("Kayu Selatan", "Craft / UMKM", "Home decor kayu"),
    ("Klinik Aroma", "Beauty", "Aromatheraphy natural"),
    ("Kulit Bening", "Beauty", "Skincare botanical"),
    ("Rias Kilau", "Beauty", "Cosmetic essentials"),
    ("Merch Panggung", "Merchandise", "Music & film merch"),
    ("Kaus Pahlawan", "Merchandise", "T-shirt storytelling"),
    ("Gadget Kios", "Technology", "Aksesoris gadget"),
    ("Ranah Digital", "Technology", "IoT starter kit"),
    ("Panggung Game", "Gaming", "Gaming gear + demo"),
    ("Roda Timur", "Automotive", "Electric bike demo"),
    ("Jasa Kilat", "Services", "Layanan urus dokumen event"),
    ("Studio Foto Mini", "Lifestyle", "Pop-up studio foto"),
    ("Kelas Sore", "Lifestyle", "Class booking pop-up"),
    ("Kopi Bulukumba", "Food & Beverage", "Kopi single origin"),
    ("Sambal Manado", "Food & Beverage", "Sambal khas Manado"),
    ("Kain Timor", "Fashion", "Kain tenun NTT"),
    ("Perak Kotagede", "Craft / UMKM", "Perhiasan perak Yogyakarta"),
    ("Kopi Aceh", "Food & Beverage", "Kopi Gayo"),
    ("Sepatu Cibaduyut", "Fashion", "Sepatu Bandung"),
]


def _tenant_specs():
    """Bangkitkan tenant catalog (bukan booth) berisi profil tenant
    fiktif yang bisa muncul di broadcast opportunity."""
    specs = []
    for i, (name, category, product) in enumerate(TENANT_BRANDS):
        city = CITY_NAMES[(i * 3) % len(CITY_NAMES)]
        seed_key = f"tenant:{name}"
        rating = stable_rating(seed_key + ":rating")
        reviews = 8 + stable_int(seed_key + ":rev", 220)
        completed = 4 + stable_int(seed_key + ":cmp", 40)
        verified = stable_int(seed_key + ":ver", 100) > 20
        specs.append(dict(
            id=f"tnt-{name.lower().replace(' ', '-').replace('/', '-').replace('&', 'and')}",
            business_name=name, product_category=category, description=product,
            city=city, province=CITY_PROVINCE.get(city, "Indonesia"),
            products=[product],
            preferred_event_categories=stable_pick(seed_key + ":prf", [
                ["Konser", "Festival musik"],
                ["Festival kuliner", "Pameran UMKM"],
                ["Fashion Week"],
                ["Konferensi", "Trade Expo"],
                ["Product Launch"],
            ]),
            booth_size_preference=stable_pick(seed_key + ":size", ["3m x 3m", "3m x 4m", "4m x 4m"]),
            power_requirement_watt=stable_pick(seed_key + ":pwr", [1000, 2000, 3500, 5000]),
            staffing=stable_pick(seed_key + ":st", [2, 3, 4]),
            experience_years=1 + stable_int(seed_key + ":exp", 10),
            rating=rating, review_count=reviews,
            completed_events=completed, verified=verified,
            event_history=[
                {"event_name": f"{city} Live {2024 + (k % 3)}",
                 "role": category, "year": 2024 + (k % 3)}
                for k in range(min(3, completed))
            ],
            food_safety=(category == "Food & Beverage"),
            provenance=PROVENANCE, is_demo=True,
            created_at=SEED_TIMESTAMP,
        ))
    return specs


# ------------------------------------------------------------------
# Public entry point
# ------------------------------------------------------------------
async def seed_network_expansion():
    """Idempotently seed the expanded network catalog. Safe to re-run."""
    talents = _talent_specs()
    venues = _venue_specs()
    vendors = _vendor_specs()
    workers = _worker_specs()
    tenants = _tenant_specs()

    for t in talents:
        await db.talents.update_one({"id": t["id"]}, {"$set": t}, upsert=True)
    for v in venues:
        await db.venues.update_one({"id": v["id"]}, {"$set": v}, upsert=True)
    for v in vendors:
        await db.vendors.update_one({"id": v["id"]}, {"$set": v}, upsert=True)
    for w in workers:
        await db.workers.update_one({"id": w["id"]}, {"$set": w}, upsert=True)
    for t in tenants:
        await db.tenants.update_one({"id": t["id"]}, {"$set": t}, upsert=True)

    # Backfill rating on existing catalog talent/venue/vendor/worker rows
    # that predate this expansion. Deterministic per ID so re-seed is safe.
    async for row in db.talents.find({"rating": {"$exists": False}}, {"_id": 0, "id": 1}):
        rid = row["id"]
        await db.talents.update_one({"id": rid}, {"$set": {
            "rating": stable_rating(f"legacy:talent:{rid}"),
            "review_count": 6 + stable_int(f"legacy:talent:{rid}:rev", 220),
            "completed_events": 4 + stable_int(f"legacy:talent:{rid}:cmp", 90),
            "experience_years": 2 + stable_int(f"legacy:talent:{rid}:exp", 15),
        }})
    async for row in db.venues.find({"rating": {"$exists": False}}, {"_id": 0, "id": 1}):
        rid = row["id"]
        await db.venues.update_one({"id": rid}, {"$set": {
            "rating": stable_rating(f"legacy:venue:{rid}"),
            "review_count": 12 + stable_int(f"legacy:venue:{rid}:rev", 200),
            "completed_events": 8 + stable_int(f"legacy:venue:{rid}:cmp", 80),
        }})
    async for row in db.vendors.find({"rating": {"$exists": False}}, {"_id": 0, "id": 1}):
        rid = row["id"]
        await db.vendors.update_one({"id": rid}, {"$set": {
            "rating": stable_rating(f"legacy:vendor:{rid}"),
            "review_count": 24 + stable_int(f"legacy:vendor:{rid}:rev", 300),
            "completed_events": 12 + stable_int(f"legacy:vendor:{rid}:cmp", 160),
            "experience_years": 3 + stable_int(f"legacy:vendor:{rid}:exp", 20),
        }})
    async for row in db.workers.find({"rating": {"$exists": False}}, {"_id": 0, "id": 1}):
        rid = row["id"]
        await db.workers.update_one({"id": rid}, {"$set": {
            "rating": stable_rating(f"legacy:worker:{rid}"),
            "review_count": 8 + stable_int(f"legacy:worker:{rid}:rev", 160),
            "experience_years": 1 + stable_int(f"legacy:worker:{rid}:exp", 14),
        }})

    sponsor_events = await _enrich_sponsor_packages()
    zone_count = await _enrich_tenant_zones()

    return {
        "talents": len(talents),
        "venues": len(venues),
        "vendors": len(vendors),
        "workers": len(workers),
        "tenants": len(tenants),
        "sponsor_events_enriched": sponsor_events,
        "tenant_zones_enriched": zone_count,
    }
