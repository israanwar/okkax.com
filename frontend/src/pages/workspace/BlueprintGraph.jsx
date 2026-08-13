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

const KIND_META = {
  Event: { icon: "sparkle", tone: "core", r: 34, ring: 0 },
  Organizer: { icon: "building", tone: "neutral", r: 17, ring: 1 },
  Venue: { icon: "pin", tone: "accent", r: 18, ring: 1 },
  Talent: { icon: "mic", tone: "accent", r: 18, ring: 1 },
  Rider: { icon: "list", tone: "soft", r: 14, ring: 2 },
  Vendor: { icon: "box", tone: "soft", r: 14, ring: 2 },
  Sponsor: { icon: "badge", tone: "accent", r: 16, ring: 1 },
  Tenant: { icon: "store", tone: "soft", r: 16, ring: 1 },
  Worker: { icon: "users", tone: "neutral", r: 16, ring: 1 },
  "Ticket tier": { icon: "ticket", tone: "soft", r: 15, ring: 1 },
  Budget: { icon: "coins", tone: "neutral", r: 17, ring: 1 },
  Funding: { icon: "trend", tone: "accent", r: 17, ring: 1 },
  Risk: { icon: "alert", tone: "accent", r: 15, ring: 1 },
  Payment: { icon: "card", tone: "soft", r: 14, ring: 2 },
};
const TONE = { core: "#ffffff", accent: "#ff2e7e", soft: "#ff7ab0", neutral: "#e4e4e7" };
const metaOf = (k) => KIND_META[k] || { icon: "dot", tone: "neutral", r: 13, ring: 2 };
export const colorOf = (k) => TONE[metaOf(k).tone];

const ICON_PATHS = {
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z",
  building: "M4 20V6l6-3v17M10 20h10V10h-6M14 13h2M14 16h2M6.5 9h1M6.5 12h1M6.5 15h1",
  pin: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zM6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6",
  list: "M4 6h16M4 12h16M4 18h10",
  box: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  badge: "M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1.2 2.7 1.2 2.7-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9L3.3 14.7 4.5 12 3.3 9.3l2.4-1.8.9-2.9 3 .2z",
  store: "M4 9h16v11H4zM3 9l2-5h14l2 5M9 20v-6h6v6",
  users: "M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 6.5a3 3 0 0 1 0 6M17.5 14.5c2.6.5 4.5 2.4 4.5 5.5",
  ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 0 0-4zM12 7v10",
  coins: "M8 11a5 3 0 1 0 0-6 5 3 0 0 0 0 6zM3 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8M11 15v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-5M11 13c0 1.7 2.2 3 5 3s5-1.3 5-3-2.2-3-5-3-5 1.3-5 3z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  alert: "M12 4l9 16H3zM12 10v5M12 18h.01",
  card: "M3 7h18v10H3zM3 11h18M7 15h3",
  dot: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};

export function NodeIcon({ kind, size = 15, color = "#fff", opacity = 1 }) {
  const d = ICON_PATHS[metaOf(kind).icon] || ICON_PATHS.dot;
  return (
    <g transform={`translate(${-size / 2},${-size / 2}) scale(${size / 24})`} opacity={opacity}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

const W = 1180;
const H = 780;
const CX = W / 2;
const CY = H / 2;
const KIND_ORDER = ["Organizer", "Venue", "Vendor", "Talent", "Rider", "Sponsor", "Tenant", "Worker",
  "Ticket tier", "Budget", "Funding", "Payment", "Risk"];

/** Layout simetris: satu Event di pusat, node lain tersebar merata pada dua orbit. */
function layout(nodes) {
  const pos = { event: { x: CX, y: CY, a: 0 } };
  const rest = nodes
    .filter((n) => n.id !== "event")
    .slice()
    .sort((a, b) => {
      const ka = KIND_ORDER.indexOf(a.kind), kb = KIND_ORDER.indexOf(b.kind);
      return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb) || a.label.localeCompare(b.label);
    });
  const N = rest.length || 1;
  rest.forEach((n, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) / N) * Math.PI * 2;
    const twoOrbits = N > 13;
    const orbit = twoOrbits && i % 2 === 1 ? 1 : 0;
    const rx = twoOrbits ? (orbit ? 470 : 328) : 320;
    const ry = twoOrbits ? (orbit ? 322 : 214) : 212;
    pos[n.id] = { x: CX + Math.cos(a) * rx, y: CY + Math.sin(a) * ry, a, orbit };
  });
  return { pos, ordered: rest };
}

function labelAnchor(a) {
  const c = Math.cos(a);
  if (c > 0.12) return "start";
  if (c < -0.12) return "end";
  return "middle";
}

export function Graph({ eventId }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(null);
  const [hover, setHover] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setData(null);
    setActive(null);
    api.get(`/events/${eventId}/graph`).then(({ data }) => setData(data));
  }, [eventId]);

  if (!data) return <div className="text-sm text-zinc-500" data-testid="graph-loading">Memuat Event Graph…</div>;

  const kinds = [...new Set(data.nodes.map((n) => n.kind))];
  const visible = filter ? data.nodes.filter((n) => n.kind === filter || n.id === "event") : data.nodes;
  const { pos } = layout(visible);
  const ids = new Set(visible.map((n) => n.id));
  const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const cand = hover || active;
  const focus = cand && ids.has(cand.id) ? cand : null;
  const connected = new Set(
    focus ? edges.filter((e) => e.source === focus.id || e.target === focus.id).flatMap((e) => [e.source, e.target]) : []
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
          {Object.entries(data.status_counts).map(([s]) => (
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
            <svg width="13" height="13" viewBox="-8 -8 16 16"><NodeIcon kind={k} size={14} color={colorOf(k)} /></svg>
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

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative overflow-hidden border border-[var(--okx-border)] bg-[#080808]" data-testid="graph-canvas">
          <div className="pointer-events-none absolute inset-0 opacity-[0.13]"
            style={{ backgroundImage: "radial-gradient(#ffffff1f 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
          <div className="okx-scroll max-h-[660px] overflow-auto">
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: `${zoom * 100}%`, minWidth: "100%" }} className="block">
              <defs>
                <radialGradient id="okxCore">
                  <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="#ff2e7e" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#ff2e7e" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="okxEdge" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ff7ab0" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              <circle cx={CX} cy={CY} r={430} fill="url(#okxCore)" pointerEvents="none" />
              {[214, 322].map((r, i) => (
                <ellipse key={r} cx={CX} cy={CY} rx={i ? 470 : 328} ry={r} fill="none"
                  stroke="#ffffff" strokeOpacity="0.05" strokeDasharray="3 9" pointerEvents="none" />
              ))}

              {edges.map((e, i) => {
                const a = pos[e.source], b = pos[e.target];
                if (!a || !b) return null;
                const radial = e.source === "event" || e.target === "event";
                const on = focus && (e.source === focus.id || e.target === focus.id);
                const d = radial
                  ? `M${a.x},${a.y} L${b.x},${b.y}`
                  : `M${a.x},${a.y} Q${(a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * 0.35},${(a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * 0.35} ${b.x},${b.y}`;
                return (
                  <g key={i} pointerEvents="none">
                    <path d={d} fill="none" stroke={on ? "#ff2e7e" : "#ffffff"} strokeWidth={on ? 1.6 : 0.7}
                      strokeOpacity={on ? 0.9 : focus ? 0.05 : 0.13}
                      style={{ transition: "stroke-opacity .25s ease, stroke .25s ease, stroke-width .25s ease" }} />
                    <path d={d} fill="none" stroke="#ff2e7e" strokeWidth={on ? 2 : 1.1}
                      strokeOpacity={on ? 0.85 : 0.28} strokeDasharray="2 26" strokeLinecap="round">
                      <animate attributeName="stroke-dashoffset" from="28" to="0"
                        dur={radial ? "5.5s" : "7s"} repeatCount="indefinite" />
                    </path>
                  </g>
                );
              })}

              {visible.map((n) => {
                const p = pos[n.id];
                if (!p) return null;
                const m = metaOf(n.kind);
                const col = colorOf(n.kind);
                const isCore = n.id === "event";
                const isFocus = focus?.id === n.id;
                const faded = dim(n.id);
                const crit = ["Missing", "At Risk", "Blocked", "Conflicted"].includes(n.status);
                const anchor = labelAnchor(p.a || 0);
                const lx = anchor === "start" ? m.r + 11 : anchor === "end" ? -(m.r + 11) : 0;
                const ly = anchor === "middle" ? (Math.sin(p.a || 0) > 0 ? m.r + 22 : -(m.r + 22)) : 4;
                const showLabel = isCore || isFocus || connected.has(n.id) || p.orbit === 0 || visible.length <= 14;
                return (
                  <g key={n.id} data-testid={`graph-node-${n.id}`} transform={`translate(${p.x},${p.y})`}
                    onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
                    onClick={() => setActive(n)}
                    style={{ cursor: "pointer", opacity: faded ? 0.2 : 1, transition: "opacity .25s ease" }}>
                    {(isFocus || crit || isCore) && (
                      <circle r={m.r + 8} fill="none" stroke={crit ? "#ff2e7e" : isCore ? "#ff7ab0" : "#ffffff"} strokeOpacity="0.4">
                        <animate attributeName="r" values={`${m.r + 5};${m.r + 17};${m.r + 5}`} dur={isCore ? "4s" : "3s"} repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.45;0;0.45" dur={isCore ? "4s" : "3s"} repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r={m.r} fill={isCore ? "#ff2e7e" : "#0f0f11"} fillOpacity={isCore ? 1 : 0.92}
                      stroke={isCore ? "#ffffff" : col} strokeOpacity={isCore ? 0.85 : isFocus ? 1 : 0.6}
                      strokeWidth={isFocus || isCore ? 2 : 1.2}
                      style={{ transition: "stroke-opacity .2s ease, stroke-width .2s ease" }} />
                    <NodeIcon kind={n.kind} size={isCore ? 22 : 15} color={isCore ? "#0a0a0a" : col}
                      opacity={isCore ? 1 : isFocus ? 1 : 0.85} />
                    {crit && !isCore && (
                      <circle cx={m.r * 0.72} cy={-m.r * 0.72} r="3.4" fill="#ff2e7e" stroke="#0a0a0a" strokeWidth="1" />
                    )}
                    {showLabel && (
                      <>
                        <text x={lx} y={ly} textAnchor={anchor} fontSize={isCore ? 13 : 11.5}
                          fontWeight={isCore ? 800 : 600} fill={isFocus || isCore ? "#ffffff" : "#d4d4d8"}>
                          {n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label}
                        </text>
                        <text x={lx} y={ly + 12} textAnchor={anchor} fontSize="8.6" letterSpacing="0.1em" fill="#71717a">
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
            <span>Event di pusat · orbit dalam = komponen utama, orbit luar = turunan · klik node untuk detail</span>
            <span className="num">Event ID: {eventId}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5 lg:sticky lg:top-20" data-testid="graph-detail">
            {active ? (
              <>
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="-8 -8 16 16"><NodeIcon kind={active.kind} size={15} color={colorOf(active.kind)} /></svg>
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
                    <svg width="13" height="13" viewBox="-8 -8 16 16" className="shrink-0">
                      <NodeIcon kind={n.kind} size={14} color={colorOf(n.kind)} />
                    </svg>
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
