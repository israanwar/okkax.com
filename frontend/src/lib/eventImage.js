// Cover event: foto real yang relevan dengan kategori.
//
// Backend seed hanya menyediakan 31 foto lokal untuk 136 event, jadi
// duplikasi antar event masih akan terjadi selama pool foto belum diperluas.
// Modul ini menjaga foto tetap KATEGORI-RELEVAN (event musik dapat foto
// musik, kuliner dapat kuliner, tech dapat tech) sambil menyeragamkan
// pemilihan lewat hash event.id supaya konsisten antar reload.
//
// Untuk menghilangkan duplikasi sepenuhnya perlu tambah asset foto di
// frontend/public/assets/discover-indonesia/ dan daftarkan URL-nya ke POOL
// di bawah.

const CATEGORY_TO_BUCKET = {
  "Festival Musik": "music",
  "Konser": "music",
  "Music Festival": "music",
  "Music Concert": "music",
  "Sound & Music": "music",
  "Music": "music",
  "Product Launch & Music Festival": "music",
  "Festival Kuliner": "food",
  "Food & Culinary": "food",
  "Food Festival": "food",
  "Culinary": "food",
  "Konferensi Teknologi": "tech",
  "Tech": "tech",
  "Technology": "tech",
  "Teknologi": "tech",
  "Startup": "tech",
  "Seminar & Pitching": "tech",
  "Esports": "esports",
  "Sport": "sport",
  "Sports": "sport",
  "Olahraga": "sport",
  "Fashion Week": "fashion",
  "Fashion": "fashion",
  "Mode": "fashion",
  "Seni & Budaya": "art",
  "Art & Culture": "art",
  "Art": "art",
  "Wellness": "wellness",
  "Kesehatan": "wellness",
  "Trade Expo": "business",
  "Pameran UMKM": "business",
  "Wedding Expo": "business",
  "Konferensi": "business",
  "Business": "business",
  "Conference": "business",
  "Trade Fair": "business",
  "Exhibition": "business",
  "Pameran": "business",
  "Ekspo": "business",
};

// Fallback berbasis kata kunci: dipakai kalau CATEGORY_TO_BUCKET tidak
// menangkap event_type-nya. Diperiksa pada `${event_type} ${event.name}`
// supaya nama event ("Nusantara Tech Summit") ikut memandu bucket meskipun
// event_type-nya generic ("Konferensi").
const KEYWORD_BUCKETS = [
  ["music", ["musik", "music", "konser", "sound", "indie", "harmoni", "resonansi", "skyline", "panggung", "carnival", "orkestra", "band"]],
  ["food", ["kuliner", "food", "culinary", "kopi", "coffee", "halal", "rasa", "seafood", "night market"]],
  ["tech", ["tech", "teknologi", "startup", "digital", "summit", "coding", "hack"]],
  ["esports", ["esports", "gaming", "e-sport", "invitational"]],
  ["sport", ["sport", "olahraga", "arena", "match", "cup", "athlete", "stadium"]],
  ["fashion", ["fashion", "mode", "runway", "catwalk"]],
  ["art", ["art", "seni", "design", "creative", "expo art", "budaya", "showcase"]],
  ["wellness", ["wellness", "kesehatan", "health", "meditation", "yoga"]],
  ["business", ["expo", "pameran", "trade", "wedding", "property", "energy", "industry", "umkm", "growth"]],
];

export function bucketFor(event) {
  const type = event?.event_type || "";
  if (CATEGORY_TO_BUCKET[type]) return CATEGORY_TO_BUCKET[type];
  const haystack = `${type} ${event?.name || ""}`.toLowerCase();
  for (const [bucket, keywords] of KEYWORD_BUCKETS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return bucket;
  }
  return "business";
}

const TINT_BY_BUCKET = {
  music: ["#ff2e7e", "#8b5cf6"],
  food: ["#f59e0b", "#ef4444"],
  tech: ["#06b6d4", "#3b82f6"],
  esports: ["#8b5cf6", "#ec4899"],
  sport: ["#10b981", "#0d9488"],
  fashion: ["#d946ef", "#ec4899"],
  art: ["#f97316", "#e11d48"],
  wellness: ["#14b8a6", "#84cc16"],
  business: ["#64748b", "#0f172a"],
};

function hashString(input) {
  let hash = 0;
  const str = String(input || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Pasangan warna duotone untuk kartu event, ditambah sudut gradient yang
 * ditentukan dari hash event.id supaya dua event dalam kategori sama tetap
 * punya arah gradient berbeda.
 */
export function tintFor(event) {
  const bucket = bucketFor(event);
  const [from, to] = TINT_BY_BUCKET[bucket] || TINT_BY_BUCKET.business;
  const angle = (hashString(event?.id || event?.name || "okkax") % 12) * 30;
  return { from, to, angle, bucket };
}

const BASE = "/assets/discover-indonesia";
const POOL = {
  music: [
    `${BASE}/nusantara-sound-fest.jpg`,
    `${BASE}/sriwijaya-music-carnival.jpg`,
    `${BASE}/bandung-indie-wave.jpg`,
    `${BASE}/malang-indie-showcase.jpg`,
    `${BASE}/semarang-youth-music-camp.jpg`,
    `${BASE}/aruna-bold-live-experience-2026.jpg`,
  ],
  food: [
    `${BASE}/jogja-rasa-nusantara.jpg`,
    `${BASE}/manado-seafood-festival.jpg`,
    `${BASE}/medan-culinary-heritage.jpg`,
    `${BASE}/palembang-halal-food-fair.jpg`,
    `${BASE}/khatulistiwa-food-and-craft.jpg`,
    `${BASE}/kopi-nusantara-weekend.jpg`,
    `${BASE}/surabaya-night-market-live.jpg`,
  ],
  tech: [
    `${BASE}/nusantara-tech-summit-2026.jpg`,
    `${BASE}/medan-startup-demo-day.jpg`,
    `${BASE}/padang-startup-week.jpg`,
    `${BASE}/denpasar-digital-nomad-summit.jpg`,
  ],
  sport: [
    `${BASE}/arena-nusantara-esports-finals.jpg`,
    `${BASE}/batam-esports-invitational.jpg`,
    `${BASE}/nusantara-gaming-expo.jpg`,
  ],
  fashion: [`${BASE}/bali-resort-fashion-week.jpg`, `${BASE}/jakarta-fashion-exchange.jpg`],
  art: [`${BASE}/bali-art-and-design-week.jpg`, `${BASE}/jogja-creative-expo.jpg`],
  wellness: [`${BASE}/bali-wellness-summit.jpg`],
  business: [
    `${BASE}/borneo-energy-forum.jpg`,
    `${BASE}/surabaya-halal-industry-expo.jpg`,
    `${BASE}/surabaya-property-expo.jpg`,
    `${BASE}/semarang-umkm-growth-fair.jpg`,
    `${BASE}/jogja-wedding-showcase.jpg`,
    `${BASE}/bandung-coffee-conference.jpg`,
  ],
};

/**
 * Foto lokal yang relevan dengan kategori event, deterministik per event.id.
 * Pool total 31 asset; kartu memakai foto langsung tanpa tint keras supaya
 * subjeknya terlihat apa adanya.
 */
export function imageFor(event) {
  const bucket = bucketFor(event);
  const pool = POOL[bucket] || POOL.business;
  const index = hashString(event?.id || event?.name || "okkax") % pool.length;
  return pool[index];
}

/**
 * Kunci deduplikasi event untuk daftar publik. Backend seed kadang membuat
 * beberapa row dengan nama + tanggal + kota identik; kita tampilkan hanya
 * satu untuk masing-masing kombinasi tersebut.
 */
export function eventDedupeKey(event) {
  return [event?.name, event?.start_date, event?.city].filter(Boolean).join("|");
}
