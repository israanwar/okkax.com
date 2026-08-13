import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Users, Building2, TrendingUp } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, compact, idr, num } from "@/lib/api";
import MAP from "@/data/indonesia-map.json";

const [LNG0, LNG1, LAT0, LAT1] = MAP.bbox;
const project = (lat, lng) => ({
  x: ((lng - LNG0) / (LNG1 - LNG0)) * MAP.width,
  y: ((LAT0 - lat) / (LAT0 - LAT1)) * MAP.height,
});

const METRICS = [
  ["Total aktivitas ekonomi", "economic_activity"],
  ["Total biaya event", "total_cost"],
  ["GMV tiket", "ticket_gmv"],
  ["Nilai sponsor", "sponsor_value"],
  ["Pendapatan tenant", "tenant_revenue"],
  ["Pendapatan venue", "venue_income"],
  ["Pembayaran talent", "talent_payout"],
  ["Pembayaran vendor", "vendor_payout"],
  ["Upah tenaga kerja", "workforce_payout"],
];

export default function EconomyMap() {
  const [data, setData] = useState(null);
  const [activeCity, setActiveCity] = useState(null);
  const [hover, setHover] = useState(null);
  const [metric, setMetric] = useState("economic_activity");

  useEffect(() => {
    api.get("/economy/map").then(({ data }) => {
      setData(data);
      setActiveCity(data.cities?.[0]?.city || null);
    });
  }, []);

  const cities = useMemo(() => data?.cities || [], [data]);
  const max = useMemo(() => Math.max(1, ...cities.map((c) => c[metric] || 0)), [cities, metric]);
  const active = cities.find((c) => c.city === activeCity) || null;
  const focus = hover ? cities.find((c) => c.city === hover) : null;

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <span className="border border-[var(--okx-accent)]/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] accent-text">
            Economic Ripple Map
          </span>
          <h1 className="editorial mt-5 text-3xl sm:text-5xl">Peta Kota Event</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Sebaran event OKKAX di seluruh Indonesia beserta dampak ekonominya per kota — biaya event,
            GMV tiket, nilai sponsor, pendapatan tenant dan venue, hingga upah tenaga kerja lokal.
          </p>
        </div>

        {!data ? (
          <div className="mt-10 text-sm text-zinc-500" data-testid="map-loading">Memuat peta ekonomi event…</div>
        ) : (
          <>
            <div className="mt-8 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4"
              data-testid="map-totals">
              {[
                ["Kota aktif", num(data.totals.cities), MapPin],
                ["Event terhubung", num(data.totals.event_count), TrendingUp],
                ["Bisnis teraktivasi", num(data.totals.businesses), Building2],
                ["Tenaga kerja terserap", num(data.totals.workers), Users],
              ].map(([label, value, Icon]) => (
                <div key={label} className="bg-[var(--okx-surface)] p-5">
                  <Icon size={16} className="accent-text" />
                  <div className="mt-3 text-xs uppercase tracking-widest text-zinc-500">{label}</div>
                  <div className="num mt-1 text-2xl font-semibold">{value}</div>
                </div>
              ))}
              <div className="bg-[var(--okx-surface)] p-5 sm:col-span-2 lg:col-span-4">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Total aktivitas ekonomi jaringan</div>
                <div className="num mt-1 text-3xl font-semibold accent-text" data-testid="map-total-activity">
                  {idr(data.totals.economic_activity)}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2" data-testid="map-metric-switch">
              {METRICS.map(([label, key]) => (
                <button key={key} data-testid={`map-metric-${key}`} onClick={() => setMetric(key)}
                  className={`border px-3 py-1.5 text-xs transition-colors ${metric === key
                    ? "border-[var(--okx-accent)] accent-text"
                    : "border-[var(--okx-border)] text-zinc-400 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
              <div className="relative overflow-hidden border border-[var(--okx-border)] bg-[#080808]" data-testid="indonesia-map">
                <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      "linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }} />
                <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="relative block w-full">
                  <defs>
                    <radialGradient id="cityGlow">
                      <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#ff2e7e" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {MAP.provinces.map((p) =>
                    p.paths.map((d, i) => (
                      <path key={`${p.state}-${i}`} d={d} fill="#17171a" stroke="#3a3a42" strokeWidth="0.7" />
                    ))
                  )}
                  {cities.map((c) => {
                    const { x, y } = project(c.lat, c.lng);
                    const value = c[metric] || 0;
                    const r = 6 + Math.sqrt(value / max) * 26;
                    const isActive = active?.city === c.city;
                    const dim = focus && focus.city !== c.city;
                    return (
                      <g key={c.city} data-testid={`map-city-${c.city}`} transform={`translate(${x},${y})`}
                        onMouseEnter={() => setHover(c.city)} onMouseLeave={() => setHover(null)}
                        onClick={() => setActiveCity(c.city)}
                        style={{ cursor: "pointer", opacity: dim ? 0.35 : 1, transition: "opacity .2s ease" }}>
                        <circle r={r * 1.9} fill="url(#cityGlow)" opacity={isActive ? 0.9 : 0.45} />
                        <circle r={r} fill="#ff2e7e" fillOpacity={isActive ? 0.55 : 0.22}
                          stroke={isActive ? "#ffffff" : "#ff2e7e"} strokeWidth={isActive ? 2 : 1.2} />
                        {isActive && (
                          <circle r={r} fill="none" stroke="#ffffff" strokeOpacity="0.5">
                            <animate attributeName="r" values={`${r};${r + 16};${r}`} dur="2.6s" repeatCount="indefinite" />
                            <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <text textAnchor="middle" y={-r - 8} fontSize="11" fontWeight="600"
                          fill={isActive ? "#ffffff" : "#e4e4e7"}>{c.city}</text>
                        {(isActive || focus?.city === c.city) && (
                          <text textAnchor="middle" y={-r - 20} fontSize="9.5" fill="#ff7ab0">{compact(value)}</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--okx-border)] px-4 py-2 text-[11px] text-zinc-500">
                  <span>Ukuran gelembung mengikuti metrik terpilih · klik kota untuk detail</span>
                  <span>{data.label}</span>
                </div>
              </div>

              <div className="space-y-6">
                {active && (
                  <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid="map-city-detail">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                      <MapPin size={13} className="accent-text" /> Kota
                    </div>
                    <h2 className="mt-1 text-base font-semibold md:text-lg">{active.city}</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {active.event_count} event · kapasitas {num(active.capacity)} pengunjung ·{" "}
                      {active.categories.join(", ")}
                    </p>
                    <dl className="mt-4 space-y-2 text-sm">
                      {METRICS.map(([label, key]) => (
                        <div key={key} className="flex justify-between gap-3 border-b border-[var(--okx-border)] pb-1.5">
                          <dt className="text-zinc-500">{label}</dt>
                          <dd className={`num ${key === metric ? "accent-text" : ""}`}>{idr(active[key])}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 border-b border-[var(--okx-border)] pb-1.5">
                        <dt className="text-zinc-500">Bisnis teraktivasi</dt>
                        <dd className="num">{num(active.businesses)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-zinc-500">Tenaga kerja</dt>
                        <dd className="num">{num(active.workers)} orang</dd>
                      </div>
                    </dl>
                    <div className="mt-4 space-y-2">
                      <div className="text-xs uppercase tracking-wider text-zinc-500">Event di kota ini</div>
                      {active.events.map((e) => (
                        <Link key={e.id} to={`/events/${e.id}`} data-testid={`map-event-${e.id}`}
                          className="flex items-center justify-between gap-3 border border-[var(--okx-border)] px-3 py-2 text-xs transition-colors hover:border-[var(--okx-accent)]">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-200">{e.name}</span>
                            <span className="text-zinc-500">{e.event_type} · {e.start_date}</span>
                          </span>
                          <span className="num shrink-0 accent-text">{compact(e.economic_activity)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid="map-ranking">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    Peringkat kota — {METRICS.find(([, k]) => k === metric)?.[0]}
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {cities.map((c) => (
                      <button key={c.city} data-testid={`map-rank-${c.city}`} onClick={() => setActiveCity(c.city)}
                        onMouseEnter={() => setHover(c.city)} onMouseLeave={() => setHover(null)}
                        className="block w-full text-left">
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className={active?.city === c.city ? "text-white" : "text-zinc-400"}>{c.city}</span>
                          <span className="num text-zinc-500">{compact(c[metric])}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full bg-[#1f1f22]">
                          <div className="h-full transition-all"
                            style={{
                              width: `${Math.max(3, ((c[metric] || 0) / max) * 100)}%`,
                              background: active?.city === c.city ? "#ffffff" : "var(--okx-accent)",
                            }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
