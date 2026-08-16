import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDot,
  Clock3, Crosshair, List, MapPin, Plus, Search, Ticket, Trash2, Users, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiError, idr, num } from "@/lib/api";
import OkxDropdown from "@/components/OkxDropdown";

// Helper: bangun options untuk OkxDropdown dengan placeholder "Semua X" sebagai
// item pertama yang memilih nilai kosong (mereset filter).
const buildFacetOptions = (label, values = []) => [
  { value: "", label },
  ...values.map((v) => ({ value: String(v), label: String(v) })),
];

const PUBLIC_STATUSES = {
  upcoming: ["Akan berlangsung", Clock3, "border-sky-400/50 bg-sky-400/10 text-sky-200"],
  ongoing: ["Sedang berlangsung", CircleDot, "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"],
  completed: ["Telah selesai", CheckCircle2, "border-zinc-600 bg-zinc-700/20 text-zinc-300"],
  rescheduled: ["Dijadwalkan ulang", CalendarDays, "border-amber-400/50 bg-amber-400/10 text-amber-200"],
  postponed: ["Ditunda", AlertTriangle, "border-orange-400/50 bg-orange-400/10 text-orange-200"],
  cancelled: ["Dibatalkan", XCircle, "border-red-400/50 bg-red-400/10 text-red-200"],
  tickets_on_sale: ["Tiket dijual", Ticket, "border-[var(--okx-accent)]/50 bg-[var(--okx-accent)]/10 text-[var(--okx-accent-soft)]"],
  tenant_open: ["Tenant dibuka", CircleDot, "border-violet-400/50 bg-violet-400/10 text-violet-200"],
  sponsor_open: ["Mencari sponsor", CircleDot, "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200"],
  workforce_open: ["Rekrut workforce", Users, "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"],
};

const INTERNAL_META = {
  Completed: [CheckCircle2, "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"],
  Confirmed: [CheckCircle2, "border-white/40 bg-white/10 text-white"],
  Pending: [Clock3, "border-amber-400/50 bg-amber-400/10 text-amber-200"],
  "At Risk": [AlertTriangle, "border-red-400/60 bg-red-400/10 text-red-200"],
  Missing: [XCircle, "border-red-400/60 bg-red-400/10 text-red-200"],
};

const pad = (value) => String(value).padStart(2, "0");
const isoDay = (value) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const startOfMonth = (value) => new Date(value.getFullYear(), value.getMonth(), 1);
const addMonths = (value, amount) => new Date(value.getFullYear(), value.getMonth() + amount, 1);
const addDays = (value, amount) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount);
const monthLabel = (value) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(value);
const dateLabel = (value, compact = false) => new Intl.DateTimeFormat("id-ID", compact
  ? { day: "numeric", month: "short" }
  : { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
const timeLabel = (value) => String(value || "").slice(11, 16);

function StatusPill({ item }) {
  const publicMeta = PUBLIC_STATUSES[item.status];
  const [label, Icon, style] = publicMeta || [item.status || "Pending", ...(INTERNAL_META[item.status] || [Clock3, "border-zinc-600 bg-zinc-700/20 text-zinc-300"])];
  return (
    <span title={`Status: ${label}`} className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-medium ${style}`}>
      <Icon size={10} aria-hidden="true" /> {label}
    </span>
  );
}

function EntryCard({ item, selected, onSelect, dense = false, href = "" }) {
  const Card = href ? Link : "button";
  return (
    <Card {...(href ? { to: href } : { type: "button", onClick: () => onSelect(item) })} data-testid={`calendar-entry-${item.id}`}
      className={`block w-full border text-left transition-colors ${selected ? "border-[var(--okx-accent)] bg-[var(--okx-accent)]/10" : "border-[var(--okx-border)] bg-[#101010] hover:border-zinc-600"} ${dense ? "p-2" : "p-3"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`min-w-0 font-medium text-zinc-100 ${dense ? "truncate text-[11px]" : "text-sm"}`}>{item.title}</span>
        {!dense && <StatusPill item={item} />}
      </div>
      <div className={`mt-1 flex flex-wrap items-center gap-x-2 text-zinc-500 ${dense ? "text-[10px]" : "text-xs"}`}>
        <span className="num">{timeLabel(item.start_at) || "Seharian"}</span>
        {item.city && <span>{item.city}</span>}
        {item.resource_name && <span className="truncate">{item.resource_name}</span>}
      </div>
    </Card>
  );
}

function MonthView({ cursor, items, selected, onSelect }) {
  const first = startOfMonth(cursor);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const grouped = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const key = String(item.start_at).slice(0, 10);
      (map[key] ||= []).push(item);
    });
    return map;
  }, [items]);
  return (
    <div className="overflow-x-auto okx-scroll" data-testid="calendar-month-view">
      <div className="min-w-[760px] border-l border-t border-[var(--okx-border)]">
        <div className="grid grid-cols-7 bg-[#0b0b0b]">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
            <div key={day} className="border-b border-r border-[var(--okx-border)] px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = isoDay(day);
            const rows = grouped[key] || [];
            const outside = day.getMonth() !== cursor.getMonth();
            const today = key === isoDay(new Date());
            return (
              <div key={key} className={`min-h-32 border-b border-r border-[var(--okx-border)] p-1.5 ${outside ? "bg-[#080808] text-zinc-700" : "bg-[#0d0d0d]"}`}>
                <div className={`num mb-1.5 flex h-6 w-6 items-center justify-center text-xs ${today ? "bg-[var(--okx-accent)] font-bold text-white" : "text-zinc-500"}`}>{day.getDate()}</div>
                <div className="space-y-1">
                  {rows.slice(0, 3).map((item) => <EntryCard key={item.id} item={item} dense selected={selected?.id === item.id} onSelect={onSelect} />)}
                  {rows.length > 3 && <div className="px-1 text-[10px] accent-text">+{rows.length - 3} aktivitas</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({ cursor, items, selected, onSelect }) {
  const start = addDays(cursor, -((cursor.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return (
    <div className="overflow-x-auto okx-scroll" data-testid="calendar-week-view">
      <div className="grid min-w-[760px] grid-cols-7 border-l border-t border-[var(--okx-border)]">
        {days.map((day) => {
          const key = isoDay(day);
          const rows = items.filter((item) => String(item.start_at).slice(0, 10) === key);
          return (
            <div key={key} className="min-h-[420px] border-b border-r border-[var(--okx-border)] bg-[#0d0d0d] p-2">
              <div className="mb-3 border-b border-[var(--okx-border)] pb-2">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">{new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(day)}</div>
                <div className="num text-lg font-semibold">{day.getDate()}</div>
              </div>
              <div className="space-y-1.5">{rows.map((item) => <EntryCard key={item.id} item={item} dense selected={selected?.id === item.id} onSelect={onSelect} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ items, selected, onSelect }) {
  const groups = useMemo(() => items.reduce((acc, item) => {
    const key = String(item.start_at).slice(0, 10);
    (acc[key] ||= []).push(item);
    return acc;
  }, {}), [items]);
  return (
    <div className="space-y-5" data-testid="calendar-list-view">
      {Object.entries(groups).map(([day, rows]) => (
        <section key={day}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{dateLabel(day)}</h3>
          <div className="grid gap-2 md:grid-cols-2">{rows.map((item) => <EntryCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={onSelect} />)}</div>
        </section>
      ))}
      {items.length === 0 && <div className="border border-dashed border-[var(--okx-border)] p-10 text-center text-sm text-zinc-500">Tidak ada aktivitas pada rentang dan filter ini.</div>}
    </div>
  );
}

function PublicFilters({ filters, setFilters, facets, onApply, busy, compact }) {
  if (compact) return null;
  const inputField = "w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[var(--okx-accent)]";
  const useLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolokasi tidak tersedia di browser ini");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setFilters((current) => ({ ...current, lat: String(coords.latitude), lng: String(coords.longitude), radius_km: current.radius_km || "50" }));
      toast.success("Lokasi digunakan untuk filter jarak");
    }, () => toast.error("Izin lokasi tidak diberikan"));
  };
  const label = (text) => <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">{text}</span>;
  const set = (key) => (value) => setFilters({ ...filters, [key]: value });
  const statusOptions = [
    { value: "", label: "Semua status" },
    ...(facets.statuses || []).map((item) => ({ value: item.value, label: item.label })),
  ];
  return (
    <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid="calendar-public-filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>{label("Dari tanggal")}<input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className={inputField} /></label>
        <label>{label("Sampai tanggal")}<input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className={inputField} /></label>
        <div>{label("Kota")}<OkxDropdown value={filters.city} onChange={set("city")} options={buildFacetOptions("Semua kota", facets.cities)} placeholder="Semua kota" testId="calendar-filter-city" /></div>
        <div>{label("Negara")}<OkxDropdown value={filters.country} onChange={set("country")} options={buildFacetOptions("Semua negara", facets.countries)} placeholder="Semua negara" testId="calendar-filter-country" /></div>
        <div>{label("Kategori")}<OkxDropdown value={filters.category} onChange={set("category")} options={buildFacetOptions("Semua kategori", facets.categories)} placeholder="Semua kategori" testId="calendar-filter-category" /></div>
        <div>{label("Artis")}<OkxDropdown value={filters.artist} onChange={set("artist")} options={buildFacetOptions("Semua artis", facets.artists)} placeholder="Semua artis" testId="calendar-filter-artist" /></div>
        <div>{label("Venue")}<OkxDropdown value={filters.venue} onChange={set("venue")} options={buildFacetOptions("Semua venue", facets.venues)} placeholder="Semua venue" testId="calendar-filter-venue" /></div>
        <div>{label("Organizer")}<OkxDropdown value={filters.organizer} onChange={set("organizer")} options={buildFacetOptions("Semua organizer", facets.organizers)} placeholder="Semua organizer" testId="calendar-filter-organizer" /></div>
        <label>{label("Harga minimum")}<input type="number" min="0" placeholder="Rp0" value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} className={inputField} /></label>
        <label>{label("Harga maksimum")}<input type="number" min="0" placeholder="Tanpa batas" value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} className={inputField} /></label>
        <label>{label("Kapasitas minimum")}<input type="number" min="0" value={filters.min_capacity} onChange={(e) => setFilters({ ...filters, min_capacity: e.target.value })} className={inputField} /></label>
        <label>{label("Usia penonton")}<input placeholder="17+, All ages…" value={filters.age} onChange={(e) => setFilters({ ...filters, age: e.target.value })} className={inputField} /></label>
        <div>{label("Penjualan tiket")}<OkxDropdown value={filters.sale_status} onChange={set("sale_status")} placeholder="Semua status" testId="calendar-filter-sale-status" options={[{ value: "", label: "Semua status" }, { value: "on_sale", label: "Sedang dijual" }, { value: "sold_out", label: "Habis" }, { value: "closed", label: "Ditutup" }]} /></div>
        <div>{label("Harga event")}<OkxDropdown value={filters.pricing} onChange={set("pricing")} placeholder="Gratis & berbayar" testId="calendar-filter-pricing" options={[{ value: "", label: "Gratis & berbayar" }, { value: "free", label: "Gratis" }, { value: "paid", label: "Berbayar" }]} /></div>
        <div>{label("Format")}<OkxDropdown value={filters.format} onChange={set("format")} options={buildFacetOptions("Offline, hybrid, virtual", facets.formats)} placeholder="Offline, hybrid, virtual" testId="calendar-filter-format" /></div>
        <div>{label("Status kalender")}<OkxDropdown value={filters.status} onChange={set("status")} options={statusOptions} placeholder="Semua status" testId="calendar-filter-status" /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40">{label("Jarak lokasi")}<OkxDropdown value={filters.radius_km} onChange={set("radius_km")} placeholder="Tanpa batas" testId="calendar-filter-radius" options={[{ value: "", label: "Tanpa batas" }, { value: "10", label: "10 km" }, { value: "25", label: "25 km" }, { value: "50", label: "50 km" }, { value: "100", label: "100 km" }, { value: "250", label: "250 km" }]} /></div>
        <button type="button" onClick={useLocation} className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500"><Crosshair size={14} /> Gunakan lokasi saya</button>
        <button type="button" disabled={busy} onClick={onApply} className="inline-flex items-center gap-2 bg-[var(--okx-accent)] px-4 py-2 text-xs font-semibold text-[#080808] disabled:opacity-50"><Search size={14} /> Terapkan filter</button>
      </div>
    </div>
  );
}

function DetailPanel({ item, onClose, internal, onFollowUp, onDelete, deleting }) {
  if (!item) return null;
  const removable = internal && item.source_type === "calendar_entry";
  return (
    <aside className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid="calendar-detail-panel">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Detail jadwal</div><h3 className="mt-1 text-base font-semibold">{item.title}</h3></div>
        <button onClick={onClose} aria-label="Tutup detail" className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <div className="mt-3"><StatusPill item={item} /></div>
      <dl className="mt-4 space-y-2 text-xs">
        {[
          ["Mulai", `${dateLabel(item.start_at)} · ${timeLabel(item.start_at)}`], ["Selesai", `${dateLabel(item.end_at)} · ${timeLabel(item.end_at)}`],
          ["Event ID", item.event_code || item.event_id], ["Lokasi", item.location], ["Penanggung jawab", item.owner || item.organizer],
          ["Resource", item.resource_name], ["Format", item.format], ["Kapasitas", item.capacity ? num(item.capacity) : null],
          ["Harga", item.max_price != null ? `${idr(item.min_price)} – ${idr(item.max_price)}` : null], ["Catatan", item.notes],
        ].filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-[var(--okx-border)] pb-2"><dt className="text-zinc-500">{label}</dt><dd className="break-words text-zinc-200">{value}</dd></div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.public_url && <Link to={item.public_url} className="bg-[var(--okx-accent)] px-3 py-2 text-xs font-semibold text-[#080808]">Buka event</Link>}
        {internal && item.resource_id && <button onClick={() => onFollowUp(item)} className="border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-[var(--okx-accent)]">Jadwalkan tindak lanjut</button>}
        {removable && (
          <button
            data-testid="calendar-delete-entry-btn"
            disabled={deleting}
            onClick={() => onDelete(item)}
            className="inline-flex items-center gap-1.5 border border-red-400/40 px-3 py-2 text-xs text-red-200 hover:bg-red-400/10 disabled:opacity-50">
            <Trash2 size={13} /> {deleting ? "Menghapus…" : "Hapus entri"}
          </button>
        )}
      </div>
    </aside>
  );
}

function CreateEntry({ seed, onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const day = String(seed?.end_at || new Date().toISOString()).slice(0, 10);
    return { event_id: seed?.event_id || "", title: seed ? `Tindak lanjut · ${seed.title}` : "",
      entry_type: "custom", resource_type: seed?.resource_type || "event", resource_id: seed?.resource_id || seed?.event_id || "",
      resource_name: seed?.resource_name || seed?.event_name || "", start_at: `${day}T09:00`, end_at: `${day}T10:00`,
      status: "Pending", visibility: "private", city: seed?.city || "", location: seed?.location || "", notes: "" };
  });
  const field = "mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2 text-sm outline-none focus:border-[var(--okx-accent)]";
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/calendar/entries", form);
      if (data.conflicts?.length) toast.warning(`Entri dibuat dengan ${data.conflicts.length} potensi konflik`);
      else toast.success("Aktivitas ditambahkan ke kalender");
      onCreated();
    } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" data-testid="calendar-create-modal">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-auto border border-[var(--okx-border)] bg-[#111] p-5 okx-scroll">
        <div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-widest accent-text">Scheduling Engine</div><h2 className="text-lg font-semibold">Tambah aktivitas</h2></div><button type="button" onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X size={18} /></button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-xs text-zinc-500">Judul</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} /></label>
          <label><span className="text-xs text-zinc-500">Mulai</span><input required type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className={field} /></label>
          <label><span className="text-xs text-zinc-500">Selesai</span><input required type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className={field} /></label>
          <div><span className="mb-1 block text-xs text-zinc-500">Jenis resource</span><OkxDropdown value={form.resource_type} onChange={(v) => setForm({ ...form, resource_type: v })} options={["event", "talent", "venue", "vendor", "worker", "sponsor", "tenant"].map((v) => ({ value: v, label: v }))} testId="calendar-create-resource-type" /></div>
          <div><span className="mb-1 block text-xs text-zinc-500">Status</span><OkxDropdown value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["Pending", "Confirmed", "Completed", "At Risk", "Missing"].map((v) => ({ value: v, label: v }))} testId="calendar-create-status" /></div>
          <label><span className="text-xs text-zinc-500">Resource ID</span><input required value={form.resource_id} onChange={(e) => setForm({ ...form, resource_id: e.target.value })} className={field} /></label>
          <label><span className="text-xs text-zinc-500">Nama resource</span><input value={form.resource_name} onChange={(e) => setForm({ ...form, resource_name: e.target.value })} className={field} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-zinc-500">Catatan</span><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="border border-[var(--okx-border)] px-4 py-2 text-sm">Batal</button><button disabled={busy} className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold text-[#080808] disabled:opacity-50">{busy ? "Memeriksa konflik…" : "Simpan & periksa konflik"}</button></div>
      </form>
    </div>
  );
}

export default function CalendarBoard({ mode = "public", compact = false, initialCity = "", eventId = "" }) {
  const internal = mode === "internal";
  const now = new Date();
  const [cursor, setCursor] = useState(startOfMonth(now));
  const [view, setView] = useState(compact ? "list" : "month");
  const [data, setData] = useState({ items: [], facets: {}, conflicts: [], available_types: [] });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [createSeed, setCreateSeed] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [filters, setFilters] = useState({
    date_from: isoDay(addDays(startOfMonth(now), -31)), date_to: isoDay(addMonths(startOfMonth(now), 7)),
    city: initialCity, country: "", category: "", artist: "", venue: "", organizer: "", min_price: "",
    max_price: "", min_capacity: "", age: "", sale_status: "", pricing: "", format: "", status: "",
    lat: "", lng: "", radius_km: "",
  });

  const load = useCallback(async (nextFilters = filters) => {
    setBusy(true); setError("");
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== ""));
      if (eventId) params.event_id = eventId;
      const { data: response } = await api.get(internal ? "/calendar/me" : "/calendar/public", { params });
      setData(response);
      setSelected((current) => response.items.find((item) => item.id === current?.id) || null);
    } catch (requestError) { setError(apiError(requestError)); } finally { setBusy(false); }
  }, [eventId, filters, internal]);

  const removeEntry = useCallback(async (item) => {
    if (!item?.id || item.source_type !== "calendar_entry") return;
    if (!window.confirm(`Hapus aktivitas "${item.title}" dari kalender?`)) return;
    setDeletingId(item.id);
    try {
      await api.delete(`/calendar/entries/${item.id}`);
      toast.success("Entri kalender dihapus");
      setSelected((current) => (current?.id === item.id ? null : current));
      await load(filters);
    } catch (requestError) { toast.error(apiError(requestError)); } finally { setDeletingId(""); }
  }, [filters, load]);

  // Initial scope changes must reload; filter edits are applied explicitly by the user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(filters); }, [internal, eventId]);
  useEffect(() => {
    if (initialCity !== filters.city) {
      const next = { ...filters, city: initialCity };
      setFilters(next); load(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCity]);

  const visible = useMemo(() => data.items.filter((item) => {
    if (view === "list" || compact) return true;
    const key = String(item.start_at).slice(0, 10);
    if (view === "week") {
      const start = addDays(cursor, -((cursor.getDay() + 6) % 7));
      const end = addDays(start, 7);
      return key >= isoDay(start) && key < isoDay(end);
    }
    return key.startsWith(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
  }), [compact, cursor, data.items, view]);

  if (compact) {
    const today = isoDay(new Date());
    const rows = data.items
      .filter((item) => ["event", "ticketing", "tenant", "sponsor", "workforce"].includes(item.entry_type)
        && String(item.end_at).slice(0, 10) >= today)
      .sort((left, right) => {
        const priority = (item) => item.status === "ongoing" ? 0 : item.entry_type === "event" ? 1 : 2;
        return priority(left) - priority(right) || String(left.start_at).localeCompare(String(right.start_at));
      })
      .slice(0, 16);
    return (
      <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid="map-calendar-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] accent-text"><CalendarDays size={14} /> Calendar & Scheduling Engine</div><h2 className="mt-2 text-lg font-semibold">Jadwal event {initialCity || "Indonesia"}</h2><p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">Tanggal event, penjualan tiket, pendaftaran tenant, sponsor, dan rekrutmen workforce dalam satu kalender.</p></div>
          <Link to={`/calendar${initialCity ? `?city=${encodeURIComponent(initialCity)}` : ""}`} className="border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-[var(--okx-accent)]">Buka kalender lengkap</Link>
        </div>
        {busy ? <div className="mt-5 text-xs text-zinc-500">Memuat jadwal…</div> : error ? <div className="mt-5 text-xs text-red-300">{error}</div> : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rows.map((item) => <EntryCard key={item.id} item={item} selected={false} href={item.public_url} />)}
            {rows.length === 0 && <div className="sm:col-span-2 border border-dashed border-[var(--okx-border)] p-6 text-center text-xs text-zinc-500">Belum ada jadwal pada rentang ini.</div>}
          </div>
        )}
      </section>
    );
  }

  // Header / calendar-type context / conflicts / view selector form
  // the persistent chrome for the internal (authenticated) calendar.
  // Only the calendar grid + status legend scroll.
  const chrome = (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] accent-text"><CalendarDays size={15} /> Calendar & Scheduling Engine</div><h1 className="editorial mt-3 text-3xl sm:text-4xl">{internal ? "Satu jadwal untuk seluruh ekosistem." : "Temukan event dan momentum pentingnya."}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{internal ? "Ketersediaan, hold, deadline, perjalanan, produksi, shift, dan konflik dibaca dari komponen yang terhubung ke akun Anda." : "Lihat event, masa penjualan tiket, pembukaan tenant, peluang sponsor, dan rekrutmen workforce dalam satu kalender publik."}</p></div>
        {internal && <button onClick={() => setCreateSeed(data.items[0] || {})} className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold text-[#080808]"><Plus size={15} /> Tambah aktivitas</button>}
      </div>

      {!internal && <PublicFilters filters={filters} setFilters={setFilters} facets={data.facets || {}} onApply={() => load(filters)} busy={busy} />}

      {internal && (
        <div className="mt-5 grid gap-3 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4 lg:grid-cols-[1fr_auto]" data-testid="calendar-module-nav">
          <div><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Kalender {data.calendar_type || "peran"}</div><div className="mt-2 flex flex-wrap gap-1.5">{data.available_types?.map((label) => <span key={label} className="border border-[var(--okx-border)] px-2 py-1 text-[10px] text-zinc-400">{label}</span>)}</div></div>
          <div className="flex items-start gap-5 text-xs"><div><div className="text-zinc-500">Aktivitas</div><div className="num mt-1 text-xl font-semibold">{num(data.total)}</div></div><div><div className="text-zinc-500">Konflik aktif</div><div className={`num mt-1 text-xl font-semibold ${data.conflicts?.length ? "text-red-300" : "text-emerald-300"}`}>{num(data.conflicts?.length)}</div></div></div>
        </div>
      )}

      {internal && data.conflicts?.length > 0 && (
        <section className="mt-4 border border-red-400/30 bg-red-400/5 p-4" data-testid="calendar-conflicts">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-200"><AlertTriangle size={16} /> Konflik yang perlu diselesaikan</div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">{data.conflicts.slice(0, 8).map((conflict) => <div key={conflict.id} className="border border-red-400/20 bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-red-100">{conflict.title}</span><span className="text-[9px] uppercase tracking-wider text-red-300">{conflict.severity}</span></div><p className="mt-1 text-xs leading-5 text-zinc-400">{conflict.reason}</p><p className="mt-2 text-xs text-zinc-200"><span className="text-zinc-500">Tindakan:</span> {conflict.action}</p></div>)}</div>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--okx-border)] py-3" data-testid="calendar-view-selector">
        <div className="flex items-center gap-1"><button onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : addDays(cursor, -7))} aria-label="Periode sebelumnya" className="border border-[var(--okx-border)] p-2 hover:border-zinc-500"><ChevronLeft size={16} /></button><button onClick={() => setCursor(startOfMonth(new Date()))} className="border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-zinc-500">Hari ini</button><button onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : addDays(cursor, 7))} aria-label="Periode berikutnya" className="border border-[var(--okx-border)] p-2 hover:border-zinc-500"><ChevronRight size={16} /></button><span className="ml-2 text-sm font-semibold capitalize">{monthLabel(cursor)}</span></div>
        <div className="flex gap-1">{[["month", "Bulan", CalendarDays], ["week", "Minggu", Clock3], ["list", "Daftar", List]].map(([key, label, Icon]) => <button key={key} onClick={() => setView(key)} data-testid={`calendar-view-${key}`} className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs ${view === key ? "border-[var(--okx-accent)] bg-[var(--okx-accent)]/10 accent-text" : "border-[var(--okx-border)] text-zinc-400"}`}><Icon size={13} /> {label}</button>)}</div>
      </div>
    </>
  );

  const body = (
    <>
      {busy ? <div className="border border-[var(--okx-border)] p-12 text-center text-sm text-zinc-500">Menyusun kalender dan memeriksa konflik…</div> : error ? <div className="border border-red-400/30 p-6 text-sm text-red-300">{error}</div> : (
        <div className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`} data-testid="calendar-body">
          <div className="min-w-0">{view === "month" ? <MonthView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} /> : view === "week" ? <WeekView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} /> : <ListView items={visible} selected={selected} onSelect={setSelected} />}</div>
          <DetailPanel item={selected} onClose={() => setSelected(null)} internal={internal} onFollowUp={setCreateSeed} onDelete={removeEntry} deleting={deletingId === selected?.id} />
        </div>
      )}

      <div role="group" className="mt-5 flex flex-wrap gap-2 border-t border-[var(--okx-border)] pt-4" aria-label="Legenda status">
        {Object.entries(PUBLIC_STATUSES).map(([status, [label, Icon, style]]) => <span key={status} title={`Status kalender: ${label}`} className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] ${style}`}><Icon size={11} /> {label}</span>)}
      </div>
    </>
  );

  if (internal) {
    return (
      <div className="okx-workspace-page" data-testid="internal-calendar-engine">
        <div className="okx-workspace-chrome" data-testid="calendar-chrome">{chrome}</div>
        <div className="okx-workspace-content">{body}</div>
        {createSeed !== null && <CreateEntry seed={createSeed} onClose={() => setCreateSeed(null)} onCreated={() => { setCreateSeed(null); load(filters); }} />}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="public-calendar-engine">
      {chrome}
      {body}
      {createSeed !== null && <CreateEntry seed={createSeed} onClose={() => setCreateSeed(null)} onCreated={() => { setCreateSeed(null); load(filters); }} />}
    </div>
  );
}
