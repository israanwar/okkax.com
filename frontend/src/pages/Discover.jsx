import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, CalendarDays, Filter } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, idr, num } from "@/lib/api";

export default function Discover() {
  const [data, setData] = useState({ items: [], cities: [], categories: [] });
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [priceMode, setPriceMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("okkax_saved") || "[]"));

  const load = async () => {
    setLoading(true);
    try {
      const params = { q, city, category };
      if (priceMode === "free") params.free = true;
      if (priceMode === "paid") params.free = false;
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

  const toggleSave = (id) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("okkax_saved", JSON.stringify(next));
  };

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="editorial text-3xl sm:text-5xl">OKKAX Discover</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Event yang sedang berlangsung, akan berlangsung, baru diumumkan, hampir habis, gratis, dan berbayar —
          semuanya berasal dari data OKKAX.
        </p>

        <div className="mt-8 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-1 items-center gap-2 border border-[var(--okx-border)] bg-[#0d0d0d] px-3">
              <Search size={16} className="text-zinc-500" />
              <input
                data-testid="discover-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Cari event, talent, atau organizer"
                aria-label="Cari event"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            <select
              data-testid="discover-city-select"
              aria-label="Filter kota"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Semua kota</option>
              {data.cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              data-testid="discover-category-select"
              aria-label="Filter kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Semua kategori</option>
              {data.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              data-testid="discover-price-select"
              aria-label="Filter harga"
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value)}
              className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Gratis & berbayar</option>
              <option value="free">Gratis</option>
              <option value="paid">Berbayar</option>
            </select>
            <button
              data-testid="discover-apply-btn"
              onClick={load}
              className="inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--okx-accent-hover)]"
            >
              <Filter size={15} /> Terapkan
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse border border-[var(--okx-border)] bg-[var(--okx-surface)]" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div data-testid="discover-empty" className="mt-14 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-12 text-center">
            <p className="text-base font-semibold">Belum ada event yang cocok</p>
            <p className="mt-2 text-sm text-zinc-500">Ubah filter atau publikasikan event Anda melalui Event Studio.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((ev) => (
              <article
                key={ev.id}
                data-testid={`discover-event-card-${ev.id}`}
                className="group flex flex-col border border-[var(--okx-border)] bg-[var(--okx-surface)] transition-colors hover:border-zinc-600"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={ev.hero_image} alt={ev.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className="bg-[#0a0a0acc] px-2 py-1 text-[11px] uppercase tracking-wider">{ev.event_type}</span>
                    {ev.almost_sold_out && (
                      <span className="bg-[var(--okx-accent)] px-2 py-1 text-[11px] font-semibold">Hampir habis</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-semibold md:text-lg">{ev.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {ev.start_date}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={13} /> {ev.city}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{ev.description}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-zinc-500">Mulai dari</div>
                      <div className="num text-lg font-bold">{ev.min_price ? idr(ev.min_price) : "Gratis"}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      <div className="num">{num(ev.tickets_remaining)} tiket tersisa</div>
                      <div className="num">{num(ev.sold)} terjual</div>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Link
                      to={`/events/${ev.id}`}
                      data-testid={`discover-view-btn-${ev.id}`}
                      className="flex-1 bg-[var(--okx-accent)] px-4 py-2.5 text-center text-sm font-semibold hover:bg-[var(--okx-accent-hover)]"
                    >
                      Lihat Event
                    </Link>
                    <button
                      data-testid={`discover-save-btn-${ev.id}`}
                      onClick={() => toggleSave(ev.id)}
                      className={`border px-4 py-2.5 text-sm ${saved.includes(ev.id) ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-300"}`}
                    >
                      {saved.includes(ev.id) ? "Disimpan" : "Simpan"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
