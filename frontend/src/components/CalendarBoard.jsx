import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDot,
  Clock3, Crosshair, LayoutGrid, List, MapPin, Plus, Search, Sun, Ticket, Trash2,
  Users, X, XCircle,
} from "lucide-react";
import { api, apiError, idr, num } from "@/lib/api";
import OkxDropdown from "@/components/OkxDropdown";
import { SpotlightCard } from "@/components/MotionPrimitives";

// Chip label -> entry_type value emitted by backend calendar_engine.
// Chips act as scoped filters. Empty entry_type list means "all".
const ORGANIZER_CATEGORY_MAP = {
  "Persiapan": "preparation",
  "Venue deadline": "venue_deadline",
  "Talent hold": "talent_hold",
  "Kontrak": "contract",
  "DP & pelunasan": "payment",
  "Perizinan": "permit",
  "Penjualan tiket": "ticketing",
  "Periode sponsor": "sponsor",
  "Pendaftaran tenant": "tenant",
  "Rekrutmen pekerja": "workforce",
  "Produksi materi": "production",
  "Perjalanan talent": "travel",
  "Loading": "loading",
  "Soundcheck": "soundcheck",
  "Rehearsal": "rehearsal",
  "Showtime": "showtime",
  "Dismantling": "dismantling",
  "Settlement": "settlement",
  "Laporan pasca-event": "post_event_report",
};

// Fallback chip -> entry_type mapping for non-organizer role calendars.
// Labels arrive from ROLE_CALENDARS on the backend; we translate to
// entry_type via a lowercase-key lookup.
const ROLE_CATEGORY_MAP = {
  ...ORGANIZER_CATEGORY_MAP,
  // talent
  "confirmed": "booking", "travel day": "travel", "rehearsal": "rehearsal",
  "performance": "performance", "rest day": "rest",
  // venue
  "site visit": "site_visit", "tentative hold": "tentative_hold",
  "confirmed booking": "booking", "loading": "loading", "setup": "setup",
  "event": "event", "dismantling": "dismantling",
  // vendor
  "jadwal kru": "crew", "mobilisasi": "mobilization",
  "instalasi": "installation", "testing": "testing", "show": "show",
  "pembongkaran": "dismantling", "pengembalian inventaris": "inventory_return",
  // freelancer
  "undangan kerja": "work_invitation", "shift": "shift",
  "check-in": "check_in", "check-out": "check_out",
  // partner
  "batas pengajuan": "proposal_deadline", "negosiasi": "negotiation",
  "pembayaran": "payment", "produksi materi": "material_production",
  "instalasi booth": "booth_installation",
};

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "Semua resource" },
  { value: "event", label: "Event" },
  { value: "venue", label: "Venue" },
  { value: "talent", label: "Talent" },
  { value: "vendor", label: "Vendor" },
  { value: "worker", label: "Worker" },
  { value: "sponsor", label: "Sponsor" },
  { value: "tenant", label: "Tenant" },
];

function chipToEntryType(chipLabel) {
  const direct = ORGANIZER_CATEGORY_MAP[chipLabel] || ROLE_CATEGORY_MAP[chipLabel];
  if (direct) return direct;
  return ROLE_CATEGORY_MAP[chipLabel.toLowerCase()] || "";
}

// Helper: bangun options untuk OkxDropdown dengan placeholder "Semua X" sebagai
// item pertama yang memilih nilai kosong (mereset filter).
const buildFacetOptions = (label, values = []) => [
  { value: "", label },
  ...values.map((v) => ({ value: String(v), label: String(v) })),
];

const PUBLIC_STATUSES = {
  upcoming: ["Akan berlangsung", Clock3, "border-sky-400/50 bg-sky-950/40 text-sky-300"],
  ongoing: ["Sedang berlangsung", CircleDot, "border-emerald-400/50 bg-emerald-950/40 text-emerald-300"],
  completed: ["Telah selesai", CheckCircle2, "border-zinc-700 bg-zinc-800/40 text-zinc-400"],
  rescheduled: ["Dijadwalkan ulang", CalendarDays, "border-amber-400/50 bg-amber-950/40 text-amber-300"],
  postponed: ["Ditunda", AlertTriangle, "border-orange-400/50 bg-orange-950/40 text-orange-300"],
  cancelled: ["Dibatalkan", XCircle, "border-rose-400/50 bg-rose-950/40 text-rose-300"],
  tickets_on_sale: ["Tiket dijual", Ticket, "border-amber-400/50 bg-amber-950/40 text-amber-300"],
  tenant_open: ["Tenant dibuka", CircleDot, "border-violet-400/50 bg-violet-950/40 text-violet-300"],
  sponsor_open: ["Mencari sponsor", CircleDot, "border-zinc-400/50 bg-zinc-800/40 text-zinc-300"],
  workforce_open: ["Rekrut workforce", Users, "border-cyan-400/50 bg-cyan-950/40 text-cyan-300"],
};

const INTERNAL_META = {
  Completed: [CheckCircle2, "border-emerald-400/50 bg-emerald-950/40 text-emerald-300"],
  Confirmed: [CheckCircle2, "border-white/40 bg-white/10 text-white"],
  Pending: [Clock3, "border-amber-400/50 bg-amber-950/40 text-amber-300"],
  "At Risk": [AlertTriangle, "border-rose-400/60 bg-rose-950/40 text-rose-300"],
  Missing: [XCircle, "border-rose-400/60 bg-rose-950/40 text-rose-300"],
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
  const [label, Icon, style] = publicMeta || [item.status || "Pending", ...(INTERNAL_META[item.status] || [Clock3, "border-zinc-700 bg-zinc-800/40 text-zinc-400"])];
  return (
    <span title={`Status: ${label}`} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider font-gemini-mono ${style}`}>
      <Icon size={9} aria-hidden="true" /> {label}
    </span>
  );
}

function EntryCard({ item, selected, onSelect, dense = false, href = "" }) {
  const Card = href ? Link : "button";
  return (
    <Card {...(href ? { to: href } : { type: "button", onClick: () => onSelect(item) })} data-testid={`calendar-entry-${item.id}`}
      className={`block w-full rounded-xl border text-left transition-all duration-200 cursor-pointer ${
        selected
          ? "border-white/40 bg-white/[0.12] shadow-sm"
          : "border-white/[0.08] bg-[#12121c]/90 hover:border-white/25 hover:bg-white/[0.06] hover:shadow-md"
      } ${dense ? "p-2" : "p-3"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`min-w-0 font-bold text-white ${dense ? "truncate text-[11px]" : "text-xs sm:text-[13px]"}`}>{item.title}</span>
        {!dense && <StatusPill item={item} />}
      </div>
      <div className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-zinc-400 font-gemini ${dense ? "text-[10px]" : "text-[11px]"}`}>
        <span className="font-mono text-zinc-300 font-semibold">{timeLabel(item.start_at) || "Seharian"}</span>
        {item.city && <span>· {item.city}</span>}
        {item.resource_name && <span className="truncate text-zinc-500">· {item.resource_name}</span>}
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

function DayView({ cursor, items, selected, onSelect }) {
  const key = isoDay(cursor);
  const rows = items
    .filter((item) => String(item.start_at).slice(0, 10) === key)
    .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const grouped = useMemo(() => {
    const map = {};
    for (const item of rows) {
      const hour = Number(String(item.start_at).slice(11, 13) || 0);
      (map[hour] ||= []).push(item);
    }
    return map;
  }, [rows]);
  return (
    <div className="border-t border-[var(--okx-border)]" data-testid="calendar-day-view">
      <div className="border-b border-[var(--okx-border)] bg-[#0b0b0b] px-3 py-2 text-xs uppercase tracking-widest text-zinc-500">
        {dateLabel(key)}
      </div>
      {rows.length === 0 && (
        <div className="border-b border-dashed border-[var(--okx-border)] p-10 text-center text-sm text-zinc-500">
          Tidak ada aktivitas pada hari ini dengan filter aktif.
        </div>
      )}
      {rows.length > 0 && (
        <div className="grid grid-cols-[70px_1fr]">
          {hours.map((h) => {
            const bucket = grouped[h] || [];
            return (
              <div key={h} className="contents">
                <div className="num border-b border-r border-[var(--okx-border)] bg-[#0b0b0b] px-2 py-2 text-right text-[10px] text-zinc-500">
                  {pad(h)}:00
                </div>
                <div className="min-h-[48px] border-b border-[var(--okx-border)] p-1.5">
                  {bucket.length === 0 ? (
                    <div className="h-full" />
                  ) : (
                    <div className="grid gap-1.5 md:grid-cols-2">
                      {bucket.map((item) => (
                        <EntryCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={onSelect} dense />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  // Internal-only operational filters. Category chips + event/resource/status
  // narrow the visible entries; date_from/date_to and city stay on the shared
  // filters object above (public API contract).
  const [activeCategories, setActiveCategories] = useState(() => new Set());
  const [eventFilter, setEventFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [conflictOpen, setConflictOpen] = useState(false);

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

  // Client-side filter step: category chips + event + resource_type + status
  // applied before the view window. Backend already scoped by auth, so this
  // is pure UI narrowing over the returned dataset.
  const activeEntryTypes = useMemo(() => {
    const out = new Set();
    for (const label of activeCategories) {
      const key = chipToEntryType(label);
      if (key) out.add(key);
    }
    return out;
  }, [activeCategories]);

  const filtered = useMemo(() => data.items.filter((item) => {
    if (activeEntryTypes.size > 0 && !activeEntryTypes.has(item.entry_type)) return false;
    if (eventFilter && item.event_id !== eventFilter) return false;
    if (resourceFilter && item.resource_type !== resourceFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    return true;
  }), [data.items, activeEntryTypes, eventFilter, resourceFilter, statusFilter]);

  const visible = useMemo(() => filtered.filter((item) => {
    if (view === "list" || view === "agenda" || compact) return true;
    const key = String(item.start_at).slice(0, 10);
    if (view === "day") return key === isoDay(cursor);
    if (view === "week") {
      const start = addDays(cursor, -((cursor.getDay() + 6) % 7));
      const end = addDays(start, 7);
      return key >= isoDay(start) && key < isoDay(end);
    }
    return key.startsWith(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
  }), [compact, cursor, filtered, view]);

  // Facet options built from the AUTHORISED result set so dropdowns never
  // suggest an event/resource/status the caller cannot see.
  const eventFacetOptions = useMemo(() => {
    const map = new Map();
    for (const it of data.items) {
      if (it.event_id && !map.has(it.event_id)) {
        map.set(it.event_id, it.event_name || it.event_code || it.event_id);
      }
    }
    return [{ value: "", label: "Semua event" },
            ...[...map.entries()].map(([v, l]) => ({ value: v, label: l }))];
  }, [data.items]);

  const statusFacetOptions = useMemo(() => {
    const set = new Set();
    for (const it of data.items) if (it.status) set.add(it.status);
    return [{ value: "", label: "Semua status" },
            ...[...set].sort().map((s) => ({ value: s, label: s }))];
  }, [data.items]);

  const toggleCategory = (label) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const resetOperational = () => {
    setActiveCategories(new Set());
    setEventFilter("");
    setResourceFilter("");
    setStatusFilter("");
  };

  const conflictCount = data.conflicts?.length || 0;
  const conflictHigh = data.conflict_summary?.high || 0;
  const conflictMedium = data.conflict_summary?.medium || 0;
  const conflictLow = data.conflict_summary?.low || 0;
  const topConflicts = (data.conflicts || [])
    .slice()
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
    })
    .slice(0, 2);

  if (compact) {
    const today = isoDay(new Date());
    const rows = data.items
      .filter((item) => ["event", "ticketing", "tenant", "sponsor", "workforce"].includes(item.entry_type)
        && String(item.end_at).slice(0, 10) >= today)
      .sort((left, right) => {
        const priority = (item) => item.status === "ongoing" ? 0 : item.entry_type === "event" ? 1 : 2;
        return priority(left) - priority(right) || String(left.start_at).localeCompare(String(right.start_at));
      })
      .slice(0, 6);
    return (
      <SpotlightCard className="p-5" data-testid="map-calendar-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono">
              <CalendarDays size={12} className="text-zinc-400" />
              Calendar Engine
            </div>
            <h2 className="mt-2 text-base font-bold text-white">Jadwal Event {initialCity || "Indonesia"}</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-400 font-gemini">
              Tanggal event, penjualan tiket, pendaftaran tenant, sponsor, dan rekrutmen workforce.
            </p>
          </div>
          <Link
            to={`/calendar${initialCity ? `?city=${encodeURIComponent(initialCity)}` : ""}`}
            className="rounded-xl border border-white/[0.14] bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/30 hover:bg-white/[0.08] hover:text-white transition-all shadow-sm"
          >
            Buka kalender lengkap
          </Link>
        </div>
        {busy ? (
          <div className="mt-4 text-xs text-zinc-500">Memuat jadwal…</div>
        ) : error ? (
          <div className="mt-4 text-xs text-rose-300">{error}</div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rows.map((item) => (
              <EntryCard key={item.id} item={item} selected={false} href={item.public_url} />
            ))}
            {rows.length === 0 && (
              <div className="sm:col-span-2 rounded-xl border border-dashed border-white/[0.1] p-6 text-center text-xs text-zinc-500">
                Belum ada jadwal pada rentang ini.
              </div>
            )}
          </div>
        )}
      </SpotlightCard>
    );
  }

  // Header / operational filters / conflict summary / view selector form
  // the persistent chrome for the internal (authenticated) calendar.
  // Only the calendar grid + status legend scroll.
  const operationalFiltersActive =
    activeCategories.size > 0 || !!eventFilter || !!resourceFilter || !!statusFilter;

  const chrome = (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] accent-text"><CalendarDays size={15} /> Calendar & Scheduling Engine</div><h1 className="editorial mt-3 text-2xl sm:text-3xl">{internal ? "Satu jadwal untuk seluruh ekosistem." : "Temukan event dan momentum pentingnya."}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{internal ? "Kalender operasional lintas event, resource, dan pembayaran. Chip di bawah memfilter jadwal secara langsung." : "Lihat event, masa penjualan tiket, pembukaan tenant, peluang sponsor, dan rekrutmen workforce dalam satu kalender publik."}</p></div>
        {internal && <button data-testid="calendar-add-btn" onClick={() => setCreateSeed(data.items[0] || {})} className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={15} /> Tambah aktivitas</button>}
      </div>

      {!internal && <PublicFilters filters={filters} setFilters={setFilters} facets={data.facets || {}} onApply={() => load(filters)} busy={busy} />}

      {internal && (
        <div
          className="mt-4 grid gap-3 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
          data-testid="calendar-filter-row"
        >
          <div className="min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Event</div>
            <OkxDropdown
              value={eventFilter}
              onChange={setEventFilter}
              options={eventFacetOptions}
              searchable={eventFacetOptions.length >= 8}
              testId="calendar-filter-event"
              ariaLabel="Filter event"
            />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Resource</div>
            <OkxDropdown
              value={resourceFilter}
              onChange={setResourceFilter}
              options={RESOURCE_TYPE_OPTIONS}
              testId="calendar-filter-resource"
              ariaLabel="Filter resource"
            />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Status</div>
            <OkxDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFacetOptions}
              testId="calendar-filter-status"
              ariaLabel="Filter status"
            />
          </div>
        </div>
      )}

      {internal && (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-3"
          data-testid="calendar-category-chips"
        >
          <div className="mr-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Kalender {data.calendar_type || "peran"}
          </div>
          {(data.available_types || []).map((label) => {
            const active = activeCategories.has(label);
            const key = chipToEntryType(label);
            const known = !!key;
            return (
              <button
                key={label}
                type="button"
                disabled={!known}
                onClick={() => toggleCategory(label)}
                data-testid={`calendar-chip-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] transition-colors ${
                  active
                    ? "border-[var(--okx-accent)] bg-[var(--okx-accent)]/15 text-[var(--okx-accent-soft)]"
                    : known
                      ? "border-[var(--okx-border)] text-zinc-300 hover:border-zinc-500 hover:text-white"
                      : "border-[var(--okx-border)] text-zinc-600 opacity-60 cursor-not-allowed"
                }`}
              >
                {label}
              </button>
            );
          })}
          {operationalFiltersActive && (
            <button
              type="button"
              onClick={resetOperational}
              className="ml-auto inline-flex items-center gap-1 border border-[var(--okx-border)] px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-white"
              data-testid="calendar-reset"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {internal && (
        <div
          className="mt-3 flex flex-wrap items-center gap-3 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-3 text-xs"
          data-testid="calendar-metrics"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Aktivitas</span>
            <span className="num text-sm font-semibold text-white">{num(filtered.length)}</span>
            <span className="text-zinc-600">/ {num(data.total)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Konflik</span>
            <span
              className={`num text-sm font-semibold ${conflictCount ? "text-red-300" : "text-emerald-300"}`}
              data-testid="calendar-conflict-count"
            >
              {num(conflictCount)}
            </span>
            {conflictHigh > 0 && (
              <span className="border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-200">
                High {conflictHigh}
              </span>
            )}
            {conflictMedium > 0 && (
              <span className="border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                Medium {conflictMedium}
              </span>
            )}
            {conflictLow > 0 && (
              <span className="border border-zinc-500/40 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
                Low {conflictLow}
              </span>
            )}
          </div>
          {conflictCount > 0 && (
            <button
              type="button"
              onClick={() => setConflictOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 border border-red-400/40 bg-red-400/10 px-2.5 py-1 text-[11px] text-red-100 hover:border-red-300"
              data-testid="calendar-conflicts-view-all"
            >
              <AlertTriangle size={12} /> View all conflicts
            </button>
          )}
        </div>
      )}

      {internal && topConflicts.length > 0 && (
        <div
          className="mt-3 grid gap-2 lg:grid-cols-2"
          data-testid="calendar-conflicts-top"
        >
          {topConflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="flex items-start justify-between gap-2 border border-red-400/25 bg-red-400/5 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-red-100 truncate">{conflict.title}</span>
                  <span className="text-[9px] uppercase tracking-wider text-red-300">{conflict.severity}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{conflict.reason}</p>
              </div>
              {conflict.event_id && (
                <Link
                  to={`/app/events/${conflict.event_id}/blueprint`}
                  className="shrink-0 border border-[var(--okx-border)] px-2 py-1 text-[10px] text-zinc-300 hover:border-[var(--okx-accent)]"
                >
                  Open event
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--okx-border)] py-2"
        data-testid="calendar-view-selector"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(
              view === "month" ? addMonths(cursor, -1)
                : view === "week" ? addDays(cursor, -7)
                : view === "day" ? addDays(cursor, -1)
                : addDays(cursor, -7),
            )}
            aria-label="Periode sebelumnya"
            className="border border-[var(--okx-border)] p-2 hover:border-zinc-500"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(view === "day" ? new Date() : startOfMonth(new Date()))}
            className="border border-[var(--okx-border)] px-3 py-2 text-xs hover:border-zinc-500"
            data-testid="calendar-today-btn"
          >
            Hari ini
          </button>
          <button
            onClick={() => setCursor(
              view === "month" ? addMonths(cursor, 1)
                : view === "week" ? addDays(cursor, 7)
                : view === "day" ? addDays(cursor, 1)
                : addDays(cursor, 7),
            )}
            aria-label="Periode berikutnya"
            className="border border-[var(--okx-border)] p-2 hover:border-zinc-500"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-semibold capitalize">
            {view === "day" ? dateLabel(isoDay(cursor)) : monthLabel(cursor)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            ["month", "Bulan", CalendarDays],
            ["week", "Minggu", LayoutGrid],
            ["day", "Hari", Sun],
            ["agenda", "Agenda", List],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              data-testid={`calendar-view-${key}`}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs ${
                view === key
                  ? "border-[var(--okx-accent)] bg-[var(--okx-accent)]/10 accent-text"
                  : "border-[var(--okx-border)] text-zinc-400"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const body = (
    <>
      {busy ? <div className="border border-[var(--okx-border)] p-12 text-center text-sm text-zinc-500">Menyusun kalender dan memeriksa konflik…</div> : error ? <div className="border border-red-400/30 p-6 text-sm text-red-300">{error}</div> : (
        <div className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`} data-testid="calendar-body">
          <div className="min-w-0">
            {view === "month" ? <MonthView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} />
              : view === "week" ? <WeekView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} />
              : view === "day" ? <DayView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} />
              : <ListView items={visible} selected={selected} onSelect={setSelected} />}
            {internal && visible.length === 0 && !busy && (
              <div
                data-testid="calendar-empty"
                className="mt-4 border border-dashed border-[var(--okx-border)] p-10 text-center text-sm text-zinc-500"
              >
                Tidak ada aktivitas pada rentang + filter aktif.
              </div>
            )}
          </div>
          <DetailPanel item={selected} onClose={() => setSelected(null)} internal={internal} onFollowUp={setCreateSeed} onDelete={removeEntry} deleting={deletingId === selected?.id} />
        </div>
      )}

      <div role="group" className="mt-5 flex flex-wrap gap-2 border-t border-[var(--okx-border)] pt-4" aria-label="Legenda status">
        {Object.entries(PUBLIC_STATUSES).map(([status, [label, Icon, style]]) => <span key={status} title={`Status kalender: ${label}`} className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] ${style}`}><Icon size={11} /> {label}</span>)}
      </div>
    </>
  );

  const conflictModal = internal && conflictOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
      data-testid="calendar-conflicts-modal"
      onClick={() => setConflictOpen(false)}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-auto border border-[var(--okx-border)] bg-[#111] p-5 okx-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest accent-text">Conflict Center</div>
            <h3 className="editorial mt-1 text-xl">{num(conflictCount)} konflik terdeteksi</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Sumber: overlap resource, overtime shift, dependency, travel buffer.
              Actionable per baris.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setConflictOpen(false)}
            className="p-2 text-zinc-500 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {(data.conflicts || []).map((conflict) => (
            <div
              key={conflict.id}
              className="border border-red-400/25 bg-black/30 p-3"
              data-testid={`calendar-conflict-${conflict.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-red-100">{conflict.title}</span>
                <span className="text-[9px] uppercase tracking-wider text-red-300">{conflict.severity}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{conflict.reason}</p>
              <p className="mt-2 text-xs text-zinc-200"><span className="text-zinc-500">Tindakan:</span> {conflict.action}</p>
              {conflict.event_id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/app/events/${conflict.event_id}/blueprint`}
                    className="border border-[var(--okx-border)] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-[var(--okx-accent)]"
                    onClick={() => setConflictOpen(false)}
                  >
                    Open event
                  </Link>
                  <Link
                    to={`/app/events/${conflict.event_id}/calendar`}
                    className="border border-[var(--okx-border)] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-[var(--okx-accent)]"
                    onClick={() => setConflictOpen(false)}
                  >
                    Buka kalender event
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (internal) {
    return (
      <div className="okx-workspace-page" data-testid="internal-calendar-engine">
        <div className="okx-workspace-chrome" data-testid="calendar-chrome">{chrome}</div>
        <div className="okx-workspace-content">{body}</div>
        {conflictModal}
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
