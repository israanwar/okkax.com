import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Wallet,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Lock,
  Unlock,
  CheckCircle2,
  FileText,
  Sparkles,
  RefreshCw,
  Clock,
} from "lucide-react";
import { api, apiError, idr, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import OkxDropdown from "@/components/OkxDropdown";
import { useAuth } from "@/context/AuthContext";

export default function OrganizerFinancePage() {
  const { workspaceVersion } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(DEMO_EVENT_ID);
  const [overview, setOverview] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [payables, setPayables] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasingId, setReleasingId] = useState(null);

  // Load events
  useEffect(() => {
    api.get("/events")
      .then(({ data }) => {
        const items = data.items || [];
        setEvents(items);
        if (items.length > 0 && !items.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(items[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceVersion]);

  const loadFinanceData = async () => {
    if (!selectedEventId) return;
    setRefreshing(true);
    try {
      const [ovRes, escRes, payRes, recRes] = await Promise.allSettled([
        api.get(`/finance/overview?event_id=${selectedEventId}`),
        api.get(`/finance/protected-balance?event_id=${selectedEventId}`),
        api.get(`/finance/payables?event_id=${selectedEventId}`),
        api.get(`/finance/receivables?event_id=${selectedEventId}`),
      ]);

      if (ovRes.status === "fulfilled") setOverview(ovRes.value.data);
      if (escRes.status === "fulfilled") setEscrow(escRes.value.data);
      if (payRes.status === "fulfilled") setPayables(payRes.value.data);
      if (recRes.status === "fulfilled") setReceivables(recRes.value.data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
    // eslint-disable-next-line
  }, [selectedEventId]);

  const handleReleasePayout = async (escrowItem) => {
    setReleasingId(escrowItem.id);
    try {
      await api.post("/finance/payouts/release", {
        deal_id: escrowItem.deal_id || "deal-sound-01",
        milestone_id: escrowItem.id,
      });
      toast.success(`Dana escrow untuk ${escrowItem.vendor_name} berhasil dicairkan`);
      loadFinanceData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setReleasingId(null);
    }
  };

  const eventOptions = useMemo(() => {
    if (events.length === 0) {
      return [{ value: DEMO_EVENT_ID, label: "Aruna Bold Live Makassar (EVT-MKS-2026-0001)" }];
    }
    return events.map((e) => ({
      value: e.id,
      label: `${e.name} (${e.event_code || e.id})`,
    }));
  }, [events]);

  return (
    <div className="okx-workspace-page space-y-4 font-gemini" data-testid="organizer-finance-page">
      {/* Header Chrome */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
              <Wallet size={11} className="text-zinc-400" />
              Financial Command & Protected Settlement
            </div>
            <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">
              Finance & Escrow
            </h1>
            <p className="mt-1 text-xs text-zinc-400 max-w-2xl leading-relaxed">
              Pusat komando finansial event: total revenue, biaya teralokasi, saldo escrow terlindungi, hutang piutang, dan otorisasi settlement pencairan dana.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadFinanceData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Event Selector Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-gemini-mono">
            Event Aktif:
          </span>
          <div className="min-w-[280px]">
            <OkxDropdown
              items={eventOptions}
              value={selectedEventId}
              onChange={(val) => setSelectedEventId(val)}
              className="w-full text-xs"
            />
          </div>
          {overview && (
            <div className="num text-[11px] text-zinc-400 font-gemini-mono">
              Net Margin Est: <span className="text-emerald-400 font-bold">{idr(overview.projected_net_margin)}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Overview Metrics */}
      {overview && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-testid="finance-kpis">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Total Revenue</span>
              <DollarSign size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {compact(overview.total_revenue)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              Tiket: {compact(overview.gross_ticket_revenue)} · Sponsor: {compact(overview.sponsorship_revenue)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Committed Costs</span>
              <ArrowUpRight size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {compact(overview.total_committed_costs)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              PPN Terpotong: {compact(overview.tax_withholding_ppn)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Protected Escrow</span>
              <ShieldCheck size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {compact(overview.protected_balance?.total_in_escrow || 850000000)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              {overview.protected_balance?.locked_contracts_count || 5} kontrak terkunci
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Projected Net Margin</span>
              <Sparkles size={13} className="text-emerald-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-emerald-400 font-gemini-mono">
              {compact(overview.projected_net_margin)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              Laba Bersih Terealisasi
            </div>
          </div>
        </div>
      )}

      {/* Protected Balance & Escrow Breakdown */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-5 shadow-sm" data-testid="escrow-section">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-white" />
            <h3 className="text-sm sm:text-base font-bold text-white">Protected Balance & Milestone Escrow</h3>
          </div>
          <span className="num text-[11px] text-zinc-400 font-gemini-mono">
            Total Escrow: <span className="text-white font-bold">{idr(escrow?.total_escrow_amount || 142500000)}</span>
          </span>
        </div>

        <div className="mt-3.5 divide-y divide-white/[0.04] space-y-2">
          {(!escrow?.items || escrow.items.length === 0) ? (
            <div className="py-6 text-center text-xs text-zinc-500">Tidak ada saldo terkunci dalam escrow.</div>
          ) : (
            escrow.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">{item.vendor_name}</span>
                    <span className="num text-[10px] font-gemini-mono uppercase px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400">
                      {item.role}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-300 mt-0.5">{item.milestone}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Kriteria: {item.release_criteria}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="num text-sm sm:text-base font-bold text-white font-gemini-mono">
                      {idr(item.amount_locked)}
                    </div>
                    <span className={`text-[10px] font-gemini-mono uppercase ${
                      item.status === "ready_for_release" ? "text-emerald-400 font-bold" : "text-zinc-400"
                    }`}>
                      {item.status === "ready_for_release" ? "Siap Dicairkan" : "Terkunci (Escrow)"}
                    </span>
                  </div>

                  {item.status === "ready_for_release" && (
                    <button
                      disabled={releasingId === item.id}
                      onClick={() => handleReleasePayout(item)}
                      className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {releasingId === item.id ? "Memproses…" : "Cairkan Dana"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Grid: Payables & Receivables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payables */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm" data-testid="payables-card">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
              <ArrowUpRight size={13} className="text-amber-400" />
              Accounts Payable (Kewajiban Bayar)
            </div>
            <span className="num text-[11px] text-zinc-400 font-gemini-mono">
              Total: {idr(payables?.total_payable || 0)}
            </span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.04] space-y-1">
            {(!payables?.items || payables.items.length === 0) ? (
              <div className="py-6 text-center text-xs text-zinc-500">Tidak ada kewajiban pembayaran tertunda.</div>
            ) : (
              payables.items.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <div className="font-semibold text-white">{p.recipient}</div>
                    <div className="num text-[10.5px] text-zinc-400 font-gemini-mono mt-0.5">Jatuh Tempo: {p.due_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-bold text-white font-gemini-mono">{idr(p.amount)}</div>
                    <span className="text-[9.5px] font-gemini-mono uppercase text-zinc-400">{p.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Receivables */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm" data-testid="receivables-card">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
              <ArrowDownLeft size={13} className="text-emerald-400" />
              Accounts Receivable (Piutang Masuk)
            </div>
            <span className="num text-[11px] text-zinc-400 font-gemini-mono">
              Total: {idr(receivables?.total_receivable || 0)}
            </span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.04] space-y-1">
            {(!receivables?.items || receivables.items.length === 0) ? (
              <div className="py-6 text-center text-xs text-zinc-500">Tidak ada piutang tertunda.</div>
            ) : (
              receivables.items.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <div className="font-semibold text-white">{r.source}</div>
                    <div className="num text-[10.5px] text-zinc-400 font-gemini-mono mt-0.5">Ekspektasi: {r.due_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="num font-bold text-emerald-400 font-gemini-mono">{idr(r.amount)}</div>
                    <span className="text-[9.5px] font-gemini-mono uppercase text-zinc-400">{r.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
