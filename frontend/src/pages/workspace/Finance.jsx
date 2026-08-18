import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError, idr, compact, num } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";

import {
  useStudioBudget,
  useStudioCacheManager,
} from "@/hooks/useStudioQueries";

export function BudgetTab({ eventId, onChange }) {
  const { data: b, isLoading, isError, error, refetch } = useStudioBudget(eventId);
  const { invalidateEvent } = useStudioCacheManager();

  const [sim, setSim] = useState(null);
  const [inputs, setInputs] = useState({ sell_through: 0.65, ticket_price_multiplier: 1, production_multiplier: 1, capacity: "" });
  const [item, setItem] = useState({ category: "Marketing", label: "", amount: 10000000 });

  const simulate = async () => {
    const { data } = await api.post(`/events/${eventId}/simulate`, { ...inputs, capacity: inputs.capacity || undefined, apply_to_all: true });
    setSim(data);
  };
  const applyScenario = async (key) => {
    try {
      await api.post(`/events/${eventId}/apply-scenario`, { scenario: key, capacity: inputs.capacity || undefined });
      toast.success(`Skenario ${key} diterapkan ke event`);
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const addItem = async () => {
    try {
      await api.post(`/events/${eventId}/budget-items`, item);
      setItem({ ...item, label: "" });
      toast.success("Cost item ditambahkan");
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Event Budget Engine</h2>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400 animate-pulse">
          Menghitung & memuat anggaran event…
        </div>
      </div>
    );
  }

  if (isError || !b) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Event Budget Engine</h2>
        <div className="border border-red-500/30 bg-red-950/20 p-6 text-center text-sm text-red-400 space-y-2">
          <div>Gagal memuat budget: {apiError(error)}</div>
          <button onClick={() => refetch()} className="border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }
  const gapPct = b.total_cost ? Math.min(100, Math.max(0, (b.confirmed_funding / b.total_cost) * 100)) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Event Budget Engine</h2>

      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total Event Cost", compact(b.total_cost), "budget-total-cost"],
          ["Confirmed Funding", compact(b.confirmed_funding), "budget-confirmed-funding"],
          ["Funding Gap", compact(b.funding_gap), "budget-funding-gap"],
          ["Break-even tickets", num(b.break_even_tickets || 0), "budget-breakeven"],
        ].map(([label, value, tid]) => (
          <div key={label} className="bg-[var(--okx-surface)] p-5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
            <div data-testid={tid} className="num mt-1.5 text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Funding coverage</span>
          <span className="num">{gapPct.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-2 w-full bg-[#27272a]">
          <div className="h-2 bg-[var(--okx-accent)] transition-all duration-500" style={{ width: `${gapPct}%` }} />
        </div>
        <div className="num mt-2 text-xs text-zinc-500">
          Projected ticket revenue {idr(b.projected_ticket_revenue)} pada asumsi sell-through {(b.sell_through_assumption * 100).toFixed(0)}% ·
          Weighted avg ticket {idr(b.weighted_avg_ticket_price)} · Tiket terjual {num(b.tickets_sold)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto border border-[var(--okx-border)] okx-scroll" data-testid="cost-lines">
          <div className="hairline p-3 text-sm font-semibold">Cost lines</div>
          <table className="w-full min-w-[420px] text-sm">
            <tbody>
              {b.cost_lines.map((c, i) => (
                <tr key={i} className="border-b border-[var(--okx-border)] last:border-0">
                  <td className="p-3">
                    <div className="text-sm">{c.label}</div>
                    <div className="text-[11px] text-zinc-500">{c.category} · {c.state}</div>
                  </td>
                  <td className="num p-3 text-right">{idr(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <div className="border border-[var(--okx-border)]" data-testid="funding-lines">
            <div className="hairline p-3 text-sm font-semibold">Funding lines</div>
            {b.funding_lines.map((f, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
                <div>
                  <div className="text-sm">{f.label}</div>
                  <div className="text-[11px] text-zinc-500">{f.source} · {f.state}</div>
                </div>
                <div className="num text-sm">{idr(f.amount)}</div>
              </div>
            ))}
          </div>
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
            <h3 className="text-sm font-semibold">Tambah cost item</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input data-testid="budget-label-input" placeholder="Label" value={item.label} onChange={(e) => setItem({ ...item, label: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
              <input data-testid="budget-amount-input" type="number" value={item.amount} onChange={(e) => setItem({ ...item, amount: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
              <button data-testid="budget-add-btn" onClick={addItem} disabled={!item.label} className="bg-[var(--okx-accent)] px-3 py-2 text-sm font-semibold text-black hover:bg-[var(--okx-accent-hover)] disabled:opacity-50">Tambah</button>
            </div>
          </div>
          <p className="text-xs text-zinc-500">{b.tax_estimate_note}</p>
        </div>
      </div>

      <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
        <h3 className="text-base font-semibold md:text-lg">What-If Simulator</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            ["sell_through", "Sell-through", 0.1, 1, 0.05],
            ["ticket_price_multiplier", "Ticket price ×", 0.5, 2, 0.05],
            ["production_multiplier", "Production ×", 0.5, 2, 0.05],
          ].map(([k, label, min, max, step]) => (
            <label key={k} className="block">
              <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
              <input
                data-testid={`sim-${k}-input`}
                type="range"
                min={min}
                max={max}
                step={step}
                value={inputs[k]}
                onChange={(e) => setInputs({ ...inputs, [k]: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--okx-accent)]"
              />
              <span className="num text-sm">{inputs[k]}</span>
            </label>
          ))}
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Kapasitas</span>
            <input
              data-testid="sim-capacity-input"
              type="number"
              placeholder="default"
              value={inputs.capacity}
              onChange={(e) => setInputs({ ...inputs, capacity: e.target.value })}
              className="mt-2 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none"
            />
          </label>
        </div>
        <button data-testid="simulate-btn" onClick={simulate} className="mt-4 bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[var(--okx-accent-hover)]">Jalankan simulasi</button>

        {sim && (
          <div className="mt-5 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] md:grid-cols-3" data-testid="sim-results">
            {Object.entries(sim.scenarios).map(([key, s]) => (
              <div key={key} className="bg-[#0d0d0d] p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{s.label}</h4>
                  <StatusBadge status={s.risk === "High" ? "At Risk" : "Confirmed"} />
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {[
                    ["Total cost", compact(s.total_cost)],
                    ["Ticket revenue", compact(s.ticket_revenue)],
                    ["Funding gap", compact(s.funding_gap)],
                    ["Break-even tiket", num(s.break_even_tickets)],
                    ["Kapasitas", num(s.capacity)],
                    ["Dampak event lokal", compact(s.local_economic_impact)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="num">{v}</dd>
                    </div>
                  ))}
                </dl>
                <button data-testid={`apply-scenario-btn-${key}`} onClick={() => applyScenario(key)} className="mt-4 w-full border border-[var(--okx-border)] px-3 py-2 text-xs font-semibold hover:border-[var(--okx-accent)]">
                  Apply Scenario
                </button>
              </div>
            ))}
          </div>
        )}
        {sim && <p className="mt-3 text-xs text-zinc-500">{sim.note}</p>}
      </div>
    </div>
  );
}

export function PaymentsTab({ eventId, onChange }) {
  const [d, setD] = useState(null);
  const load = () => api.get(`/events/${eventId}/payments`).then(({ data }) => setD(data));
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId]);

  const pay = async (id) => {
    await api.post(`/events/${eventId}/milestones/${id}/pay`);
    toast.success("Milestone ditandai Simulated Paid");
    load();
    onChange?.();
  };

  if (!d) return <div className="text-sm text-zinc-500">Memuat payments…</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Payments, Milestones & Simulated Settlement</h2>
      <div className="border border-[var(--okx-accent)] bg-[#140700] p-3 text-xs text-zinc-300">{d.notice}</div>

      <div className="overflow-x-auto border border-[var(--okx-border)] okx-scroll" data-testid="payments-table">
        <div className="hairline p-3 text-sm font-semibold">Payment objects</div>
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr className="border-b border-[var(--okx-border)]">
              <th className="p-3">Payment ref</th><th className="p-3">Payer</th><th className="p-3">Metode</th>
              <th className="p-3 text-right">Gross</th><th className="p-3 text-right">Fee</th>
              <th className="p-3 text-right">Pajak (est.)</th><th className="p-3 text-right">Net</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {d.payments.map((p) => (
              <tr key={p.id} className="border-b border-[var(--okx-border)] last:border-0">
                <td className="num p-3">{p.payment_ref}</td>
                <td className="p-3">{p.payer_name}</td>
                <td className="p-3 text-xs text-zinc-400">{p.method_channel}</td>
                <td className="num p-3 text-right">{idr(p.gross)}</td>
                <td className="num p-3 text-right">{idr(p.platform_fee + (p.gateway_fee || 0))}</td>
                <td className="num p-3 text-right">{idr(p.tax_estimate)}</td>
                <td className="num p-3 text-right">{idr(p.net)}</td>
                <td className="p-3"><StatusBadge status={p.status === "Simulated Paid" ? "Confirmed" : p.status === "Refunded" ? "Cancelled" : "Pending"} /></td>
              </tr>
            ))}
            {d.payments.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-sm text-zinc-500">Belum ada pembayaran.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-[var(--okx-border)]" data-testid="milestones-list">
          <div className="hairline p-3 text-sm font-semibold">Payment milestones</div>
          {d.milestones.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
              <div>
                <div className="text-sm">{m.ref_name} — {m.description}</div>
                <div className="num text-xs text-zinc-500">{m.percentage}% · {idr(m.amount)} · due {m.due_date}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status === "Simulated Paid" ? "Confirmed" : "Pending"} />
                {m.status !== "Simulated Paid" && (
                  <button data-testid={`pay-milestone-btn-${m.id}`} onClick={() => pay(m.id)} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">Bayar (sandbox)</button>
                )}
              </div>
            </div>
          ))}
          {d.milestones.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Belum ada milestone.</div>}
        </div>
        <div className="space-y-4">
          <div className="border border-[var(--okx-border)]" data-testid="settlement-list">
            <div className="hairline p-3 text-sm font-semibold">Split settlement simulation</div>
            {d.settlement_simulation.map((s) => (
              <div key={s.party} className="flex justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
                <span className="text-sm text-zinc-300">{s.party}</span>
                <span className="num text-sm">{idr(s.amount)}</span>
              </div>
            ))}
          </div>
          <div className="border border-[var(--okx-border)]" data-testid="refunds-list">
            <div className="hairline p-3 text-sm font-semibold">Refunds</div>
            {d.refunds.map((r) => (
              <div key={r.id} className="border-b border-[var(--okx-border)] p-3 last:border-0">
                <div className="num text-sm">{idr(r.amount)} · {r.status}</div>
                <div className="text-xs text-zinc-500">{r.reason}</div>
              </div>
            ))}
            {d.refunds.length === 0 && <div className="p-4 text-sm text-zinc-500">Belum ada refund.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RippleTab({ eventId }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get(`/events/${eventId}/ripple`).then(({ data }) => setD(data));
  }, [eventId]);
  if (!d) return <div className="text-sm text-zinc-500">Menghitung Live Event Impact…</div>;
  const m = d.metrics;
  const money = ["total_event_cost", "total_funding", "ticket_gmv", "sponsor_commitment", "tenant_revenue", "talent_payout", "venue_income", "vendor_payout", "workforce_payout", "total_economic_activity"];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold md:text-lg">Live Event Impact</h2>
        <p className="text-xs text-zinc-500">{d.label}</p>
      </div>
      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4" data-testid="ripple-metrics">
        {Object.entries(m).map(([k, v]) => (
          <div key={k} className="bg-[var(--okx-surface)] p-5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">{k.replace(/_/g, " ")}</div>
            <div className="num mt-1.5 text-xl font-bold">{money.includes(k) ? compact(v) : num(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OperationsTab({ eventId }) {
  const [d, setD] = useState(null);
  const [inc, setInc] = useState({ description: "", severity: "Low", category: "Operations" });
  const load = () => api.get(`/events/${eventId}/command-center`).then(({ data }) => setD(data));
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId]);

  const report = async () => {
    try {
      await api.post(`/events/${eventId}/incidents`, inc);
      toast.success("Incident dicatat");
      setInc({ ...inc, description: "" });
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const setScheduleStatus = async (id, status) => {
    await api.patch(`/events/${eventId}/schedule/${id}`, { status });
    load();
  };

  if (!d) return <div className="text-sm text-zinc-500">Memuat Command Center…</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Event Command Center</h2>
      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4" data-testid="command-metrics">
        {[
          ["Countdown", d.days_to_event !== null ? `${d.days_to_event} hari` : "—"],
          ["Readiness", `${d.readiness_score}%`],
          ["Tiket terjual", `${num(d.ticket_sales.sold)}/${num(d.ticket_sales.capacity)}`],
          ["Ticket revenue", compact(d.ticket_sales.revenue)],
          ["Workforce", `${d.workforce.filled}/${d.workforce.needed}`],
          ["Tenant occupancy", `${d.tenant_occupancy.occupied}/${d.tenant_occupancy.total}`],
          ["Rider fulfillment", `${d.rider_fulfillment.matched}/${d.rider_fulfillment.total}`],
          ["Funding gap", compact(d.budget.funding_gap)],
        ].map(([label, value]) => (
          <div key={label} className="bg-[var(--okx-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
            <div className="num mt-1 text-lg font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-[var(--okx-border)]" data-testid="run-of-show">
          <div className="hairline p-3 text-sm font-semibold">Run of Show</div>
          {d.schedule.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 border-b border-[var(--okx-border)] p-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="num text-sm font-semibold accent-text">{s.time}</span>
                <div>
                  <div className="text-sm">{s.activity}</div>
                  <div className="text-xs text-zinc-500">{s.location} · {s.owner} · dep: {s.dependency}</div>
                </div>
              </div>
              <PremiumSelect
                data-testid={`schedule-status-${s.id}`}
                value={s.status}
                onChange={(e) => setScheduleStatus(s.id, e.target.value)}
                compact
              >
                {["Not Started", "In Progress", "Blocked", "Ready", "Completed", "Cancelled"].map((x) => <option key={x}>{x}</option>)}
              </PremiumSelect>
            </div>
          ))}
          {d.schedule.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Belum ada rundown.</div>}
        </div>

        <div className="space-y-4">
          <div className="border border-[var(--okx-border)]" data-testid="risks-list">
            <div className="hairline p-3 text-sm font-semibold">Risk register</div>
            {d.risks.map((r) => (
              <div key={r.id} className="border-b border-[var(--okx-border)] p-3 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">{r.risk}</div>
                  <StatusBadge status={r.severity === "High" || r.severity === "Critical" ? "At Risk" : "Pending"} />
                </div>
                <div className="text-xs text-zinc-500">Mitigasi: {r.mitigation}</div>
              </div>
            ))}
            {d.risks.length === 0 && <div className="p-4 text-sm text-zinc-500">Belum ada risiko tercatat.</div>}
          </div>

          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
            <h3 className="text-sm font-semibold">Laporkan incident</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <input data-testid="incident-desc-input" placeholder="Deskripsi" value={inc.description} onChange={(e) => setInc({ ...inc, description: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none sm:col-span-2" />
              <PremiumSelect data-testid="incident-severity-select" value={inc.severity} onChange={(e) => setInc({ ...inc, severity: e.target.value })} className="w-full">
                {["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}
              </PremiumSelect>
              <button data-testid="incident-submit-btn" onClick={report} disabled={!inc.description} className="bg-[var(--okx-accent)] px-3 py-2 text-sm font-semibold text-black hover:bg-[var(--okx-accent-hover)] disabled:opacity-50">Catat</button>
            </div>
          </div>

          <div className="border border-[var(--okx-border)]" data-testid="incidents-list">
            <div className="hairline p-3 text-sm font-semibold">Incidents</div>
            {d.incidents.map((i) => (
              <div key={i.id} className="border-b border-[var(--okx-border)] p-3 last:border-0">
                <div className="text-sm">{i.description}</div>
                <div className="text-xs text-zinc-500">{i.severity} · {i.category} · {i.status} · {i.owner}</div>
              </div>
            ))}
            {d.incidents.length === 0 && <div className="p-4 text-sm text-zinc-500">Tidak ada incident.</div>}
          </div>

          <div className="border border-[var(--okx-border)]" data-testid="activity-feed">
            <div className="hairline p-3 text-sm font-semibold">Recent activity</div>
            {d.activities.map((a) => (
              <div key={a.id} className="border-b border-[var(--okx-border)] p-3 text-xs last:border-0">
                <span className="accent-text">{a.action}</span> · {a.user_email} · {String(a.created_at).slice(0, 19).replace("T", " ")}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
