import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError, idr, num } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export function SponsorsTab({ eventId, onChange }) {
  const [packages, setPackages] = useState([]);
  const [interests, setInterests] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [form, setForm] = useState({ name: "", price: 50000000, quantity: 1, rights: "" });

  const load = async () => {
    const [{ data: p }, { data: i }] = await Promise.all([
      api.get(`/events/${eventId}/sponsor-packages`),
      api.get(`/events/${eventId}/sponsor-interests`),
    ]);
    setPackages(p.items);
    setInterests(i.items);
    setCommitments(i.commitments);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId]);

  const create = async () => {
    try {
      await api.post(`/events/${eventId}/sponsor-packages`, {
        ...form, rights: form.rights.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Sponsor package dibuat");
      setForm({ name: "", price: 50000000, quantity: 1, rights: "" });
      load();
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const decide = async (id, decision) => {
    try {
      await api.post(`/sponsor-interests/${id}/decision`, { decision });
      toast.success(decision === "approved" ? "Sponsor disetujui — funding gap diperbarui" : "Pengajuan ditolak");
      load();
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Sponsor Exchange</h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="sponsor-packages">
        {packages.map((p) => (
          <div key={p.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <StatusBadge status={p.sold >= p.quantity ? "Completed" : p.sold ? "Pending" : "Draft"} />
            </div>
            <div className="num mt-2 text-lg font-bold">{idr(p.price)}</div>
            <div className="num text-xs text-zinc-500">Terjual {p.sold}/{p.quantity} · Exclusivity {p.exclusivity}</div>
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
              {(p.rights || []).map((r) => <li key={r}>· {r}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
        <h3 className="text-sm font-semibold">Tambah sponsor package</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <input data-testid="pkg-name-input" placeholder="Nama paket" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none sm:col-span-2" />
          <input data-testid="pkg-price-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
          <input data-testid="pkg-qty-input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
          <button data-testid="create-pkg-btn" onClick={create} disabled={!form.name} className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Buat paket</button>
        </div>
        <input data-testid="pkg-rights-input" placeholder="Hak sponsor, pisahkan dengan koma" value={form.rights} onChange={(e) => setForm({ ...form, rights: e.target.value })} className="mt-3 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Sponsor interests</h3>
        <div className="mt-3 border border-[var(--okx-border)]" data-testid="sponsor-interests">
          {interests.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Belum ada pengajuan sponsor.</div>}
          {interests.map((i) => (
            <div key={i.id} className="flex flex-col gap-3 border-b border-[var(--okx-border)] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">{i.sponsor_name} — {i.package_name}</div>
                <div className="num text-xs text-zinc-500">{idr(i.amount)}</div>
                {i.message && <div className="mt-1 text-xs text-zinc-400">“{i.message}”</div>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={i.status === "approved" ? "Confirmed" : i.status === "rejected" ? "Cancelled" : "Pending"} />
                {i.status === "pending" && (
                  <>
                    <button data-testid={`approve-interest-btn-${i.id}`} onClick={() => decide(i.id, "approved")} className="bg-[var(--okx-accent)] px-3 py-1.5 text-xs font-semibold">Setujui</button>
                    <button data-testid={`reject-interest-btn-${i.id}`} onClick={() => decide(i.id, "rejected")} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs">Tolak</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Commitments & deliverables</h3>
        <div className="mt-3 border border-[var(--okx-border)]" data-testid="sponsor-commitments">
          {commitments.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Belum ada komitmen sponsor.</div>}
          {commitments.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border-b border-[var(--okx-border)] p-4 last:border-0">
              <div>
                <div className="text-sm font-semibold">{c.sponsor_name}</div>
                <div className="text-xs text-zinc-500">{c.package_name} · Fulfillment {c.fulfillment_status}</div>
              </div>
              <div className="num text-sm font-bold accent-text">{idr(c.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TenantsTab({ eventId, onChange }) {
  const [zones, setZones] = useState([]);
  const [booths, setBooths] = useState([]);
  const [apps, setApps] = useState([]);
  const [form, setForm] = useState({ name: "", category: "Food and Beverage", slots: 6, price: 7500000 });

  const load = async () => {
    const [{ data: z }, { data: a }] = await Promise.all([
      api.get(`/events/${eventId}/tenant-zones`),
      api.get(`/events/${eventId}/tenant-applications`),
    ]);
    setZones(z.zones);
    setBooths(z.booths);
    setApps(a.items);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId]);

  const createZone = async () => {
    try {
      await api.post(`/events/${eventId}/tenant-zones`, form);
      toast.success("Tenant zone dan booth dibuat");
      setForm({ ...form, name: "" });
      load();
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const decide = async (id, decision) => {
    try {
      await api.post(`/tenant-applications/${id}/decision`, { decision });
      toast.success(decision === "approved" ? "Tenant disetujui — booth terisi & funding diperbarui" : "Aplikasi ditolak, booth dibuka kembali");
      load();
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold md:text-lg">Tenant Exchange</h2>

      <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
        <h3 className="text-sm font-semibold">Buat tenant zone</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <input data-testid="zone-name-input" placeholder="Nama zona" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none sm:col-span-2" />
          <select data-testid="zone-category-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none">
            {["Food and Beverage", "Merchandise", "Fashion", "Beauty", "Technology", "Automotive", "Community", "Creative Product", "UMKM Lokal", "Exhibitor", "Franchise", "Retail Pop-up", "Sponsor Activation"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input data-testid="zone-slots-input" type="number" value={form.slots} onChange={(e) => setForm({ ...form, slots: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
          <button data-testid="create-zone-btn" onClick={createZone} disabled={!form.name} className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Buat zona</button>
        </div>
      </div>

      {zones.map((z) => {
        const zb = booths.filter((b) => b.zone_id === z.id);
        return (
          <div key={z.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid={`zone-${z.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{z.name}</h3>
                <div className="num text-xs text-zinc-500">{z.category} · {z.area_sqm} m² · {zb.length} booth · {z.operating_hours}</div>
              </div>
              <div className="num text-xs text-zinc-400">
                Terisi {zb.filter((b) => b.status === "occupied").length}/{zb.length}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5" data-testid={`booth-map-${z.id}`}>
              {zb.map((b) => (
                <span
                  key={b.id}
                  title={`${b.code} · ${idr(b.price)} · ${b.status}`}
                  data-testid={`booth-${b.code}`}
                  className={`num border px-2 py-1 text-[11px] ${
                    b.status === "occupied"
                      ? "border-white/45 bg-white/10 text-white"
                      : b.status === "reserved"
                      ? "border-[var(--okx-accent)]/40 bg-[var(--okx-accent)]/10 text-[var(--okx-accent-soft)]"
                      : "border-[var(--okx-border)] text-zinc-400"
                  }`}
                >
                  {b.code}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Tenant applications</h3>
        <div className="mt-3 border border-[var(--okx-border)]" data-testid="tenant-applications">
          {apps.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">Belum ada aplikasi tenant.</div>}
          {apps.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 border-b border-[var(--okx-border)] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">{a.business_name} — {a.booth_code}</div>
                <div className="num text-xs text-zinc-500">{a.product_category} · {idr(a.amount)} · Listrik {a.power_requirement} · {a.payment_status}</div>
                {a.compatibility_conflicts?.length > 0 && (
                  <div className="mt-1 text-xs text-red-400">Konflik: {a.compatibility_conflicts.join("; ")}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status === "approved" ? "Confirmed" : a.status === "rejected" ? "Cancelled" : "Pending"} />
                {a.status === "pending" && (
                  <>
                    <button data-testid={`approve-tenant-btn-${a.id}`} onClick={() => decide(a.id, "approved")} className="bg-[var(--okx-accent)] px-3 py-1.5 text-xs font-semibold">Setujui</button>
                    <button data-testid={`reject-tenant-btn-${a.id}`} onClick={() => decide(a.id, "rejected")} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs">Tolak</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketsTab({ eventId, event, onChange }) {
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState({ name: "", ticket_type: "Regular", price: 250000, quantity: 300 });
  const [publishing, setPublishing] = useState(false);

  const load = () => api.get(`/events/${eventId}/ticket-tiers`).then(({ data }) => setTiers(data.items));
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId]);

  const create = async () => {
    try {
      await api.post(`/events/${eventId}/ticket-tiers`, form);
      toast.success("Ticket tier dibuat");
      setForm({ ...form, name: "" });
      load();
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const publish = async () => {
    setPublishing(true);
    try {
      await api.post(`/events/${eventId}/publish`);
      toast.success("Event dipublikasikan ke OKKAX Discover");
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-base font-semibold md:text-lg">Ticketing</h2>
        <div className="flex items-center gap-3">
          <StatusBadge status={event?.status === "published" ? "Confirmed" : "Draft"} testId="event-publish-status" />
          <button data-testid="publish-event-btn" onClick={publish} disabled={publishing} className="bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
            {event?.status === "published" ? "Publikasikan ulang" : "Publish event"}
          </button>
        </div>
      </div>

      <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
        <div className="grid gap-3 sm:grid-cols-5">
          <input data-testid="tier-name-input" placeholder="Nama tier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
          <select data-testid="tier-type-select" value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none">
            {["Free Registration", "Invitation", "Early Bird", "Presale", "Regular", "VIP", "VVIP", "Festival", "Seated", "Group", "Corporate Allocation", "Sponsor Allocation", "Community Allocation", "Waiting List"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input data-testid="tier-price-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
          <input data-testid="tier-qty-input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none" />
          <button data-testid="create-tier-btn" onClick={create} disabled={!form.name} className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Tambah tier</button>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--okx-border)] okx-scroll" data-testid="tiers-table">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr className="border-b border-[var(--okx-border)]">
              <th className="p-3">Tier</th><th className="p-3">Tipe</th><th className="p-3 text-right">Harga</th>
              <th className="p-3 text-right">Kuota</th><th className="p-3 text-right">Terjual</th>
              <th className="p-3 text-right">Revenue</th><th className="p-3">Aturan</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id} className="border-b border-[var(--okx-border)] last:border-0" data-testid={`tier-row-${t.id}`}>
                <td className="p-3 font-medium">{t.name}</td>
                <td className="p-3 text-zinc-400">{t.ticket_type}</td>
                <td className="num p-3 text-right">{idr(t.price)}</td>
                <td className="num p-3 text-right">{num(t.quantity)}</td>
                <td className="num p-3 text-right">{num(t.sold)}</td>
                <td className="num p-3 text-right">{idr(t.sold * t.price)}</td>
                <td className="p-3 text-xs text-zinc-500">{t.refund_rule} · {t.transfer_rule}</td>
              </tr>
            ))}
            {tiers.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-sm text-zinc-500">Belum ada ticket tier.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
