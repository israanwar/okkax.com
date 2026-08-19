"""OKKAX Admission & Dynamic Ticketing Engine.

Comprehensive admission models, extensive data-driven tier templates catalog (70+ templates),
canonical tiered public fee policy engine, atomic inventory protection, and credential state machine.
"""

from typing import Dict, Any, List, Optional
import copy

# -----------------------------------------------------------------------------
# 1. Admission & Pricing Constants
# -----------------------------------------------------------------------------
ADMISSION_TYPES = {
    "open_access": "Akses terbuka tanpa tiket atau registrasi wajib",
    "registration": "Registrasi pengunjung / RSVP tanpa biaya tiket",
    "ticketed": "Tiket berbayar atau bernomor dengan validasi QR",
    "invitation_only": "Khusus tamu undangan / private guest list",
    "accreditation": "Akreditasi resmi media, kru, atlet, atau delegasi",
    "mixed": "Kombinasi free admission & berbayar / multi-tier",
}

PRICING_TYPES = {
    "free": "Gratis Rp0",
    "paid": "Berbayar dengan harga tetap",
    "donation": "Donasi sukarela / Pay What You Want",
    "mixed": "Campuran tier gratis dan berbayar",
}

CREDENTIAL_TYPES = {
    "ticket": "Tiket Masuk Reguler/VIP",
    "registration_pass": "Pass Registrasi Pengunjung",
    "invitation_pass": "Pass Tamu Undangan (VVIP/VIP/Family)",
    "accreditation_pass": "Pass Akreditasi (Media/Crew/Staff/Vendor)",
    "complimentary_pass": "Pass Gratis Partner / Sponsor",
}

# -----------------------------------------------------------------------------
# 2. Canonical Extensible Default Tier Templates Catalog (75+ Templates)
# -----------------------------------------------------------------------------
DEFAULT_TIER_TEMPLATES: List[Dict[str, Any]] = [
    # ==========================================
    # 1. MUSIK / KONSER / FESTIVAL (8 templates)
    # ==========================================
    {
        "id": "tpl-mus-free-adm",
        "name": "Free Admission",
        "category": "Musik / Konser / Festival",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 500,
        "description": "Akses masuk gratis tanpa biaya untuk area festival umum",
        "benefits": ["Akses Festival Area", "Food & Beverage Zone"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable (Gratis)",
        "is_default": True,
    },
    {
        "id": "tpl-mus-early-bird",
        "name": "Early Bird",
        "category": "Musik / Konser / Festival",
        "ticket_type": "Early Bird",
        "pricing_type": "paid",
        "default_price": 150000,
        "default_quantity": 300,
        "description": "Tiket promo kuota terbatas untuk pembeli awal",
        "benefits": ["Akses Main Stage", "Free Festival Wristband"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-mus-presale-1",
        "name": "Presale 1",
        "category": "Musik / Konser / Festival",
        "ticket_type": "Presale",
        "pricing_type": "paid",
        "default_price": 200000,
        "default_quantity": 500,
        "description": "Tiket periode penjualan presale fase 1",
        "benefits": ["Akses Main Stage Area", "Jalur Masuk Khusus Presale"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-mus-presale-2",
        "name": "Presale 2",
        "category": "Musik / Konser / Festival",
        "ticket_type": "Presale",
        "pricing_type": "paid",
        "default_price": 250000,
        "default_quantity": 600,
        "description": "Tiket periode penjualan presale fase 2",
        "benefits": ["Akses Main Stage Area"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-mus-regular",
        "name": "Regular General Admission",
        "category": "Musik / Konser / Festival",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 350000,
        "default_quantity": 1000,
        "description": "Tiket tarif normal akses umum ke seluruh panggung",
        "benefits": ["Akses Seluruh Area Publik", "Food Court & Merchandise"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund 50% hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-mus-festival-pass",
        "name": "Festival 2-Day Pass",
        "category": "Musik / Konser / Festival",
        "ticket_type": "Multi-Day",
        "pricing_type": "paid",
        "default_price": 550000,
        "default_quantity": 400,
        "description": "Pass terusan lengkap untuk seluruh hari festival",
        "benefits": ["Akses 2 Hari Penuh", "Merchandise Pack", "Re-entry Allowed"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-mus-vip",
        "name": "VIP Standing & Lounge",
        "category": "Musik / Konser / Festival",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 750000,
        "default_quantity": 250,
        "description": "Area eksklusif depan panggung dengan fasilitas lounge khusus",
        "benefits": ["Front Row View", "AC Lounge & Bar", "Exclusive Fast Track", "Complimentary Drink"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-mus-vvip",
        "name": "VVIP Backstage & Hospitality",
        "category": "Musik / Konser / Festival",
        "ticket_type": "VVIP",
        "pricing_type": "paid",
        "default_price": 1500000,
        "default_quantity": 50,
        "description": "Pengalaman premium tertinggi dengan akses hospitality dan artis",
        "benefits": ["Backstage Tour", "Artist Meet & Greet", "VIP Parking Pass", "Gourmet Catering", "Official Merch Pack"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 2. KONFERENSI / SEMINAR / SUMMIT (7 templates)
    # ==========================================
    {
        "id": "tpl-conf-free-reg",
        "name": "Free Registration",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 300,
        "description": "Registrasi bebas biaya akses panggung umum dan area pameran",
        "benefits": ["Akses Plenary Session", "E-Certificate"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-conf-delegate-early",
        "name": "Early Bird Delegate",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "Early Bird",
        "pricing_type": "paid",
        "default_price": 450000,
        "default_quantity": 200,
        "description": "Tiket delegasi profesional dengan potongan harga awal",
        "benefits": ["Akses Seluruh Sesi", "Lunch & Networking Coffee", "Materi Presentasi", "Sertifikat Cetak"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-conf-delegate-reg",
        "name": "Standard Professional Delegate",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 750000,
        "default_quantity": 500,
        "description": "Tiket partisipasi lengkap untuk profesional dan korporat",
        "benefits": ["Akses 2 Hari Konferensi", "Networking Dinner", "Conference Kit", "CPD/CPE Credit"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-conf-student",
        "name": "Student / Academic Pass",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "Student",
        "pricing_type": "paid",
        "default_price": 150000,
        "default_quantity": 150,
        "description": "Tiket subsidi khusus mahasiswa, peneliti, dan dosen",
        "benefits": ["Akses Sesi Ilmiah", "E-Certificate & E-Booklet"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-conf-vip-exec",
        "name": "VIP Executive Pass",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 2500000,
        "default_quantity": 50,
        "description": "Tiket pimpinan puncak dengan akses eksklusif VIP Lounge & Speaker Dinner",
        "benefits": ["Private Speaker Lounge", "Exclusive Round-Table Access", "1-on-1 Business Matching", "Reserved Front Row"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-conf-workshop",
        "name": "Workshop Masterclass Add-on",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "Workshop",
        "pricing_type": "paid",
        "default_price": 350000,
        "default_quantity": 80,
        "description": "Sesi praktis hands-on berdurasi 3 jam bersama instruktur industri",
        "benefits": ["Hands-on Project Lab", "Direct Mentor Feedback", "Specialized Certificate"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-conf-speaker",
        "name": "Speaker & Panelist Pass",
        "category": "Konferensi / Seminar / Summit",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 40,
        "description": "Pass kehormatan resmi untuk pembicara dan moderator",
        "benefits": ["All-Access VIP", "Green Room Access", "Complimentary Hospitality"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 3. EXPO / PAMERAN / TRADE SHOW (6 templates)
    # ==========================================
    {
        "id": "tpl-expo-free-visitor",
        "name": "Free Visitor Pass",
        "category": "Expo / Pameran / Trade Show",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 2000,
        "description": "Akses masuk pameran gratis untuk masyarakat umum",
        "benefits": ["Akses Exhibition Hall", "Katalog Digital"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-expo-biz-buyer",
        "name": "Trade Buyer & Business Pass",
        "category": "Expo / Pameran / Trade Show",
        "ticket_type": "Business",
        "pricing_type": "paid",
        "default_price": 150000,
        "default_quantity": 500,
        "description": "Akses hari khusus B2B, lounge negosiasi, dan matchmaking",
        "benefits": ["B2B Trade Day Access", "Business Matching Lounge", "Official Exhibitor Directory"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-expo-multiday-badge",
        "name": "3-Day Trade Show Badge",
        "category": "Expo / Pameran / Trade Show",
        "ticket_type": "Multi-Day",
        "pricing_type": "paid",
        "default_price": 275000,
        "default_quantity": 300,
        "description": "Badge fisik multi-hari untuk seluruh jadwal pameran",
        "benefits": ["Akses 3 Hari Pameran", "Fast-Track Entry Gate", "Exhibitor Directory Guide"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Refund hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-expo-vip-buyer",
        "name": "VIP Hosted Buyer Program",
        "category": "Expo / Pameran / Trade Show",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 850000,
        "default_quantity": 80,
        "description": "Program pembeli korporat terakreditasi dengan fasilitas VIP",
        "benefits": ["Dedicated Meeting Room", "Complimentary Lounge & Lunch", "Guaranteed B2B Meetings"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-expo-exhibitor",
        "name": "Exhibitor Booth Crew Pass",
        "category": "Expo / Pameran / Trade Show",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 200,
        "description": "Pass resmi staf penjaga booth tenant dan peserta pameran",
        "benefits": ["Loading Dock Access", "Early Hall Entry", "Staff Lounge"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-expo-contractor",
        "name": "Official Contractor & Build-up Pass",
        "category": "Expo / Pameran / Trade Show",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 100,
        "description": "Pass kontraktor booth saat periode loading in dan loading out",
        "benefits": ["Loading Zone Access", "Safety Briefing Required"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 4. OLAHRAGA / TURNAMEN / ESPORTS (6 templates)
    # ==========================================
    {
        "id": "tpl-spt-tribune",
        "name": "Tribune Category 1",
        "category": "Olahraga / Turnamen / Esports",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 120000,
        "default_quantity": 1500,
        "description": "Tempat duduk tribun dengan sudut pandang tengah lapangan",
        "benefits": ["Numbered Seat", "Full Match Visibility"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-spt-tribune-cat2",
        "name": "Tribune Category 2",
        "category": "Olahraga / Turnamen / Esports",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 80000,
        "default_quantity": 2000,
        "description": "Tempat duduk tribun sayap utara/selatan",
        "benefits": ["Numbered Seat Area"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-spt-vip-hospitality",
        "name": "VIP Royal Box & Hospitality",
        "category": "Olahraga / Turnamen / Esports",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 950000,
        "default_quantity": 100,
        "description": "Tribun utama ber-AC dengan hidangan makanan dan minuman",
        "benefits": ["Padded Luxury Seat", "Buffet Hospitality", "VIP Parking", "Program Book"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-spt-race-pass",
        "name": "3-Day Race Weekend Pass",
        "category": "Olahraga / Turnamen / Esports",
        "ticket_type": "Multi-Day",
        "pricing_type": "paid",
        "default_price": 1200000,
        "default_quantity": 350,
        "description": "Pass 3 hari babak latihan, kualifikasi, dan final",
        "benefits": ["Akses 3 Hari Penuh", "Pit Walk Session", "Official Event Cap"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-spt-athlete",
        "name": "Athlete & Official Accreditation",
        "category": "Olahraga / Turnamen / Esports",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 150,
        "description": "Pass atlet tanding, pelatih, tim medis, dan official pertandingan",
        "benefits": ["Field of Play Access", "Locker Room Access", "Athlete Dining Hall"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-spt-esports-fan",
        "name": "Esports Stage Fan Zone",
        "category": "Olahraga / Turnamen / Esports",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 75000,
        "default_quantity": 800,
        "description": "Area standing dekat layar panggung turnamen gaming",
        "benefits": ["Fan Clapper", "In-game Skin Redemption Code"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 5. BAZAAR / KULINER / FESTIVAL (5 templates)
    # ==========================================
    {
        "id": "tpl-baz-open-access",
        "name": "Open Access Pasar Komunitas",
        "category": "Bazaar / Kuliner / Festival",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 3000,
        "description": "Masuk bebas untuk menikmati bazaar kuliner dan stan UMKM",
        "benefits": ["Akses Terbuka Seluruh Tenant", "Live Cooking Stage"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-baz-tasting-passport",
        "name": "Food Tasting Passport",
        "category": "Bazaar / Kuliner / Festival",
        "ticket_type": "Package",
        "pricing_type": "paid",
        "default_price": 125000,
        "default_quantity": 500,
        "description": "Paket kupon mencicipi hidangan di 8 stan pilihan terbaik",
        "benefits": ["8x Food Tasting Voucher", "Exclusive Tote Bag", "Voting Rights Favorite Tenant"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund hingga H-3",
        "is_default": True,
    },
    {
        "id": "tpl-baz-vip-dine",
        "name": "Chef Table VIP Dining",
        "category": "Bazaar / Kuliner / Festival",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 450000,
        "default_quantity": 40,
        "description": "Sesi jamuan 5-course eksklusif dipandu Chef tamu",
        "benefits": ["5-Course Tasting Menu", "Wine Pairing", "Chef Q&A Session"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-baz-tenant-pass",
        "name": "Tenant Food Vendor Pass",
        "category": "Bazaar / Kuliner / Festival",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 150,
        "description": "Pass kru booth kuliner dan operasional dapur tenant",
        "benefits": ["Loading Dock Kitchen Access", "Waste Management Station"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-baz-early-entry",
        "name": "Early Shopper Golden Hour",
        "category": "Bazaar / Kuliner / Festival",
        "ticket_type": "Special Access",
        "pricing_type": "paid",
        "default_price": 35000,
        "default_quantity": 300,
        "description": "Masuk 1 jam lebih awal sebelum dibuka untuk umum",
        "benefits": ["First Pick Merchandise", "Free Shopping Bag", "No Queue Gate"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 6. BISNIS / NETWORKING / CORPORATE (5 templates)
    # ==========================================
    {
        "id": "tpl-biz-free-rsvp",
        "name": "Free Corporate RSVP",
        "category": "Bisnis / Networking / Corporate",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 100,
        "description": "Konfirmasi kehadiran sesi networking & product launch",
        "benefits": ["Cocktail Reception", "Directory Matchmaking"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-biz-founder-pass",
        "name": "Startup Founder Pass",
        "category": "Bisnis / Networking / Corporate",
        "ticket_type": "Business",
        "pricing_type": "paid",
        "default_price": 350000,
        "default_quantity": 150,
        "description": "Tiket khusus founder dengan akses pitching session",
        "benefits": ["Investor Speed Dating", "Pitch Stage Slot", "Co-working Lounge Access"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-biz-investor-pass",
        "name": "Accredited Investor Pass",
        "category": "Bisnis / Networking / Corporate",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 1250000,
        "default_quantity": 50,
        "description": "Pass pemodal ventura, angel investor, dan family office",
        "benefits": ["Curated Deal Flow Directory", "Private Investor Lounge", "VIP Dinner"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-biz-table",
        "name": "Corporate Reserved Table (8 Seats)",
        "category": "Bisnis / Networking / Corporate",
        "ticket_type": "Corporate Table",
        "pricing_type": "paid",
        "default_price": 8000000,
        "default_quantity": 15,
        "description": "Meja khusus 8 orang untuk jamuan makan malam bisnis korporat",
        "benefits": ["8x Gala Dinner Seat", "Logo Prominence on Table", "Dedicated Service Staff", "2x Wine Bottle"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-biz-sponsor-pass",
        "name": "Corporate Partner Representative",
        "category": "Bisnis / Networking / Corporate",
        "ticket_type": "Complimentary",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 30,
        "description": "Pass complimentary perwakilan brand sponsor resmi",
        "benefits": ["All-Access Pass", "VIP Banquet Table", "Keynote Recognition"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 7. PRIVATE / GALA / AWARDS (5 templates)
    # ==========================================
    {
        "id": "tpl-pvt-invitation",
        "name": "Exclusive Guest Invitation",
        "category": "Private / Gala / Awards",
        "ticket_type": "Invitation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 250,
        "description": "Undangan privat non-komersial khusus tamu terdaftar",
        "benefits": ["Akses Acara Resepsi", "Souvenir Voucher", "Seat Assignment"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-pvt-gala-seat",
        "name": "Charity Gala Individual Seat",
        "category": "Private / Gala / Awards",
        "ticket_type": "Gala Seat",
        "pricing_type": "paid",
        "default_price": 1750000,
        "default_quantity": 120,
        "description": "Tiket jamuan amal malam penghargaan",
        "benefits": ["4-Course Fine Dining", "Live Orchestra", "Charity Auction Participation"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-pvt-nominee-pass",
        "name": "Award Nominee VIP Guest",
        "category": "Private / Gala / Awards",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 40,
        "description": "Pass undangan khusus nominasi peraih penghargaan",
        "benefits": ["Red Carpet Photo Session", "Front Row Seat", "Media Interview Slot"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-pvt-patron-table",
        "name": "Patron Sponsor Table (10 Pax)",
        "category": "Private / Gala / Awards",
        "ticket_type": "VIP Table",
        "pricing_type": "paid",
        "default_price": 15000000,
        "default_quantity": 10,
        "description": "Meja patron kehormatan dengan menu premium champagne",
        "benefits": ["10x Gala Dinner Seat", "2x Premium Champagne", "Program Book Full-page Recognition"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-pvt-family-rsvp",
        "name": "Family & VVIP Private RSVP",
        "category": "Private / Gala / Awards",
        "ticket_type": "Invitation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 50,
        "description": "Undangan khusus keluarga inti dan tamu VVIP",
        "benefits": ["VVIP Holding Room", "Reserved Priority Table", "Private Valet"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 8. EDUKASI / PELATIHAN / WORKSHOP (5 templates)
    # ==========================================
    {
        "id": "tpl-edu-free-intro",
        "name": "Free Webinar / Intro Session",
        "category": "Edukasi / Pelatihan / Workshop",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 500,
        "description": "Sesi pengenalan materi dan overview gratis",
        "benefits": ["Live Stream Access", "Presentation Slides"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-edu-single-workshop",
        "name": "1-Day Skill Workshop",
        "category": "Edukasi / Pelatihan / Workshop",
        "ticket_type": "Workshop",
        "pricing_type": "paid",
        "default_price": 275000,
        "default_quantity": 100,
        "description": "Pelatihan intensif 1 hari dengan studi kasus nyata",
        "benefits": ["Workshop Toolkit", "E-Certificate", "Coffee Break & Lunch"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-edu-bootcamp",
        "name": "Full Bootcamp Certification",
        "category": "Edukasi / Pelatihan / Workshop",
        "ticket_type": "Full Program",
        "pricing_type": "paid",
        "default_price": 1200000,
        "default_quantity": 60,
        "description": "Program pelatihan intensif 3 hari bersertifikasi kompetensi",
        "benefits": ["3-Day Intensive Classes", "Capstone Project Review", "National Accreditation Certificate"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund 80% hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-edu-group-pass",
        "name": "Group Registration (3+ Participants)",
        "category": "Edukasi / Pelatihan / Workshop",
        "ticket_type": "Group",
        "pricing_type": "paid",
        "default_price": 750000,
        "default_quantity": 40,
        "description": "Harga bundling hemat untuk pendaftaran rombongan 3 orang",
        "benefits": ["3x Full Training Access", "Group Project Mentoring", "3x Certificates"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-edu-instructor",
        "name": "Mentor & Teaching Assistant",
        "category": "Edukasi / Pelatihan / Workshop",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 20,
        "description": "Pass instruktur kelas, asisten lab, dan mentor pendamping",
        "benefits": ["Mentor Desk Access", "Lab Admin Rights", "Teaching Honorarium Payout"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 9. PEMERINTAH / PROTOKOLER / BUMN (5 templates)
    # ==========================================
    {
        "id": "tpl-gov-delegate",
        "name": "Official Government Delegate",
        "category": "Pemerintah / Protokoler / BUMN",
        "ticket_type": "Official",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 100,
        "description": "Pass resmi delegasi kementerian, dinas, dan pemda",
        "benefits": ["VIP Protocol Line", "Official Transcripts", "VIP Transit Area"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-gov-public-pass",
        "name": "Public Citizen Attendance Pass",
        "category": "Pemerintah / Protokoler / BUMN",
        "ticket_type": "Public Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 1000,
        "description": "Akses warga masyarakat menghadiri sosialisasi dan pesta rakyat",
        "benefits": ["General Seating", "Public Information Kit"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-gov-bumn-rep",
        "name": "BUMN Corporate Representative",
        "category": "Pemerintah / Protokoler / BUMN",
        "ticket_type": "Corporate Official",
        "pricing_type": "paid",
        "default_price": 500000,
        "default_quantity": 200,
        "description": "Delegasi BUMN dan BUMD untuk forum sinergi nasional",
        "benefits": ["Plenary Seat", "Materi Forum", "Networking Luncheon"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-gov-security-protocol",
        "name": "Paspampres & Security Escort",
        "category": "Pemerintah / Protokoler / BUMN",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 50,
        "description": "Pass pengamanan protokoler VVIP RI-1/RI-2 dan pejabat tinggi",
        "benefits": ["All Perimeter Access", "Command Post Comms"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-gov-press-official",
        "name": "Government Public Relations / Media",
        "category": "Pemerintah / Protokoler / BUMN",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 40,
        "description": "Pass peliputan humas kementerian dan tim dokumentasi resmi",
        "benefits": ["Press Room Access", "Official Audio Feed"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 10. SENI / TEATER / BUDAYA (5 templates)
    # ==========================================
    {
        "id": "tpl-art-balcony",
        "name": "Balcony Seating",
        "category": "Seni / Teater / Budaya",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 100000,
        "default_quantity": 300,
        "description": "Tempat duduk lantai balkon atas dengan akustik jernih",
        "benefits": ["Numbered Theater Seat", "Show Playbill"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-art-stalls",
        "name": "Center Stalls (Auditorium)",
        "category": "Seni / Teater / Budaya",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 250000,
        "default_quantity": 400,
        "description": "Kursi utama tengah panggung pertunjukan teater",
        "benefits": ["Prime Visual Angle", "Show Playbill Book"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-art-vip-box",
        "name": "VIP Royal Theater Box",
        "category": "Seni / Teater / Budaya",
        "ticket_type": "VIP",
        "pricing_type": "paid",
        "default_price": 600000,
        "default_quantity": 30,
        "description": "Bilik privat VIP dengan jamuan pre-show cocktail",
        "benefits": ["Private Box (4 Seats)", "Pre-Show Drinks", "Meet Cast Backstage"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-14",
        "is_default": True,
    },
    {
        "id": "tpl-art-patron-donor",
        "name": "Arts Patron & Donor Pass",
        "category": "Seni / Teater / Budaya",
        "ticket_type": "Patron",
        "pricing_type": "paid",
        "default_price": 1500000,
        "default_quantity": 20,
        "description": "Tiket donasi pendukung seni budaya dengan apresiasi khusus",
        "benefits": ["Front Row Reserved", "Name in Program Book", "Annual Foundation Membership"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-art-cast-crew",
        "name": "Cast, Crew & Production Pass",
        "category": "Seni / Teater / Budaya",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 60,
        "description": "Pass pemain teater, pemusik, kru panggung, dan penata rias",
        "benefits": ["Dressing Room Access", "Stage Wing Entry"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 11. ONLINE / WEBINAR / HYBRID (5 templates)
    # ==========================================
    {
        "id": "tpl-onl-free-stream",
        "name": "Free Public Live Stream",
        "category": "Online / Webinar / Hybrid",
        "ticket_type": "Virtual Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 10000,
        "description": "Siaran langsung gratis resolusi standar 720p",
        "benefits": ["720p Live Stream", "Public Live Chat"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-onl-livestream",
        "name": "Live Streaming Full HD (1080p)",
        "category": "Online / Webinar / Hybrid",
        "ticket_type": "Virtual Paid",
        "pricing_type": "paid",
        "default_price": 50000,
        "default_quantity": 5000,
        "description": "Akses siaran langsung berkualitas 1080p dengan fitur interaktif",
        "benefits": ["1080p HD Live Stream", "Interactive Live Q&A", "7-Day Video Replay/VOD"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Refund sebelum siaran dimulai",
        "is_default": True,
    },
    {
        "id": "tpl-onl-hybrid-pass",
        "name": "Hybrid Delegate All-Access",
        "category": "Online / Webinar / Hybrid",
        "ticket_type": "Hybrid",
        "pricing_type": "paid",
        "default_price": 200000,
        "default_quantity": 1000,
        "description": "Akses siaran multi-camera, breakout room, dan networking virtual",
        "benefits": ["Multi-Camera 4K Feed", "Virtual Breakout Session", "Digital Networking Lounge", "Lifetime VOD Access"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-1",
        "is_default": True,
    },
    {
        "id": "tpl-onl-interactive-vip",
        "name": "VIP Backstage Virtual Meet",
        "category": "Online / Webinar / Hybrid",
        "ticket_type": "Virtual VIP",
        "pricing_type": "paid",
        "default_price": 450000,
        "default_quantity": 50,
        "description": "Sesi video call interaktif 2 arah langsung bersama bintang tamu",
        "benefits": ["2-Way Zoom Green Room", "1-on-1 Digital Photo", "Exclusive Digital Souvenir"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Refund hingga H-3",
        "is_default": True,
    },
    {
        "id": "tpl-onl-broadcast-crew",
        "name": "Broadcast & Streaming Engineer",
        "category": "Online / Webinar / Hybrid",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 15,
        "description": "Pass teknisi streaming, operator OBS/vMix, dan audio engineer",
        "benefits": ["Streaming Control Room Access", "Server RTMP Keys"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 12. KOMUNITAS / FAN MEETUP / ESPORTS (5 templates)
    # ==========================================
    {
        "id": "tpl-com-free-meetup",
        "name": "Free Community Gathering",
        "category": "Komunitas / Fan Meetup / E-Sports",
        "ticket_type": "Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 200,
        "description": "Kumpul bulanan komunitas pecinta hobi dan diskusi santai",
        "benefits": ["Community Space Access", "Sticker Pack"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-com-fan-tier",
        "name": "Fan Meet & Greet Ticket",
        "category": "Komunitas / Fan Meetup / E-Sports",
        "ticket_type": "Special Access",
        "pricing_type": "paid",
        "default_price": 180000,
        "default_quantity": 100,
        "description": "Sesi tatap muka dan foto bersama kreator / idola",
        "benefits": ["Group Photo Session", "Signed Poster", "Early Entry"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-com-tourney-slot",
        "name": "Tournament Team Slot (5 Players)",
        "category": "Komunitas / Fan Meetup / E-Sports",
        "ticket_type": "Team Registration",
        "pricing_type": "paid",
        "default_price": 250000,
        "default_quantity": 32,
        "description": "Slot pendaftaran 1 tim turnamen esport (5 pemain + 1 cadangan)",
        "benefits": ["Tournament Bracket Entry", "5x Player Badges", "Cash Prize Pool Eligibility"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-com-cosplay-pass",
        "name": "Cosplayer Changing Room Pass",
        "category": "Komunitas / Fan Meetup / E-Sports",
        "ticket_type": "Special Access",
        "pricing_type": "paid",
        "default_price": 40000,
        "default_quantity": 150,
        "description": "Fasilitas ruang ganti ber-AC dan penitipan properti kostum",
        "benefits": ["Cosplay Dressing Room", "Luggage Storage", "Makeup Mirror"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-com-marshal-pass",
        "name": "Community Marshal & Volunteer",
        "category": "Komunitas / Fan Meetup / E-Sports",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 40,
        "description": "Pass relawan pengatur kerumunan dan panitia komunitas",
        "benefits": ["Marshal Vest", "Meal Box Voucher", "Volunteer Certificate"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 13. WISATA / REKREASI / ATRAKSI (5 templates)
    # ==========================================
    {
        "id": "tpl-wis-general-entry",
        "name": "General Day Entry",
        "category": "Wisata / Rekreasi / Atraksi",
        "ticket_type": "Regular",
        "pricing_type": "paid",
        "default_price": 65000,
        "default_quantity": 1200,
        "description": "Tiket masuk area rekreasi dan wahana taman terbuka",
        "benefits": ["All-Day Park Access", "Map Guide"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund 100% sebelum tanggal kunjungan",
        "is_default": True,
    },
    {
        "id": "tpl-wis-all-inclusive",
        "name": "All-Inclusive Rides Pass",
        "category": "Wisata / Rekreasi / Atraksi",
        "ticket_type": "Package",
        "pricing_type": "paid",
        "default_price": 175000,
        "default_quantity": 500,
        "description": "Tiket terusan bebas mencoba seluruh wahana permainan",
        "benefits": ["Unlimited Rides Access", "Free Soft Drink", "Fast Track Queue"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-1",
        "is_default": True,
    },
    {
        "id": "tpl-wis-family-bundle",
        "name": "Family Fun Pack (4 Pax)",
        "category": "Wisata / Rekreasi / Atraksi",
        "ticket_type": "Family",
        "pricing_type": "paid",
        "default_price": 220000,
        "default_quantity": 250,
        "description": "Paket hemat masuk keluarga untuk 2 dewasa dan 2 anak",
        "benefits": ["4x General Admission", "1x Snack Voucher Rp50.000"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-1",
        "is_default": True,
    },
    {
        "id": "tpl-wis-annual-pass",
        "name": "365-Day Unlimited Annual Pass",
        "category": "Wisata / Rekreasi / Atraksi",
        "ticket_type": "Membership",
        "pricing_type": "paid",
        "default_price": 650000,
        "default_quantity": 100,
        "description": "Kartu anggota tahunan bebas masuk setiap hari selama 1 tahun",
        "benefits": ["365 Days Free Entry", "10% F&B Discount", "Free Parking Voucher"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-wis-guide-pass",
        "name": "Tour Guide & Driver Pass",
        "category": "Wisata / Rekreasi / Atraksi",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 80,
        "description": "Pass resmi pemandu wisata dan pengemudi bus rombongan",
        "benefits": ["Driver Rest Lounge", "Free Mineral Water"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },

    # ==========================================
    # 14. CORPORATE GATHERING / TOWNHALL (5 templates)
    # ==========================================
    {
        "id": "tpl-corp-employee-badge",
        "name": "Employee All-Staff Badge",
        "category": "Corporate Gathering / Outing & Townhall",
        "ticket_type": "Internal Free",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 600,
        "description": "Pass kehadiran wajib seluruh karyawan internal perusahaan",
        "benefits": ["Gathering Kit & T-Shirt", "Door Prize Raffle Number", "Buffet Lunch"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-corp-executive-bod",
        "name": "Board of Directors & Management",
        "category": "Corporate Gathering / Outing & Townhall",
        "ticket_type": "Internal VIP",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 25,
        "description": "Pass pimpinan direksi, komisaris, dan kepala divisi",
        "benefits": ["VIP Round Table", "Keynote Microphone Access", "Dedicated Escort"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-corp-family-addon",
        "name": "Employee Spouse & Child Add-on",
        "category": "Corporate Gathering / Outing & Townhall",
        "ticket_type": "Family Add-on",
        "pricing_type": "paid",
        "default_price": 100000,
        "default_quantity": 300,
        "description": "Tiket partisipasi keluarga karyawan untuk konsumsi & souvenir",
        "benefits": ["Kids Activity Zone", "Family Meal Voucher", "Souvenir Bag"],
        "transfer_rule": "Dapat dipindahtangankan",
        "refund_rule": "Refund penuh hingga H-7",
        "is_default": True,
    },
    {
        "id": "tpl-corp-eo-crew",
        "name": "Event Organizer Production Crew",
        "category": "Corporate Gathering / Outing & Townhall",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 50,
        "description": "Pass staf EO pelaksana, show director, dan tim teknis panggung",
        "benefits": ["Production Control Room Access", "Radio Comms Channel"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
    {
        "id": "tpl-corp-vendor-catering",
        "name": "Catering & Banquet Staff",
        "category": "Corporate Gathering / Outing & Townhall",
        "ticket_type": "Accreditation",
        "pricing_type": "free",
        "default_price": 0,
        "default_quantity": 40,
        "description": "Pass kru katering, waiter, dan tim kebersihan venue",
        "benefits": ["Kitchen Service Entrance", "Staff Meal"],
        "transfer_rule": "Tidak dapat dipindahtangankan",
        "refund_rule": "Non-refundable",
        "is_default": True,
    },
]

# -----------------------------------------------------------------------------
# 3. Category Template Mappings (Canonical Taxonomy)
# -----------------------------------------------------------------------------
CATEGORY_SUGGESTIONS: Dict[str, List[str]] = {
    "konser": ["tpl-mus-early-bird", "tpl-mus-presale-1", "tpl-mus-regular", "tpl-mus-vip", "tpl-mus-vvip"],
    "festival musik": ["tpl-mus-early-bird", "tpl-mus-presale-1", "tpl-mus-presale-2", "tpl-mus-regular", "tpl-mus-festival-pass", "tpl-mus-vip"],
    "festival": ["tpl-mus-free-adm", "tpl-mus-regular", "tpl-mus-festival-pass", "tpl-mus-vip"],
    "musik": ["tpl-mus-early-bird", "tpl-mus-presale-1", "tpl-mus-regular", "tpl-mus-vip", "tpl-mus-vvip"],
    "konferensi": ["tpl-conf-free-reg", "tpl-conf-delegate-early", "tpl-conf-delegate-reg", "tpl-conf-vip-exec", "tpl-conf-workshop"],
    "seminar": ["tpl-conf-free-reg", "tpl-conf-delegate-reg", "tpl-conf-student", "tpl-conf-speaker"],
    "summit": ["tpl-conf-delegate-early", "tpl-conf-delegate-reg", "tpl-conf-vip-exec", "tpl-conf-speaker"],
    "expo": ["tpl-expo-free-visitor", "tpl-expo-biz-buyer", "tpl-expo-multiday-badge", "tpl-expo-vip-buyer", "tpl-expo-exhibitor"],
    "pameran": ["tpl-expo-free-visitor", "tpl-expo-biz-buyer", "tpl-expo-multiday-badge", "tpl-expo-exhibitor"],
    "trade show": ["tpl-expo-biz-buyer", "tpl-expo-multiday-badge", "tpl-expo-vip-buyer", "tpl-expo-exhibitor"],
    "esports": ["tpl-spt-tribune", "tpl-spt-esports-fan", "tpl-spt-athlete", "tpl-onl-livestream"],
    "olahraga": ["tpl-spt-tribune", "tpl-spt-tribune-cat2", "tpl-spt-vip-hospitality", "tpl-spt-race-pass", "tpl-spt-athlete"],
    "sport": ["tpl-spt-tribune", "tpl-spt-vip-hospitality", "tpl-spt-athlete"],
    "turnamen": ["tpl-spt-tribune", "tpl-spt-athlete", "tpl-com-tourney-slot"],
    "festival kuliner": ["tpl-baz-open-access", "tpl-baz-tasting-passport", "tpl-baz-vip-dine", "tpl-baz-tenant-pass"],
    "kuliner": ["tpl-baz-open-access", "tpl-baz-tasting-passport", "tpl-baz-vip-dine"],
    "bazaar": ["tpl-baz-open-access", "tpl-baz-tasting-passport", "tpl-baz-early-entry", "tpl-baz-tenant-pass"],
    "fashion week": ["tpl-mus-regular", "tpl-mus-vip", "tpl-pvt-invitation"],
    "corporate gathering": ["tpl-corp-employee-badge", "tpl-corp-executive-bod", "tpl-corp-family-addon", "tpl-corp-eo-crew"],
    "townhall": ["tpl-corp-employee-badge", "tpl-corp-executive-bod"],
    "product launch": ["tpl-biz-free-rsvp", "tpl-mus-vip", "tpl-pvt-invitation"],
    "wedding": ["tpl-pvt-invitation", "tpl-pvt-family-rsvp"],
    "gala": ["tpl-pvt-invitation", "tpl-pvt-gala-seat", "tpl-pvt-patron-table"],
    "awards": ["tpl-pvt-invitation", "tpl-pvt-nominee-pass", "tpl-pvt-gala-seat"],
    "workshop": ["tpl-conf-workshop", "tpl-edu-single-workshop", "tpl-edu-bootcamp"],
    "training": ["tpl-edu-single-workshop", "tpl-edu-bootcamp", "tpl-edu-group-pass"],
    "bootcamp": ["tpl-edu-bootcamp", "tpl-edu-instructor"],
    "edukasi": ["tpl-edu-free-intro", "tpl-edu-single-workshop", "tpl-edu-bootcamp"],
    "pemerintah": ["tpl-gov-delegate", "tpl-gov-public-pass", "tpl-gov-bumn-rep", "tpl-gov-security-protocol"],
    "bumn": ["tpl-gov-bumn-rep", "tpl-biz-table"],
    "seni": ["tpl-art-balcony", "tpl-art-stalls", "tpl-art-vip-box", "tpl-art-patron-donor"],
    "teater": ["tpl-art-balcony", "tpl-art-stalls", "tpl-art-vip-box", "tpl-art-cast-crew"],
    "budaya": ["tpl-art-stalls", "tpl-art-patron-donor", "tpl-art-cast-crew"],
    "online": ["tpl-onl-free-stream", "tpl-onl-livestream", "tpl-onl-hybrid-pass", "tpl-onl-interactive-vip"],
    "webinar": ["tpl-onl-free-stream", "tpl-onl-livestream", "tpl-onl-hybrid-pass"],
    "hybrid": ["tpl-onl-hybrid-pass", "tpl-onl-interactive-vip", "tpl-onl-livestream"],
    "komunitas": ["tpl-com-free-meetup", "tpl-com-fan-tier", "tpl-com-tourney-slot", "tpl-com-marshal-pass"],
    "meetup": ["tpl-com-free-meetup", "tpl-com-fan-tier"],
    "wisata": ["tpl-wis-general-entry", "tpl-wis-all-inclusive", "tpl-wis-family-bundle", "tpl-wis-annual-pass", "tpl-wis-guide-pass"],
    "rekreasi": ["tpl-wis-general-entry", "tpl-wis-all-inclusive", "tpl-wis-family-bundle"],
    "atraksi": ["tpl-wis-general-entry", "tpl-wis-all-inclusive"],
}


def get_default_tier_templates(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns copies of canonical default tier templates, optionally filtered by category."""
    if not category:
        return [copy.deepcopy(t) for t in DEFAULT_TIER_TEMPLATES]

    cat_lower = category.lower().strip()
    return [
        copy.deepcopy(t) for t in DEFAULT_TIER_TEMPLATES
        if cat_lower in t["category"].lower() or cat_lower in t["name"].lower()
    ]


def get_suggested_templates(event_type_or_category: Optional[str]) -> List[Dict[str, Any]]:
    """Returns recommended default templates matching event category/type with rich fallback."""
    if not event_type_or_category:
        return [copy.deepcopy(t) for t in DEFAULT_TIER_TEMPLATES[:5]]

    query = event_type_or_category.lower().strip()
    matched_ids = []

    for key, template_ids in CATEGORY_SUGGESTIONS.items():
        if key in query or query in key:
            matched_ids.extend(template_ids)
            break

    if not matched_ids:
        # Fallback: general concert/conference standard mix
        matched_ids = ["tpl-mus-early-bird", "tpl-mus-regular", "tpl-mus-vip", "tpl-conf-free-reg", "tpl-onl-livestream"]

    template_dict = {t["id"]: t for t in DEFAULT_TIER_TEMPLATES}
    return [copy.deepcopy(template_dict[tid]) for tid in matched_ids if tid in template_dict]


# -----------------------------------------------------------------------------
# 4. Canonical Versioned Ticketing Fee Policy Configuration & Pure Domain Calculator
# -----------------------------------------------------------------------------
CANONICAL_TICKETING_FEE_POLICY_KEY = "ticketing.public.default"

DEFAULT_TICKETING_FEE_POLICY_DOC: Dict[str, Any] = {
    "id": "policy-ticketing-public-default",
    "key": CANONICAL_TICKETING_FEE_POLICY_KEY,
    "name": "OKKAX Canonical Public Tiered Fee Policy",
    "version": "2026.1",
    "currency": "IDR",
    "active": True,
    "policy_type": "tiered_public",
    "fee_bearer": "buyer_absorbs",
    "public_tiers": [
        {"max_price": 50000, "rate": 0.0150, "name": "Micro / Community Tier (<= Rp50.000: 1.50%)"},
        {"max_price": 150000, "rate": 0.0125, "name": "Standard / Early Tier (Rp50.001–Rp150.000: 1.25%)"},
        {"max_price": 1000000, "rate": 0.0100, "name": "Mid / Festival Tier (Rp150.001–Rp1.000.000: 1.00%)"},
        {"max_price": None, "rate": 0.0075, "name": "VIP / High Value Tier (> Rp1.000.000: 0.75%)"},
    ],
    "minimum_strategic_fee_rate": 0.0050,  # 0.50% minimum approved floor
    "fixed_fee": 0,
    "min_fee": 0,
    "max_fee": 0,
    "tax_configured": False,
    "tax_rate": None,
    "gateway_fee": {
        "amount": 4000,
        "type": "sandbox_simulated",
    },
    "created_at": "2026-08-13T00:00:00+00:00",
    "updated_at": "2026-08-13T00:00:00+00:00",
}

CANONICAL_FEE_POLICY_CONFIG = DEFAULT_TICKETING_FEE_POLICY_DOC
MINIMUM_STRATEGIC_FEE_RATE = DEFAULT_TICKETING_FEE_POLICY_DOC["minimum_strategic_fee_rate"]


async def get_active_ticketing_fee_policy(database=None) -> Dict[str, Any]:
    """Fetch active canonical ticketing fee policy from db.platform_policies with safe deterministic fallback."""
    if database is not None:
        try:
            doc = await database.platform_policies.find_one(
                {"key": CANONICAL_TICKETING_FEE_POLICY_KEY, "active": True},
                {"_id": 0}
            )
            if doc and isinstance(doc, dict) and "public_tiers" in doc:
                return doc
        except Exception:
            pass
    return copy.deepcopy(DEFAULT_TICKETING_FEE_POLICY_DOC)


def get_canonical_public_fee_rate(
    single_ticket_price: int,
    policy: Optional[Dict[str, Any]] = None,
) -> float:
    """Returns canonical public platform fee rate evaluated against canonical policy configuration."""
    cfg = policy or DEFAULT_TICKETING_FEE_POLICY_DOC
    tiers = cfg.get("public_tiers", DEFAULT_TICKETING_FEE_POLICY_DOC["public_tiers"])
    for tier in tiers:
        max_p = tier.get("max_price")
        if max_p is None or single_ticket_price <= max_p:
            return float(tier["rate"])
    return 0.0075


DEFAULT_FEE_POLICY = DEFAULT_TICKETING_FEE_POLICY_DOC


def calculate_ticketing_fees(
    price: int,
    quantity: int,
    policy: Optional[Dict[str, Any]] = None,
    custom_policy: Optional[Dict[str, Any]] = None,
    fee_bearer_override: Optional[str] = None,
) -> Dict[str, Any]:
    """Server-authoritative calculation of ticketing totals, fees, taxes, and net organizer payout.

    Rules:
    1. Zero price / free events (registration, invitation, accreditation, open access):
       platform_fee = Rp0, tax = Rp0, gateway_fee = Rp0, total = Rp0.
    2. Paid tickets:
       Calculates rate based on canonical single ticket tiered pricing or approved strategic negotiated policy.
       Any negotiated rate < 0.50% is strictly rejected.
    3. Tax Engine:
       Tax is NOT hardcoded. If tax policy is not explicitly configured, tax = Rp0 with metadata 'not_configured'.
    4. Payment Gateway Fee:
       Separated from OKKAX platform revenue and marked as 'sandbox_simulated'.
    5. Integer IDR Money Math:
       Uses exact integer rounding: int(round(gross * rate)).
    """
    base_policy = copy.deepcopy(policy or DEFAULT_TICKETING_FEE_POLICY_DOC)
    effective_policy = {**base_policy, **(custom_policy or {})}
    bearer = fee_bearer_override or effective_policy.get("fee_bearer", "buyer_absorbs")

    price = max(0, int(price))
    quantity = max(1, int(quantity))
    gross = price * quantity

    # 1. Free event / ticket policy (Rp0 platform fee, Rp0 tax, Rp0 gateway)
    if gross == 0:
        return {
            "policy_key": effective_policy.get("key", CANONICAL_TICKETING_FEE_POLICY_KEY),
            "policy_name": effective_policy.get("name", "OKKAX Free Event & Credential Policy"),
            "policy_version": effective_policy.get("version", "2026.1"),
            "gross": 0,
            "platform_fee": 0,
            "gateway_fee": 0,
            "gateway_fee_type": "none",
            "tax": 0,
            "tax_rate": 0.0,
            "tax_status": "free_exempt",
            "total": 0,
            "net_to_organizer": 0,
            "fee_bearer": bearer,
            "policy_type": "free",
            "fee_rate": 0.0,
        }

    # 2. Determine rate and fee policy type
    p_type = effective_policy.get("policy_type", "tiered_public")
    min_strat_rate = float(effective_policy.get("minimum_strategic_fee_rate", MINIMUM_STRATEGIC_FEE_RATE))

    # Check if custom policy supplied an explicit percentage rate
    if "rate" in effective_policy and effective_policy["rate"] is not None and p_type != "tiered_public":
        rate = float(effective_policy["rate"])
        # Validate minimum strategic floor
        if rate < min_strat_rate:
            raise ValueError(
                f"Negotiated rate {rate*100:.2f}% is below minimum strategic floor {min_strat_rate*100:.2f}%"
            )
        p_type = "strategic_negotiated"
    elif p_type == "fixed":
        rate = 0.0
    elif p_type == "free":
        rate = 0.0
    else:
        # Default canonical public tiered rate based on SINGLE ticket face value
        rate = get_canonical_public_fee_rate(price, policy=effective_policy)
        p_type = "tiered_public"

    fixed = int(effective_policy.get("fixed_fee", 0))

    if p_type in ("tiered_public", "strategic_negotiated"):
        platform_fee = int(round(gross * rate))
    elif p_type == "fixed":
        platform_fee = fixed * quantity
    elif p_type == "percentage_plus_fixed":
        platform_fee = int(round(gross * rate)) + (fixed * quantity)
    elif p_type == "free":
        platform_fee = 0
    else:
        platform_fee = int(round(gross * rate))

    min_fee = effective_policy.get("min_fee", 0)
    max_fee = effective_policy.get("max_fee", 0)
    if min_fee and platform_fee < min_fee:
        platform_fee = min_fee
    if max_fee and platform_fee > max_fee:
        platform_fee = max_fee

    # 3. Tax policy calculation (explicit, no hardcoded universal rate)
    tax_configured = False
    tax_rate = 0.0
    tax_status = "not_configured"

    if "tax_rate" in effective_policy and effective_policy["tax_rate"] is not None:
        tax_rate = float(effective_policy["tax_rate"])
        tax_configured = True
        tax_status = "configured"

    tax = int(round(gross * tax_rate)) if tax_configured else 0

    # 4. Processor / gateway fee (classified as sandbox simulated)
    gw_conf = effective_policy.get("gateway_fee", 4000)
    if isinstance(gw_conf, dict):
        gateway_fee = int(gw_conf.get("amount", 4000)) if gross > 0 else 0
        gateway_fee_type = str(gw_conf.get("type", "sandbox_simulated"))
    else:
        gateway_fee = int(gw_conf) if gross > 0 else 0
        gateway_fee_type = "sandbox_simulated"

    # 5. Bearer calculation
    if bearer == "organizer_absorbs":
        # Buyer pays exactly the ticket face value; fees are deducted from organizer net payout
        total = gross
        net_to_organizer = max(0, gross - platform_fee - gateway_fee)
    else:
        # Buyer absorbs fees on top of face value
        total = gross + platform_fee + tax
        net_to_organizer = gross

    return {
        "policy_key": effective_policy.get("key", CANONICAL_TICKETING_FEE_POLICY_KEY),
        "policy_name": effective_policy.get("name", "OKKAX Canonical Public Tiered Fee Policy"),
        "policy_version": effective_policy.get("version", "2026.1"),
        "gross": gross,
        "platform_fee": platform_fee,
        "gateway_fee": gateway_fee,
        "gateway_fee_type": gateway_fee_type,
        "tax": tax,
        "tax_rate": tax_rate,
        "tax_status": tax_status,
        "total": total,
        "net_to_organizer": net_to_organizer,
        "fee_bearer": bearer,
        "policy_type": p_type,
        "fee_rate": rate,
    }
