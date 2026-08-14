"""Katalog event demo tambahan OKKAX: banyak kota, banyak jenis event. Semua data fiktif."""
import hashlib
from datetime import date, timedelta

from core import db

SEED_TIMESTAMP = "2026-08-13T00:00:00+00:00"
SEED_BASE_DATE = date(2026, 8, 13)


def stable_index(value: str, size: int) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:16], 16) % size

IMG = {
    "conference": "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHx0ZWNoJTIwY29uZmVyZW5jZSUyMHN0YWdlJTIwYXVkaWVuY2V8ZW58MHx8fHwxNzg2NTQxNzQ5fDA&ixlib=rb-4.1.0&q=85",
    "seminar": "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwzfHx0ZWNoJTIwY29uZmVyZW5jZSUyMHN0YWdlJTIwYXVkaWVuY2V8ZW58MHx8fHwxNzg2NTQxNzQ5fDA&ixlib=rb-4.1.0&q=85",
    "expo": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwY29uZmVyZW5jZSUyMHN0YWdlJTIwYXVkaWVuY2V8ZW58MHx8fHwxNzg2NTQxNzQ5fDA&ixlib=rb-4.1.0&q=85",
    "food": "https://images.unsplash.com/photo-1568882041008-c0954e91caba?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTV8MHwxfHNlYXJjaHwyfHxpbmRvbmVzaWFuJTIwc3RyZWV0JTIwZm9vZCUyMGZlc3RpdmFsJTIwbmlnaHR8ZW58MHx8fHwxNzg2NTQxNzUwfDA&ixlib=rb-4.1.0&q=85",
    "food2": "https://images.unsplash.com/photo-1733959541069-1a289a05a59f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTV8MHwxfHNlYXJjaHwzfHxpbmRvbmVzaWFuJTIwc3RyZWV0JTIwZm9vZCUyMGZlc3RpdmFsJTIwbmlnaHR8ZW58MHx8fHwxNzg2NTQxNzUwfDA&ixlib=rb-4.1.0&q=85",
    "esports": "https://images.unsplash.com/photo-1587095951604-b9d924a3fda0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwyfHxlc3BvcnRzJTIwYXJlbmElMjBnYW1pbmclMjB0b3VybmFtZW50fGVufDB8fHx8MTc4NjU0MTc0OXww&ixlib=rb-4.1.0&q=85",
    "concert": "https://images.unsplash.com/photo-1674507738101-b4dbe86beea7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxtYXNzaXZlJTIwY29uY2VydCUyMGNyb3dkJTIwY2luZW1hdGljfGVufDB8fHx8MTc4NjUyMzE4N3ww&ixlib=rb-4.1.0&q=85",
    "fashion": "https://images.unsplash.com/photo-1543728069-a3f97c5a2f32?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwyfHxmYXNoaW9uJTIwcnVud2F5JTIwc2hvd3xlbnwwfHx8fDE3ODY1NDE3NDl8MA&ixlib=rb-4.1.0&q=85",
    "runway": "https://images.unsplash.com/photo-1613909671501-f9678ffc1d33?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwcnVud2F5JTIwc2hvd3xlbnwwfHx8fDE3ODY1NDE3NDl8MA&ixlib=rb-4.1.0&q=85",
}

# Satu foto Indonesia untuk satu event. Asset lokal menjaga identitas visual Discover
# tetap konsisten, cepat, dan tidak kembali bergantung pada stok foto generik.
EVENT_IMAGE_SOURCES = {
    "evt-b-nusantara-sound-fest": "/assets/discover-indonesia/nusantara-sound-fest.jpg",
    "evt-b-surabaya-night-market-live": "/assets/discover-indonesia/surabaya-night-market-live.jpg",
    "evt-jogja-kuliner": "/assets/discover-indonesia/jogja-rasa-nusantara.jpg",
    "evt-jkt-esports": "/assets/discover-indonesia/arena-nusantara-esports-finals.jpg",
    "evt-b-kopi-nusantara-weekend": "/assets/discover-indonesia/kopi-nusantara-weekend.jpg",
    "evt-surabaya-expo": "/assets/discover-indonesia/surabaya-halal-industry-expo.jpg",
    "evt-b-manado-seafood-festival": "/assets/discover-indonesia/manado-seafood-festival.jpg",
    "evt-b-sriwijaya-music-carnival": "/assets/discover-indonesia/sriwijaya-music-carnival.jpg",
    "evt-b-batam-esports-invitational": "/assets/discover-indonesia/batam-esports-invitational.jpg",
    "evt-b-bali-wellness-summit": "/assets/discover-indonesia/bali-wellness-summit.jpg",
    "evt-b-jakarta-fashion-exchange": "/assets/discover-indonesia/jakarta-fashion-exchange.jpg",
    "evt-b-khatulistiwa-food--craft": "/assets/discover-indonesia/khatulistiwa-food-and-craft.jpg",
    "evt-b-nusantara-gaming-expo": "/assets/discover-indonesia/nusantara-gaming-expo.jpg",
    "evt-nusa-tech": "/assets/discover-indonesia/nusantara-tech-summit-2026.jpg",
    "evt-bandung-indie": "/assets/discover-indonesia/bandung-indie-wave.jpg",
    "evt-b-surabaya-property-expo": "/assets/discover-indonesia/surabaya-property-expo.jpg",
    "evt-b-jogja-creative-expo": "/assets/discover-indonesia/jogja-creative-expo.jpg",
    "evt-semarang-umkm": "/assets/discover-indonesia/semarang-umkm-growth-fair.jpg",
    "evt-b-malang-indie-showcase": "/assets/discover-indonesia/malang-indie-showcase.jpg",
    "evt-b-bandung-coffee-conference": "/assets/discover-indonesia/bandung-coffee-conference.jpg",
    "evt-b-borneo-energy-forum": "/assets/discover-indonesia/borneo-energy-forum.jpg",
    "evt-b-padang-startup-week": "/assets/discover-indonesia/padang-startup-week.jpg",
    "evt-bali-fashion": "/assets/discover-indonesia/bali-resort-fashion-week.jpg",
    "evt-medan-startup": "/assets/discover-indonesia/medan-startup-demo-day.jpg",
    "evt-b-denpasar-digital-nomad-summit": "/assets/discover-indonesia/denpasar-digital-nomad-summit.jpg",
    "evt-b-medan-culinary-heritage": "/assets/discover-indonesia/medan-culinary-heritage.jpg",
    "evt-b-jogja-wedding-showcase": "/assets/discover-indonesia/jogja-wedding-showcase.jpg",
    "evt-b-bali-art--design-week": "/assets/discover-indonesia/bali-art-and-design-week.jpg",
    "evt-b-palembang-halal-food-fair": "/assets/discover-indonesia/palembang-halal-food-fair.jpg",
    "evt-b-semarang-youth-music-camp": "/assets/discover-indonesia/semarang-youth-music-camp.jpg",
    "evt-aruna-2026": "/assets/discover-indonesia/aruna-bold-live-experience-2026.jpg",
}


def discover_image(event_id: str) -> str:
    direct = EVENT_IMAGE_SOURCES.get(event_id)
    if direct:
        return direct
    local_images = tuple(EVENT_IMAGE_SOURCES.values())
    return local_images[stable_index(event_id, len(local_images))]


# Jaringan penyelenggara fiktif lintas Indonesia. Seluruh event katalog
# mengacu ke organisasi database ini, bukan ke nama yang ditanam di frontend.
PROMOTERS = [
    ("org-aruna", "PT Aruna Consumer Indonesia", "Makassar"),
    ("org-pulse-jakarta", "Pulse Jakarta Kreasi", "Jakarta"),
    ("org-sora-bandung", "Bandung Sora Production", "Bandung"),
    ("org-liveworks-surabaya", "Surabaya Liveworks", "Surabaya"),
    ("org-ruang-jogja", "Jogja Ruang Event", "Yogyakarta"),
    ("org-island-bali", "Bali Island Promotor", "Denpasar"),
    ("org-panggung-medan", "Medan Panggung Bersama", "Medan"),
    ("org-spektrum-semarang", "Semarang Spektrum Kreasi", "Semarang"),
    ("org-sriwijaya-event", "Sriwijaya Event Network", "Palembang"),
    ("org-borneo-stageworks", "Borneo Stageworks", "Balikpapan"),
    ("org-bahari-manado", "Manado Bahari Production", "Manado"),
    ("org-ranah-live", "Ranah Minang Live", "Padang"),
    ("org-batam-crossborder", "Batam Crossborder Events", "Batam"),
    ("org-malang-indie", "Malang Indie Movement", "Malang"),
    ("org-khatulistiwa-creative", "Khatulistiwa Creative House", "Pontianak"),
    ("org-makassar-promosindo", "Makassar Timur Promosindo", "Makassar"),
]

BAND_ROOTS = [
    "Arunika", "Bahari", "Baskara", "Cakrawala", "Derap", "Ekuator", "Fajar", "Gema",
    "Jelajah", "Khatulistiwa", "Lentera", "Meridian", "Niskala", "Purnama", "Rasi",
]
BAND_SUFFIXES = ["Collective", "Syndicate", "Ensemble", "Parade", "Society", "Project", "Orchestra", "Unit"]
BAND_CITIES = [
    "Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Denpasar", "Medan", "Semarang",
    "Palembang", "Balikpapan", "Manado", "Padang", "Batam", "Malang", "Pontianak", "Makassar",
]


def _catalog_talents():
    """Bangun 120 band katalog dengan ID dan profil deterministik."""
    talents = []
    for root_index, root in enumerate(BAND_ROOTS):
        for suffix_index, suffix in enumerate(BAND_SUFFIXES):
            ordinal = root_index * len(BAND_SUFFIXES) + suffix_index + 1
            base_fee = 45000000 + (ordinal % 12) * 12500000
            talents.append(dict(
                id=f"tal-catalog-{ordinal:03d}", stage_name=f"{root} {suffix}",
                management="OKKAX Artist Network", category="Music Band",
                genre=["Alternative Pop", "Indie Rock", "Electronic Pop", "Folk Fusion"][ordinal % 4],
                city=BAND_CITIES[(ordinal - 1) % len(BAND_CITIES)], base_fee=base_fee,
                fee_min=int(base_fee * 0.9), fee_max=int(base_fee * 1.25),
                fee_status="Indicative Range", team_size=5 + ordinal % 8, duration_min=60,
                verified=ordinal % 7 != 0,
                bio=f"Band fiktif asal {BAND_CITIES[(ordinal - 1) % len(BAND_CITIES)]} dalam katalog demo OKKAX.",
                brand_restrictions=[], age_restriction="All ages",
                cancellation_policy="Pembatalan H-14: 40% fee", delivery_score=82 + ordinal % 15,
                portfolio=3 + ordinal % 14, rider_template=[], currency="IDR",
                availability=["2026-09-01", "2026-10-01", "2026-11-01"], created_at=SEED_TIMESTAMP,
            ))
    return talents


CATALOG_TALENTS = _catalog_talents()


# venue tambahan di berbagai kota
EXTRA_VENUES = [
    dict(id="ven-jkt-icehall", name="Ice Hall Kemayoran", city="Jakarta", indoor=True,
         standing_capacity=9000, seated_capacity=6500, area_sqm=11000, event_day_price=420000000,
         setup_day_price=150000000, deposit=210000000, power_kva=2000, curfew="01:00",
         event_types=["Esports", "Konser", "Trade show"], image=IMG["esports"]),
    dict(id="ven-bdg-sasana", name="Sasana Budaya Bandung", city="Bandung", indoor=True,
         standing_capacity=3500, seated_capacity=2800, area_sqm=4200, event_day_price=145000000,
         setup_day_price=55000000, deposit=72000000, power_kva=700, curfew="23:00",
         event_types=["Konser", "Konferensi", "Pameran"], image=IMG["conference"]),
    dict(id="ven-sby-graha", name="Graha Timur Surabaya", city="Surabaya", indoor=True,
         standing_capacity=4200, seated_capacity=3000, area_sqm=5200, event_day_price=190000000,
         setup_day_price=70000000, deposit=95000000, power_kva=900, curfew="23:30",
         event_types=["Konferensi", "Expo", "Product Launch"], image=IMG["expo"]),
    dict(id="ven-yog-alun", name="Lapangan Kreatif Yogyakarta", city="Yogyakarta", indoor=False,
         standing_capacity=7000, seated_capacity=0, area_sqm=9000, event_day_price=90000000,
         setup_day_price=32000000, deposit=45000000, power_kva=0, curfew="22:30",
         event_types=["Festival kuliner", "Festival musik", "Pasar kreatif"], image=IMG["food"]),
    dict(id="ven-dps-garuda", name="Garuda Bali Convention", city="Denpasar", indoor=True,
         standing_capacity=2600, seated_capacity=2000, area_sqm=3800, event_day_price=260000000,
         setup_day_price=90000000, deposit=130000000, power_kva=850, curfew="00:00",
         event_types=["Fashion Week", "Wedding Expo", "Konferensi"], image=IMG["fashion"]),
    dict(id="ven-mdn-atrium", name="Atrium Deli Medan", city="Medan", indoor=True,
         standing_capacity=1800, seated_capacity=1400, area_sqm=2400, event_day_price=110000000,
         setup_day_price=40000000, deposit=55000000, power_kva=500, curfew="23:00",
         event_types=["Seminar", "Product Launch", "Job Fair"], image=IMG["seminar"]),
    dict(id="ven-smg-balai", name="Balai Kota Kreatif Semarang", city="Semarang", indoor=True,
         standing_capacity=1500, seated_capacity=1100, area_sqm=1900, event_day_price=85000000,
         setup_day_price=30000000, deposit=42000000, power_kva=420, curfew="22:30",
         event_types=["Seminar", "Workshop", "Pameran UMKM"], image=IMG["expo"]),
]

VENUE_DEFAULTS = dict(
    address="Alamat fiktif demo OKKAX", lat=-6.2, lng=106.8, stage_dimension="Custom build",
    operating_hours="08:00 - 23:00", facilities=["Loading dock", "Green room", "Parkir luas"],
    accessibility=["Ramp", "Wheelchair seating"], verified=True, delivery_score=90,
    sound_restriction="Sesuai kebijakan venue", included_equipment=["House sound"],
    required_vendors=[], prohibited=[], availability=["2026-08-01", "2026-09-01", "2026-10-01"],
    cancellation_policy="Pembatalan H-30: deposit non-refundable",
)

# (id, code, nama, jenis, kota, venue_id, tanggal, hari, kapasitas, budget, gambar, tiers, sponsor_price)
EXTRA_EVENTS = [
    ("evt-nusa-tech", "EVT-JKT-2026-0002", "Nusantara Tech Summit 2026", "Konferensi Teknologi",
     "Jakarta", "ven-jkt-icehall", "2026-09-10", 2, 4500, 3800000000, IMG["conference"],
     [("Early Bird", 850000, 800), ("Regular", 1450000, 2500), ("Executive Pass", 4200000, 400)], 650000000),
    ("evt-bandung-indie", "EVT-BDG-2026-0003", "Bandung Indie Wave", "Festival Musik",
     "Bandung", "ven-bdg-sasana", "2026-08-29", 1, 3200, 1250000000, IMG["concert"],
     [("Presale", 175000, 1200), ("Regular", 265000, 1800), ("VIP Deck", 720000, 200)], 180000000),
    ("evt-surabaya-expo", "EVT-SBY-2026-0004", "Surabaya Halal Industry Expo", "Trade Expo",
     "Surabaya", "ven-sby-graha", "2026-10-02", 3, 6000, 2100000000, IMG["expo"],
     [("Visitor Pass", 50000, 4000), ("Business Pass", 350000, 1500)], 320000000),
    ("evt-jogja-kuliner", "EVT-YOG-2026-0005", "Jogja Rasa Nusantara", "Festival Kuliner",
     "Yogyakarta", "ven-yog-alun", "2026-08-22", 3, 8000, 940000000, IMG["food"],
     [("Tiket Masuk", 35000, 6000), ("Food Passport", 150000, 2000)], 120000000),
    ("evt-bali-fashion", "EVT-DPS-2026-0006", "Bali Resort Fashion Week", "Fashion Week",
     "Denpasar", "ven-dps-garuda", "2026-09-19", 2, 2200, 2650000000, IMG["runway"],
     [("Runway Seat", 1250000, 900), ("Front Row", 3800000, 240), ("Trade Buyer", 650000, 600)], 480000000),
    ("evt-medan-startup", "EVT-MDN-2026-0007", "Medan Startup Demo Day", "Seminar & Pitching",
     "Medan", "ven-mdn-atrium", "2026-07-26", 1, 1400, 460000000, IMG["seminar"],
     [("General", 120000, 900), ("Investor Pass", 900000, 200)], 90000000),
    ("evt-jkt-esports", "EVT-JKT-2026-0008", "Arena Nusantara Esports Finals", "Esports",
     "Jakarta", "ven-jkt-icehall", "2026-11-14", 2, 8500, 3200000000, IMG["esports"],
     [("Standing", 220000, 5000), ("Tribune", 480000, 2500), ("Player Zone", 1500000, 500)], 750000000),
    ("evt-semarang-umkm", "EVT-SMG-2026-0009", "Semarang UMKM Growth Fair", "Pameran UMKM",
     "Semarang", "ven-smg-balai", "2026-08-08", 2, 1600, 380000000, IMG["food2"],
     [("Gratis Masuk", 0, 1400), ("Workshop Pass", 95000, 300)], 70000000),
]

BULK_VENUES = [
    ("ven-plm-arena", "Sriwijaya Arena", "Palembang", True, 4200, 130000000, IMG["conference"]),
    ("ven-bpn-hall", "Balikpapan Bay Hall", "Balikpapan", True, 2600, 120000000, IMG["expo"]),
    ("ven-mnd-plaza", "Manado Waterfront Plaza", "Manado", False, 5200, 95000000, IMG["food2"]),
    ("ven-pdg-convention", "Padang Convention Center", "Padang", True, 2400, 105000000, IMG["seminar"]),
    ("ven-btm-dome", "Batam Nusantara Dome", "Batam", True, 3800, 160000000, IMG["esports"]),
    ("ven-mlg-graha", "Graha Kreatif Malang", "Malang", True, 2200, 88000000, IMG["conference"]),
    ("ven-ptk-lapangan", "Lapangan Khatulistiwa", "Pontianak", False, 6000, 78000000, IMG["food"]),
    ("ven-jog-hall", "Jogja Expo Hall", "Yogyakarta", True, 3000, 115000000, IMG["expo"]),
    ("ven-sby-pantai", "Kenjeran Open Stage", "Surabaya", False, 9000, 105000000, IMG["concert"]),
    ("ven-bdg-dago", "Dago Creative Ground", "Bandung", False, 5000, 88000000, IMG["runway"]),
    ("ven-jkt-senayan", "Senayan Grand Plaza", "Jakarta", False, 12000, 380000000, IMG["concert"]),
    ("ven-dps-beach", "Sanur Beach Arena", "Denpasar", False, 4500, 145000000, IMG["food"]),
]

# (nama, jenis, kota, venue, offset hari dari hari ini, durasi, kapasitas, budget, gambar, harga dasar, rasio terjual)
BULK_EVENTS = [
    ("Nusantara Sound Fest", "Festival Musik", "Jakarta", "ven-jkt-senayan", -1, 3, 11000, 4200000000, "concert", 320000, 0.94),
    ("Kopi Nusantara Weekend", "Festival Kuliner", "Bandung", "ven-bdg-dago", 0, 2, 4600, 620000000, "food", 45000, 0.88),
    ("Surabaya Night Market Live", "Festival Kuliner", "Surabaya", "ven-sby-pantai", 1, 2, 8000, 740000000, "food2", 35000, 0.71),
    ("Bali Wellness Summit", "Konferensi", "Denpasar", "ven-dps-beach", 3, 2, 3800, 1650000000, "seminar", 780000, 0.63),
    ("Jogja Creative Expo", "Pameran UMKM", "Yogyakarta", "ven-jog-hall", 4, 3, 2900, 520000000, "expo", 40000, 0.55),
    ("Sriwijaya Music Carnival", "Festival Musik", "Palembang", "ven-plm-arena", 6, 1, 3900, 890000000, "concert", 195000, 0.82),
    ("Borneo Energy Forum", "Konferensi Teknologi", "Balikpapan", "ven-bpn-hall", 9, 2, 2400, 1980000000, "conference", 1350000, 0.47),
    ("Manado Seafood Festival", "Festival Kuliner", "Manado", "ven-mnd-plaza", 12, 3, 5000, 680000000, "food", 30000, 0.66),
    ("Padang Startup Week", "Seminar & Pitching", "Padang", "ven-pdg-convention", 15, 2, 2200, 540000000, "seminar", 145000, 0.42),
    ("Batam Esports Invitational", "Esports", "Batam", "ven-btm-dome", 18, 2, 3600, 1450000000, "esports", 210000, 0.77),
    ("Malang Indie Showcase", "Festival Musik", "Malang", "ven-mlg-graha", 21, 1, 2000, 380000000, "concert", 125000, 0.58),
    ("Khatulistiwa Food & Craft", "Festival Kuliner", "Pontianak", "ven-ptk-lapangan", 24, 2, 5600, 460000000, "food2", 25000, 0.35),
    ("Jakarta Fashion Exchange", "Fashion Week", "Jakarta", "ven-jkt-icehall", 27, 2, 4200, 2750000000, "runway", 950000, 0.51),
    ("Bandung Coffee Conference", "Konferensi", "Bandung", "ven-bdg-sasana", 31, 2, 2600, 780000000, "conference", 420000, 0.44),
    ("Surabaya Property Expo", "Trade Expo", "Surabaya", "ven-sby-graha", 34, 3, 5200, 1250000000, "expo", 0, 0.29),
    ("Denpasar Digital Nomad Summit", "Konferensi Teknologi", "Denpasar", "ven-dps-garuda", 38, 2, 1900, 1420000000, "conference", 890000, 0.36),
    ("Medan Culinary Heritage", "Festival Kuliner", "Medan", "ven-mdn-atrium", 42, 2, 1700, 420000000, "food", 38000, 0.31),
    ("Semarang Youth Music Camp", "Festival Musik", "Semarang", "ven-smg-balai", 46, 2, 1450, 360000000, "concert", 95000, 0.24),
    ("Jogja Wedding Showcase", "Wedding Expo", "Yogyakarta", "ven-jog-hall", 52, 2, 2600, 690000000, "fashion", 0, 0.18),
    ("Nusantara Gaming Expo", "Esports", "Jakarta", "ven-jkt-icehall", 58, 3, 8800, 3150000000, "esports", 175000, 0.22),
    ("Bali Art & Design Week", "Fashion Week", "Denpasar", "ven-dps-beach", 64, 3, 3400, 1780000000, "runway", 560000, 0.15),
    ("Palembang Halal Food Fair", "Trade Expo", "Palembang", "ven-plm-arena", 70, 3, 3600, 820000000, "food2", 20000, 0.12),
]

# Tujuh seri di 15 kota menghasilkan 105 event tambahan. Nama, tanggal,
# promotor, talent, kapasitas, dan nilai disimpan sebagai dokumen event biasa.
CATALOG_MARKETS = [
    ("JKT", "Jakarta", "ven-jkt-senayan"),
    ("BDG", "Bandung", "ven-bdg-dago"),
    ("SBY", "Surabaya", "ven-sby-pantai"),
    ("YOG", "Yogyakarta", "ven-jog-hall"),
    ("DPS", "Denpasar", "ven-dps-beach"),
    ("MDN", "Medan", "ven-mdn-atrium"),
    ("SMG", "Semarang", "ven-smg-balai"),
    ("PLM", "Palembang", "ven-plm-arena"),
    ("BPN", "Balikpapan", "ven-bpn-hall"),
    ("MND", "Manado", "ven-mnd-plaza"),
    ("PDG", "Padang", "ven-pdg-convention"),
    ("BTM", "Batam", "ven-btm-dome"),
    ("MLG", "Malang", "ven-mlg-graha"),
    ("PTK", "Pontianak", "ven-ptk-lapangan"),
    ("MKS", "Makassar", "ven-mch"),
]
CATALOG_SERIES = [
    ("Soundscape Weekender", "Festival Musik", "concert", 210000, 980000000),
    ("Resonansi Kota", "Konser", "concert", 185000, 760000000),
    ("Panggung Nusantara", "Festival Musik", "concert", 240000, 1120000000),
    ("Skyline Music Fest", "Konser", "concert", 275000, 1380000000),
    ("Harmoni Lokal Live", "Festival Musik", "concert", 150000, 620000000),
    ("Indie District", "Konser", "concert", 175000, 710000000),
    ("Rhythm Archipelago", "Festival Musik", "concert", 225000, 1040000000),
]


def _catalog_specs():
    """Bangun 105 event musik lintas Indonesia dari snapshot yang stabil."""
    out = []
    ordinal = 0
    for market_index, (city_code, city, venue_id) in enumerate(CATALOG_MARKETS):
        for series_index, (series, event_type, image_key, base_price, base_budget) in enumerate(CATALOG_SERIES):
            ordinal += 1
            start_date = SEED_BASE_DATE + timedelta(days=76 + ordinal * 3)
            days = 2 if series_index % 3 == 0 else 1
            capacity = 1800 + ((market_index * 7 + series_index * 5) % 18) * 280
            budget = base_budget + market_index * 45000000
            name = f"{city} {series} {start_date.year}"
            slug = "".join(ch for ch in f"{city}-{series}".lower().replace(" ", "-") if ch.isalnum() or ch == "-")
            eid = f"evt-catalog-{slug}"
            code = f"EVT-{city_code}-{start_date.year}-{ordinal + 100:04d}"
            tiers = [
                ("Presale", int(base_price * 0.78), int(capacity * 0.34)),
                ("Regular", base_price, int(capacity * 0.5)),
                ("VIP", int(base_price * 2.4), max(80, int(capacity * 0.1))),
            ]
            sold_ratio = 0.18 + ((ordinal * 11) % 61) / 100
            out.append((eid, code, name, event_type, city, venue_id, start_date.isoformat(), days,
                        capacity, budget, IMG[image_key], tiers, int(budget * 0.2), sold_ratio))
    return out


def _bulk_specs():
    """Bangun spesifikasi event massal dari tanggal snapshot yang stabil."""
    out = []
    for i, (name, etype, city, venue, offset, days, cap, budget, img, price, ratio) in enumerate(BULK_EVENTS):
        start = (SEED_BASE_DATE + timedelta(days=offset)).isoformat()
        code = f"EVT-{city[:3].upper()}-2026-{i + 20:04d}"
        eid = "evt-b-" + "".join(ch for ch in name.lower().replace(" ", "-") if ch.isalnum() or ch == "-")
        if price == 0:
            tiers = [("Gratis Masuk", 0, int(cap * 0.8)), ("Premium Pass", 165000, int(cap * 0.12) or 60)]
        else:
            tiers = [("Presale", int(price * 0.72), int(cap * 0.35)),
                     ("Regular", price, int(cap * 0.5)),
                     ("VIP", int(price * 2.6), max(80, int(cap * 0.1)))]
        out.append((eid, code, name, etype, city, venue, start, days, cap, budget, IMG[img],
                    tiers, int(budget * 0.22), ratio))
    return out


SPONSOR_TIERS = [("Presenting Sponsor", 1.0, 1), ("Main Sponsor", 0.45, 2), ("Supporting Sponsor", 0.18, 4)]


async def seed_extra_events():
    for oid, name, city in PROMOTERS:
        await db.organizations.update_one({"id": oid}, {"$set": dict(
            id=oid, name=name, org_type="Event Promoter", city=city, verified=True,
            address=f"{city}, Indonesia", contact_email=f"contact@{oid}.demo",
            website=f"https://{oid}.demo",
            description=f"{name} adalah promotor fiktif dalam katalog demo OKKAX.",
            currency="IDR", timezone="Asia/Jakarta", language="id",
            document_status="Verified", created_at=SEED_TIMESTAMP)}, upsert=True)
    for talent in CATALOG_TALENTS:
        await db.talents.update_one({"id": talent["id"]}, {"$set": talent}, upsert=True)

    for v in EXTRA_VENUES:
        await db.venues.update_one({"id": v["id"]}, {"$set": {**VENUE_DEFAULTS, **v, "created_at": SEED_TIMESTAMP}},
                                   upsert=True)
    for vid, vname, vcity, indoor, capv, price, img in BULK_VENUES:
        await db.venues.update_one({"id": vid}, {"$set": {**VENUE_DEFAULTS, "id": vid, "name": vname,
            "city": vcity, "indoor": indoor, "standing_capacity": capv,
            "seated_capacity": int(capv * 0.7) if indoor else 0, "area_sqm": capv,
            "event_day_price": price, "setup_day_price": int(price * 0.38), "deposit": int(price * 0.5),
            "power_kva": 700 if indoor else 0, "curfew": "23:30" if indoor else "22:30",
            "event_types": ["Konser", "Konferensi", "Festival", "Expo"], "image": img,
            "created_at": SEED_TIMESTAMP}}, upsert=True)

    specs = [(*e, None) for e in EXTRA_EVENTS] + _bulk_specs() + _catalog_specs()
    vendor_pool = await db.vendors.find({}, {"_id": 0}).sort("id", 1).to_list(50)
    for spec_index, (eid, code, name, etype, city, venue_id, start, days, cap, budget, img,
                     tiers, sponsor_base, sold_ratio) in enumerate(specs):
        img = discover_image(eid)
        venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
        promoter_id, promoter_name, _promoter_city = PROMOTERS[spec_index % len(PROMOTERS)]
        talent = CATALOG_TALENTS[spec_index % len(CATALOG_TALENTS)]
        _s = date.fromisoformat(start)
        end = (_s + timedelta(days=days - 1)).isoformat()
        ev_status = "live" if _s <= SEED_BASE_DATE <= _s + timedelta(days=days - 1) else "published"
        # Calendar lifecycle is independent from publication state: an event may
        # remain publicly documented while it is postponed, rescheduled, or cancelled.
        calendar_status = (
            "rescheduled" if _s > SEED_BASE_DATE and spec_index % 31 == 9 else
            "postponed" if _s > SEED_BASE_DATE and spec_index % 37 == 14 else
            "cancelled" if _s > SEED_BASE_DATE and spec_index % 43 == 21 else None
        )
        brief = dict(
            name=name, event_type=etype, city=city, start_date=start, days=days, setup_days=1,
            capacity=cap, budget=budget, currency="IDR", organizer=promoter_name,
            objective=f"Menjalankan {etype.lower()} berskala kota di {city} dengan ekosistem OKKAX.",
            description=f"{name} adalah {etype.lower()} fiktif di {city} untuk demonstrasi jaringan operasional live event OKKAX.",
            venue_preference="Indoor" if venue.get("indoor") else "Outdoor", ticketed=True,
            sponsor_requirement=True, tenant_requirement=True, workforce_requirement=True,
            audience_profile="Urban professional & creative community", target_age="18-45",
            production_standard="Premium", attendance_format="Offline", event_id=eid)

        await db.events.update_one({"id": eid}, {"$set": dict(
            id=eid, event_code=code, name=name, event_type=etype, city=city,
            venue_name=venue["name"], organizer_org_id=promoter_id,
            organizer_name=promoter_name, owner_user_id="usr-1", status=ev_status,
            calendar_status=calendar_status, country="Indonesia",
            original_start_date=(_s - timedelta(days=7)).isoformat() if calendar_status == "rescheduled" else None,
            start_date=start, end_date=end, start_time="10:00" if "Konferensi" in etype or "Seminar" in etype else "16:00",
            timezone="Asia/Jakarta", days=days, setup_days=1, capacity=cap, budget=budget,
            currency="IDR", description=brief["description"], objective=brief["objective"],
            audience_profile=brief["audience_profile"], age_limit="17+", hero_image=img, is_demo=True,
            refund_policy="Refund penuh hingga H-14, 50% hingga H-7.",
            reschedule_policy="Tiket berlaku pada tanggal pengganti bila dijadwalkan ulang.",
            accessibility="Ramp, wheelchair seating, accessible toilet",
            gate_info="Gate utama buka 1 jam sebelum acara",
            support_contact="support@okkax.demo", indoor=bool(venue.get("indoor")), format="Offline",
            faq=[{"q": "Apakah tiket bisa dipindahtangankan?", "a": "Tiket reguler dapat dipindahtangankan hingga H-3."}],
            published_at=SEED_TIMESTAMP, created_at=SEED_TIMESTAMP)}, upsert=True)

        await db.event_briefs.update_one({"event_id": eid}, {"$set": dict(
            id=f"evtbrief-{eid}", event_id=eid, payload=brief, created_at=SEED_TIMESTAMP)}, upsert=True)

        # venue link
        total = venue["event_day_price"] * days + venue["setup_day_price"]
        await db.event_venues.update_one({"event_id": eid}, {"$set": dict(
            id=f"evtven-{eid}", event_id=eid, venue_id=venue_id, venue_name=venue["name"],
            event_days=days, setup_days=1, total_cost=total, deposit=venue["deposit"],
            status="Confirmed", compatibility={"score": 90, "reasons": [
                f"Kapasitas {venue['standing_capacity']} memenuhi target {cap} pengunjung",
                f"Curfew {venue.get('curfew')} sesuai rundown",
                f"Kota {city} sesuai target audiens"]}, created_at=SEED_TIMESTAMP)}, upsert=True)

        # ticket tiers
        for i, (tname, price, qty) in enumerate(tiers):
            base_ratio = sold_ratio if sold_ratio is not None else (0.62 if i == 0 else 0.34 if i == 1 else 0.18)
            factor = 1.0 if sold_ratio is None else (1.0 if i == 0 else 0.82 if i == 1 else 0.6)
            sold = min(qty, int(qty * base_ratio * factor))
            await db.ticket_tiers.update_one({"id": f"{eid}-tier-{i+1}"}, {"$set": dict(
                id=f"{eid}-tier-{i+1}", event_id=eid, name=tname, ticket_type=tname, price=price,
                quantity=qty, sold=sold, sale_start="2026-05-01", sale_end=start,
                benefits=[f"Akses {days} hari", "E-ticket QR"], purchase_limit=5, age_rule="17+",
                transfer_rule="Dapat dipindahtangankan hingga H-3",
                refund_rule="Refund penuh hingga H-14", active=True, created_at=SEED_TIMESTAMP)}, upsert=True)

        # sponsor inventory
        for tier, mult, qty in SPONSOR_TIERS:
            pkg_id = f"{eid}-pkg-{tier.lower().replace(' ', '-')}"
            await db.sponsor_packages.update_one({"id": pkg_id}, {"$set": dict(
                id=pkg_id, event_id=eid, name=tier, tier=tier,
                price=int(sponsor_base * mult), quantity=qty, sold=1 if tier == "Main Sponsor" else 0,
                rights=["Logo Placement", "LED Exposure", "Booth Activation"], exclusivity="Open",
                deadline=start, deliverables=[{"item": "Logo Placement", "status": "Not Started"}],
                audience_profile=brief["audience_profile"], estimated_attendance=cap,
                status="Open", created_at=SEED_TIMESTAMP)}, upsert=True)

        # tenant zone + booth
        zid = f"{eid}-zone-1"
        await db.tenant_zones.update_one({"id": zid}, {"$set": dict(
            id=zid, event_id=eid, name="Tenant & Activation Zone", category="Food and Beverage",
            area_sqm=360, slots=12, utilities=["Electricity", "Water"], operating_hours="10:00 - 22:00",
            description=f"Zona tenant {name}.", created_at=SEED_TIMESTAMP)}, upsert=True)
        for i in range(12):
            await db.booth_slots.update_one({"id": f"{zid}-b{i+1}"}, {"$set": dict(
                id=f"{zid}-b{i+1}", event_id=eid, zone_id=zid, zone_name="Tenant & Activation Zone",
                code=f"TZ-{i+1:02d}", size="3m x 3m", price=6500000, deposit=1300000,
                electricity_watt=2000, furniture="1 meja, 2 kursi", position=f"Row {chr(65 + i // 4)}-{i % 4 + 1}",
                status="occupied" if i < 5 else "available",
                tenant_name="Tenant Demo UMKM" if i < 5 else None,
                tenant_application_id=None, created_at=SEED_TIMESTAMP)}, upsert=True)

        # vendor produksi + headline talent agar kartu Discover kaya konteks
        picks = [vendor_pool[(stable_index(eid, len(vendor_pool)) + k * 5) % len(vendor_pool)] for k in range(6)] if vendor_pool else []
        seen = set()
        for v in picks:
            if v["id"] in seen:
                continue
            seen.add(v["id"])
            ven_id = f"evtven-{eid}-{v['id']}"
            await db.event_vendors.update_one({"id": ven_id}, {"$set": dict(
                id=ven_id, event_id=eid, vendor_id=v["id"], vendor_name=v["name"], category=v["category"],
                cost=int((v["price_min"] + v["price_max"]) / 2), status="Confirmed",
                created_at=SEED_TIMESTAMP)}, upsert=True)

        fee = talent["base_fee"]
        await db.event_talents.update_one({"id": f"evttal-{eid}"}, {"$set": dict(
            id=f"evttal-{eid}", event_id=eid, talent_id=talent["id"], talent_name=talent["stage_name"],
            fee=fee, tax_estimate=int(fee * 0.02), travel=0, accommodation=0, local_transport=2000000,
            security=0, rider_cost=0, hospitality=2500000,
            landed_cost=int(fee * 1.02) + 4500000, status="Confirmed",
            performance_slot=f"{start} 20:00", created_at=SEED_TIMESTAMP)}, upsert=True)

        # workforce, budget, funding, risks
        for role, need, comp in [("Usher", max(6, cap // 250), 275000), ("Security", max(6, cap // 300), 400000),
                                 ("Stagehand", 10, 350000), ("Ticketing Crew", 8, 300000)]:
            job_id = f"evtjob-{eid}-{role.lower().replace(' ', '-')}"
            await db.event_jobs.update_one({"id": job_id}, {"$set": dict(
                id=job_id, event_id=eid, role=role, needed=need, shift="Show day", location=venue["name"],
                compensation_per_day=comp, days=days, supervisor="Ops Supervisor",
                required_skills=[role], filled=max(0, need - 3), status="In Progress",
                created_at=SEED_TIMESTAMP)}, upsert=True)

        for cat, label, share, state in [("Venue", "Sewa venue & setup", 0.0, "committed"),
                                         ("Production", "Panggung, audio, lighting, LED", 0.32, "committed"),
                                         ("Talent", "Talent & pembicara", 0.22, "estimated"),
                                         ("Marketing", "Campaign & KOL", 0.12, "estimated"),
                                         ("Operations", "Workforce, security, medis", 0.1, "estimated"),
                                         ("Contingency", "Contingency 5%", 0.05, "estimated")]:
            bud_id = f"evtbud-{eid}-{cat.lower()}"
            await db.budget_items.update_one({"id": bud_id}, {"$set": dict(
                id=bud_id, event_id=eid, category=cat, label=label,
                amount=total if cat == "Venue" else int(budget * share), state=state,
                source="seed", created_at=SEED_TIMESTAMP)}, upsert=True)

        await db.funding_items.update_one({"id": f"evtfund-{eid}-organizer"}, {"$set": dict(
            id=f"evtfund-{eid}-organizer", event_id=eid, source="Organizer Budget",
            label="Anggaran penyelenggara", amount=int(budget * 0.55), state="committed",
            source_type="brief", created_at=SEED_TIMESTAMP)}, upsert=True)
        await db.funding_items.update_one({"id": f"evtfund-{eid}-sponsor"}, {"$set": dict(
            id=f"evtfund-{eid}-sponsor", event_id=eid, source="Sponsor Commitments",
            label="Main Sponsor terkonfirmasi", amount=int(sponsor_base * 0.45), state="committed",
            source_type="sponsor", created_at=SEED_TIMESTAMP)}, upsert=True)

        for ri, (r, sev, mit) in enumerate([(f"Perizinan {city} belum final", "Medium", "Ajukan izin H-45"),
                                            ("Funding gap belum tertutup", "High",
                                             "Percepat closing sponsor & tenant")]):
            risk_id = f"evtrisk-{eid}-{ri+1}"
            await db.risks.update_one({"id": risk_id}, {"$set": dict(
                id=risk_id, event_id=eid, risk=r, severity=sev, mitigation=mit, status="Open",
                created_at=SEED_TIMESTAMP)}, upsert=True)

    # Event utama dibuat oleh seed_data, tetapi foto Discover-nya tetap dikelola
    # bersama katalog agar database lama ikut menerima asset Indonesia terbaru.
    await db.events.update_one(
        {"id": "evt-aruna-2026"},
        {"$set": {"hero_image": discover_image("evt-aruna-2026")}},
    )
    return {"events": len(specs), "venues": len(EXTRA_VENUES) + len(BULK_VENUES),
            "promoters": len(PROMOTERS), "talents": len(CATALOG_TALENTS)}
