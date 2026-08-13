import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, CalendarDays, Filter, RotateCcw, Users, Store, TrendingUp, Mic2 } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, compact, idr, num } from "@/lib/api";

const SECTIONS = [
  ["live", "Sedang berlangsung", "Event yang panggungnya hidup hari ini"],
  ["this_week", "Minggu ini", "Berlangsung dalam 7 hari ke depan"],
  ["almost_sold_out", "Hampir habis", "Tiket terjual di atas 70%"],
  ["top_impact", "Event Terbesar", ""],
];

function EventCard({ ev, saved, onSave, compactMode }) {
  return (
    <article data-testid={`discover-event-card-${ev.id}`}
      className="group flex flex-col border border-[var(--okx-border)] bg-[var(--okx-surface)] transition-colors hover:border-[var(--okx-accent)]/60">
      <div className={`relative overflow-hidden ${compactMode ? "h-32" : "h-44"}`}>
        <img src={ev.hero_image} alt={ev.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="bg-[#0a0a0acc] px-2 py-1 text-[11px] uppercase tracking-wider">{ev.event_type}</span>
          {ev.is_live && (
            <span className="flex items-center gap-1.5 bg-[var(--okx-accent)] px-2 py-1 text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
            </span>
          )}
          {!ev.is_live && ev.almost_sold_out && (
            <span className="bg-[var(--okx-accent)] px-2 py-1 text-[11px] font-semibold">Hampir habis</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className={`font-semibold ${compactMode ? "text-sm" : "text-base md:text-lg"}`}>{ev.name}</h3>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {ev.start_date}</span>
          <span className="inline-flex items-center gap-1"><MapPin size={13} /> {ev.city}</span>
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          <span className="text-zinc-400">{ev.organizer_name}</span>
          {ev.headline_talent && (
            <span className="ml-2 inline-flex items-center gap-1 text-zinc-400"><Mic2 size={12} /> {ev.headline_talent}</span>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[11px] text-zinc-500">
            <span>Tiket terjual</span>
            <span className="num accent-text">{ev.sold_percentage}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-[#1f1f22]">
            <div className="h-full bg-[var(--okx-accent)]" style={{ width: `${Math.min(100, ev.sold_percentage)}%` }} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-y border-[var(--okx-border)] py-2.5 text-[11px] text-zinc-500">
          <span className="flex flex-col"><span className="num text-zinc-200">{num(ev.tenant_count)}</span> tenant</span>
          <span className="flex flex-col"><span className="num text-zinc-200">{num(ev.vendor_count)}</span> vendor</span>
          <span className="flex flex-col"><span className="num text-zinc-200">{num(ev.sponsor_sold)}/{num(ev.sponsor_slots)}</span> sponsor</span>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Mulai dari</div>
            <div className="num text-lg font-bold">{ev.min_price ? idr(ev.min_price) : "Gratis"}</div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div className="flex items-center justify-end gap-1 accent-text">
              <TrendingUp size={12} /> <span className="num">{compact(ev.economic_ripple)}</span>
            </div>
            <div className="num">{num(ev.tickets_remaining)} tiket tersisa</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link to={`/events/${ev.id}`} data-testid={`discover-view-btn-${ev.id}`}
            className="flex-1 bg-[var(--okx-accent)] px-4 py-2.5 text-center text-sm font-semibold hover:bg-[var(--okx-accent-hover)]">
            Lihat Event
          </Link>
          <button data-testid={`discover-save-btn-${ev.id}`} onClick={() => onSave(ev.id)}
            className={`border px-4 py-2.5 text-sm ${saved ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-300"}`}>
            {saved ? "Disimpan" : "Simpan"}
          </button>
        </div>
      </div>
    </article>
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

  const reset = () => {
    setQ(""); setCity(""); setCategory(""); setPriceMode("");
    load({ q: "", city: "", category: "", priceMode: "" });
  };

  const toggleSave = (id) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("okkax_saved", JSON.stringify(next));
  };

  const byId = useMemo(() => Object.fromEntries(data.items.map((e) => [e.id, e])), [data.items]);
  const hasFilter = Boolean(q || city || category || priceMode);
  const sections = SECTIONS.map(([key, title, sub]) => ({
    key, title, sub,
    items: (data.highlights?.[key] || []).map((id) => byId[id]).filter(Boolean).slice(0, 8),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="editorial text-3xl sm:text-5xl">OKKAX Discover</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Event yang sedang berlangsung, akan berlangsung, hampir habis, gratis, dan berbayar — beserta organizer,
          talent, tenant, sponsor, dan dampak ekonominya. Semua berasal dari data OKKAX.
        </p>

        {data.totals && (
          <div className="mt-7 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4"
            data-testid="discover-network-stats">
            {[
              ["Event di jaringan", num(data.totals.events)],
              ["Kota", num(data.totals.cities)],
              ["Kategori", num(data.totals.categories)],
              ["Aktivitas ekonomi", compact(data.totals.economic_ripple)],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--okx-surface)] p-4">
                <div className="text-[11px] uppercase tracking-widest text-zinc-500">{label}</div>
                <div className="num mt-1 text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-1 items-center gap-2 border border-[var(--okx-border)] bg-[#0d0d0d] px-3">
              <Search size={16} className="text-zinc-500" />
              <input data-testid="discover-search-input" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Cari event, talent, atau organizer"
                aria-label="Cari event" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-zinc-600" />
            </div>
            <select data-testid="discover-city-select" aria-label="Filter kota" value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none">
              <option value="">Semua kota</option>
              {data.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select data-testid="discover-category-select" aria-label="Filter kategori" value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none">
              <option value="">Semua kategori</option>
              {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select data-testid="discover-price-select" aria-label="Filter harga" value={priceMode}
              onChange={(e) => setPriceMode(e.target.value)}
              className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none">
              <option value="">Gratis & berbayar</option>
              <option value="free">Gratis</option>
              <option value="paid">Berbayar</option>
            </select>
            <button data-testid="discover-apply-btn" onClick={() => load()}
              className="inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--okx-accent-hover)]">
              <Filter size={15} /> Terapkan
            </button>
            <button data-testid="discover-reset-btn" onClick={reset}
              className="inline-flex items-center justify-center gap-2 border border-[var(--okx-border)] px-4 py-2.5 text-sm text-zinc-300 hover:border-[var(--okx-accent)] hover:text-white">
              <RotateCcw size={15} /> Reset filter
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span data-testid="discover-result-count" className="num text-zinc-300">
              {num(data.items.length)} event ditemukan
            </span>
            {hasFilter && <span>· filter aktif: {[city, category, priceMode, q].filter(Boolean).join(" · ")}</span>}
          </div>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-80 animate-pulse border border-[var(--okx-border)] bg-[var(--okx-surface)]" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div data-testid="discover-empty" className="mt-14 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-12 text-center">
            <p className="text-base font-semibold">Belum ada event yang cocok</p>
            <p className="mt-2 text-sm text-zinc-500">Ubah filter atau publikasikan event Anda melalui Event Studio.</p>
            <button data-testid="discover-empty-reset-btn" onClick={reset}
              className="mt-5 inline-flex items-center gap-2 border border-[var(--okx-border)] px-4 py-2.5 text-sm hover:border-[var(--okx-accent)]">
              <RotateCcw size={15} /> Reset filter
            </button>
          </div>
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
                      <EventCard ev={ev} saved={saved.includes(ev.id)} onSave={toggleSave} compactMode />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="mt-14" data-testid="discover-all-section">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold md:text-lg">Semua event</h2>
                  <p className="text-xs text-zinc-500">Seluruh event terpublikasi di jaringan OKKAX</p>
                </div>
                <span className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1"><Users size={12} /> organizer terverifikasi</span>
                  <span className="inline-flex items-center gap-1"><Store size={12} /> tenant aktif</span>
                </span>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((ev) => (
                  <EventCard key={ev.id} ev={ev} saved={saved.includes(ev.id)} onSave={toggleSave} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
