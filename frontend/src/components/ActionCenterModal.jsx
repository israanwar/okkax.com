import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Clock, ArrowRight, X, Sparkles, RefreshCw } from "lucide-react";
import { api, apiError } from "@/lib/api";

export default function ActionCenterModal({ isOpen, onClose }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/overview/actions");
      setActions(data.items || []);
    } catch {
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
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

  if (!isOpen) return null;

  const pendingActions = actions.filter((a) => a.status === "pending" || a.status === "action_required");
  const completedActions = actions.filter((a) => a.status !== "pending" && a.status !== "action_required");

  return (
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
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 border border-white/20 text-white">
              <Sparkles size={14} />
            </div>
            <div>
              <h2 id="action-center-title" className="text-sm sm:text-base font-bold text-white tracking-tight">
                Universal Action Center
              </h2>
              <p className="text-[11px] text-zinc-400 font-gemini-mono">
                Persetujuan, verifikasi kontrak & deadline yang membutuhkan tindakan Anda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchActions}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Refresh tindakan"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loading && actions.length === 0 ? (
            <div className="space-y-3 py-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
              ))}
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
          ) : (
            <>
              {pendingActions.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                    Membutuhkan Tindakan ({pendingActions.length})
                  </div>
                  {pendingActions.map((act) => (
                    <div
                      key={act.id}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] p-3.5 transition-all hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 uppercase tracking-wider font-gemini-mono">
                            <AlertTriangle size={11} /> Urgent Action
                          </div>
                          <h4 className="text-xs sm:text-sm font-semibold text-white">
                            {act.title || act.task || `Tindakan Diperlukan: ${act.id}`}
                          </h4>
                          <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                            {act.description || act.notes || "Persetujuan quotation vendor & alokasi budget produksi."}
                          </p>
                          {act.deadline && (
                            <div className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-gemini-mono mt-1">
                              <Clock size={10} /> Deadline: {act.deadline}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/[0.06] pt-2.5">
                        <button
                          disabled={resolvingId === act.id}
                          onClick={() => handleResolve(act.id, "rejected")}
                          className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-all disabled:opacity-50"
                        >
                          Tolak
                        </button>
                        <button
                          disabled={resolvingId === act.id}
                          onClick={() => handleResolve(act.id, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50"
                        >
                          {resolvingId === act.id ? "Memproses…" : "Setujui & Selesaikan"}
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {completedActions.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-gemini-mono">
                    Riwayat Tindakan ({completedActions.length})
                  </div>
                  {completedActions.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3 text-xs opacity-75"
                    >
                      <div>
                        <div className="font-semibold text-zinc-200">
                          {act.title || act.task || `Tindakan ${act.id}`}
                        </div>
                        <div className="text-[10.5px] text-zinc-500 font-gemini-mono mt-0.5">
                          {act.notes || "Disetujui"} {act.resolved_at ? `· ${act.resolved_at.slice(0, 10)}` : ""}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 font-gemini-mono bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} /> {act.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
