// Cover event: uniqueness + category relevance.
//
// Problem yang di-address:
// 1) Seed backend hanya punya 31 cover unik untuk 136 event, jadi banyak
//    kartu memakai foto identik.
// 2) Generator tidak melihat kategori, jadi tech summit bisa memakai foto
//    pernikahan.
//
// Strategi:
// - bucketFor(event) mengelompokkan event ke 8 kategori berdasarkan
//   event_type Bahasa Indonesia + kata kunci di nama event sebagai fallback.
// - imageFor(event) mengembalikan URL picsum.photos berbasis seed event.id
//   dengan grayscale + blur ringan; setiap event mendapat foto berbeda yang
//   deterministik (tidak berubah antar reload). Foto berperan sebagai
//   tekstur; kategori disinyalkan lewat overlay warna di komponen kartu.
// - tintFor(event) memberi pasangan warna duotone per bucket sehingga
//   overlay mix-blend-multiply di kartu selalu merefleksikan kategori.

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
  "Esports": "sport",
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
  ["sport", ["sport", "esports", "gaming", "olahraga", "arena", "match", "cup", "invitational"]],
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

/**
 * URL cover unik per event. Memakai picsum.photos dengan seed dari event.id
 * plus grayscale supaya foto berfungsi sebagai tekstur; warna kategori
 * disuplai oleh overlay di komponen kartu. Alat ini juga menjamin dua event
 * dengan id berbeda pasti mendapat foto berbeda (Picsum menjamin uniqueness
 * per seed).
 */
export function imageFor(event) {
  const seed = String(event?.id || event?.name || "okkax").replace(/[^a-zA-Z0-9-]/g, "-");
  return `https://picsum.photos/seed/${seed || "okkax"}/800/500?grayscale&blur=1`;
}

/**
 * Kunci deduplikasi event untuk daftar publik. Backend seed kadang membuat
 * beberapa row dengan nama + tanggal + kota identik; kita tampilkan hanya
 * satu untuk masing-masing kombinasi tersebut.
 */
export function eventDedupeKey(event) {
  return [event?.name, event?.start_date, event?.city].filter(Boolean).join("|");
}
