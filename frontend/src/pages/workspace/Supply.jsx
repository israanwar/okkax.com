import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { api, apiError, idr, num } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";
import {
  useStudioTalents,
  useStudioCatalogTalents,
  useStudioVenue,
  useStudioVendors,
  useStudioWorkforce,
  useStudioCacheManager,
} from "@/hooks/useStudioQueries";

const RIDER_STATUSES = ["Matched", "Partially Matched", "Missing", "Conflicted", "Alternative Available", "Requires Confirmation"];

export function TalentRider({ eventId, onChange }) {
  const { data, isLoading, isError, error, refetch } = useStudioTalents(eventId);
  const { data: pool = [], isLoading: isPoolLoading } = useStudioCatalogTalents();
  const { invalidateEvent } = useStudioCacheManager();

  const items = useMemo(() => data?.items || [], [data?.items]);
  const riders = useMemo(() => data?.riders || [], [data?.riders]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!open && items[0]) setOpen(items[0].id);
  }, [items, open]);

  const add = async (talent_id) => {
    try {
      await api.post(`/events/${eventId}/talents`, { talent_id });
      toast.success("Talent ditambahkan. Rider otomatis diaktifkan.");
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const setStatus = async (et_id, status) => {
    try {
      await api.patch(`/events/${eventId}/talents/${et_id}`, { status });
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const remove = async (et_id) => {
    try {
      await api.delete(`/events/${eventId}/talents/${et_id}`);
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const patchRider = async (id, body) => {
    try {
      await api.patch(`/events/${eventId}/rider/${id}`, body);
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Talent terpilih & Structured Rider Engine</h2>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400 animate-pulse">
          Memuat data talent & structured rider…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Talent terpilih & Structured Rider Engine</h2>
        <div className="border border-red-500/30 bg-red-950/20 p-6 text-center text-sm text-red-400 space-y-2">
          <div>Gagal memuat data talent: {apiError(error)}</div>
          <button onClick={() => refetch()} className="border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Talent terpilih & Structured Rider Engine</h2>

      {items.length === 0 && (
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400">
          Belum ada talent. Pilih talent dari network di bawah untuk mengaktifkan rider.
        </div>
      )}

      {items.map((t) => {
        const rs = riders.filter((r) => r.event_talent_id === t.id);
        const matched = rs.filter((r) => r.status === "Matched").length;
        return (
          <div key={t.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)]" data-testid={`event-talent-${t.id}`}>
            <div className="flex flex-col gap-3 border-b border-[var(--okx-border)] p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold md:text-lg">{t.talent_name}</h3>
                <div className="num mt-1 text-xs text-zinc-500">
                  Rider {matched}/{rs.length} matched · Slot {t.performance_slot || "belum diatur"}
                </div>
                <div className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {[
                    ["Performance Fee", t.fee], ["Estimated Tax", t.tax_estimate], ["Travel", t.travel],
                    ["Accommodation", t.accommodation], ["Local Transport", t.local_transport],
                    ["Security", t.security], ["Hospitality", t.hospitality], ["Technical Rider", t.rider_cost],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-[var(--okx-border)] py-1">
                      <span className="text-zinc-500">{k}</span>
                      <span className="num">{idr(v)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Landed Talent Cost</span>
                  <span data-testid={`landed-cost-${t.id}`} className="num text-xl font-bold accent-text">{idr(t.landed_cost)}</span>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <StatusBadge status={t.status} />
                <div className="flex gap-2">
                  <button data-testid={`confirm-talent-btn-${t.id}`} onClick={() => setStatus(t.id, t.status === "Confirmed" ? "Pending" : "Confirmed")} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">
                    {t.status === "Confirmed" ? "Set Pending" : "Konfirmasi"}
                  </button>
                  <button data-testid={`remove-talent-btn-${t.id}`} onClick={() => remove(t.id)} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs text-zinc-400">Hapus</button>
                  <button onClick={() => setOpen(open === t.id ? null : t.id)} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs" data-testid={`toggle-rider-btn-${t.id}`}>
                    {open === t.id ? "Sembunyikan rider" : "Lihat rider"}
                  </button>
                </div>
              </div>
            </div>

            {open === t.id && (
              <div className="overflow-x-auto okx-scroll" data-testid={`rider-table-${t.id}`}>
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <tr className="border-b border-[var(--okx-border)]">
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Item</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3">Spesifikasi</th>
                      <th className="p-3">Wajib</th>
                      <th className="p-3 text-right">Est. biaya</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rs.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--okx-border)] last:border-0">
                        <td className="p-3 text-zinc-400">{r.category}</td>
                        <td className="p-3">{r.item}</td>
                        <td className="num p-3 text-right">{r.quantity}</td>
                        <td className="p-3 text-xs text-zinc-500">{r.specification}</td>
                        <td className="p-3 text-xs">{r.mandatory ? "Mandatory" : "Optional"}</td>
                        <td className="num p-3 text-right">{idr(r.estimated_cost)}</td>
                        <td className="p-3">
                          <PremiumSelect
                            data-testid={`rider-status-${r.id}`}
                            value={r.status}
                            onChange={(e) => patchRider(r.id, { status: e.target.value })}
                            compact
                          >
                            {RIDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </PremiumSelect>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Talent network</h3>
        {isPoolLoading ? (
          <div className="mt-3 p-6 text-center text-xs text-zinc-500 animate-pulse">Memuat katalog talent…</div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pool.map((t) => (
              <div key={t.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid={`talent-card-${t.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{t.stage_name}</h4>
                    <div className="text-xs text-zinc-500">{t.category} · {t.genre} · {t.city}</div>
                  </div>
                  {t.verified && <span className="border border-white/45 px-1.5 py-0.5 text-[10px] accent-text">Verified</span>}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{t.bio}</p>
                <div className="num mt-3 text-sm font-bold">{idr(t.base_fee)}</div>
                <div className="text-[11px] text-zinc-500">{t.fee_status} · {t.team_size} orang · {t.duration_min} menit</div>
                <button
                  data-testid={`add-talent-btn-${t.id}`}
                  onClick={() => add(t.id)}
                  className="mt-3 w-full bg-[var(--okx-accent)] px-3 py-2 text-xs font-semibold text-black hover:bg-[var(--okx-accent-hover)] cursor-pointer"
                >
                  Tambahkan ke event
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VenueTab({ eventId, onChange }) {
  const { data, isLoading, isError, error, refetch } = useStudioVenue(eventId);
  const { invalidateEvent } = useStudioCacheManager();

  const matches = data?.matches || [];
  const selected = data?.selected || null;

  const pick = async (venue_id) => {
    try {
      await api.post(`/events/${eventId}/venue`, { venue_id });
      toast.success("Venue dipilih. Budget dan Event Graph diperbarui.");
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Venue Network & Compatibility Score</h2>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400 animate-pulse">
          Memuat kecocokan venue…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Venue Network & Compatibility Score</h2>
        <div className="border border-red-500/30 bg-red-950/20 p-6 text-center text-sm text-red-400 space-y-2">
          <div>Gagal memuat venue: {apiError(error)}</div>
          <button onClick={() => refetch()} className="border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Venue Network & Compatibility Score</h2>
      {selected && (
        <div className="border border-[var(--okx-accent)] bg-[#140700] p-5" data-testid="selected-venue">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider accent-text">Venue terpilih</div>
              <h3 className="text-base font-semibold md:text-lg">{selected.venue_name}</h3>
              <div className="num text-xs text-zinc-400">
                {selected.event_days} event day + {selected.setup_days} setup day · Total {idr(selected.total_cost)} · Deposit {idr(selected.deposit)}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-3xl font-bold accent-text">{selected.compatibility.score}</div>
              <div className="text-[11px] text-zinc-500">Compatibility</div>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-zinc-300">
            {selected.compatibility.reasons.map((r) => <li key={r}>· {r}</li>)}
          </ul>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {matches.map((v) => (
          <div key={v.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`venue-card-${v.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{v.name}</h3>
                <div className="text-xs text-zinc-500">{v.address}, {v.city} · {v.indoor ? "Indoor" : "Outdoor"}</div>
              </div>
              <div className="text-right">
                <div className="num text-2xl font-bold accent-text">{v.compatibility.score}</div>
                <div className="text-[10px] text-zinc-500">score</div>
              </div>
            </div>
            <div className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
              <div>Standing: {num(v.standing_capacity)}</div>
              <div>Seated: {num(v.seated_capacity)}</div>
              <div>Event day: {idr(v.event_day_price)}</div>
              <div>Setup day: {idr(v.setup_day_price)}</div>
              <div>Power: {v.power_kva} kVA</div>
              <div>Curfew: {v.curfew}</div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400">
              {v.compatibility.reasons.slice(0, 4).map((r) => <li key={r}>· {r}</li>)}
            </ul>
            <div className="num mt-3 text-sm font-semibold">Estimasi total: {idr(v.compatibility.estimated_total)}</div>
            <button
              data-testid={`select-venue-btn-${v.id}`}
              onClick={() => pick(v.id)}
              className="mt-3 w-full bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[var(--okx-accent-hover)] cursor-pointer"
            >
              {selected?.venue_id === v.id ? "Venue aktif — pilih ulang" : "Pilih venue ini"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VendorTab({ eventId, onChange }) {
  const { data, isLoading, isError, error, refetch } = useStudioVendors(eventId);
  const { invalidateEvent } = useStudioCacheManager();

  const matches = data?.matches || [];
  const selected = data?.selected || [];

  const add = async (vendor_id) => {
    try {
      await api.post(`/events/${eventId}/vendors`, { vendor_id });
      toast.success("Vendor ditambahkan ke event");
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/events/${eventId}/vendors/${id}`, { status });
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Vendor & Event Organizer</h2>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400 animate-pulse">
          Memuat vendor & matching network…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Vendor & Event Organizer</h2>
        <div className="border border-red-500/30 bg-red-950/20 p-6 text-center text-sm text-red-400 space-y-2">
          <div>Gagal memuat vendor: {apiError(error)}</div>
          <button onClick={() => refetch()} className="border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Vendor & Event Organizer</h2>
      <div className="border border-[var(--okx-border)]" data-testid="event-vendors">
        <div className="hairline p-4 text-sm font-semibold">Vendor pada event ini ({selected.length})</div>
        <div className="overflow-x-auto okx-scroll">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-[var(--okx-border)]"><th className="p-3">Vendor</th><th className="p-3">Kategori</th><th className="p-3 text-right">Biaya</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {selected.map((v) => (
                <tr key={v.id} className="border-b border-[var(--okx-border)] last:border-0">
                  <td className="p-3">{v.vendor_name}</td>
                  <td className="p-3 text-zinc-400">{v.category}</td>
                  <td className="num p-3 text-right">{idr(v.cost)}</td>
                  <td className="p-3">
                    <button data-testid={`vendor-status-btn-${v.id}`} onClick={() => setStatus(v.id, v.status === "Confirmed" ? "Pending" : "Confirmed")}>
                      <StatusBadge status={v.status} />
                    </button>
                  </td>
                </tr>
              ))}
              {selected.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-zinc-500">Belum ada vendor.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Vendor matching</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {matches.slice(0, 12).map((v) => (
          <div key={v.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid={`vendor-card-${v.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">{v.name}</h4>
                <div className="text-xs text-zinc-500">{v.category}</div>
              </div>
              <div className="num text-lg font-bold accent-text">{v.match.score}</div>
            </div>
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
              {v.match.reasons.map((r) => <li key={r}>· {r}</li>)}
            </ul>
            <div className="num mt-2 text-xs text-zinc-400">{idr(v.price_min)} – {idr(v.price_max)}</div>
            <button data-testid={`add-vendor-btn-${v.id}`} onClick={() => add(v.id)} className="mt-3 w-full border border-[var(--okx-border)] px-3 py-2 text-xs font-semibold hover:border-[var(--okx-accent)] cursor-pointer">
              Tambahkan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkforceTab({ eventId, onChange }) {
  const { data, isLoading, isError, error, refetch } = useStudioWorkforce(eventId);
  const { invalidateEvent } = useStudioCacheManager();
  const [form, setForm] = useState({ role: "Usher", needed: 10, compensation_per_day: 275000 });

  const createJob = async () => {
    try {
      await api.post(`/events/${eventId}/jobs`, form);
      toast.success("Event job dibuat");
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const assign = async (worker_id, job_id) => {
    try {
      await api.post(`/events/${eventId}/workers`, { worker_id, job_id });
      invalidateEvent(eventId);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const checkin = async (id) => {
    try {
      await api.post(`/events/${eventId}/workers/${id}/checkin`);
      toast.success("QR check-in tersimulasi & diverifikasi supervisor");
      invalidateEvent(eventId);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Workforce Network</h2>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400 animate-pulse">
          Memuat workforce…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-semibold md:text-lg">Workforce Network</h2>
        <div className="border border-red-500/30 bg-red-950/20 p-6 text-center text-sm text-red-400 space-y-2">
          <div>Gagal memuat workforce: {apiError(error)}</div>
          <button onClick={() => refetch()} className="border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const jobs = data?.jobs || [];
  const assigned = data?.assigned || [];
  const pool = data?.pool || [];

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Workforce Network</h2>
      <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[["role", "Role", "text"], ["needed", "Jumlah", "number"], ["compensation_per_day", "Kompensasi/hari", "number"]].map(([k, label, type]) => (
            <label key={k} className="block">
              <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
              <input
                data-testid={`job-${k}-input`}
                type={type}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: type === "number" ? Number(e.target.value) : e.target.value })}
                className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none"
              />
            </label>
          ))}
          <button data-testid="create-job-btn" onClick={createJob} className="mt-5 h-10 bg-[var(--okx-accent)] px-4 text-sm font-semibold text-black hover:bg-[var(--okx-accent-hover)] cursor-pointer">Buat job</button>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--okx-border)] okx-scroll" data-testid="jobs-table">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr className="border-b border-[var(--okx-border)]"><th className="p-3">Role</th><th className="p-3">Shift</th><th className="p-3 text-right">Terisi</th><th className="p-3 text-right">Kompensasi</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-[var(--okx-border)] last:border-0">
                <td className="p-3">{j.role}</td>
                <td className="p-3 text-xs text-zinc-400">{j.shift}</td>
                <td className="num p-3 text-right">{j.filled}/{j.needed}</td>
                <td className="num p-3 text-right">{idr(j.compensation_per_day)}/hari</td>
                <td className="p-3"><StatusBadge status={j.filled >= j.needed ? "Confirmed" : j.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Pekerja ditugaskan</h3>
          <div className="mt-3 border border-[var(--okx-border)]" data-testid="assigned-workers">
            {assigned.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
                <div>
                  <div className="text-sm font-medium">{w.worker_name}</div>
                  <div className="text-xs text-zinc-500">{w.role} · {w.status}</div>
                </div>
                <button data-testid={`checkin-btn-${w.id}`} onClick={() => checkin(w.id)} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)] cursor-pointer">
                  {w.check_in_at ? "Checked in" : "QR check-in"}
                </button>
              </div>
            ))}
            {assigned.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Belum ada pekerja ditugaskan.</div>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Talent pool pekerja</h3>
          <div className="mt-3 border border-[var(--okx-border)]">
            {pool.slice(0, 12).map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
                <div>
                  <div className="text-sm font-medium">{w.name} {w.verified && <span className="ml-1 text-[10px] accent-text">Verified</span>}</div>
                  <div className="num text-xs text-zinc-500">{w.category} · {idr(w.rate_per_day)}/hari · attendance {w.attendance_rate}%</div>
                </div>
                <button
                  data-testid={`assign-worker-btn-${w.id}`}
                  onClick={() => assign(w.id, jobs.find((j) => j.role === w.category)?.id)}
                  className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)] cursor-pointer"
                >
                  Tugaskan
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
