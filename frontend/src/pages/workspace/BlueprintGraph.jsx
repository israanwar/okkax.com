import { useEffect, useState } from "react";
import { api, compact, idr } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export function Blueprint({ eventId, event }) {
  const [bp, setBp] = useState(null);
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

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
      const { data } = await api.post(`/events/${eventId}/compile`);
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
        <button data-testid="compile-btn" onClick={compile} disabled={busy} className="bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
          {busy ? "AI Event Compiler bekerja…" : bp ? "Kompilasi ulang" : "Compile Blueprint"}
        </button>
      </div>

      {!bp ? (
        <div data-testid="blueprint-empty" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-10 text-center text-sm text-zinc-400">
          Belum ada blueprint. Jalankan AI Event Compiler untuk mengubah brief menjadi Event Blueprint.
        </div>
      ) : (
        <div className="space-y-6" data-testid="blueprint-content">
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
            <div className="flex items-center gap-2">
              <span className="border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">Estimasi AI</span>
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

const KIND_COLOR = {
  Event: "#ff4500", Talent: "#f59e0b", Rider: "#f59e0b", Venue: "#38bdf8", Vendor: "#38bdf8",
  Sponsor: "#a3e635", Tenant: "#a3e635", Worker: "#e879f9", "Ticket tier": "#34d399",
  Budget: "#fbbf24", Funding: "#fbbf24", Risk: "#ef4444", Payment: "#34d399", Organizer: "#ffffff",
};

export function Graph({ eventId }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get(`/events/${eventId}/graph`).then(({ data }) => setData(data));
  }, [eventId]);

  if (!data) return <div className="text-sm text-zinc-500">Memuat Event Graph…</div>;
  const kinds = [...new Set(data.nodes.map((n) => n.kind))];
  const nodes = filter ? data.nodes.filter((n) => n.kind === filter || n.id === "event") : data.nodes;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold md:text-lg">Event Graph</h2>
          <p className="text-xs text-zinc-500">
            Readiness score <span className="num accent-text">{data.readiness_score}%</span> · {data.nodes.length} node · {data.edges.length} dependency
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.status_counts).map(([s, c]) => (
            <StatusBadge key={s} status={`${s}`} className="whitespace-nowrap" testId={`graph-count-${s.replace(/\s/g, "-")}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("")} data-testid="graph-filter-all" className={`border px-3 py-1.5 text-xs ${!filter ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-400"}`}>
          Semua kategori
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            data-testid={`graph-filter-${k.replace(/\s/g, "-")}`}
            onClick={() => setFilter(k)}
            className={`border px-3 py-1.5 text-xs ${filter === k ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-400"}`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="graph-nodes">
          {nodes.map((n) => (
            <button
              key={n.id}
              data-testid={`graph-node-${n.id}`}
              onClick={() => setActive(n)}
              className={`border p-3 text-left transition-all hover:border-zinc-500 ${active?.id === n.id ? "border-[var(--okx-accent)] bg-[#1c0a02]" : "border-[var(--okx-border)] bg-[var(--okx-surface)]"}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[n.kind] || "#a1a1aa" }} />
                <span className="text-[11px] uppercase tracking-wider text-zinc-500">{n.kind}</span>
              </div>
              <div className="mt-1.5 text-sm font-medium">{n.label}</div>
              <div className="mt-2"><StatusBadge status={n.status} /></div>
            </button>
          ))}
        </div>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5 lg:sticky lg:top-20 lg:self-start" data-testid="graph-detail">
          {active ? (
            <>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{active.kind}</div>
              <h3 className="mt-1 text-base font-semibold md:text-lg">{active.label}</h3>
              <div className="mt-2"><StatusBadge status={active.status} /></div>
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
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {data.edges.filter((e) => e.source === active.id || e.target === active.id).map((e, i) => (
                    <li key={i}>
                      {data.nodes.find((n) => n.id === e.source)?.label} → {e.label} → {data.nodes.find((n) => n.id === e.target)?.label}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Klik salah satu node untuk melihat detail, dependency, dan konflik.</p>
          )}
        </div>
      </div>
    </div>
  );
}
