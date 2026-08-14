import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError, idr, num } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";

export function SponsorPortal() {
  const [ops, setOps] = useState([]);
  const [mine, setMine] = useState({ interests: [], commitments: [] });

  const load = async () => {
    const [{ data: o }, { data: m }] = await Promise.all([
      api.get("/sponsor/opportunities"),
      api.get("/sponsor/my-interests"),
    ]);
    setOps(o.items);
    setMine(m);
  };
  useEffect(() => {
    load();
  }, []);

  const express = async (pkg) => {
    try {
      await api.post("/sponsor-interests", { package_id: pkg.id, amount: pkg.price, message: "Tertarik pada paket ini." });
      toast.success("Minat sponsor dikirim ke organizer");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="editorial text-2xl sm:text-3xl">Sponsor Exchange</h1>
        <p className="mt-2 text-sm text-zinc-400">Temukan event, lihat inventory sponsor, dan ajukan minat.</p>
      </div>

      {ops.length === 0 && <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400">Belum ada peluang sponsor terbuka.</div>}

      {ops.map(({ event, packages }) => (
        <div key={event.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`sponsor-opportunity-${event.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold md:text-lg">{event.name}</h2>
              <div className="num text-xs text-zinc-500">
                {event.city} · {event.start_date} · kapasitas {num(event.capacity)} · {event.audience_profile}
              </div>
            </div>
            <span className="num border border-[var(--okx-border)] px-2 py-1 text-xs">{event.event_code}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {packages.map((p) => (
              <div key={p.id} className="border border-[var(--okx-border)] p-4">
                <h3 className="text-sm font-semibold">{p.name}</h3>
                <div className="num mt-1 text-lg font-bold">{idr(p.price)}</div>
                <div className="num text-xs text-zinc-500">Sisa {p.quantity - p.sold} slot · {p.exclusivity}</div>
                <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
                  {(p.rights || []).slice(0, 4).map((r) => <li key={r}>· {r}</li>)}
                </ul>
                <button data-testid={`express-interest-btn-${p.id}`} onClick={() => express(p)} className="mt-3 w-full bg-[var(--okx-accent)] px-3 py-2 text-xs font-semibold">
                  Express Interest
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-[var(--okx-border)]" data-testid="my-sponsor-interests">
          <div className="hairline p-3 text-sm font-semibold">Interests saya</div>
          {mine.interests.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
              <div>
                <div className="text-sm">{i.event_name} — {i.package_name}</div>
                <div className="num text-xs text-zinc-500">{idr(i.amount)}</div>
              </div>
              <StatusBadge status={i.status === "approved" ? "Confirmed" : i.status === "rejected" ? "Cancelled" : "Pending"} />
            </div>
          ))}
          {mine.interests.length === 0 && <div className="p-4 text-sm text-zinc-500">Belum ada pengajuan.</div>}
        </div>
        <div className="border border-[var(--okx-border)]" data-testid="my-sponsor-commitments">
          <div className="hairline p-3 text-sm font-semibold">Commitments & deliverables</div>
          {mine.commitments.map((c) => (
            <div key={c.id} className="border-b border-[var(--okx-border)] p-3 last:border-0">
              <div className="text-sm">{c.event_name} — {c.package_name}</div>
              <div className="num text-xs text-zinc-500">{idr(c.amount)} · {c.status} · fulfillment {c.fulfillment_status}</div>
            </div>
          ))}
          {mine.commitments.length === 0 && <div className="p-4 text-sm text-zinc-500">Belum ada komitmen.</div>}
        </div>
      </div>
    </div>
  );
}

export function TenantPortal() {
  const [ops, setOps] = useState([]);
  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ business_name: "", product_category: "Food and Beverage", power_watt: 1000, staffing: 2 });

  const load = async () => {
    const [{ data: o }, { data: m }] = await Promise.all([
      api.get("/tenant/opportunities"),
      api.get("/tenant/my-applications"),
    ]);
    setOps(o.items);
    setMine(m.items);
  };
  useEffect(() => {
    load();
  }, []);

  const apply = async () => {
    try {
      await api.post("/tenant-applications", { booth_id: selected.id, ...form });
      toast.success("Aplikasi booth dikirim. Booth berstatus reserved.");
      setSelected(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="editorial text-2xl sm:text-3xl">Tenant Exchange</h1>
        <p className="mt-2 text-sm text-zinc-400">Pilih booth, lihat audiens event, dan ajukan aplikasi tenant.</p>
      </div>

      {ops.length === 0 && <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center text-sm text-zinc-400">Belum ada booth tersedia.</div>}

      {ops.map(({ event, booths, available_booths }) => (
        <div key={event.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`tenant-opportunity-${event.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold md:text-lg">{event.name}</h2>
              <div className="num text-xs text-zinc-500">
                {event.city} · {event.start_date} · audiens {num(event.capacity)} · {available_booths} booth tersedia
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {booths.map((b) => (
              <button
                key={b.id}
                data-testid={`select-booth-btn-${b.code}`}
                onClick={() => {
                  setSelected(b);
                  setForm((f) => ({ ...f, product_category: b.zone_name.includes("Food") ? "Food and Beverage" : f.product_category }));
                }}
                title={`${b.zone_name} · ${idr(b.price)} · ${b.electricity_watt}W`}
                className={`num border px-2 py-1 text-[11px] ${selected?.id === b.id ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-300 hover:border-zinc-500"}`}
              >
                {b.code}
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <div className="border border-[var(--okx-accent)] bg-[#140700] p-5" data-testid="tenant-apply-form">
          <h3 className="text-base font-semibold md:text-lg">Ajukan booth {selected.code}</h3>
          <div className="num mt-1 text-xs text-zinc-400">
            {selected.zone_name} · {selected.size} · {idr(selected.price)} · deposit {idr(selected.deposit)} · listrik {selected.electricity_watt}W
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <input data-testid="tenant-business-input" placeholder="Nama bisnis" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
            <PremiumSelect data-testid="tenant-category-select" value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })} className="w-full">
              {["Food and Beverage", "Merchandise", "Fashion", "Beauty", "Technology", "Automotive", "Community", "Creative Product", "UMKM Lokal", "Exhibitor", "Franchise", "Retail Pop-up"].map((c) => <option key={c}>{c}</option>)}
            </PremiumSelect>
            <input data-testid="tenant-power-input" type="number" value={form.power_watt} onChange={(e) => setForm({ ...form, power_watt: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
            <button data-testid="tenant-apply-btn" onClick={apply} disabled={!form.business_name} className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Kirim aplikasi</button>
          </div>
        </div>
      )}

      <div className="border border-[var(--okx-border)]" data-testid="my-tenant-applications">
        <div className="hairline p-3 text-sm font-semibold">Aplikasi saya</div>
        {mine.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
            <div>
              <div className="text-sm">{a.event_name} — booth {a.booth_code}</div>
              <div className="num text-xs text-zinc-500">{a.business_name} · {idr(a.amount)} · {a.payment_status}</div>
            </div>
            <StatusBadge status={a.status === "approved" ? "Confirmed" : a.status === "rejected" ? "Cancelled" : "Pending"} />
          </div>
        ))}
        {mine.length === 0 && <div className="p-4 text-sm text-zinc-500">Belum ada aplikasi.</div>}
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [m, setM] = useState(null);
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState("metrics");

  const load = async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        api.get("/admin/metrics"), api.get("/admin/users"), api.get("/admin/organizations"), api.get("/admin/audit-logs"),
      ]);
      setM(a.data);
      setUsers(b.data.items);
      setOrgs(c.data.items);
      setLogs(d.data.items);
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const verifyOrg = async (id, verified) => {
    await api.post("/admin/verify", { kind: "organization", id, verified });
    toast.success("Status verifikasi diperbarui");
    load();
  };
  const reseed = async () => {
    await api.post("/demo/reset");
    toast.success("Data demo direset");
    load();
  };

  if (!m) return <div className="text-sm text-zinc-500">Memuat admin panel…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="editorial text-2xl sm:text-3xl">Admin Panel</h1>
        <button data-testid="admin-reseed-btn" onClick={reseed} className="border border-[var(--okx-border)] px-4 py-2 text-sm hover:border-[var(--okx-accent)]">Reset data demo</button>
      </div>

      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-3 lg:grid-cols-6" data-testid="admin-metrics">
        {Object.entries(m).map(([k, v]) => (
          <div key={k} className="bg-[var(--okx-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">{k.replace(/_/g, " ")}</div>
            <div className="num mt-1 text-lg font-bold">{k === "gmv" ? idr(v) : num(v)}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-[var(--okx-border)]">
        {["metrics", "users", "organizations", "audit"].map((t) => (
          <button key={t} data-testid={`admin-tab-${t}`} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-[var(--okx-accent)] accent-text" : "text-zinc-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="overflow-x-auto border border-[var(--okx-border)] okx-scroll" data-testid="admin-users">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-[var(--okx-border)]"><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Roles</th><th className="p-3">Org</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--okx-border)] last:border-0">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3 text-zinc-400">{u.email}</td>
                  <td className="p-3 text-xs">{(u.roles || []).join(", ")}</td>
                  <td className="p-3 text-xs text-zinc-500">{u.org_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "organizations" && (
        <div className="border border-[var(--okx-border)]" data-testid="admin-orgs">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-3 last:border-0">
              <div>
                <div className="text-sm font-medium">{o.name}</div>
                <div className="text-xs text-zinc-500">{o.org_type} · {o.city} · dokumen {o.document_status}</div>
              </div>
              <button data-testid={`verify-org-btn-${o.id}`} onClick={() => verifyOrg(o.id, !o.verified)} className={`border px-3 py-1.5 text-xs ${o.verified ? "border-white/45 text-white" : "border-[var(--okx-border)] text-zinc-400"}`}>
                {o.verified ? "Verified" : "Verifikasi"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div className="border border-[var(--okx-border)]" data-testid="admin-audit">
          {logs.map((l) => (
            <div key={l.id} className="border-b border-[var(--okx-border)] p-3 text-xs last:border-0">
              <span className="accent-text">{l.action}</span> · {l.user_email || "system"} · {String(l.created_at).slice(0, 19).replace("T", " ")}
            </div>
          ))}
        </div>
      )}

      {tab === "metrics" && (
        <p className="text-sm text-zinc-400">
          Semua metrik dihitung langsung dari database OKKAX. Route admin dilindungi oleh role Super Administrator
          dan Platform Administrator.
        </p>
      )}
    </div>
  );
}
