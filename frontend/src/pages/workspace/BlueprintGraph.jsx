import { useEffect, useState } from "react";
import { api, compact, idr } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export function Blueprint({ eventId, event }) {
  const [bp, setBp] = useState(null);
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [engines, setEngines] = useState([]);
  const [engine, setEngine] = useState("");

  useEffect(() => {
    api.get("/ai/engines").then(({ data }) => {
      setEngines(data.engines || []);
      setEngine(data.default);
    }).catch(() => {});
  }, []);

  const load = async () => {
    const [{ data: b }, { data: br }] = await Promise.all([
      api.get(`/events/${eventId}/blueprint`),
      api.get(`/events/${eventId}/brief`),
    ]);
    setBp(b.blueprint);
    setSummary(b.blueprint?.summary || "");
    setBrief(br.brief?.payload);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId]);

  const compile = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/events/${eventId}/compile`, null, { params: engine ? { engine } : {} });
      setBp(data.blueprint);
      setSummary(data.blueprint.summary);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (bp?.ai_status !== "refining") return;
    const t = setInterval(async () => {
      const { data } = await api.get(`/events/${eventId}/blueprint`);
      if (data.blueprint?.ai_status !== "refining") {
        setBp(data.blueprint);
        setSummary(data.blueprint.summary);
      }
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [bp?.ai_status, eventId]);

  const saveSummary = async () => {
    const { data } = await api.patch(`/events/${eventId}/blueprint`, { summary });
    setBp(data.blueprint);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold md:text-lg">AI Event Blueprint</h2>
          <p className="text-xs text-zinc-500" data-testid="blueprint-source">
            Sumber: {bp?.source || "belum dikompilasi"}
            {bp?.ai_status === "refining" && " · AI Event Compiler sedang menyempurnakan blueprint…"}
            · Semua output AI dapat diedit sebelum dikonfirmasi.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            data-testid="ai-engine-select"
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="border border-[var(--okx-border)] bg-[var(--okx-surface)] px-3 py-2.5 text-xs text-zinc-300 focus:outline-none"
          >
            {engines.map((e) => (
              <option key={e.key} value={e.key}>{e.label}</option>
            ))}
          </select>
          <button data-testid="compile-btn" onClick={compile} disabled={busy} className="bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
            {busy ? "AI Event Compiler bekerja…" : bp ? "Kompilasi ulang" : "Compile Blueprint"}
          </button>
        </div>
      </div>

      {!bp ? (
        <div data-testid="blueprint-empty" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-10 text-center text-sm text-zinc-400">
          Belum ada blueprint. Jalankan AI Event Compiler untuk mengubah brief menjadi Event Blueprint.
        </div>
      ) : (
        <div className="space-y-6" data-testid="blueprint-content">
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
            <div className="flex items-center gap-2">
              <span className="border border-[var(--okx-accent)]/40 bg-[var(--okx-accent)]/10 px-2 py-0.5 text-[11px] text-[var(--okx-accent-soft)]">Estimasi AI</span>
              <span className="text-xs text-zinc-500">Dapat diedit · bukan keputusan final</span>
            </div>
            <textarea
              data-testid="blueprint-summary-input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="mt-3 w-full border border-[var(--okx-border)] bg-[#0d0d0d] p-3 text-sm outline-none focus:border-[var(--okx-accent)]"
            />
            <button data-testid="blueprint-save-btn" onClick={saveSummary} className="mt-2 border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">
              Simpan sebagai Dikonfirmasi pengguna
            </button>
          </div>

          <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] md:grid-cols-2">
            <Section title="Fase event" rows={bp.phases?.map((p) => [p.name, `${p.objective} · ${p.duration}`])} />
            <Section title="Workstreams" rows={bp.workstreams?.map((w) => [w.name, `${w.owner_role} — ${w.description}`])} />
            <Section title="Timeline" rows={bp.timeline?.map((t) => [t.week, t.activity])} />
            <Section title="Required capabilities" rows={(bp.required_capabilities || []).map((c) => [c, ""])} />
            <Section title="Vendor requirements" rows={bp.vendor_requirements?.map((v) => [v.category, v.scope])} />
            <Section title="Workforce requirements" rows={bp.workforce_requirements?.map((w) => [w.role, `${w.headcount} orang · ${w.shift}`])} />
            <Section title="Sponsor inventory (estimasi)" rows={bp.sponsor_inventory?.map((s) => [s.tier, `${idr(s.price_estimate)} × ${s.quantity}`])} />
            <Section title="Tenant zones (estimasi)" rows={bp.tenant_zones?.map((z) => [z.name, `${z.slots} slot · ${idr(z.price_estimate)}`])} />
            <Section title="Ticket recommendations" rows={bp.ticket_recommendations?.map((t) => [t.name, `${idr(t.price_estimate)} × ${t.quantity}`])} />
            <Section title="Budget categories (estimasi)" rows={bp.budget_categories?.map((b) => [b.category, compact(b.amount_estimate)])} />
            <Section title="Risiko operasional" rows={bp.risks?.map((r) => [`${r.severity} — ${r.risk}`, r.mitigation])} />
            <Section title="Informasi yang belum diketahui" rows={(bp.missing_information || []).map((m) => [m, "Perlu konfirmasi"])} />
          </div>

          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Recommended next actions</h3>
            <ol className="mt-3 space-y-2 text-sm text-zinc-300">
              {(bp.next_actions || []).map((a, i) => (
                <li key={i} className="flex gap-2"><span className="num accent-text">{i + 1}.</span> {a}</li>
              ))}
            </ol>
          </div>

          {brief && (
            <details className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
              <summary className="cursor-pointer text-sm font-semibold">Lihat Event Brief sumber</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(brief).filter(([k]) => k !== "event_id").map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-[var(--okx-border)] py-1.5 text-xs">
                    <span className="text-zinc-500">{k}</span>
                    <span className="num text-right text-zinc-200">{String(v)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, rows = [] }) {
  return (
    <div className="bg-[var(--okx-surface)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{title}</h3>
      <div className="mt-3 space-y-2">
        {(rows || []).map(([a, b], i) => (
          <div key={i} className="border-b border-[var(--okx-border)] pb-2 last:border-0">
            <div className="text-sm font-medium">{a}</div>
            {b && <div className="num text-xs text-zinc-400">{b}</div>}
          </div>
        ))}
        {(!rows || rows.length === 0) && <div className="text-xs text-zinc-600">Belum diketahui</div>}
      </div>
    </div>
  );
}

const KIND_STYLE = {
  Event: { c: "#ffffff", r: 30 },
  Organizer: { c: "#ffffff", r: 15 },
  Talent: { c: "#ff2e7e", r: 17 },
  Rider: { c: "#ff7ab0", r: 13 },
  Venue: { c: "#ff2e7e", r: 18 },
  Vendor: { c: "#ff9ec4", r: 12 },
  Sponsor: { c: "#ff2e7e", r: 15 },
  Tenant: { c: "#ff7ab0", r: 15 },
  Worker: { c: "#ffffff", r: 15 },
  "Ticket tier": { c: "#ff7ab0", r: 14 },
  Budget: { c: "#ffffff", r: 16 },
  Funding: { c: "#ff2e7e", r: 16 },
  Risk: { c: "#ff2e7e", r: 14 },
  Payment: { c: "#ff7ab0", r: 13 },
};
const styleOf = (k) => KIND_STYLE[k] || { c: "#a1a1aa", r: 12 };
const W = 1280;
const H = 860;

function layout(nodes) {
  const pos = { event: { x: W / 2, y: H / 2 } };
  const kinds = [...new Set(nodes.filter((n) => n.id !== "event").map((n) => n.kind))];
  kinds.forEach((k, gi) => {
    const g = nodes.filter((n) => n.kind === k && n.id !== "event");
    const angle = (gi / kinds.length) * Math.PI * 2 - Math.PI / 2;
    const spread = Math.min(0.62, 1.05 / kinds.length + 0.12 + (g.length > 6 ? 0.16 : 0));
    g.forEach((n, i) => {
      const t = g.length === 1 ? 0 : (i / (g.length - 1) - 0.5) * 2;
      const a = angle + t * spread;
      const rad = 235 + (i % 4) * 95;
      pos[n.id] = { x: W / 2 + Math.cos(a) * rad * 1.35, y: H / 2 + Math.sin(a) * rad * 0.86 };
    });
  });
  return { pos };
}

export function Graph({ eventId }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(null);
  const [hover, setHover] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setData(null);
    api.get(`/events/${eventId}/graph`).then(({ data }) => setData(data));
  }, [eventId]);

  if (!data) return <div className="text-sm text-zinc-500" data-testid="graph-loading">Memuat Event Graph…</div>;

  const kinds = [...new Set(data.nodes.map((n) => n.kind))];
  const visible = filter ? data.nodes.filter((n) => n.kind === filter || n.id === "event") : data.nodes;
  const { pos } = layout(visible);
  const ids = new Set(visible.map((n) => n.id));
  const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const focus = hover || active;
  const connected = new Set(
    focus ? edges.filter((e) => e.source === focus.id || e.target === focus.id)
      .flatMap((e) => [e.source, e.target]) : []
  );
  const dim = (id) => focus && id !== focus.id && !connected.has(id);

  return (
    <div className="space-y-5" data-testid="event-graph">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-semibold md:text-lg">Event Graph</h2>
          <p className="text-xs text-zinc-500">
            Satu Event ID menghubungkan seluruh komponen · readiness{" "}
            <span className="num accent-text" data-testid="graph-readiness">{data.readiness_score}%</span> ·{" "}
            <span className="num">{data.nodes.length}</span> node ·{" "}
            <span className="num">{data.edges.length}</span> dependency
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.status_counts).map(([s, c]) => (
            <StatusBadge key={s} status={`${s}`} className="whitespace-nowrap" testId={`graph-count-${s.replace(/\s/g, "-")}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setFilter(""); setActive(null); }} data-testid="graph-filter-all"
          className={`border px-3 py-1.5 text-xs transition-colors ${!filter ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-400 hover:text-white"}`}>
          Semua kategori
        </button>
        {kinds.map((k) => (
          <button key={k} data-testid={`graph-filter-${k.replace(/\s/g, "-")}`} onClick={() => setFilter(k)}
            className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs transition-colors ${filter === k ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-400 hover:text-white"}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: styleOf(k).c }} />
            {k}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button data-testid="graph-zoom-out" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
            className="border border-[var(--okx-border)] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white">−</button>
          <span className="num w-12 text-center text-xs text-zinc-500">{Math.round(zoom * 100)}%</span>
          <button data-testid="graph-zoom-in" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
            className="border border-[var(--okx-border)] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white">+</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        <div className="relative overflow-hidden border border-[var(--okx-border)] bg-[#080808]" data-testid="graph-canvas">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{ backgroundImage: "linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
          <div className="okx-scroll max-h-[620px] overflow-auto">
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: `${zoom * 100}%`, minWidth: "100%" }} className="block">
              <defs>
                <radialGradient id="coreGlow">
                  <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#ff2e7e" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx={W / 2} cy={H / 2} r={300} fill="url(#coreGlow)" opacity="0.45" />
              {edges.map((e, i) => {
                const a = pos[e.source], b = pos[e.target];
                if (!a || !b) return null;
                const on = focus && (e.source === focus.id || e.target === focus.id);
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 26;
                return (
                  <path key={i} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} fill="none"
                    stroke={on ? "#ff2e7e" : "#ffffff"} strokeWidth={on ? 1.8 : 0.8}
                    strokeOpacity={on ? 0.95 : focus ? 0.06 : 0.16}
                    style={{ transition: "stroke-opacity .2s ease, stroke .2s ease" }} />
                );
              })}
              {visible.map((n) => {
                const p = pos[n.id];
                if (!p) return null;
                const st = styleOf(n.kind);
                const isFocus = focus?.id === n.id;
                const faded = dim(n.id);
                const crit = ["Missing", "At Risk", "Blocked", "Conflicted"].includes(n.status);
                return (
                  <g key={n.id} data-testid={`graph-node-${n.id}`} transform={`translate(${p.x},${p.y})`}
                    onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
                    onClick={() => setActive(n)} style={{ cursor: "pointer", opacity: faded ? 0.22 : 1, transition: "opacity .2s ease" }}>
                    {(isFocus || crit) && (
                      <circle r={st.r + 10} fill="none" stroke={crit ? "#ff2e7e" : "#ffffff"} strokeOpacity="0.45">
                        <animate attributeName="r" values={`${st.r + 6};${st.r + 16};${st.r + 6}`} dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r={st.r} fill={st.c} fillOpacity={n.id === "event" ? 1 : 0.14}
                      stroke={st.c} strokeWidth={isFocus ? 2.4 : 1.2} />
                    {n.id === "event" && (
                      <text textAnchor="middle" y="5" fontSize="13" fontWeight="800" fill="#0a0a0a">OKX</text>
                    )}
                    {(visible.length <= 16 || isFocus || connected.has(n.id) || n.id === "event") && (
                      <>
                        <text textAnchor="middle" y={st.r + 16} fontSize="12" fill={isFocus ? "#ffffff" : "#d4d4d8"}>
                          {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
                        </text>
                        <text textAnchor="middle" y={st.r + 29} fontSize="9" fill="#71717a" letterSpacing="0.08em">
                          {n.kind.toUpperCase()}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--okx-border)] px-4 py-2 text-[11px] text-zinc-500">
            <span>Klik node untuk detail · hover untuk menyorot dependency</span>
            <span className="num">Event ID: {eventId}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5 lg:sticky lg:top-20" data-testid="graph-detail">
            {active ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: styleOf(active.kind).c }} />
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">{active.kind}</span>
                </div>
                <h3 className="mt-1 text-base font-semibold md:text-lg">{active.label}</h3>
                <div className="mt-2"><StatusBadge status={active.status} testId="graph-detail-status" /></div>
                <dl className="mt-4 space-y-2 text-sm">
                  {Object.entries(active.meta || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-[var(--okx-border)] pb-1.5">
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="num">{typeof v === "number" && v > 10000 ? idr(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Dependency</div>
                  <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
                    {edges.filter((e) => e.source === active.id || e.target === active.id).map((e, i) => {
                      const other = e.source === active.id ? e.target : e.source;
                      const on = data.nodes.find((n) => n.id === other);
                      return (
                        <li key={i}>
                          <button onClick={() => setActive(on)} className="text-left hover:text-white">
                            <span className="accent-text">{e.label}</span> → {on?.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Klik salah satu node pada graph untuk melihat detail, dependency, dan konflik.</p>
            )}
          </div>

          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Daftar node</div>
            <div className="okx-scroll mt-3 max-h-64 space-y-1.5 overflow-auto pr-1" data-testid="graph-nodes">
              {visible.map((n) => (
                <button key={n.id} data-testid={`graph-list-${n.id}`} onClick={() => setActive(n)}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
                  className={`flex w-full items-center justify-between gap-2 border px-2.5 py-2 text-left text-xs transition-colors ${active?.id === n.id ? "border-[var(--okx-accent)] bg-[var(--okx-accent-tint)]" : "border-transparent hover:border-[var(--okx-border)]"}`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: styleOf(n.kind).c }} />
                    <span className="truncate">{n.label}</span>
                  </span>
                  <StatusBadge status={n.status} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
