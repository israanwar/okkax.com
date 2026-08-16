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
        className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
          Assignment scope
        </div>
        <h2 className="editorial mt-2 text-xl">Anda mengelola event, bukan dibooking oleh event.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          My Assignments menampilkan penugasan operasional pada satu individu:
          performance slot talent, booking venue, deliverable vendor, shift workforce,
          dan persetujuan pembayaran finance. Peran penyelenggara tidak mengisi kolom
          ini karena Anda adalah pemilik event.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Untuk pekerjaan penyelenggara, gunakan surface berikut.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/app/events"
            className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-[var(--okx-accent)]"
          >
            <ListOrdered size={14} /> Buka Events
          </Link>
          <Link
            to="/app/calendar"
            className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-[var(--okx-accent)]"
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
        className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
          Assignment scope
        </div>
        <h2 className="editorial mt-2 text-xl">Sponsor bekerja melalui portal peluang.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Minat, komitmen, dan deliverable sponsor tinggal di Sponsor Opportunities.
          Ketika minat Anda dikonfirmasi organizer, komitmen dan pemenuhan akan tampil di sana.
        </p>
        <div className="mt-5">
          <Link
            to="/app/sponsor"
            className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-[var(--okx-accent)]"
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
        className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
          Assignment scope
        </div>
        <h2 className="editorial mt-2 text-xl">Tenant bekerja melalui portal peluang.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Aplikasi tenant dan penempatan booth dikelola di Tenant Opportunities.
          Ketika aplikasi Anda diputuskan, statusnya akan tampil pada portal tersebut.
        </p>
        <div className="mt-5">
          <Link
            to="/app/tenant"
            className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-[var(--okx-accent)]"
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
        className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
          Assignment scope
        </div>
        <h2 className="editorial mt-2 text-xl">Belum ada penugasan operasional.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
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
      className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
        Assignment scope
      </div>
      <h2 className="editorial mt-2 text-xl">Belum ada penugasan aktif untuk peran Anda.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
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

  if (!d) return <div className="text-sm text-zinc-500">Memuat dashboard peran…</div>;

  const totalItems = d.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const summary = d.sections.length > 0
    ? `${d.sections.length} kategori · ${totalItems} penugasan aktif`
    : "Belum ada penugasan operasional.";

  return (
    <div className="okx-workspace-page" data-testid="roleworkspace-page">
      <div className="okx-workspace-chrome" data-testid="roleworkspace-chrome">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
          My Assignments
        </div>
        <h1 className="editorial text-2xl sm:text-3xl">Dashboard peran saya</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          {user.name} · peran: {d.roles.join(", ") || "belum ada"}. {summary}
        </p>
      </div>

      <div className="okx-workspace-content">
        <div className="space-y-8">
          {d.sections.length === 0 && <EmptyStateGeneric roles={d.roles} />}

          {d.sections.map((s) => (
        <section key={s.kind} data-testid={`role-section-${s.kind}`}>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">{s.title}</h2>
          <div className="mt-3 space-y-3">
            {s.items.length === 0 && (
              <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-6 text-sm text-zinc-500">
                Belum ada data pada peran ini.
              </div>
            )}

            {s.kind === "talent" && s.items.map((b) => (
              <div key={b.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`talent-booking-${b.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{b.event_name}</h3>
                    <div className="num text-xs text-zinc-500">
                      {b.talent_name} · slot {b.performance_slot || "belum diatur"} · rider {b.rider_matched}/{b.rider_total} matched
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    <button data-testid={`talent-confirm-${b.id}`} onClick={() => confirm("talent", b.id, b.status === "Confirmed" ? "Pending" : "Confirmed")} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">
                      {b.status === "Confirmed" ? "Ubah ke Pending" : "Konfirmasi kesiapan"}
                    </button>
                  </div>
                </div>
                <div className="num mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {[["Performance fee", b.fee], ["Landed cost", b.landed_cost], ["Travel", b.travel], ["Akomodasi", b.accommodation]].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[var(--okx-border)] py-1">
                      <span className="text-zinc-500">{k}</span><span>{idr(v)}</span>
                    </div>
                  ))}
                </div>
                {b.milestones?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wider text-zinc-500">Jadwal pembayaran saya</div>
                    {b.milestones.map((m) => (
                      <div key={m.id} className="flex justify-between gap-3 border-b border-[var(--okx-border)] py-1.5 text-xs">
                        <span>{m.description} ({m.percentage}%)</span>
                        <span className="num">{idr(m.amount)} · {m.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {s.kind === "venue" && s.items.map((v) => (
              <div key={v.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`venue-booking-${v.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{v.event_name}</h3>
                    <div className="num text-xs text-zinc-500">
                      {v.event_days} event day + {v.setup_days} setup day · {idr(v.total_cost)} · deposit {idr(v.deposit)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} />
                    <button data-testid={`venue-confirm-${v.id}`} onClick={() => confirm("venue", v.id, v.status === "Confirmed" ? "Pending" : "Confirmed")} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">
                      {v.status === "Confirmed" ? "Ubah ke Pending" : "Konfirmasi booking"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {s.kind === "vendor" && s.items.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`vendor-assignment-${v.id}`}>
                <div>
                  <h3 className="text-base font-semibold">{v.event_name}</h3>
                  <div className="num text-xs text-zinc-500">{v.category} · nilai kontrak {idr(v.cost)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={v.status} />
                  <button data-testid={`vendor-confirm-${v.id}`} onClick={() => confirm("vendor", v.id, v.status === "Confirmed" ? "Pending" : "Confirmed")} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">
                    {v.status === "Confirmed" ? "Ubah ke Pending" : "Terima penugasan"}
                  </button>
                </div>
              </div>
            ))}

            {s.kind === "worker" && s.items.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`worker-shift-${w.id}`}>
                <div>
                  <h3 className="text-base font-semibold">{w.event_name}</h3>
                  <div className="num text-xs text-zinc-500">
                    {w.role} · {w.job?.shift || "shift menyusul"} · perkiraan upah {idr(w.earning)} · pembayaran {w.payment_status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={w.check_in_at ? "Confirmed" : "Pending"} />
                  <span className="num text-xs text-zinc-500">{w.check_in_at ? `Check-in ${String(w.check_in_at).slice(11, 16)}` : "Belum check-in"}</span>
                </div>
              </div>
            ))}

            {s.kind === "finance" && s.items.map((f) => (
              <div key={f.event_id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`finance-event-${f.event_id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{f.event_name}</h3>
                  <div className="num text-sm">
                    {num(f.pending)} milestone menunggu · {idr(f.pending_amount)}
                  </div>
                </div>
                <div className="mt-3">
                  {f.milestones.map((m) => (
                    <div key={m.id} className="flex justify-between gap-3 border-b border-[var(--okx-border)] py-1.5 text-xs">
                      <span>{m.ref_name} · {m.description}</span>
                      <span className="num">{idr(m.amount)} · {m.status}</span>
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
