// Unsplash photo assigner untuk cover event Discover.
//
// Kontrak: setiap event mendapat foto UNIK dalam bucket kategorinya.
// Cara kerja: kelompokkan event berdasarkan bucket, hitung berapa foto
// diperlukan tiap bucket, fetch halaman Unsplash sampai jumlah tersebut
// tercapai, lalu assign foto per event berdasar posisi dalam bucket.
// Hasil assignment (event.id -> URL) di-cache di localStorage 7 hari;
// kunjungan berikutnya nol API call.
//
// Rate limit Unsplash demo: 50 request/jam. Music (bucket terbesar dengan
// 111 event) membutuhkan 4 halaman = 4 request; bucket lain 1 halaman.
// Total awal ~9 request, jauh di bawah limit.

import { bucketFor } from "@/lib/eventImage";

const ACCESS_KEY =
  process.env.REACT_APP_UNSPLASH_ACCESS_KEY ||
  "O7SCkspc1OcH3-b-JKsmSYxRx6e9a1GtEr0M1yRuvPk";

const CACHE_KEY = "okkax_unsplash_assign_v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const PER_PAGE = 30;
const MAX_PAGES_PER_BUCKET = 6; // 6 x 30 = 180 foto maksimum per bucket

// Query per bucket dipilih agar Unsplash mengembalikan foto aktivitas yang
// tepat. Esports dipisah dari sport karena "sports arena" mengembalikan
// lapangan basket, bukan setup gaming.
const BUCKET_QUERIES = {
  music: "music concert stage",
  food: "food festival market",
  tech: "tech conference workshop",
  esports: "esports gaming tournament",
  sport: "sport athlete stadium",
  fashion: "fashion runway show",
  art: "art exhibition gallery",
  wellness: "wellness yoga retreat",
  business: "business conference expo",
};

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - (parsed.at || 0) > CACHE_TTL_MS) return null;
    return parsed.assignment || null;
  } catch {
    return null;
  }
}

function writeCache(assignment) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), assignment }));
  } catch {
    // Storage penuh atau di-block; abaikan.
  }
}

async function fetchBucketPhotos(bucket, needed) {
  const query = BUCKET_QUERIES[bucket] || "event indonesia";
  const pages = Math.min(MAX_PAGES_PER_BUCKET, Math.max(1, Math.ceil(needed / PER_PAGE)));
  const collected = [];
  const seen = new Set();
  for (let page = 1; page <= pages; page += 1) {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&per_page=${PER_PAGE}&page=${page}&orientation=landscape&content_filter=high&client_id=${ACCESS_KEY}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      for (const photo of data?.results || []) {
        const src = photo?.urls?.regular;
        if (!src || seen.has(photo.id)) continue;
        seen.add(photo.id);
        collected.push(src);
        if (collected.length >= needed) break;
      }
      if (collected.length >= needed) break;
      if (!data?.results?.length) break;
    } catch {
      break;
    }
  }
  return collected;
}

let inflight = null;
let inflightSignature = null;

function signatureOf(events) {
  // Signature dibuat dari list id event yang di-sort, sehingga cache tetap
  // valid selama daftar event tidak berubah. Kalau backend menambah event
  // baru, signature berubah dan cache di-refresh otomatis.
  return (events || [])
    .map((event) => event?.id || event?.name || "")
    .filter(Boolean)
    .sort()
    .join("|");
}

/**
 * Pastikan setiap event dalam list mendapat URL foto Unsplash unik dalam
 * bucket-nya. Aman dipanggil berkali-kali; permintaan yang sedang berjalan
 * di-dedup, dan hasil di-cache di localStorage.
 */
export async function loadUnsplashAssignments(events) {
  if (!events || !events.length) return {};
  const cached = readCache();
  if (cached && cached.signature === signatureOf(events) && cached.map) {
    return cached.map;
  }
  if (inflight && inflightSignature === signatureOf(events)) {
    return inflight;
  }
  inflightSignature = signatureOf(events);
  inflight = (async () => {
    // Kelompokkan event ke bucket-nya, jaga urutan asli supaya index event
    // stabil antar-render.
    const byBucket = new Map();
    for (const event of events) {
      const bucket = bucketFor(event);
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket).push(event);
    }
    const map = {};
    for (const [bucket, bucketEvents] of byBucket.entries()) {
      const photos = await fetchBucketPhotos(bucket, bucketEvents.length);
      bucketEvents.forEach((event, index) => {
        const src = photos[index % Math.max(1, photos.length)];
        if (src) map[event.id] = src;
      });
    }
    if (Object.keys(map).length) {
      writeCache({ signature: signatureOf(events), map });
    }
    return map;
  })().finally(() => {
    inflight = null;
    inflightSignature = null;
  });
  return inflight;
}

/**
 * Kembalikan URL foto yang sudah di-assign untuk event, atau fallback bila
 * assignment belum ter-load / event belum ada dalam map.
 */
export function pickAssignedPhoto(assignments, event, fallback) {
  return assignments?.[event?.id] || fallback;
}
