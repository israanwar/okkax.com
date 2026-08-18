import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  CircleDot,
  Filter,
  LayoutGrid,
  MapPin,
  Mic2,
  RotateCcw,
  Search,
  Store,
  Tags,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import OkxDropdown from "@/components/OkxDropdown";
import { api, compact, idr, num } from "@/lib/api";
import { imageFor, eventDedupeKey } from "@/lib/eventImage";
import { loadUnsplashAssignments, pickAssignedPhoto } from "@/lib/unsplash";
import {
  Reveal,
  RevealGroup,
  RevealItem,
  MaskReveal,
  ScrollProgressBar,
  CounterNumber,
  SpotlightCard,
} from "@/components/MotionPrimitives";

const SECTIONS = [
  ["live", "Sedang berlangsung", "Event yang panggungnya hidup hari ini"],
  ["this_week", "Minggu ini", "Berlangsung dalam 7 hari ke depan"],
  ["almost_sold_out", "Hampir habis", "Tiket terjual di atas 70%"],
  ["top_impact", "Event Terbesar", ""],
];

function FilterSelect({ testId, label, icon, value, onChange, options }) {
  return (
    <div className="block min-w-0">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <OkxDropdown value={value} onChange={onChange} options={options} icon={icon} testId={testId} ariaLabel={label} />
    </div>
  );
}

function EventCard({ ev, saved, onSave, compactMode, unsplashAssignments }) {
  const cover = pickAssignedPhoto(unsplashAssignments, ev, imageFor(ev));
  return (
    <SpotlightCard className="h-full">
      <article
        data-testid={`discover-event-card-${ev.id}`}
        className="group flex flex-col h-full overflow-hidden"
      >
        <div className={`relative overflow-hidden ${compactMode ? "h-36" : "h-48"}`}>
          <img
            src={cover}
            alt={ev.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(event) => {
              if (event.currentTarget.src !== imageFor(ev)) {
                event.currentTarget.src = imageFor(ev);
              }
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0c0c12] via-[#0c0c12]/20 to-transparent" />
          <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/[0.12] bg-[#06060a]/80 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-200 shadow-sm">
              {ev.event_type}
            </span>
            {ev.is_live && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
              </span>
            )}
            {!ev.is_live && ev.almost_sold_out && (
              <span className="rounded-full border border-dashed border-white/30 bg-white/[0.04] backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-zinc-300 shadow-sm">
                Hampir habis
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className={`font-bold text-white group-hover:text-zinc-100 transition-colors line-clamp-1 ${compactMode ? "text-sm" : "text-base md:text-lg"}`}>
            {ev.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1 font-gemini"><CalendarDays size={13} className="text-zinc-500" /> {ev.start_date}</span>
            <span className="inline-flex items-center gap-1 font-gemini"><MapPin size={13} className="text-zinc-500" /> {ev.city}</span>
          </div>
          <div className="mt-2.5 text-xs text-zinc-400">
            <span className="text-zinc-300 font-medium">{ev.organizer_name}</span>
            {ev.headline_talent && (
              <span className="ml-2 inline-flex items-center gap-1 text-zinc-400"><Mic2 size={12} className="text-zinc-500" /> {ev.headline_talent}</span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[11px] text-zinc-400 font-gemini-mono">
              <span>Tiket Terjual</span>
              <span className="font-bold text-white">{ev.sold_percentage}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-white transition-all duration-500"
                style={{ width: `${Math.min(100, ev.sold_percentage)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-y border-white/[0.08] py-3 text-[11px] text-zinc-400">
            <span className="flex flex-col"><span className="font-bold text-white font-mono">{num(ev.tenant_count)}</span> tenant</span>
            <span className="flex flex-col"><span className="font-bold text-white font-mono">{num(ev.vendor_count)}</span> vendor</span>
            <span className="flex flex-col"><span className="font-bold text-white font-mono">{num(ev.sponsor_sold)}/{num(ev.sponsor_slots)}</span> sponsor</span>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-gemini-mono">Mulai Dari</div>
              <div className="text-lg font-bold text-white font-gemini-display">{ev.min_price ? idr(ev.min_price) : "Gratis"}</div>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <div className="flex items-center justify-end gap-1 font-semibold text-white font-gemini-mono">
                <TrendingUp size={12} /> <span>{compact(ev.economic_ripple)}</span>
              </div>
              <div className="font-gemini-mono text-[11px] text-zinc-400">{num(ev.tickets_remaining)} tiket tersisa</div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Link
              to={`/events/${ev.id}`}
              data-testid={`discover-view-btn-${ev.id}`}
              className="flex-1 rounded-xl bg-white hover:bg-zinc-200 text-black px-4 py-2.5 text-center text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
            >
              Lihat Event
            </Link>
            <button
              data-testid={`discover-save-btn-${ev.id}`}
              onClick={() => onSave(ev.id)}
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                saved
                  ? "border-white/40 bg-white/[0.15] text-white"
                  : "border-white/[0.12] bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {saved ? "Disimpan" : "Simpan"}
            </button>
          </div>
        </div>
      </article>
    </SpotlightCard>
  );
}

export default function Discover() {
  const [data, setData] = useState({ items: [], cities: [], categories: [], highlights: {}, totals: null });
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [priceMode, setPriceMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("okkax_saved") || "[]"));
  const [unsplashAssignments, setUnsplashAssignments] = useState({});

  const load = async (override = {}) => {
    setLoading(true);
    try {
      const state = { q, city, category, priceMode, ...override };
      const params = { q: state.q, city: state.city, category: state.category };
      if (state.priceMode === "free") params.free = true;
      if (state.priceMode === "paid") params.free = false;
      const { data } = await api.get("/discover/events", { params });
      setData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, category, priceMode]);

  // Assignment Unsplash dijalankan sekali per daftar event (signature-based
  // cache) sehingga setiap event mendapat foto unik dalam bucket-nya.
  useEffect(() => {
    if (!data.items?.length) return;
    let cancelled = false;
    loadUnsplashAssignments(data.items).then((assignments) => {
      if (!cancelled) setUnsplashAssignments(assignments || {});
    });
    return () => { cancelled = true; };
  }, [data.items]);

  const reset = () => {
    setQ(""); setCity(""); setCategory(""); setPriceMode("");
    load({ q: "", city: "", category: "", priceMode: "" });
  };

  const toggleSave = (id) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("okkax_saved", JSON.stringify(next));
  };

  // Dedupe event dari seed yang membuat baris identik (nama + tanggal + kota
  // sama tapi id berbeda). Tampilkan hanya satu representasi per kombinasi.
  const uniqueItems = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const event of data.items) {
      const key = eventDedupeKey(event);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(event);
    }
    return result;
  }, [data.items]);
  const byId = useMemo(() => Object.fromEntries(uniqueItems.map((e) => [e.id, e])), [uniqueItems]);
  const hasFilter = Boolean(q || city || category || priceMode);
  const featuredEventIds = new Set();
  const sections = SECTIONS.map(([key, title, sub]) => {
    const items = [];
    for (const id of data.highlights?.[key] || []) {
      const event = byId[id];
      if (!event || featuredEventIds.has(event.id)) continue;
      featuredEventIds.add(event.id);
      items.push(event);
      if (items.length === 8) break;
    }
    return { key, title, sub, items };
  }).filter((s) => s.items.length > 0);
  const catalogueItems = hasFilter
    ? uniqueItems
    : uniqueItems.filter((event) => !featuredEventIds.has(event.id));

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <ScrollProgressBar />
      <PublicNav />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <MaskReveal delay={0.05}>
          <h1 className="editorial text-3xl sm:text-5xl">OKKAX Discover</h1>
        </MaskReveal>
        <Reveal delay={0.15}>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Event yang sedang berlangsung, akan berlangsung, hampir habis, gratis, dan berbayar — beserta organizer,
            talent, tenant, sponsor, dan skala aktivitas eventnya. Semua berasal dari data OKKAX.
          </p>
        </Reveal>

        {data.totals && (
          <section
            className="discover-stat-panel mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl shadow-lg"
            data-testid="discover-network-stats"
            aria-label="Ringkasan jaringan event"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3.5 sm:px-6 bg-[#09090f]">
              <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                <Activity size={14} className="text-zinc-300" />
                Network overview
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-gemini-mono">
                <CircleDot size={12} className="animate-pulse text-white" />
                Data katalog aktif
              </div>
            </div>
            <RevealGroup stagger={0.08} className="grid sm:grid-cols-2 lg:grid-cols-4">
              {[
                [LayoutGrid, "Event terhubung", data.totals.events, "live & mendatang"],
                [MapPin, "Kota aktif", data.totals.cities, "di seluruh Indonesia"],
                [Tags, "Format event", data.totals.categories, "kategori terkurasi"],
              ].map(([Icon, label, value, detail], index) => (
                <RevealItem
                  key={label}
                  className={`group relative px-5 py-5 transition-colors duration-300 hover:bg-white/[0.03] sm:px-6 ${
                    index > 0 ? "lg:border-l lg:border-white/[0.08]" : ""
                  } ${index % 2 ? "sm:border-l sm:border-white/[0.08] lg:border-l" : ""} ${
                    index > 1 ? "border-t border-white/[0.08] lg:border-t-0" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 font-gemini-mono">
                      {label}
                    </span>
                    <Icon size={16} className="text-zinc-500 transition-colors group-hover:text-white" />
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem] font-gemini-display">
                    <CounterNumber value={value} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-zinc-500">{detail}</div>
                </RevealItem>
              ))}
              <RevealItem className="group relative px-5 py-5 transition-colors duration-300 hover:bg-white/[0.03] sm:px-6 lg:border-l lg:border-white/[0.08] border-t border-white/[0.08] lg:border-t-0">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 font-gemini-mono">
                    Nilai operasional
                  </span>
                  <TicketCheck size={16} className="text-zinc-500 transition-colors group-hover:text-white" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem] font-gemini-display">
                  {compact(data.totals.economic_ripple)}
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-500">dalam jaringan</div>
              </RevealItem>
            </RevealGroup>
          </section>
        )}

        <section
          className="discover-filter-panel mt-7 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-5 sm:p-6 lg:p-7 shadow-lg"
          aria-label="Filter event"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                <Filter size={13} className="text-zinc-400" /> Curated discovery
              </div>
              <h2 className="mt-1.5 text-base font-bold text-white font-gemini-display">Temukan event yang tepat</h2>
            </div>
            <span
              data-testid="discover-result-count"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 text-xs text-zinc-300 font-gemini-mono"
            >
              <span className="font-bold text-white">{num(data.items.length)}</span>
              event ditemukan
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12 xl:items-end">
            <label className="group block min-w-0 sm:col-span-2 xl:col-span-4">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono">
                Pencarian
              </span>
              <span className="relative block">
                <Search
                  aria-hidden="true"
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors"
                />
                <input
                  data-testid="discover-search-input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="Nama event, talent, atau organizer"
                  aria-label="Cari event"
                  className="h-12 w-full rounded-xl border border-white/[0.12] bg-[#060609] pl-11 pr-4 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none transition-all"
                />
              </span>
            </label>
            <div className="xl:col-span-2">
              <FilterSelect
                testId="discover-city-select"
                label="Kota"
                icon={MapPin}
                value={city}
                onChange={setCity}
                options={[{ value: "", label: "Semua kota" }, ...data.cities.map((c) => ({ value: c, label: c }))]}
              />
            </div>
            <div className="xl:col-span-3">
              <FilterSelect
                testId="discover-category-select"
                label="Kategori"
                icon={Tags}
                value={category}
                onChange={setCategory}
                options={[{ value: "", label: "Semua kategori" }, ...data.categories.map((c) => ({ value: c, label: c }))]}
              />
            </div>
            <div className="xl:col-span-3">
              <FilterSelect
                testId="discover-price-select"
                label="Akses tiket"
                icon={TicketCheck}
                value={priceMode}
                onChange={setPriceMode}
                options={[
                  { value: "", label: "Gratis & berbayar" },
                  { value: "free", label: "Gratis" },
                  { value: "paid", label: "Berbayar" },
                ]}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-col justify-between gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center">
            <div className="min-h-5 text-xs text-zinc-400 font-gemini">
              {hasFilter ? (
                <span>
                  Filter aktif <span className="mx-2 text-zinc-600">/</span>
                  <span className="font-semibold text-white">{[city, category, priceMode, q].filter(Boolean).join(" · ")}</span>
                </span>
              ) : (
                "Tampilkan seluruh event dalam jaringan OKKAX"
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                data-testid="discover-reset-btn"
                onClick={reset}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 text-sm font-semibold text-zinc-300 hover:border-white/25 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <RotateCcw size={15} /> Reset
              </button>
              <button
                data-testid="discover-apply-btn"
                onClick={() => load()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-6 text-sm font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <Filter size={15} /> Terapkan filter
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <SpotlightCard className="mt-14 p-12 text-center">
            <p className="text-base font-bold text-white">Belum ada event yang cocok</p>
            <p className="mt-2 text-sm text-zinc-400">Ubah filter atau publikasikan event Anda melalui Event Studio.</p>
            <button
              data-testid="discover-empty-reset-btn"
              onClick={reset}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:border-white/30 hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <RotateCcw size={15} /> Reset filter
            </button>
          </SpotlightCard>
        ) : (
          <>
            {!hasFilter && sections.map((s) => (
              <section key={s.key} className="mt-12" data-testid={`discover-section-${s.key}`}>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold md:text-lg">{s.title}</h2>
                    {s.sub && <p className="text-xs text-zinc-500">{s.sub}</p>}                  </div>
                  <span className="num text-xs text-zinc-500">{num(s.items.length)} event</span>
                </div>
                <div className="okx-scroll mt-4 flex gap-4 overflow-x-auto pb-2">
                  {s.items.map((ev) => (
                    <div key={`${s.key}-${ev.id}`} className="w-[290px] shrink-0">
                      <EventCard ev={ev} saved={saved.includes(ev.id)} onSave={toggleSave} compactMode unsplashAssignments={unsplashAssignments} />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {catalogueItems.length > 0 && <section className="mt-14" data-testid="discover-all-section">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold md:text-lg">{hasFilter ? "Hasil event" : "Event lainnya"}</h2>
                  <p className="text-xs text-zinc-500">
                    {hasFilter ? "Event yang sesuai dengan filter Anda" : "Event terpublikasi lain di jaringan OKKAX"}
                  </p>
                </div>
                <span className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1"><Users size={12} /> organizer terverifikasi</span>
                  <span className="inline-flex items-center gap-1"><Store size={12} /> tenant aktif</span>
                </span>
              </div>
              <RevealGroup stagger={0.06} className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {catalogueItems.map((ev) => (
                  <RevealItem key={ev.id}>
                    <EventCard ev={ev} saved={saved.includes(ev.id)} onSave={toggleSave} unsplashAssignments={unsplashAssignments} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </section>}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
