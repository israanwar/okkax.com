// Solutions router. One page per audience with:
//   - a title and lead,
//   - four to five talking points,
//   - a live data slice pulled from canonical backend catalogs so the
//     page is never a static brochure,
//   - a role-honest CTA.
//
// Route: /for/:audience  (audience ∈ organizers, promoters, talent,
// venues, vendors, workforce, sponsors, tenants, attendees).

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, apiError, compact, idr, num } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Talking points and CTA are still declarative per audience.
// live.source is a catalog slug so the shell can fetch and slice the right
// canonical data set for that role.
// ---------------------------------------------------------------------------
const AUDIENCES = {
  organizers: {
    title: "For Organizers",
    tagline: "Compile brief menjadi event yang dapat dieksekusi, dibiayai, dijual, dioperasikan, dan diukur.",
    points: [
      ["Event Studio", "Guided brief dengan autosave, validasi, dan preview sebelum dikompilasi."],
      ["Blueprint Engine", "Fase, workstream, requirement, budget, sponsor inventory, tenant zone, dan risiko dalam satu dokumen editable."],
      ["Event Graph", "Setiap komponen terikat pada satu Event ID dengan status Draft, Pending, Confirmed, At Risk, Blocked."],
      ["Command Center", "Countdown, readiness, milestone, run of show, incident, dan aktivitas terbaru."],
    ],
    live: { source: "events", label: "Live event pipeline", explain: "Snapshot dari event yang sudah di-publish pada catalog OKKAX." },
    cta: ["Build an Event", "/register"],
  },
  promoters: {
    title: "For Promoters",
    tagline: "Kelola portfolio event, ticketing, dan settlement lintas kota dalam satu operasi.",
    points: [
      ["Event Portfolio", "Multi-event command center dengan readiness dan finansial per event."],
      ["Ticket Studio", "Inventory, tier, kuota, dan LivePass yang dikendalikan langsung dari satu tempat."],
      ["Protected Payment", "Funding aman, protected balance, settlement transparan."],
      ["Intelligence", "Rekomendasi berbasis state event untuk keputusan taktis dan strategis."],
    ],
    live: { source: "events", label: "Live promoter pipeline", explain: "Event dari catalog OKKAX. Portfolio view menampilkan lintas kota dan kategori." },
    cta: ["Kelola Portfolio", "/register?role=promoter"],
  },
  talent: {
    title: "For Talent",
    tagline: "Terima booking, kelola rider, dan tampilkan portfolio pada jaringan event yang terverifikasi.",
    points: [
      ["Structured Rider", "Rider terstruktur dengan compatibility check terhadap venue dan production."],
      ["Booking Pipeline", "Opportunity, offer, contract, dan schedule pada satu inbox."],
      ["Landed Cost", "Perhitungan biaya travel, akomodasi, dan tim otomatis dari kota event."],
      ["Reputation", "Review dan riwayat event membentuk kredibilitas jangka panjang."],
    ],
    live: { source: "talents", label: "Peer talent on OKKAX", explain: "Peer talent lain yang terdaftar di catalog OKKAX. Detail komersial gated." },
    cta: ["Buat Profil Talent", "/register?role=talent"],
  },
  venues: {
    title: "For Venues",
    tagline: "Publikasikan kapasitas, availability, dan spec teknis pada satu jaringan event nasional.",
    points: [
      ["Compatibility Score", "Skor kesesuaian venue dengan brief event: kapasitas, power, curfew, dan anggaran."],
      ["Booking Calendar", "Availability, holds, confirmed booking, dan handover checklist."],
      ["Operational Requirements", "Loading dock, security, medical, permit, dan gate operations."],
      ["Revenue Analytics", "Occupancy, ancillary revenue, dan comparative performance."],
    ],
    live: { source: "venues", label: "Venue in the network", explain: "Sampel venue dari catalog OKKAX. Kapasitas dan curfew publik; harga detail gated." },
    cta: ["Daftarkan Venue", "/register?role=venue"],
  },
  vendors: {
    title: "For Vendors",
    tagline: "Ambil work order, kelola project, dan tumbuhkan bisnis production Anda.",
    points: [
      ["Opportunity Feed", "Kebutuhan event yang cocok dengan kategori, area layanan, dan kapasitas Anda."],
      ["Quotation Workflow", "Quote versioned, negotiation trail, dan accepted quote yang terekam."],
      ["Project Management", "Load-in, setup, rehearsal, show, dismantling, completion."],
      ["Payment Schedule", "Milestone payment, protected balance, dan settlement transparan."],
    ],
    live: { source: "vendors", label: "Vendor in the network", explain: "Sampel vendor dari catalog OKKAX. Kategori dan kota publik; harga range gated." },
    cta: ["Daftar Vendor", "/register?role=vendor"],
  },
  workforce: {
    title: "For Workforce",
    tagline: "Temukan job, jaga jadwal, dan bangun karir pada industri live event.",
    points: [
      ["Smart Job Matching", "Opportunity yang cocok dengan skill, availability, dan lokasi Anda."],
      ["Shift Check-in", "QR check-in dan verifikasi supervisor untuk gate, security, atau produksi."],
      ["Payment History", "Riwayat penghasilan yang terekam per event dan per shift."],
      ["Reputation", "Rating dan riwayat kerja membentuk profil profesional yang dapat diverifikasi."],
    ],
    live: { source: "workers", label: "Workforce peers", explain: "Sampel worker terverifikasi. Rate harian dan kontak gated hingga role authorization." },
    cta: ["Daftar Workforce", "/register?role=workforce"],
  },
  sponsors: {
    title: "For Sponsors",
    tagline: "Temukan event yang cocok dengan brand Anda, lihat inventory, dan kunci komitmen secara terukur.",
    points: [
      ["Discovery", "Cari event berdasarkan kota, kategori, kapasitas, audiens, organizer, dan talent."],
      ["Sponsor Inventory", "Naming rights, presenting, main, supporting, category partner, booth activation, LED exposure, VIP hospitality."],
      ["Alur transparan", "Express interest, negotiation, approval, commitment, payment schedule, deliverable tracking."],
      ["Dampak terukur", "Komitmen yang disetujui langsung mengurangi funding gap event dan tercatat pada Event Graph."],
    ],
    live: { source: "events", label: "Events open for sponsorship", explain: "Event yang tercantum pada catalog. Package inventory dan brand fit gated untuk sponsor terverifikasi." },
    cta: ["Masuk sebagai Sponsor", "/login"],
  },
  tenants: {
    title: "For Tenants",
    tagline: "Pilih booth pada event yang tepat, ajukan aplikasi, dan kelola operasional hari-H.",
    points: [
      ["Booth marketplace", "Zona tenant dengan kode booth, ukuran, harga, deposit, kapasitas listrik, dan posisi."],
      ["Compatibility check", "Deteksi sponsor conflict, duplikasi kategori, kapasitas listrik, dan kebutuhan food safety."],
      ["Alur aplikasi", "Apply, review organizer, approval, payment schedule, reserved, check-in, completion."],
      ["Kontribusi funding", "Pendapatan booth yang terkonfirmasi memperkuat funding event."],
    ],
    live: { source: "tenants", label: "Tenants on OKKAX", explain: "Sampel tenant terdaftar. Booth pricing dan aplikasi terkunci untuk tenant yang terautorisasi." },
    cta: ["Masuk sebagai Tenant", "/login"],
  },
  attendees: {
    title: "For Attendees",
    tagline: "Discover live event, beli tiket dengan aman, dan simpan LivePass Anda pada satu tempat.",
    points: [
      ["Discover", "Jelajah event berdasarkan kota, kategori, tanggal, dan lineup."],
      ["Sandbox Checkout", "QRIS, Virtual Account, e-wallet, kartu. Tidak ada uang nyata pada mode demo."],
      ["LivePass", "Access credential live, bukan file. Sekali scan, langsung tervalidasi."],
      ["Transfer", "Pindahkan tiket ke teman dengan jejak audit."],
    ],
    live: { source: "events", label: "Live discover feed", explain: "Event yang sedang berjalan atau segera datang di catalog OKKAX." },
    cta: ["Cari Event", "/discover"],
  },
};

// ---------------------------------------------------------------------------
// Live data hook per source.
// ---------------------------------------------------------------------------
const CATALOG_URL = {
  talents: "/catalog/talents",
  venues: "/catalog/venues",
  vendors: "/catalog/vendors",
  workers: "/catalog/workers",
  tenants: "/catalog/tenants",
  events: "/discover/events",
};

function useLiveSlice(source) {
  const [data, setData] = useState({ items: [], loading: true, err: "" });
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const url = CATALOG_URL[source];
        if (!url) { setData({ items: [], loading: false, err: "unsupported source" }); return; }
        const { data: resp } = await api.get(url);
        if (cancel) return;
        const items = resp?.items || resp || [];
        setData({ items: items.slice(0, 6), loading: false, err: "" });
      } catch (e) {
        if (!cancel) setData({ items: [], loading: false, err: apiError(e) });
      }
    })();
    return () => { cancel = true; };
  }, [source]);
  return data;
}

// ---------------------------------------------------------------------------
// Live card renderers per source.
// ---------------------------------------------------------------------------
function renderCard(source, item) {
  if (source === "talents") {
    return (
      <>
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-semibold text-white">{item.name}</div>
          {item.rating && <span className="text-xs text-zinc-500">{Number(item.rating).toFixed(1)}</span>}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">{item.category || item.genre} · {item.city}</div>
        <div className="mt-3 text-[10.5px] text-zinc-600">{(item.availability || []).length} open dates published</div>
      </>
    );
  }
  if (source === "venues") {
    return (
      <>
        <div className="text-sm font-semibold text-white">{item.name}</div>
        <div className="mt-1 text-[11px] text-zinc-500">{item.city} · {item.area_sqm ? item.area_sqm + " sqm" : "Multi-purpose"}</div>
        <div className="mt-3 text-[10.5px] text-zinc-600">{(item.event_types || []).slice(0, 2).join(", ")}{item.curfew ? " · curfew " + item.curfew : ""}</div>
      </>
    );
  }
  if (source === "vendors") {
    return (
      <>
        <div className="text-sm font-semibold text-white">{item.name}</div>
        <div className="mt-1 text-[11px] text-zinc-500">{item.city} · {item.category}</div>
        <div className="mt-3 text-[10.5px] text-zinc-600">{(item.capabilities || []).slice(0, 2).join(", ")}</div>
      </>
    );
  }
  if (source === "workers") {
    return (
      <>
        <div className="text-sm font-semibold text-white">{item.name}</div>
        <div className="mt-1 text-[11px] text-zinc-500">{item.city} · {item.category}</div>
        <div className="mt-3 text-[10.5px] text-zinc-600">{(item.skills || []).slice(0, 2).join(", ")}{item.attendance_rate ? " · " + item.attendance_rate + "% attendance" : ""}</div>
      </>
    );
  }
  if (source === "tenants") {
    return (
      <>
        <div className="text-sm font-semibold text-white">{item.business_name}</div>
        <div className="mt-1 text-[11px] text-zinc-500">{item.city} · {item.product_category}</div>
        <div className="mt-3 text-[10.5px] text-zinc-600">{item.description}</div>
      </>
    );
  }
  if (source === "events") {
    return (
      <>
        <div className="text-sm font-semibold text-white">{item.name || item.title}</div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
          <MapPin size={11} aria-hidden="true" /> {item.city} · {(item.start_date || item.end_date || "").slice(0, 10)}
        </div>
        <div className="mt-3 text-[10.5px] text-zinc-600">
          {item.event_type} · Capacity {num(item.capacity)}
        </div>
      </>
    );
  }
  return null;
}

function LiveSlice({ source, label, explain, ctaHref, ctaLabel }) {
  const { items, loading, err } = useLiveSlice(source);
  return (
    <section aria-labelledby="for-live-heading" data-testid={`for-live-${source}`} className="mt-14 border-t border-[var(--okx-border)] pt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
            <ShieldCheck size={13} aria-hidden="true" /> {label}
          </div>
          <h2 id="for-live-heading" className="editorial mt-3 text-[clamp(1.4rem,3vw,2.2rem)] leading-tight text-[#f4efec]">
            {source === "events" ? "Real events." : "Real entities."} <span className="accent-text">Public preview.</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{explain}</p>
        </div>
        <Link to={source === "events" ? "/discover" : "/products/network"} className="hidden shrink-0 items-center gap-2 border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-100 hover:border-zinc-500 sm:inline-flex">
          Open Network
          <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      </div>
      {err ? (
        <div className="mt-6 border border-[var(--okx-border)] bg-[#0a0a0a] p-6 text-sm text-[var(--okx-accent-soft)]">
          Backend unreachable. Silakan buka /discover atau /products/network setelah backend hidup.
        </div>
      ) : loading ? (
        <div className="mt-6 border border-[var(--okx-border)] bg-[#0a0a0a] p-6 text-sm text-zinc-500">Memuat sampel dari catalog...</div>
      ) : items.length === 0 ? (
        <div className="mt-6 border border-[var(--okx-border)] bg-[#0a0a0a] p-6 text-sm text-zinc-500">Belum ada entri publik pada catalog.</div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`for-live-${source}-list`}>
          {items.map((it) => (
            <li key={it.id} className="border border-[var(--okx-border)] bg-[#0a0a0a] p-5">
              {renderCard(source, it)}
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                <Lock size={10} aria-hidden="true" /> Detail penuh gated
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 text-xs text-zinc-600">
        Data ini publik dari catalog OKKAX. Detail komersial, kontak, dan action tetap terkunci hingga sign in dan role authorization backend.
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ForPage() {
  const { audience } = useParams();
  const c = AUDIENCES[audience] || AUDIENCES.organizers;
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <PublicNav />
      <main data-testid={`for-${audience || "organizers"}`} className="mx-auto max-w-5xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
          <Sparkles size={12} aria-hidden="true" /> Solutions · {audience || "organizers"}
        </div>
        <h1 className="editorial mt-5 text-4xl leading-[0.98] sm:text-5xl lg:text-6xl">{c.title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">{c.tagline}</p>

        <div className="mt-10 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2">
          {c.points.map(([t, b]) => (
            <div key={t} className="bg-[#0a0a0a] p-6">
              <h2 className="text-base font-semibold text-white md:text-lg">{t}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{b}</p>
            </div>
          ))}
        </div>

        <LiveSlice
          source={c.live.source}
          label={c.live.label}
          explain={c.live.explain}
        />

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link to={c.cta[1]} data-testid="for-cta-btn" className="inline-flex items-center justify-between gap-3 bg-[var(--okx-accent)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]">
            {c.cta[0]}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link to="/products/network" className="inline-flex items-center justify-between gap-3 border border-zinc-800 px-6 py-3.5 text-sm font-semibold text-zinc-200 hover:border-zinc-600">
            Explore Network
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
