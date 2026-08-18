import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ListOrdered, CalendarDays, Handshake, Store } from "lucide-react";
import { api, apiError, idr, num } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

const ORGANIZER_ROLES = new Set([
  "organizer",
  "event_organizer",
  "promoter",
  "supervisor",
  "finance_approver",
]);

const SPONSOR_ROLES = new Set(["sponsor"]);
const TENANT_ROLES = new Set(["tenant"]);
const AUDIENCE_ROLES = new Set(["audience"]);

function EmptyStateGeneric({ roles }) {
  const roleSet = new Set(roles || []);
  const isOrganizer = [...roleSet].some((r) => ORGANIZER_ROLES.has(r));
  const isSponsor = [...roleSet].some((r) => SPONSOR_ROLES.has(r));
  const isTenant = [...roleSet].some((r) => TENANT_ROLES.has(r));
  const isAudience = [...roleSet].some((r) => AUDIENCE_ROLES.has(r));

  if (isOrganizer) {
    return (
      <div
        data-testid="roleworkspace-empty-organizer"
        className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-8 shadow-sm"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
          Assignment scope
        </div>
        <h2 className="editorial mt-3 text-2xl text-white">Anda mengelola event, bukan dibooking oleh event.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          My Assignments menampilkan penugasan operasional pada satu individu:
          performance slot talent, booking venue, deliverable vendor, shift workforce,
          dan persetujuan pembayaran finance. Peran penyelenggara tidak mengisi kolom
          ini karena Anda adalah pemilik event.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Untuk pekerjaan penyelenggara, gunakan surface berikut.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/app/events"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
          >
            <ListOrdered size={14} /> Buka Events
          </Link>
          <Link
            to="/app/calendar"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]"
          >
            <CalendarDays size={14} /> Buka Calendar
          </Link>
        </div>
      </div>
    );
  }

  if (isSponsor) {
    return (
      <div
        data-testid="roleworkspace-empty-sponsor"
        className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-8 shadow-sm"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
          Assignment scope
        </div>
        <h2 className="editorial mt-3 text-2xl text-white">Sponsor bekerja melalui portal peluang.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Minat, komitmen, dan deliverable sponsor tinggal di Sponsor Opportunities.
          Ketika minat Anda dikonfirmasi organizer, komitmen dan pemenuhan akan tampil di sana.
        </p>
        <div className="mt-6">
          <Link
            to="/app/sponsor"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
          >
            <Handshake size={14} /> Buka Sponsor Opportunities
          </Link>
        </div>
      </div>
    );
  }

  if (isTenant) {
    return (
      <div
        data-testid="roleworkspace-empty-tenant"
        className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-8 shadow-sm"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
          Assignment scope
        </div>
        <h2 className="editorial mt-3 text-2xl text-white">Tenant bekerja melalui portal peluang.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Aplikasi tenant dan penempatan booth dikelola di Tenant Opportunities.
          Ketika aplikasi Anda diputuskan, statusnya akan tampil pada portal tersebut.
        </p>
        <div className="mt-6">
          <Link
            to="/app/tenant"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
          >
            <Store size={14} /> Buka Tenant Opportunities
          </Link>
        </div>
      </div>
    );
  }

  if (isAudience) {
    return (
      <div
        data-testid="roleworkspace-empty-audience"
        className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-8 shadow-sm"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
          Assignment scope
        </div>
        <h2 className="editorial mt-3 text-2xl text-white">Belum ada penugasan operasional.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          My Assignments menampilkan penugasan produksi: booking talent, venue, vendor,
          workforce, atau persetujuan pembayaran. Sebagai audiens, tiket dan pesanan Anda
          tinggal di My Tickets.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="roleworkspace-empty"
      className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-8 shadow-sm"
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
        Assignment scope
      </div>
      <h2 className="editorial mt-3 text-2xl text-white">Belum ada penugasan aktif untuk peran Anda.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Ketika organizer menempatkan Anda pada sebuah event, penugasan akan otomatis muncul
        di sini beserta status kesiapan dan jadwal pembayaran.
      </p>
    </div>
  );
}

export default function RoleWorkspace() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const load = () => api.get("/me/workspace").then(({ data }) => setD(data));
  useEffect(() => {
    load();
  }, []);

  const confirm = async (kind, id, status) => {
    try {
      await api.post("/me/workspace/confirm", { kind, id, status });
      toast.success("Status penugasan diperbarui");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!d) return <div className="text-sm text-zinc-500 p-8 font-gemini">Memuat dashboard peran…</div>;

  const totalItems = d.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const summary = d.sections.length > 0
    ? `${d.sections.length} kategori · ${totalItems} penugasan aktif`
    : "Belum ada penugasan operasional.";

  return (
    <div className="okx-workspace-page space-y-4 font-gemini" data-testid="roleworkspace-page">
      <div className="okx-workspace-chrome rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-4.5" data-testid="roleworkspace-chrome">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
          My Assignments
        </div>
        <h1 className="editorial text-xl sm:text-2xl text-white">Dashboard peran saya</h1>
        <p className="mt-1 max-w-3xl text-xs sm:text-[13px] leading-relaxed text-zinc-400">
          <span className="font-semibold text-white">{user.name}</span> · peran: {d.roles.join(", ") || "belum ada"}. {summary}
        </p>
      </div>

      <div className="okx-workspace-content">
        <div className="space-y-6">
          {d.sections.length === 0 && <EmptyStateGeneric roles={d.roles} />}

          {d.sections.map((s) => (
            <section key={s.kind} data-testid={`role-section-${s.kind}`} className="space-y-2.5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">{s.title}</h2>
              <div className="space-y-2.5">
                {s.items.length === 0 && (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 text-xs text-zinc-400">
                    Belum ada data pada peran ini.
                  </div>
                )}

                {s.kind === "talent" && s.items.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`talent-booking-${b.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-white/[0.06] pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white md:text-base">{b.event_name}</h3>
                        <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
                          {b.talent_name} · slot {b.performance_slot || "belum diatur"} · rider {b.rider_matched}/{b.rider_total} matched
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={b.status} />
                        <button
                          data-testid={`talent-confirm-${b.id}`}
                          onClick={() => confirm("talent", b.id, b.status === "Confirmed" ? "Pending" : "Confirmed")}
                          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
                        >
                          {b.status === "Confirmed" ? "Ubah ke Pending" : "Konfirmasi kesiapan"}
                        </button>
                      </div>
                    </div>
                    <div className="num mt-3 grid gap-x-5 gap-y-1.5 text-xs sm:grid-cols-2 font-gemini-mono">
                      {[["Performance fee", b.fee], ["Landed cost", b.landed_cost], ["Travel", b.travel], ["Akomodasi", b.accommodation]].map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-white/[0.04] py-1">
                          <span className="text-zinc-400 text-[11px]">{k}</span><span className="text-white font-semibold text-[11px]">{idr(v)}</span>
                        </div>
                      ))}
                    </div>
                    {b.milestones?.length > 0 && (
                      <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/40 p-2.5">
                        <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono mb-1.5">Jadwal pembayaran saya</div>
                        <div className="divide-y divide-white/[0.04]">
                          {b.milestones.map((m) => (
                            <div key={m.id} className="flex justify-between gap-2.5 py-1 text-xs">
                              <span className="text-zinc-300 text-[11px]">{m.description} ({m.percentage}%)</span>
                              <span className="num font-gemini-mono text-zinc-100 font-semibold text-[11px]">{idr(m.amount)} · {m.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {s.kind === "venue" && s.items.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`venue-booking-${v.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div>
                        <h3 className="text-sm font-bold text-white md:text-base">{v.event_name}</h3>
                        <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
                          {v.event_days} event day + {v.setup_days} setup day · {idr(v.total_cost)} · deposit {idr(v.deposit)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={v.status} />
                        <button
                          data-testid={`venue-confirm-${v.id}`}
                          onClick={() => confirm("venue", v.id, v.status === "Confirmed" ? "Pending" : "Confirmed")}
                          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
                        >
                          {v.status === "Confirmed" ? "Ubah ke Pending" : "Konfirmasi booking"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {s.kind === "vendor" && s.items.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`vendor-assignment-${v.id}`}>
                    <div>
                      <h3 className="text-sm font-bold text-white md:text-base">{v.event_name}</h3>
                      <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">{v.category} · nilai kontrak {idr(v.cost)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={v.status} />
                      <button
                        data-testid={`vendor-confirm-${v.id}`}
                        onClick={() => confirm("vendor", v.id, v.status === "Confirmed" ? "Pending" : "Confirmed")}
                        className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
                      >
                        {v.status === "Confirmed" ? "Ubah ke Pending" : "Terima penugasan"}
                      </button>
                    </div>
                  </div>
                ))}

                {s.kind === "worker" && s.items.map((w) => (
                  <div key={w.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`worker-shift-${w.id}`}>
                    <div>
                      <h3 className="text-sm font-bold text-white md:text-base">{w.event_name}</h3>
                      <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
                        {w.role} · {w.job?.shift || "shift menyusul"} · perkiraan upah {idr(w.earning)} · pembayaran {w.payment_status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.check_in_at ? "Confirmed" : "Pending"} />
                      <span className="num text-[11px] text-zinc-400 font-gemini-mono">{w.check_in_at ? `Check-in ${String(w.check_in_at).slice(11, 16)}` : "Belum check-in"}</span>
                    </div>
                  </div>
                ))}

                {s.kind === "finance" && s.items.map((f) => (
                  <div key={f.event_id} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`finance-event-${f.event_id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.06] pb-2.5">
                      <h3 className="text-sm font-bold text-white md:text-base">{f.event_name}</h3>
                      <div className="num text-xs sm:text-sm text-white font-bold font-gemini-mono">
                        {num(f.pending)} milestone menunggu · {idr(f.pending_amount)}
                      </div>
                    </div>
                    <div className="mt-2.5 divide-y divide-white/[0.04]">
                      {f.milestones.map((m) => (
                        <div key={m.id} className="flex justify-between gap-2.5 py-1.5 text-xs">
                          <span className="text-zinc-300 text-[11px]">{m.ref_name} · {m.description}</span>
                          <span className="num font-gemini-mono text-white font-semibold text-[11px]">{idr(m.amount)} · {m.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
