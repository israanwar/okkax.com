import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Activity,
  Users,
  Ticket,
  Wallet,
  RefreshCw,
  Layers,
  ChevronRight,
  TrendingUp,
  Building2,
  HardHat,
  Handshake,
  Store,
} from "lucide-react";
import { api, apiError, compact, num, idr, DEMO_EVENT_ID } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";
import { useAuth } from "@/context/AuthContext";
import { canAccessMemberCopilot } from "@/lib/memberRoles";
import PageIntro, { PageIntroEyebrow, PageIntroTitle, PageIntroDescription } from "@/components/PageIntro";

export function Overview() {
  const { user, hasRole, workspaceVersion, activeWorkspace, effectiveRole } = useAuth();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [actions, setActions] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [ripple, setRipple] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);

  const role = (effectiveRole || "audience").toLowerCase();
  const canUseCopilot = canAccessMemberCopilot(role);

  const organizerContext = hasRole(
    "organizer",
    "event_organizer",
    "promoter",
    "supervisor",
    "finance_approver"
  );

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [evRes, sumRes, actRes, dlRes, ripRes] = await Promise.allSettled([
        api.get("/events"),
        api.get("/overview/summary"),
        api.get("/overview/actions"),
        api.get("/overview/deadlines"),
        api.get(`/events/${DEMO_EVENT_ID}/ripple`),
      ]);

      if (evRes.status === "fulfilled") setEvents(evRes.value.data?.items || []);
      if (sumRes.status === "fulfilled") setSummary(sumRes.value.data);
      if (actRes.status === "fulfilled") setActions(actRes.value.data?.items || []);
      if (dlRes.status === "fulfilled") setDeadlines(dlRes.value.data?.items || []);
      if (ripRes.status === "fulfilled") setRipple(ripRes.value.data?.metrics);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    // eslint-disable-next-line
  }, [workspaceVersion, effectiveRole]);

  const handleResolveAction = async (actionId, actionType = "approved") => {
    setResolvingId(actionId);
    try {
      await api.post(`/overview/actions/${actionId}/resolve`, {
        action: actionType,
        notes: `Diselesaikan dari Overview Command pada ${new Date().toISOString()}`,
      });
      toast.success("Tindakan berhasil diselesaikan");
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId
            ? { ...a, status: actionType, resolved_at: new Date().toISOString() }
            : a
        )
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setResolvingId(null);
    }
  };

  const pendingActions = useMemo(
    () => actions.filter((a) => a.status === "pending" || a.status === "action_required"),
    [actions]
  );

  return (
    <div className="space-y-4 font-gemini pb-8" data-testid="overview-page">
      <PageIntro testId="overview-page-intro">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <PageIntroEyebrow icon={Sparkles}>Member OS Universal Command</PageIntroEyebrow>
            <PageIntroTitle>Selamat datang, {user.name}</PageIntroTitle>
            <PageIntroDescription>
              Workspace aktif: {activeWorkspace?.name || "Personal"} · Peran: {role}. Semua operasi terkoordinasi secara aman dan terhubung ke jaringan ekonomi Okkax.
            </PageIntroDescription>
          </div>

          <button
            onClick={fetchOverviewData}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </PageIntro>

      {/* SECTION: PRIMARY ACTIONS — content, not sticky */}
      <section
        className="rounded-2xl border border-white/[0.08] p-3.5 sm:p-4 bg-[#0c0c12]/80 backdrop-blur-xl shadow-sm"
        data-testid="overview-command-surface"
      >

        {/* Primary Action Buttons with clear visual weight */}
        <div className="flex flex-wrap items-center gap-2.5">
          {organizerContext && (
            <>
              <Link
                to="/app/studio"
                data-testid="overview-studio-btn"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                <Plus size={14} /> Buat Event Baru
              </Link>
              <Link
                to="/app/ticketing"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/[0.06] transition-all"
              >
                <Ticket size={13} /> Kelola Tiket
              </Link>
              <Link
                to="/app/operations"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/[0.06] transition-all"
              >
                <Activity size={13} /> Live Operations
              </Link>
              <Link
                to="/app/finance"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/[0.06] transition-all"
              >
                <Wallet size={13} /> Finance & Escrow
              </Link>
            </>
          )}

          {["talent", "talent_management", "artist", "band"].includes(role) && (
            <>
              <Link
                to="/app/opportunities"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 transition-all"
              >
                <Handshake size={14} /> Booking Requests
              </Link>
              <Link
                to="/app/me"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                Jadwal Tampil & Rider
              </Link>
              <Link
                to="/app/wallet"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Wallet size={13} /> Dompet Personal
              </Link>
            </>
          )}

          {["workforce", "worker", "crew"].includes(role) && (
            <>
              <Link
                to="/app/jobs"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 transition-all"
              >
                <HardHat size={14} /> Cari Pekerjaan
              </Link>
              <Link
                to="/app/me"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                Tugas & Shift Saya
              </Link>
              <Link
                to="/app/wallet"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Wallet size={13} /> Saldo & Payout
              </Link>
            </>
          )}

          {role === "vendor" && (
            <>
              <Link
                to="/app/opportunities"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 transition-all"
              >
                <Handshake size={14} /> RFQ & Project Requests
              </Link>
              <Link
                to="/app/me"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                Projects & Deliverables
              </Link>
              <Link
                to="/app/wallet"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Wallet size={13} /> Wallet & Piutang
              </Link>
            </>
          )}

          {role === "sponsor" && (
            <>
              <Link
                to="/discover"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 transition-all"
              >
                Cari Event Sponsorship
              </Link>
              <Link
                to="/app/sponsor"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                Sponsorship Inventory
              </Link>
              <Link
                to="/app/finance"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Wallet size={13} /> Commitments & Billing
              </Link>
            </>
          )}

          {role === "tenant" && (
            <>
              <Link
                to="/discover"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 transition-all"
              >
                Cari Event & Booth
              </Link>
              <Link
                to="/app/tenant"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Store size={13} /> Applications & Booths
              </Link>
              <Link
                to="/app/finance"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Wallet size={13} /> Biaya Booth & Invoices
              </Link>
            </>
          )}

          {role === "audience" && (
            <>
              <Link
                to="/app/discover"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 transition-all"
              >
                Jelajahi Event Terdekat
              </Link>
              <Link
                to="/app/tickets"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30"
              >
                <Ticket size={13} /> Tiket & LivePass Saya
              </Link>
            </>
          )}

          {canUseCopilot && (
            <Link
              to="/app/copilot"
              data-testid="overview-intelligence-btn"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/[0.06] transition-all ml-auto"
            >
              <Sparkles size={13} className="text-zinc-400" /> Okkax Copilot
            </Link>
          )}
        </div>
      </section>

      {/* SECTION 2: PRIMARY KPIS — EXECUTIVE METRICS CARDS */}
      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="overview-summary-kpis">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Occupancy & Penjualan</span>
              <Ticket size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1.5 text-2xl sm:text-3xl font-bold text-white font-gemini-mono">
              {summary.occupancy_rate_pct}%
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 font-gemini-mono">
              {num(summary.tickets_sold)} / {num(summary.capacity)} tiket terjual
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Gross Revenue</span>
              <Wallet size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1.5 text-2xl sm:text-3xl font-bold text-white font-gemini-mono">
              {compact(summary.gross_revenue)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 font-gemini-mono">
              BEP: <span className="text-emerald-400 font-bold">{summary.break_even_pct}%</span> target
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Protected Escrow</span>
              <ShieldCheck size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1.5 text-2xl sm:text-3xl font-bold text-white font-gemini-mono">
              {compact(summary.protected_balance)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 font-gemini-mono">
              Status: <span className="text-white font-semibold">{summary.system_status}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Readiness Score</span>
              <Activity size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1.5 text-2xl sm:text-3xl font-bold text-white font-gemini-mono">
              {summary.readiness_score}/100
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 font-gemini-mono">
              {summary.active_workstreams} workstreams terverifikasi
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: ACTIONABLE — PRIORITY ACTIONS & UPCOMING DEADLINES */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Priority Action Center */}
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4.5 sm:p-5 shadow-sm"
          data-testid="overview-actions-card"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-200 font-gemini-mono">
                Priority Action Center
              </h2>
            </div>
            <span className="num text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-full font-gemini-mono">
              {pendingActions.length} menunggu tindakan
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {pendingActions.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-gemini">
                <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-400/80" />
                Semua tindakan operasional dan persetujuan telah diselesaikan.
              </div>
            ) : (
              pendingActions.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                        {act.title || act.task || `Persetujuan: ${act.id}`}
                      </h3>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                      {act.notes || act.description || "Persetujuan quotation & alokasi resource"}
                    </p>
                  </div>

                  <button
                    disabled={resolvingId === act.id}
                    onClick={() => handleResolveAction(act.id, "approved")}
                    className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50"
                  >
                    {resolvingId === act.id ? "…" : "Setujui"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Master Timeline & Upcoming Deadlines */}
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4.5 sm:p-5 shadow-sm"
          data-testid="overview-deadlines-card"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-zinc-400" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-200 font-gemini-mono">
                Master Timeline & Deadlines
              </h2>
            </div>
            <span className="num text-[11px] text-zinc-400 font-gemini-mono">
              {deadlines.length} milestones
            </span>
          </div>

          <div className="mt-3.5 divide-y divide-white/[0.04] space-y-1">
            {deadlines.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-gemini">
                Belum ada jadwal deadline penting tercatat.
              </div>
            ) : (
              deadlines.slice(0, 5).map((dl) => (
                <div key={dl.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{dl.task}</div>
                    <div className="num text-[10.5px] text-zinc-400 font-gemini-mono mt-0.5">
                      Kategori: {dl.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="num text-[11px] text-zinc-300 font-gemini-mono font-medium">{dl.deadline}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-gemini-mono uppercase tracking-wider font-semibold ${
                        dl.status === "completed"
                          ? "bg-emerald-950/50 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/[0.04] text-zinc-300 border border-white/[0.1]"
                      }`}
                    >
                      {dl.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* SECTION 4: CONTEXTUAL — ACTIVE EVENT PORTFOLIO */}
      {events.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
              Active Event Portfolio ({events.length})
            </h2>
            <Link
              to="/app/events"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Lihat semua <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid gap-3 lg:grid-cols-2" data-testid="overview-events">
            {events.map((ev) => (
              <Link
                key={ev.id}
                to={`/app/events/${ev.id}/blueprint`}
                data-testid={`overview-event-${ev.id}`}
                className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 transition-all hover:border-white/25 hover:bg-[#12121c] shadow-sm hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="num text-[11px] text-zinc-400 font-gemini-mono">{ev.event_code}</div>
                    <h3 className="text-sm font-semibold text-white md:text-base mt-0.5">{ev.name}</h3>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
                      {ev.event_type} · {ev.city} · {ev.start_date} · kapasitas {num(ev.capacity)}
                    </div>
                  </div>
                  <StatusBadge status={ev.status === "published" ? "Confirmed" : "Draft"} />
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-black/40 p-2.5 text-xs">
                  {[
                    ["Total Cost", compact(ev.total_cost)],
                    ["Funding", compact(ev.confirmed_funding)],
                    ["Funding Gap", compact(ev.funding_gap)],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="text-zinc-400 text-[10px] font-medium font-gemini-mono uppercase">{l}</div>
                      <div className="num text-xs sm:text-[13px] font-bold text-white mt-0.5 font-gemini-mono">{v}</div>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 5: SECONDARY — LIVE EVENT ECONOMIC IMPACT */}
      {ripple && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
            Live Event Economic Impact Telemetry
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Economic Activity", compact(ripple.total_economic_activity)],
              ["Businesses Activated", num(ripple.businesses_activated)],
              ["Workers Deployed", num(ripple.workers)],
              ["Ticket GMV Realized", compact(ripple.ticket_gmv)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{l}</div>
                <div className="num mt-1 text-lg sm:text-xl font-bold text-white font-gemini-mono">{v}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function EventsList() {
  const { workspaceVersion } = useAuth();
  const [events, setEvents] = useState(null);
  useEffect(() => {
    api.get("/events").then(({ data }) => setEvents(data.items));
    // eslint-disable-next-line
  }, [workspaceVersion]);
  if (!events) return <div className="text-xs text-zinc-400 p-6 font-gemini">Memuat event…</div>;
  return (
    <div className="okx-workspace-page space-y-4 font-gemini" data-testid="events-page">
      <div className="okx-workspace-chrome rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-3.5 sm:p-4" data-testid="events-chrome">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
              Live Event Portfolio
            </div>
            <h1 className="editorial text-xl sm:text-2xl text-white">Events</h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              {events.length} event pada workspace ini.
            </p>
          </div>
          <Link
            to="/app/studio"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
            data-testid="events-new-btn"
          >
            <Plus size={14} /> Event baru
          </Link>
        </div>
      </div>
      <div className="okx-workspace-content">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]" data-testid="events-list">
          {events.map((ev) => (
            <Link key={ev.id} to={`/app/events/${ev.id}/blueprint`} className="flex flex-col gap-2 p-3 sm:p-4 transition-all hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="num text-[11px] text-zinc-400 font-gemini-mono">{ev.event_code}</div>
                <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">{ev.name}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{ev.event_type} · {ev.city} · {ev.start_date}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-xs text-zinc-400 font-gemini-mono">Gap {compact(ev.funding_gap)}</span>
                <StatusBadge status={ev.status === "published" ? "Confirmed" : "Draft"} />
              </div>
            </Link>
          ))}
          {events.length === 0 && <div className="p-6 text-center text-xs text-zinc-400 font-gemini">Belum ada event. Mulai dari Event Studio.</div>}
        </div>
      </div>
    </div>
  );
}

export { default as EventStudio } from "@/pages/EventStudio";
