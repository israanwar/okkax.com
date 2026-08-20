import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Activity,
  ScanLine,
  AlertTriangle,
  Clock,
  Users,
  ShieldCheck,
  QrCode,
  Sparkles,
  RefreshCw,
  Plus,
  Radio,
} from "lucide-react";
import { api, apiError, idr, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";
import OkxDropdown from "@/components/OkxDropdown";
import { useAuth } from "@/context/AuthContext";
import PageIntro, { PageIntroEyebrow, PageIntroTitle, PageIntroDescription } from "@/components/PageIntro";

export default function LiveOperationsPage() {
  const { workspaceVersion } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(DEMO_EVENT_ID);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Scanner state
  const [scanCode, setScanCode] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Incident form
  const [inc, setInc] = useState({ description: "", severity: "Low", category: "Operations" });
  const [submittingInc, setSubmittingInc] = useState(false);

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

  const loadOperationsData = async () => {
    if (!selectedEventId) return;
    setRefreshing(true);
    try {
      const { data: resData } = await api.get(`/events/${selectedEventId}/command-center`);
      setData(resData);
    } catch (e) {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOperationsData();
    // eslint-disable-next-line
  }, [selectedEventId]);

  const handleValidateTicket = async (e) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    setScanning(true);
    try {
      const { data: res } = await api.post("/tickets/validate", { qr_code: scanCode.trim() });
      setScanResult(res);
      if (res.result === "Valid") {
        toast.success(`Tiket Valid: ${res.ticket?.attendee_name || scanCode}`);
      } else {
        toast.error(`Akses Ditolak: ${res.result}`);
      }
      loadOperationsData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setScanning(false);
    }
  };

  const handleReportIncident = async (e) => {
    e.preventDefault();
    if (!inc.description.trim()) return toast.error("Deskripsi incident wajib diisi");
    setSubmittingInc(true);
    try {
      await api.post(`/events/${selectedEventId}/incidents`, inc);
      toast.success("Incident operasional dicatat");
      setInc({ description: "", severity: "Low", category: "Operations" });
      loadOperationsData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmittingInc(false);
    }
  };

  const setScheduleStatus = async (id, status) => {
    try {
      await api.patch(`/events/${selectedEventId}/schedule/${id}`, { status });
      toast.success("Status rundown diperbarui");
      loadOperationsData();
    } catch (err) {
      toast.error(apiError(err));
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
    <div className="okx-workspace-page space-y-4 font-gemini" data-testid="live-operations-page">
      <PageIntro testId="operations-page-intro">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <PageIntroEyebrow icon={Radio} tone="border-red-500/30 bg-red-950/20 text-red-400">
              Live Operations & Command Center
            </PageIntroEyebrow>
            <PageIntroTitle>Command Center</PageIntroTitle>
            <PageIntroDescription>
              Monitoring hari-H: Gate access scanner, crowd occupancy, live execution timeline, risk register, dan incident escalation.
            </PageIntroDescription>
          </div>

          <button
            onClick={loadOperationsData}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-white/20 transition-all cursor-pointer"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>

        {/* Event Selector Strip */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-white/[0.06] pt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-gemini-mono">
            Event Aktif:
          </span>
          <div className="min-w-[240px] max-w-[280px]">
            <OkxDropdown
              items={eventOptions}
              value={selectedEventId}
              onChange={(val) => setSelectedEventId(val)}
              className="w-full text-xs"
            />
          </div>
          {data && (
            <div className="num text-[10.5px] text-zinc-400 font-gemini-mono">
              Status: <span className="text-white font-bold">LIVE OPERATIONAL</span> · Readiness:{" "}
              <span className="text-emerald-400 font-bold">{data.readiness_score}%</span>
            </div>
          )}
        </div>
      </PageIntro>

      {/* Real-Time Operational Telemetry Strip */}
      {data && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-testid="command-metrics">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Gate & Attendance</span>
              <ScanLine size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {num(data.ticket_sales?.sold || 4200)} <span className="text-xs font-normal text-zinc-500">/ {num(data.ticket_sales?.capacity || 5000)}</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              Occupancy: <span className="text-emerald-400 font-bold">{((Number(data.ticket_sales?.sold || 4200) / Number(data.ticket_sales?.capacity || 5000)) * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Workforce On-Duty</span>
              <Users size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {data.workforce?.filled || 45} <span className="text-xs font-normal text-zinc-500">/ {data.workforce?.needed || 50} crew</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              Readiness: <span className="text-white font-semibold">90% Hadir</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Tenant & Rider</span>
              <ShieldCheck size={13} className="text-zinc-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {data.rider_fulfillment?.matched || 8} / {data.rider_fulfillment?.total || 8}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              Tenant: {data.tenant_occupancy?.occupied || 18}/{data.tenant_occupancy?.total || 20} booth
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
              <span>Incidents & Risks</span>
              <AlertTriangle size={13} className="text-amber-400" />
            </div>
            <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
              {data.incidents?.length || 0} <span className="text-xs font-normal text-zinc-500">insiden aktif</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
              Risiko: {data.risks?.length || 0} mitigasi
            </div>
          </div>
        </div>
      )}

      {/* QR Ticket Gate Scanner Strip */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-5 shadow-sm" data-testid="gate-scanner-section">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <ScanLine size={15} className="text-white" />
            <h3 className="text-sm sm:text-base font-bold text-white">Live Gate Ticket Validator</h3>
          </div>
          <span className="text-[11px] text-zinc-400 font-gemini-mono">Online Scan Mode</span>
        </div>

        <form onSubmit={handleValidateTicket} className="mt-3.5 flex flex-col gap-2.5 sm:flex-row">
          <input
            data-testid="validator-input"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder="Scan atau tempel kode tiket: OKKAX|EVT-MKS-2026-0001|OKX-TIX-000001"
            className="flex-1 rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white placeholder:text-zinc-500 outline-none focus:border-white/40 font-gemini-mono"
          />
          <button
            type="submit"
            disabled={scanning || !scanCode.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-2 text-xs font-bold text-black shadow-sm hover:bg-zinc-200 disabled:opacity-50"
          >
            {scanning ? "Memeriksa…" : "Validasi Tiket"}
          </button>
        </form>

        {scanResult && (
          <div
            data-testid="validator-result"
            className={`mt-3.5 rounded-xl border p-3.5 backdrop-blur-xl ${
              scanResult.result === "Valid"
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300 font-bold"
                : "border-red-500/40 bg-red-950/20 text-red-300 font-bold"
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              <QrCode size={16} /> Status: {scanResult.result}
            </div>
            <p className="mt-1 text-xs font-normal text-zinc-300">{scanResult.message}</p>
            {scanResult.ticket && (
              <div className="num mt-2 rounded-lg border border-white/[0.08] bg-black/40 p-2 text-[11px] text-zinc-300 font-gemini-mono">
                {scanResult.ticket.ticket_number} · {scanResult.ticket.attendee_name} · {scanResult.ticket.tier_name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid: Run of Show (Rundown) & Incident Management */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Run of Show */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm" data-testid="run-of-show">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
              <Clock size={13} className="text-zinc-400" />
              Live Run of Show (Rundown)
            </div>
            <span className="num text-[10.5px] text-zinc-400 font-gemini-mono">
              {data?.schedule?.length || 0} segmen
            </span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.04] space-y-1">
            {(!data?.schedule || data.schedule.length === 0) ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-gemini">Belum ada rundown aktif.</div>
            ) : (
              data.schedule.map((s) => (
                <div key={s.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2.5">
                    <span className="num text-xs font-bold text-white font-gemini-mono">{s.time}</span>
                    <div>
                      <div className="text-xs font-semibold text-white">{s.activity}</div>
                      <div className="text-[10.5px] text-zinc-400 mt-0.5">{s.location} · {s.owner}</div>
                    </div>
                  </div>
                  <PremiumSelect
                    data-testid={`schedule-status-${s.id}`}
                    value={s.status}
                    onChange={(e) => setScheduleStatus(s.id, e.target.value)}
                    className="text-[11px] py-0.5"
                  >
                    {["Not Started", "In Progress", "Ready", "Completed", "Cancelled"].map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </PremiumSelect>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Incident Center & Risk Register */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 shadow-sm" data-testid="incidents-card">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                <AlertTriangle size={13} className="text-amber-400" />
                Live Incident Center
              </div>
            </div>

            {/* Log Incident Form */}
            <form onSubmit={handleReportIncident} className="mt-3 grid gap-2 sm:grid-cols-4">
              <input
                data-testid="incident-desc-input"
                placeholder="Laporkan insiden operasional..."
                value={inc.description}
                onChange={(e) => setInc({ ...inc, description: e.target.value })}
                className="sm:col-span-2 rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-white/40"
              />
              <PremiumSelect
                data-testid="incident-severity-select"
                value={inc.severity}
                onChange={(e) => setInc({ ...inc, severity: e.target.value })}
                className="text-xs"
              >
                {["Low", "Medium", "High", "Critical"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </PremiumSelect>
              <button
                type="submit"
                disabled={submittingInc || !inc.description.trim()}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                {submittingInc ? "..." : "Catat"}
              </button>
            </form>

            {/* Incidents List */}
            <div className="mt-3.5 space-y-2">
              {(!data?.incidents || data.incidents.length === 0) ? (
                <div className="py-4 text-center text-xs text-zinc-500 font-gemini">Tidak ada insiden tercatat.</div>
              ) : (
                data.incidents.map((i) => (
                  <div key={i.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{i.description}</span>
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-gemini-mono uppercase font-bold ${
                        i.severity === "Critical" || i.severity === "High"
                          ? "bg-red-950/50 text-red-400 border border-red-500/30"
                          : "bg-white/[0.04] text-zinc-300"
                      }`}>
                        {i.severity}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-zinc-400 mt-1">
                      {i.category} · {i.status} · PIC: {i.owner || "Team Lead"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
