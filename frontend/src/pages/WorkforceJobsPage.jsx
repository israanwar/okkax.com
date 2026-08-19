import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, apiError, idr } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WorkforceJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open_jobs"); // "open_jobs" | "my_applications"
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyForm, setApplyForm] = useState({ expected_rate: "", notes: "", portfolio_url: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: jData }, { data: aData }] = await Promise.all([
        api.get("/workforce/jobs").catch(() => ({ data: { items: [] } })),
        api.get("/workforce/applications").catch(() => ({ data: { items: [] } })),
      ]);
      setJobs(jData.items || []);
      setMyApps(aData.items || []);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenApply = (job) => {
    setSelectedJob(job);
    setApplyForm({
      expected_rate: job.rate_per_day ? String(job.rate_per_day) : "",
      notes: "",
      portfolio_url: ""
    });
    setApplyModalOpen(true);
  };

  const handleSubmitApply = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);
    try {
      await api.post(`/workforce/jobs/${selectedJob.id}/apply`, {
        expected_rate: applyForm.expected_rate ? Number(applyForm.expected_rate) : undefined,
        notes: applyForm.notes,
        portfolio_url: applyForm.portfolio_url
      });
      toast.success("Lamaran pekerjaan berhasil dikirim ke organizer!");
      setApplyModalOpen(false);
      loadData();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 font-gemini" data-testid="workforce-jobs-page">
      {/* Header Banner */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
              Workforce Opportunity Board
            </div>
            <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">
              Bursa Lowongan Kru & Shift Event
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Cari dan lamar posisi teknisi audio, stage hand, liaison officer, lighting operator, dan kru festival live.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("open_jobs")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                tab === "open_jobs"
                  ? "bg-white text-black font-bold shadow-sm"
                  : "border border-white/[0.1] bg-white/[0.02] text-zinc-400 hover:text-white"
              }`}
              data-testid="tab-open-jobs"
            >
              Lowongan Terbuka ({jobs.length})
            </button>
            <button
              onClick={() => setTab("my_applications")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                tab === "my_applications"
                  ? "bg-white text-black font-bold shadow-sm"
                  : "border border-white/[0.1] bg-white/[0.02] text-zinc-400 hover:text-white"
              }`}
              data-testid="tab-my-applications"
            >
              Lamaran Saya ({myApps.length})
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 font-gemini">Memuat daftar lowongan pekerjaan…</div>
      ) : tab === "open_jobs" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-8 text-center text-xs text-zinc-400">
              Belum ada lowongan kru terbuka saat ini.
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-5 shadow-sm transition-all hover:border-white/20"
                data-testid={`job-card-${job.id}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-300 font-gemini-mono">
                        {job.department}
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-white mt-1.5">{job.title}</h2>
                      <div className="num text-xs text-zinc-400 mt-0.5 font-gemini-mono">
                        {job.event_name} · {job.city} ({job.venue})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm sm:text-base font-bold text-white font-gemini-mono">
                        {idr(job.rate_per_day)}
                      </div>
                      <span className="text-[10px] text-zinc-500 block font-gemini-mono">per shift/hari</span>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs text-zinc-300">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-gemini-mono pb-1 border-b border-white/[0.04]">
                      <span>Tanggal Shift: <strong className="text-white">{job.shift_date}</strong></span>
                      <span>Call Time: <strong className="text-white">{job.call_time}</strong></span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[10.5px] uppercase font-bold text-zinc-400 font-gemini-mono block mb-1">Persyaratan:</span>
                      <ul className="space-y-0.5 text-[11px] text-zinc-300 list-disc list-inside">
                        {(job.requirements || []).map((req, idx) => (
                          <li key={idx} className="line-clamp-1">{req}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <span className="num text-[11px] text-zinc-400 font-gemini-mono">
                    Sisa Kuota: <strong className="text-white">{job.slots_open} kru</strong>
                  </span>

                  {job.applied_status ? (
                    <StatusBadge status={job.applied_status === "accepted" ? "Confirmed" : job.applied_status === "rejected" ? "Cancelled" : "Pending"} />
                  ) : (
                    <button
                      onClick={() => handleOpenApply(job)}
                      className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                      data-testid={`apply-btn-${job.id}`}
                    >
                      Lamar Shift
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm" data-testid="my-applications-list">
          <div className="border-b border-white/[0.08] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
            Riwayat Lamaran Shift Pekerja
          </div>
          <div className="divide-y divide-white/[0.06]">
            {myApps.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">Anda belum melamar lowongan shift.</div>
            ) : (
              myApps.map((app) => (
                <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/[0.02]">
                  <div>
                    <h3 className="text-sm font-bold text-white">{app.job_title}</h3>
                    <div className="num text-xs text-zinc-400 mt-0.5 font-gemini-mono">
                      {app.event_name} · Estimasi Upah: {idr(app.expected_rate)}
                    </div>
                    {app.notes && <p className="text-xs text-zinc-300 mt-1 italic">"{app.notes}"</p>}
                  </div>
                  <div className="text-right">
                    <StatusBadge status={app.status === "accepted" ? "Confirmed" : app.status === "rejected" ? "Cancelled" : "Pending"} />
                    <span className="text-[10px] text-zinc-500 block font-gemini-mono mt-1">
                      {String(app.created_at || "").slice(0, 10)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Apply Modal */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="border-white/10 bg-[#0c0c12] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="editorial text-xl text-white">
              Lamar Posisi {selectedJob?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <form onSubmit={handleSubmitApply} className="space-y-3.5 text-xs">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-zinc-300">
                <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono block">Event & Jadwal:</span>
                <div className="font-semibold text-white mt-0.5">{selectedJob.event_name}</div>
                <div className="num text-[11px] text-zinc-400 font-gemini-mono mt-0.5">
                  {selectedJob.shift_date} · Call time {selectedJob.call_time} · Standard: {idr(selectedJob.rate_per_day)}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Ekspektasi Upah Harian (IDR)</label>
                <input
                  type="number"
                  value={applyForm.expected_rate}
                  onChange={(e) => setApplyForm({ ...applyForm, expected_rate: e.target.value })}
                  placeholder="Contoh: 2500000"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-gemini-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Link Portfolio / Sertifikat K3</label>
                <input
                  type="url"
                  value={applyForm.portfolio_url}
                  onChange={(e) => setApplyForm({ ...applyForm, portfolio_url: e.target.value })}
                  placeholder="https://drive.google.com/... atau https://instagram.com/..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Catatan Kesiapan & Pengalaman</label>
                <textarea
                  rows={3}
                  value={applyForm.notes}
                  onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })}
                  placeholder="Tuliskan pengalaman relevan atau konfirmasi kehadiran gladi resik..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submitting ? "Mengirimkan…" : "Kirim Lamaran"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
