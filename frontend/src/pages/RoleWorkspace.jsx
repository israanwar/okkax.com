import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError, idr, num } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="editorial text-2xl sm:text-3xl">Dashboard peran saya</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {user.name} · peran: {d.roles.join(", ")}. Menampilkan penugasan, kesiapan, dan pembayaran yang terkait
          dengan Anda saja.
        </p>
      </div>

      {d.sections.length === 0 && (
        <div data-testid="roleworkspace-empty" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400">
          Belum ada penugasan untuk peran Anda. Masuk sebagai talent@okkax.id, venue@okkax.id, vendor@okkax.id,
          worker@okkax.id, atau finance@okkax.id untuk melihat contoh data.
        </div>
      )}

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
                      <span>{m.ref_name} — {m.description}</span>
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
  );
}
