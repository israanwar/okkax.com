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
    setOps(o.items || []);
    setMine(m || { interests: [], commitments: [] });
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
    <div className="space-y-4 font-gemini">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-4.5 shadow-sm">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
          Sponsor Opportunity Exchange
        </div>
        <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">Sponsor Exchange</h1>
        <p className="mt-1 text-xs text-zinc-400">Temukan event, lihat inventory sponsor, dan ajukan minat kemitraan.</p>
      </div>

      {ops.length === 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-6 text-center text-xs text-zinc-400 font-gemini">
          Belum ada peluang sponsor terbuka.
        </div>
      )}

      {ops.map(({ event, packages }) => (
        <div key={event.id} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`sponsor-opportunity-${event.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white md:text-base">{event.name}</h2>
              <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
                {event.city} · {event.start_date} · kapasitas {num(event.capacity)} · {event.audience_profile}
              </div>
            </div>
            <span className="num rounded-lg border border-white/[0.12] bg-white/[0.03] px-2 py-0.5 text-[11px] font-gemini-mono text-zinc-300">{event.event_code}</span>
          </div>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {packages.map((p) => (
              <div key={p.id} className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#14141a]/60 p-3 transition-all hover:border-white/20">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">{p.name}</h3>
                  <div className="num mt-1 text-base font-bold text-white font-gemini-mono">{idr(p.price)}</div>
                  <div className="num text-[10.5px] text-zinc-400 mt-0.5 font-gemini-mono">Sisa {p.quantity - p.sold} slot · {p.exclusivity}</div>
                  <ul className="mt-2 space-y-0.5 text-[10.5px] text-zinc-400">
                    {(p.rights || []).slice(0, 4).map((r) => <li key={r} className="line-clamp-1">· {r}</li>)}
                  </ul>
                </div>
                <button
                  data-testid={`express-interest-btn-${p.id}`}
                  onClick={() => express(p)}
                  className="mt-3 w-full rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
                >
                  Express Interest
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm" data-testid="my-sponsor-interests">
          <div className="border-b border-white/[0.08] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Interests saya</div>
          <div className="divide-y divide-white/[0.06]">
            {mine.interests.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 p-3 hover:bg-white/[0.02]">
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-white">{i.event_name} — {i.package_name}</div>
                  <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">{idr(i.amount)}</div>
                </div>
                <StatusBadge status={i.status === "approved" ? "Confirmed" : i.status === "rejected" ? "Cancelled" : "Pending"} />
              </div>
            ))}
            {mine.interests.length === 0 && <div className="p-4 text-xs text-zinc-500 font-gemini">Belum ada pengajuan interest.</div>}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm" data-testid="my-sponsor-commitments">
          <div className="border-b border-white/[0.08] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Commitments & deliverables</div>
          <div className="divide-y divide-white/[0.06]">
            {mine.commitments.map((c) => (
              <div key={c.id} className="p-3 hover:bg-white/[0.02]">
                <div className="text-xs sm:text-sm font-semibold text-white">{c.event_name} — {c.package_name}</div>
                <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">{idr(c.amount)} · {c.status} · fulfillment {c.fulfillment_status}</div>
              </div>
            ))}
            {mine.commitments.length === 0 && <div className="p-4 text-xs text-zinc-500 font-gemini">Belum ada komitmen aktif.</div>}
          </div>
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
    setOps(o.items || []);
    setMine(m.items || []);
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
    <div className="space-y-4 font-gemini">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-4.5 shadow-sm">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
          Tenant & Booth Exchange
        </div>
        <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">Tenant Exchange</h1>
        <p className="mt-1 text-xs text-zinc-400">Pilih booth, lihat audiens event, dan ajukan aplikasi tenant bisnis Anda.</p>
      </div>

      {ops.length === 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-6 text-center text-xs text-zinc-400 font-gemini">
          Belum ada booth tersedia.
        </div>
      )}

      {ops.map(({ event, booths, available_booths }) => (
        <div key={event.id} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm" data-testid={`tenant-opportunity-${event.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white md:text-base">{event.name}</h2>
              <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
                {event.city} · {event.start_date} · audiens {num(event.capacity)} · <span className="text-white font-bold">{available_booths} booth tersedia</span>
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {booths.map((b) => (
              <button
                key={b.id}
                data-testid={`select-booth-btn-${b.code}`}
                onClick={() => {
                  setSelected(b);
                  setForm((f) => ({ ...f, product_category: b.zone_name.includes("Food") ? "Food and Beverage" : f.product_category }));
                }}
                title={`${b.zone_name} · ${idr(b.price)} · ${b.electricity_watt}W`}
                className={`num rounded-lg border px-2.5 py-1 text-[11px] font-semibold font-gemini-mono transition-all cursor-pointer ${
                  selected?.id === b.id
                    ? "border-white bg-white text-black shadow-sm font-bold scale-105"
                    : "border-white/[0.12] bg-[#0d0d14] text-zinc-300 hover:border-white/30 hover:bg-white/[0.04]"
                }`}
              >
                {b.code} · <span className="opacity-70">{idr(b.price)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <div className="rounded-2xl border border-white/25 bg-[#0c0c14] backdrop-blur-xl p-4 sm:p-5 shadow-lg animate-in fade-in zoom-in-95 duration-150" data-testid="tenant-apply-form">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-white md:text-base">Ajukan booth {selected.code}</h3>
              <div className="num mt-0.5 text-[11px] text-zinc-300 font-gemini-mono">
                {selected.zone_name} · {selected.size} · {idr(selected.price)} · deposit {idr(selected.deposit)} · listrik {selected.electricity_watt}W
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-zinc-400 hover:text-white">Batal</button>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
            <input data-testid="tenant-business-input" placeholder="Nama bisnis" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-white/40" />
            <PremiumSelect data-testid="tenant-category-select" value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })} className="w-full">
              {["Food and Beverage", "Merchandise", "Fashion", "Beauty", "Technology", "Automotive", "Community", "Creative Product", "UMKM Lokal", "Exhibitor", "Franchise", "Retail Pop-up"].map((c) => <option key={c}>{c}</option>)}
            </PremiumSelect>
            <input data-testid="tenant-power-input" type="number" value={form.power_watt} onChange={(e) => setForm({ ...form, power_watt: Number(e.target.value) })} className="rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-white/40" />
            <button data-testid="tenant-apply-btn" onClick={apply} disabled={!form.business_name} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed">Kirim aplikasi</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm" data-testid="my-tenant-applications">
        <div className="border-b border-white/[0.08] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Aplikasi booth saya</div>
        <div className="divide-y divide-white/[0.06]">
          {mine.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-3 hover:bg-white/[0.02]">
              <div>
                <div className="text-xs sm:text-sm font-semibold text-white">{a.event_name} — booth {a.booth_code}</div>
                <div className="num text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">{a.business_name} · {idr(a.amount)} · {a.payment_status}</div>
              </div>
              <StatusBadge status={a.status === "approved" ? "Confirmed" : a.status === "rejected" ? "Cancelled" : "Pending"} />
            </div>
          ))}
          {mine.length === 0 && <div className="p-4 text-xs text-zinc-500 font-gemini">Belum ada aplikasi booth.</div>}
        </div>
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
      setUsers(b.data.items || []);
      setOrgs(c.data.items || []);
      setLogs(d.data.items || []);
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

  if (!m) return <div className="text-xs text-zinc-500 p-6 font-gemini">Memuat admin panel…</div>;

  return (
    <div className="space-y-4 font-gemini">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-4.5">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
            Platform Governance
          </div>
          <h1 className="editorial text-xl sm:text-2xl text-white">Admin Panel</h1>
        </div>
        <button data-testid="admin-reseed-btn" onClick={reseed} className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]">
          Reset data demo
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6" data-testid="admin-metrics">
        {Object.entries(m).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{k.replace(/_/g, " ")}</div>
            <div className="num mt-1 text-base sm:text-lg font-bold text-white font-gemini-mono">{k === "gmv" ? idr(v) : num(v)}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 border-b border-white/[0.08] pb-1">
        {["metrics", "users", "organizations", "audit"].map((t) => (
          <button
            key={t}
            data-testid={`admin-tab-${t}`}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === t
                ? "bg-white/[0.1] text-white border border-white/[0.1]"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl okx-scroll" data-testid="admin-users">
          <table className="w-full min-w-[600px] text-xs">
            <thead className="text-left text-[11px] uppercase tracking-wider text-zinc-400 font-gemini-mono bg-white/[0.02]">
              <tr className="border-b border-white/[0.08]"><th className="p-2.5">Nama</th><th className="p-2.5">Email</th><th className="p-2.5">Roles</th><th className="p-2.5">Org</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-2.5 font-medium text-white">{u.name}</td>
                  <td className="p-2.5 text-zinc-400">{u.email}</td>
                  <td className="p-2.5 text-[11px] text-zinc-300 font-gemini-mono">{(u.roles || []).join(", ")}</td>
                  <td className="p-2.5 text-[11px] text-zinc-500 font-gemini-mono">{u.org_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "organizations" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]" data-testid="admin-orgs">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 p-3 hover:bg-white/[0.02] transition-colors">
              <div>
                <div className="text-xs sm:text-sm font-semibold text-white">{o.name}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{o.org_type} · {o.city} · dokumen {o.document_status}</div>
              </div>
              <button
                data-testid={`verify-org-btn-${o.id}`}
                onClick={() => verifyOrg(o.id, !o.verified)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                  o.verified ? "border-white/30 bg-white/10 text-white font-bold" : "border-white/[0.12] text-zinc-400 hover:text-white"
                }`}
              >
                {o.verified ? "Verified" : "Verifikasi"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]" data-testid="admin-audit">
          {logs.map((l) => (
            <div key={l.id} className="p-2.5 text-[11px] text-zinc-400 font-gemini-mono hover:bg-white/[0.02]">
              <span className="text-white font-bold">{l.action}</span> · {l.user_email || "system"} · {String(l.created_at).slice(0, 19).replace("T", " ")}
            </div>
          ))}
        </div>
      )}

      {tab === "metrics" && (
        <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
          Semua metrik dihitung langsung dari database live event OKKAX. Route admin dilindungi oleh role Super Administrator
          dan Platform Administrator.
        </p>
      )}
    </div>
  );
}
