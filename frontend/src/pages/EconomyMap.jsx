import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Users, Building2, TrendingUp } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, compact, idr, num } from "@/lib/api";
import MAP from "@/data/indonesia-map.json";
import CalendarBoard from "@/components/CalendarBoard";
import {
  Reveal,
  RevealGroup,
  RevealItem,
  MaskReveal,
  MotionPanel,
  ScrollProgressBar,
  CounterNumber,
  SpotlightCard,
} from "@/components/MotionPrimitives";

const [LNG0, LNG1, LAT0, LAT1] = MAP.bbox;
const project = (lat, lng) => ({
  x: ((lng - LNG0) / (LNG1 - LNG0)) * MAP.width,
  y: ((LAT0 - lat) / (LAT0 - LAT1)) * MAP.height,
});

const METRICS = [
  ["Total aktivitas event", "economic_activity"],
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
    <div className="min-h-screen bg-[#050508] text-white font-gemini">
      <ScrollProgressBar />
      <PublicNav />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-3xl">
          <Reveal delay={0.05}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
              <MapPin size={11} className="text-zinc-400" />
              Live Event Map
            </span>
          </Reveal>
          <MaskReveal delay={0.1}>
            <h1 className="editorial mt-4 text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Peta Kota Event
            </h1>
          </MaskReveal>
          <Reveal delay={0.2}>
            <p className="mt-2.5 text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
              Sebaran live event OKKAX di seluruh Indonesia beserta telemetri aktivitas per kota — biaya event,
              GMV tiket, nilai sponsor, pendapatan tenant dan venue, hingga upah tenaga kerja lokal.
            </p>
          </Reveal>
        </div>

        {!data ? (
          <div className="mt-10 text-sm text-zinc-500 font-gemini" data-testid="map-loading">
            Memuat peta aktivitas live event…
          </div>
        ) : (
          <>
            {/* Top Unified 5-Stat Ribbon */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="map-totals">
              <SpotlightCard className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                  <TrendingUp size={13} className="text-emerald-400" />
                  Total Aktivitas
                </div>
                <div className="num mt-2 text-xl sm:text-2xl font-bold text-white tracking-tight" data-testid="map-total-activity">
                  {idr(data.totals.economic_activity)}
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                  <MapPin size={13} className="text-zinc-300" />
                  Kota Aktif
                </div>
                <div className="num mt-2 text-xl sm:text-2xl font-bold text-white">
                  <CounterNumber value={data.totals.cities} />
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                  <TrendingUp size={13} className="text-zinc-300" />
                  Event Terhubung
                </div>
                <div className="num mt-2 text-xl sm:text-2xl font-bold text-white">
                  <CounterNumber value={data.totals.event_count} />
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                  <Building2 size={13} className="text-zinc-300" />
                  Bisnis Teraktivasi
                </div>
                <div className="num mt-2 text-xl sm:text-2xl font-bold text-white">
                  <CounterNumber value={data.totals.businesses} />
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-4 sm:p-5 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                  <Users size={13} className="text-zinc-300" />
                  Tenaga Kerja
                </div>
                <div className="num mt-2 text-xl sm:text-2xl font-bold text-white">
                  <CounterNumber value={data.totals.workers} />
                </div>
              </SpotlightCard>
            </div>

            {/* Metric Switcher Ribbon */}
            <div className="mt-6 flex flex-wrap gap-2" data-testid="map-metric-switch">
              {METRICS.map(([label, key]) => (
                <button
                  key={key}
                  data-testid={`map-metric-${key}`}
                  onClick={() => setMetric(key)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    metric === key
                      ? "border-white bg-white text-black font-bold shadow-md shadow-white/10"
                      : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Main Balanced 2-Column Grid */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
              {/* Left Column: Map + Calendar */}
              <div className="min-w-0 space-y-6">
                <SpotlightCard className="overflow-hidden" data-testid="indonesia-map">
                  <div className="relative overflow-hidden bg-[#07070c]">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.12]"
                      style={{
                        backgroundImage:
                          "linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                      }}
                    />
                    <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="relative block w-full">
                      <defs>
                        <radialGradient id="cityGlow">
                          <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#ff2e7e" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      {MAP.provinces.map((p) =>
                        p.paths.map((d, i) => (
                          <path key={`${p.state}-${i}`} d={d} fill="#14141c]" stroke="#2c2c38" strokeWidth="0.7" />
                        ))
                      )}

                      {/* Inter-City Flight Routes */}
                      {[
                        [[-6.2088, 106.8456], [-6.9175, 107.6191]],
                        [[-6.9175, 107.6191], [-7.7956, 110.3695]],
                        [[-7.7956, 110.3695], [-7.2575, 112.7521]],
                        [[-7.2575, 112.7521], [-8.4095, 115.1889]],
                        [[3.5952, 98.6722], [-6.2088, 106.8456]],
                        [[-7.2575, 112.7521], [-5.1477, 119.4327]],
                      ].map(([c1, c2], idx) => {
                        const p1 = project(c1[0], c1[1]);
                        const p2 = project(c2[0], c2[1]);
                        const curveY = (p1.y + p2.y) / 2 - 25;
                        const pathD = `M${p1.x},${p1.y} Q${(p1.x + p2.x) / 2},${curveY} ${p2.x},${p2.y}`;
                        return (
                          <g key={idx} pointerEvents="none">
                            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 6" />
                            <path d={pathD} fill="none" stroke="#ff2e7e" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="6 20">
                              <animate attributeName="stroke-dashoffset" values="26;0" dur="2.4s" repeatCount="indefinite" />
                            </path>
                          </g>
                        );
                      })}

                      {cities.map((c) => {
                        const { x, y } = project(c.lat, c.lng);
                        const value = c[metric] || 0;
                        const r = 6 + Math.sqrt(value / max) * 26;
                        const isActive = active?.city === c.city;
                        const dim = focus && focus.city !== c.city;
                        return (
                          <g
                            key={c.city}
                            data-testid={`map-city-${c.city}`}
                            transform={`translate(${x},${y})`}
                            onMouseEnter={() => setHover(c.city)}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => setActiveCity(c.city)}
                            style={{ cursor: "pointer", opacity: dim ? 0.35 : 1, transition: "opacity .2s ease" }}
                          >
                            <circle r={r * 1.8} fill="url(#cityGlow)" opacity={isActive ? 0.9 : 0.4} />
                            <circle
                              r={r}
                              fill={isActive ? "#ffffff" : "#2a2a3e"}
                              fillOpacity={isActive ? 0.35 : 0.6}
                              stroke={isActive ? "#ffffff" : "rgba(255,255,255,0.3)"}
                              strokeWidth={isActive ? 2 : 1.2}
                            />
                            {isActive && (
                              <circle r={r} fill="none" stroke="#ffffff" strokeOpacity="0.6">
                                <animate attributeName="r" values={`${r};${r + 14};${r}`} dur="2.6s" repeatCount="indefinite" />
                                <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="2.6s" repeatCount="indefinite" />
                              </circle>
                            )}
                            <text
                              textAnchor="middle"
                              y={-r - 8}
                              fontSize="11"
                              fontWeight="bold"
                              fill={isActive ? "#ffffff" : "#d4d4d8"}
                              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                            >
                              {c.city}
                            </text>
                            {(isActive || focus?.city === c.city) && (
                              <text
                                textAnchor="middle"
                                y={-r - 20}
                                fontSize="9.5"
                                fill="#ffffff"
                                fontWeight="bold"
                                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                              >
                                {compact(value)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-[#0c0c14]/90 px-4 py-2.5 text-[11px] text-zinc-400 font-gemini">
                      <span>Ukuran lingkaran mengikuti metrik terpilih · klik kota untuk detail</span>
                      <span className="font-mono text-zinc-300">{data.label}</span>
                    </div>
                  </div>
                </SpotlightCard>

                <CalendarBoard mode="public" compact initialCity={activeCity || ""} />
              </div>

              {/* Right Column: City Detail + Rankings */}
              <div className="space-y-6">
                {active && (
                  <MotionPanel activeKey={active.city}>
                    <SpotlightCard className="p-5" data-testid="map-city-detail">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono">
                          <MapPin size={11} className="text-zinc-400" /> Detail Kota
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {active.event_count} event
                        </span>
                      </div>

                      <h2 className="mt-2 text-xl font-bold text-white tracking-tight">{active.city}</h2>
                      <p className="mt-1 text-xs text-zinc-400 leading-relaxed font-gemini">
                        Kapasitas {num(active.capacity)} pengunjung · {active.categories.join(", ")}
                      </p>

                      {/* Telemetry Metrics List */}
                      <dl className="mt-4 space-y-1.5 text-xs font-gemini">
                        {METRICS.map(([label, key]) => (
                          <div key={key} className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-1">
                            <dt className="text-zinc-400">{label}</dt>
                            <dd className={`font-mono ${key === metric ? "font-bold text-white" : "text-zinc-300"}`}>
                              {idr(active[key])}
                            </dd>
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-1">
                          <dt className="text-zinc-400">Bisnis teraktivasi</dt>
                          <dd className="font-mono text-zinc-200">{num(active.businesses)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1">
                          <dt className="text-zinc-400">Tenaga kerja</dt>
                          <dd className="font-mono text-zinc-200">{num(active.workers)} orang</dd>
                        </div>
                      </dl>

                      {/* Events in this City (Compact Scrollable) */}
                      <div className="mt-4 border-t border-white/[0.08] pt-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono mb-2">
                          Event di {active.city}
                        </div>
                        <div className="max-h-48 overflow-y-auto okx-custom-scrollbar space-y-1.5 pr-0.5">
                          {active.events.map((e) => (
                            <Link
                              key={e.id}
                              to={`/events/${e.id}`}
                              data-testid={`map-event-${e.id}`}
                              className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#141420]/90 px-3 py-2 text-xs transition-all hover:border-white/30 hover:bg-white/[0.06]"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-bold text-white group-hover:text-zinc-100">{e.name}</span>
                                <span className="text-[10.5px] text-zinc-400">{e.event_type} · {e.start_date}</span>
                              </span>
                              <span className="font-mono font-bold text-white shrink-0 text-xs">{compact(e.economic_activity)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </SpotlightCard>
                  </MotionPanel>
                )}

                {/* City Rankings Panel */}
                <SpotlightCard className="p-5" data-testid="map-ranking">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                      Peringkat Kota — {METRICS.find(([, k]) => k === metric)?.[0]}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">{cities.length} Kota</span>
                  </div>

                  <div className="mt-3.5 max-h-64 overflow-y-auto okx-custom-scrollbar pr-1 space-y-2">
                    {cities.map((c) => (
                      <button
                        key={c.city}
                        data-testid={`map-rank-${c.city}`}
                        onClick={() => setActiveCity(c.city)}
                        onMouseEnter={() => setHover(c.city)}
                        onMouseLeave={() => setHover(null)}
                        className={`block w-full rounded-xl p-2 text-left transition-all cursor-pointer ${
                          active?.city === c.city ? "bg-white/[0.08] border border-white/20" : "hover:bg-white/[0.03] border border-transparent"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className={`font-medium ${active?.city === c.city ? "font-bold text-white" : "text-zinc-300"}`}>
                            {c.city}
                          </span>
                          <span className="font-mono font-semibold text-zinc-400 text-[11px]">{compact(c[metric])}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              active?.city === c.city ? "bg-gradient-to-r from-zinc-300 to-white" : "bg-white/30"
                            }`}
                            style={{
                              width: `${Math.max(3, ((c[metric] || 0) / max) * 100)}%`,
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </SpotlightCard>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
