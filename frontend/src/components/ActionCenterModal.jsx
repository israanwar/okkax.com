import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowRight,
  X,
  Sparkles,
  RefreshCw,
  Building2,
} from "lucide-react";
import { api, apiError } from "@/lib/api";

const SEVERITY_STYLES = {
  high: {
    label: "Mendesak",
    icon: AlertTriangle,
    badge: "text-rose-300 bg-rose-500/10 border-rose-500/30",
    dot: "bg-rose-400",
  },
  medium: {
    label: "Perlu Perhatian",
    icon: Clock,
    badge: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-400",
  },
  low: {
    label: "Bisa Ditunda",
    icon: AlertCircle,
    badge: "text-zinc-300 bg-white/[0.06] border-white/[0.12]",
    dot: "bg-zinc-400",
  },
};

const formatAmount = (n) => {
  if (typeof n !== "number") return null;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
};

export default function ActionCenterModal({ isOpen, onClose }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [tab, setTab] = useState("pending"); // "pending" | "history"

  const fetchActions = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get("/overview/actions");
      setActions(data.items || []);
    } catch {
      setActions([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTab("pending");
      fetchActions();
    }
  }, [isOpen]);

  const handleResolve = async (actionId, actionType = "approved") => {
    setResolvingId(actionId);
    try {
      await api.post(`/overview/actions/${actionId}/resolve`, {
        action: actionType,
        notes: `Diselesaikan melalui Universal Action Center pada ${new Date().toISOString()}`,
      });
      toast.success(actionType === "approved" ? "Tindakan disetujui" : "Tindakan ditolak");
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

  const { pendingActions, completedActions } = useMemo(() => {
    const severityRank = { high: 0, medium: 1, low: 2 };
    const pending = actions
      .filter((a) => a.status === "pending" || a.status === "action_required")
      .sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));
    const completed = actions.filter((a) => a.status !== "pending" && a.status !== "action_required");
    return { pendingActions: pending, completedActions: completed };
  }, [actions]);

  if (!isOpen) return null;

  const activeList = tab === "pending" ? pendingActions : completedActions;

  // Portal to document.body: the header this trigger lives in uses
  // backdrop-blur, which establishes a containing block for fixed-position
  // descendants and would otherwise clip this modal to the header's own
  // height. Rendering outside that subtree keeps positioning correct
  // regardless of ancestor layout.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 font-gemini"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-center-title"
    >
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0c0c12]/95 backdrop-blur-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/20 text-white">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0">
              <h2 id="action-center-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                Universal Action Center
              </h2>
              <p className="text-[11px] text-zinc-400 font-gemini-mono truncate">
                Persetujuan, verifikasi kontrak &amp; deadline yang membutuhkan tindakan Anda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchActions}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              title="Refresh tindakan"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Segmented Tabs */}
        {!error && actions.length > 0 && (
          <div className="flex items-center gap-1.5 px-5 pt-3 shrink-0">
            {[
              { key: "pending", label: "Butuh Tindakan", count: pendingActions.length },
              { key: "history", label: "Riwayat", count: completedActions.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold font-gemini-mono transition-all cursor-pointer ${
                  tab === t.key
                    ? "bg-white text-black"
                    : "bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/20"
                }`}
              >
                {t.label}
                <span className={tab === t.key ? "text-black/60" : "text-zinc-500"}>{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          {loading && actions.length === 0 ? (
            <div className="space-y-3 py-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] text-rose-300 mb-3">
                <AlertCircle size={22} />
              </div>
              <h3 className="text-sm font-semibold text-white">Gagal memuat tindakan</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Terjadi gangguan koneksi ke server. Coba muat ulang.
              </p>
              <button
                onClick={fetchActions}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-white/25 transition-all cursor-pointer"
              >
                <RefreshCw size={12} /> Muat Ulang
              </button>
            </div>
          ) : actions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.03] text-zinc-400 mb-3">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-white">Semua Tindakan Selesai</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Tidak ada dokumen, pembayaran, atau persetujuan yang tertunda saat ini.
              </p>
            </div>
          ) : activeList.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-zinc-400">
                {tab === "pending" ? "Tidak ada tindakan yang menunggu." : "Belum ada riwayat tindakan."}
              </p>
            </div>
          ) : tab === "pending" ? (
            activeList.map((act) => {
              const sev = SEVERITY_STYLES[act.severity] || SEVERITY_STYLES.medium;
              const SevIcon = sev.icon;
              const amount = formatAmount(act.amount);
              return (
                <div
                  key={act.id}
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] p-3.5 transition-all hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-gemini-mono ${sev.badge}`}
                        >
                          <SevIcon size={11} /> {sev.label}
                        </span>
                        {act.event_name && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-zinc-400 font-gemini-mono truncate max-w-[200px]">
                            <Building2 size={10} className="shrink-0" /> {act.event_name}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white leading-snug">
                        {act.title || act.task || `Tindakan Diperlukan: ${act.id}`}
                      </h4>
                      {(act.description || act.notes) && (
                        <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                          {act.description || act.notes}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                        {act.deadline && (
                          <div
                            className={`inline-flex items-center gap-1 text-[10px] font-gemini-mono ${
                              act.severity === "high" ? "text-rose-300" : "text-zinc-400"
                            }`}
                          >
                            <Clock size={10} /> {act.deadline}
                          </div>
                        )}
                        {amount && (
                          <div className="inline-flex items-center text-[10px] text-zinc-300 font-gemini-mono font-semibold">
                            {amount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-2.5">
                    <button
                      disabled={resolvingId === act.id}
                      onClick={() => handleResolve(act.id, "rejected")}
                      className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Tolak
                    </button>
                    <button
                      disabled={resolvingId === act.id}
                      onClick={() => handleResolve(act.id, "approved")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {resolvingId === act.id ? "Memproses…" : act.cta_label || "Setujui & Selesaikan"}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            activeList.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-xs opacity-75"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-200 truncate">
                    {act.title || act.task || `Tindakan ${act.id}`}
                  </div>
                  <div className="text-[10.5px] text-zinc-500 font-gemini-mono mt-0.5 truncate">
                    {act.event_name ? `${act.event_name} · ` : ""}
                    {act.notes || "Disetujui"} {act.resolved_at ? `· ${act.resolved_at.slice(0, 10)}` : ""}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-bold font-gemini-mono px-2 py-0.5 rounded-full border ${
                    act.status === "rejected"
                      ? "text-rose-300 bg-rose-950/30 border-rose-500/30"
                      : "text-emerald-400 bg-emerald-950/30 border-emerald-500/30"
                  }`}
                >
                  <CheckCircle2 size={10} /> {act.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
