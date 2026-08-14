// Seed backend hanya punya 31 cover unik untuk 136 event, dan generator tidak
// mempertimbangkan kategori sehingga banyak event musik memakai foto makanan
// dan sebaliknya. Modul ini meng-override hero_image di sisi frontend dengan
// pool yang relevan per kategori. Pemilihan deterministik (hash event.id),
// jadi satu event selalu memakai foto yang sama antar sesi.

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
  fashion: [
    `${BASE}/bali-resort-fashion-week.jpg`,
    `${BASE}/jakarta-fashion-exchange.jpg`,
  ],
  art: [
    `${BASE}/bali-art-and-design-week.jpg`,
    `${BASE}/jogja-creative-expo.jpg`,
  ],
  wellness: [
    `${BASE}/bali-wellness-summit.jpg`,
  ],
  business: [
    `${BASE}/borneo-energy-forum.jpg`,
    `${BASE}/surabaya-halal-industry-expo.jpg`,
    `${BASE}/surabaya-property-expo.jpg`,
    `${BASE}/semarang-umkm-growth-fair.jpg`,
    `${BASE}/jogja-wedding-showcase.jpg`,
    `${BASE}/bandung-coffee-conference.jpg`,
  ],
};

// Peta event_type (bahasa Indonesia dan Inggris) ke bucket pool di atas.
// Fallback ke 'business' untuk kategori yang tidak terpetakan.
const CATEGORY_BUCKET = {
  "Music Festival": "music",
  "Music Concert": "music",
  "Sound & Music": "music",
  "Music": "music",
  "Festival Musik": "music",
  "Konser": "music",
  "Konferensi": "business",
  "Food & Culinary": "food",
  "Culinary": "food",
  "Food Festival": "food",
  "Festival Kuliner": "food",
  "Kuliner": "food",
  "Tech": "tech",
  "Technology": "tech",
  "Teknologi": "tech",
  "Startup": "tech",
  "Sport": "sport",
  "Sports": "sport",
  "Esports": "sport",
  "Olahraga": "sport",
  "Fashion": "fashion",
  "Mode": "fashion",
  "Art & Culture": "art",
  "Art": "art",
  "Seni & Budaya": "art",
  "Wellness": "wellness",
  "Kesehatan": "wellness",
  "Business": "business",
  "Conference": "business",
  "Trade Fair": "business",
  "Exhibition": "business",
  "Ekspo": "business",
  "Pameran": "business",
};

function bucketFor(eventType = "") {
  if (CATEGORY_BUCKET[eventType]) return CATEGORY_BUCKET[eventType];
  // Fallback berbasis kata kunci supaya kategori baru dari backend tetap
  // mendapat pool yang masuk akal tanpa harus update peta manual.
  const t = eventType.toLowerCase();
  if (t.includes("music") || t.includes("musik") || t.includes("konser") || t.includes("indie") || t.includes("sound")) return "music";
  if (t.includes("food") || t.includes("kuliner") || t.includes("culinary") || t.includes("kopi") || t.includes("halal")) return "food";
  if (t.includes("tech") || t.includes("startup") || t.includes("digital")) return "tech";
  if (t.includes("sport") || t.includes("esports") || t.includes("gaming") || t.includes("olahraga")) return "sport";
  if (t.includes("fashion") || t.includes("mode")) return "fashion";
  if (t.includes("art") || t.includes("seni") || t.includes("design") || t.includes("creative")) return "art";
  if (t.includes("wellness") || t.includes("kesehatan") || t.includes("health")) return "wellness";
  return "business";
}

function hashString(input) {
  let hash = 0;
  const str = String(input || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Kembalikan URL cover yang relevan dengan kategori event. Deterministik
 * berdasarkan event.id supaya satu event selalu mendapat gambar yang sama.
 */
export function imageFor(event) {
  if (!event) return `${BASE}/nusantara-sound-fest.jpg`;
  const bucket = bucketFor(event.event_type);
  const pool = POOL[bucket] || POOL.business;
  const index = hashString(event.id || event.name || "okkax") % pool.length;
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
