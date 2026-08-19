import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Ticket,
  Plus,
  QrCode,
  ScanLine,
  TrendingUp,
  Users,
  DollarSign,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { api, apiError, idr, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";
import OkxDropdown from "@/components/OkxDropdown";
import { useAuth } from "@/context/AuthContext";

const TICKET_TYPES = [
  "Regular",
  "VIP",
  "VVIP",
  "Early Bird",
  "Presale",
  "OTS (On The Spot)",
  "Group Package",
  "Complimentary",
];

export default function OrganizerTicketingPage() {
  const { workspaceVersion } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(DEMO_EVENT_ID);
  const [event, setEvent] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Tier form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ticket_type: "Regular",
    price: 150000,
    quantity: 500,
  });

  // Edit Tier state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", ticket_type: "Regular", price: 0, quantity: 0 });

  // Load events
  useEffect(() => {
    api.get("/events")
      .then(({ data }) => {
        const items = data.items || [];
        setEvents(items);
        if (items.length > 0 && !items.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(items[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceVersion]);

  // Load event-specific ticketing data
  const loadTicketingData = async () => {
    if (!selectedEventId) return;
    setRefreshing(true);
    try {
      const [evRes, tierRes, ordRes] = await Promise.allSettled([
        api.get(`/events/${selectedEventId}/brief`),
        api.get(`/events/${selectedEventId}/ticket-tiers`),
        api.get("/my/orders"),
      ]);

      if (evRes.status === "fulfilled") {
        setEvent(evRes.value.data?.event || null);
      }
      if (tierRes.status === "fulfilled") {
        setTiers(tierRes.value.data?.items || []);
      }
      if (ordRes.status === "fulfilled") {
        setOrders(ordRes.value.data?.items || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTicketingData();
    // eslint-disable-next-line
  }, [selectedEventId]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const totalCapacity = tiers.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0) || event?.capacity || 5000;
    const totalSold = tiers.reduce((sum, t) => sum + (Number(t.sold) || 0), 0);
    const totalGMV = tiers.reduce((sum, t) => sum + ((Number(t.sold) || 0) * (Number(t.price) || 0)), 0);
    const available = Math.max(0, totalCapacity - totalSold);
    const conversion = totalCapacity > 0 ? ((totalSold / totalCapacity) * 100).toFixed(1) : 0;

    return { totalCapacity, totalSold, totalGMV, available, conversion };
  }, [tiers, event]);

  const handleCreateTier = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Nama tier tiket wajib diisi");
    try {
      await api.post(`/events/${selectedEventId}/ticket-tiers`, form);
      toast.success(`Ticket tier ${form.name} berhasil dibuat`);
      setForm({ name: "", ticket_type: "Regular", price: 150000, quantity: 500 });
      setShowCreate(false);
      loadTicketingData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleStartEdit = (tier) => {
    setEditingId(tier.id);
    setEditForm({
      name: tier.name,
      ticket_type: tier.ticket_type || "Regular",
      price: tier.price,
      quantity: tier.quantity,
    });
  };

  const handleSaveEdit = async (tierId) => {
    if (!editForm.name.trim()) return toast.error("Nama tier wajib diisi");
    try {
      await api.patch(`/events/${selectedEventId}/ticket-tiers/${tierId}`, {
        name: editForm.name,
        ticket_type: editForm.ticket_type,
        price: Number(editForm.price),
        quantity: Number(editForm.quantity),
      });
      toast.success("Tier tiket berhasil diperbarui");
      setEditingId(null);
      loadTicketingData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const eventOptions = useMemo(() => {
    if (events.length === 0) {
      return [{ value: DEMO_EVENT_ID, label: "Aruna Bold Live Makassar (EVT-MKS-2026-0001)" }];
    }
    return events.map((e) => ({
      value: e.id,
      label: `${e.name} (${e.event_code || e.id})`,
    }));
  }, [events]);

  return (
    <div className="okx-workspace-page space-y-4 font-gemini" data-testid="organizer-ticketing-page">
      {/* Header Chrome */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
              <Ticket size={11} className="text-zinc-400" />
              Ticketing & Inventory Engine
            </div>
            <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">
              Ticketing Management
            </h1>
            <p className="mt-1 text-xs text-zinc-400 max-w-2xl leading-relaxed">
              Kelola kelas tiket, kuota kapasitas, monitoring penjualan real-time, order transaksi, dan kontrol gate access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadTicketingData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-all cursor-pointer"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              to="/app/validator"
              data-testid="ticketing-validator-link"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-white/30 hover:bg-white/[0.06] transition-all"
            >
              <ScanLine size={13} /> Gate Scanner
            </Link>

            <button
              data-testid="create-tier-toggle-btn"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              <Plus size={14} /> Tambah Tier
            </button>
          </div>
        </div>

        {/* Event Selector Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-gemini-mono">
            Event Aktif:
          </span>
          <div className="min-w-[280px]">
            <OkxDropdown
              items={eventOptions}
              value={selectedEventId}
              onChange={(val) => setSelectedEventId(val)}
              className="w-full text-xs"
            />
          </div>
          {event && (
            <div className="num text-[11px] text-zinc-400 font-gemini-mono">
              {event.city} · {event.start_date} · Status: <span className="text-white font-bold">{event.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-testid="ticketing-kpis">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
            <span>Tiket Terjual</span>
            <Users size={13} className="text-zinc-400" />
          </div>
          <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
            {num(metrics.totalSold)} <span className="text-xs font-normal text-zinc-500">/ {num(metrics.totalCapacity)}</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
            Tingkat Konversi: <span className="text-emerald-400 font-bold">{metrics.conversion}%</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
            <span>Gross Ticket GMV</span>
            <DollarSign size={13} className="text-zinc-400" />
          </div>
          <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
            {compact(metrics.totalGMV)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
            Rata-rata: {idr(metrics.totalSold > 0 ? metrics.totalGMV / metrics.totalSold : 0)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
            <span>Sisa Kuota Tersedia</span>
            <Ticket size={13} className="text-zinc-400" />
          </div>
          <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
            {num(metrics.available)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
            {tiers.length} kelas tiket aktif
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-gemini-mono">
            <span>Transaksi Masuk</span>
            <TrendingUp size={13} className="text-zinc-400" />
          </div>
          <div className="num mt-1 text-xl sm:text-2xl font-bold text-white font-gemini-mono">
            {orders.length} orders
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">
            Live Settlement Enabled
          </div>
        </div>
      </div>

      {/* Create New Tier Modal / Form */}
      {showCreate && (
        <form
          onSubmit={handleCreateTier}
          className="rounded-2xl border border-white/20 bg-[#0c0c14] backdrop-blur-xl p-4 sm:p-5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
          data-testid="create-tier-form"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <h3 className="text-sm sm:text-base font-bold text-white">Buat Kelas Tiket Baru</h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3.5 grid gap-3 sm:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="text-[11px] text-zinc-400 font-gemini-mono">Nama Tier</span>
              <input
                data-testid="new-tier-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="mis. Presale 1 Festival"
                className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-white/40"
              />
            </label>

            <label>
              <span className="text-[11px] text-zinc-400 font-gemini-mono">Tipe Tier</span>
              <PremiumSelect
                data-testid="new-tier-type"
                value={form.ticket_type}
                onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}
                className="mt-1 w-full"
              >
                {TICKET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </PremiumSelect>
            </label>

            <label>
              <span className="text-[11px] text-zinc-400 font-gemini-mono">Harga (IDR)</span>
              <input
                data-testid="new-tier-price"
                type="number"
                min="0"
                step="10000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs text-white font-gemini-mono outline-none focus:border-white/40"
              />
            </label>

            <label>
              <span className="text-[11px] text-zinc-400 font-gemini-mono">Kuota Tiket</span>
              <input
                data-testid="new-tier-quantity"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs text-white font-gemini-mono outline-none focus:border-white/40"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-white/[0.1] px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="submit-create-tier-btn"
              className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black shadow-sm hover:bg-zinc-200"
            >
              Simpan Tier
            </button>
          </div>
        </form>
      )}

      {/* Ticket Tiers Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
            Struktur Kelas Tiket & Kapasitas
          </h2>
          <span className="num text-[11px] text-zinc-400 font-gemini-mono">
            {tiers.length} tier aktif
          </span>
        </div>

        <div className="overflow-x-auto okx-scroll">
          <table className="w-full min-w-[700px] text-xs">
            <thead className="text-left text-[11px] uppercase tracking-wider text-zinc-400 font-gemini-mono bg-white/[0.02]">
              <tr className="border-b border-white/[0.08]">
                <th className="p-3">Nama Tier</th>
                <th className="p-3">Tipe</th>
                <th className="p-3 text-right">Harga</th>
                <th className="p-3 text-right">Kuota</th>
                <th className="p-3 text-right">Terjual</th>
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {tiers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500 font-gemini">
                    Belum ada kelas tiket untuk event ini. Klik "Tambah Tier" untuk membuat.
                  </td>
                </tr>
              ) : (
                tiers.map((t) => {
                  const isEditing = editingId === t.id;
                  const sold = Number(t.sold) || 0;
                  const price = Number(t.price) || 0;
                  const rev = sold * price;
                  return (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors" data-testid={`tier-row-${t.id}`}>
                      <td className="p-3 font-semibold text-white">
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="rounded-lg border border-white/30 bg-[#09090e] px-2 py-1 text-xs text-white"
                          />
                        ) : (
                          t.name
                        )}
                      </td>
                      <td className="p-3 text-zinc-400">
                        {isEditing ? (
                          <PremiumSelect
                            value={editForm.ticket_type}
                            onChange={(e) => setEditForm({ ...editForm, ticket_type: e.target.value })}
                            className="text-xs py-1"
                          >
                            {TICKET_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </PremiumSelect>
                        ) : (
                          t.ticket_type || "Regular"
                        )}
                      </td>
                      <td className="p-3 text-right num font-bold text-white font-gemini-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.price}
                            onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                            className="w-24 text-right rounded-lg border border-white/30 bg-[#09090e] px-2 py-1 text-xs text-white font-gemini-mono"
                          />
                        ) : (
                          idr(t.price)
                        )}
                      </td>
                      <td className="p-3 text-right num text-zinc-300 font-gemini-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                            className="w-20 text-right rounded-lg border border-white/30 bg-[#09090e] px-2 py-1 text-xs text-white font-gemini-mono"
                          />
                        ) : (
                          num(t.quantity)
                        )}
                      </td>
                      <td className="p-3 text-right num font-semibold text-white font-gemini-mono">
                        {num(sold)}
                      </td>
                      <td className="p-3 text-right num font-bold text-emerald-400 font-gemini-mono">
                        {idr(rev)}
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge status={sold >= t.quantity ? "Cancelled" : "Confirmed"} />
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSaveEdit(t.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              title="Simpan"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Batal"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(t)}
                            className="p-1 text-zinc-400 hover:text-white transition-colors"
                            title="Edit Tier"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
