import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDot,
  Clock3, Crosshair, LayoutGrid, List, MapPin, Plus, Search, Sun, Ticket, Trash2,
  RotateCcw, SlidersHorizontal, Users, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
  upcoming: ["Akan berlangsung", Clock3, "border-white/20 bg-white/[0.04] text-zinc-300"],
  ongoing: ["Sedang berlangsung", CircleDot, "border-white/40 bg-white/10 text-white font-bold"],
  completed: ["Telah selesai", CheckCircle2, "border-zinc-700/60 bg-zinc-800/30 text-zinc-400"],
  rescheduled: ["Dijadwalkan ulang", CalendarDays, "border-dashed border-white/30 bg-white/[0.03] text-zinc-200"],
  postponed: ["Ditunda", AlertTriangle, "border-white/25 bg-white/[0.03] text-zinc-300"],
  cancelled: ["Dibatalkan", XCircle, "border-zinc-800 bg-black/40 text-zinc-500 line-through"],
  tickets_on_sale: ["Tiket dijual", Ticket, "border-white/25 bg-white/[0.05] text-zinc-200 font-semibold"],
  tenant_open: ["Tenant dibuka", CircleDot, "border-white/20 bg-white/[0.03] text-zinc-300"],
  sponsor_open: ["Mencari sponsor", CircleDot, "border-white/20 bg-white/[0.03] text-zinc-300"],
  workforce_open: ["Rekrut workforce", Users, "border-white/20 bg-white/[0.03] text-zinc-300"],
};

const INTERNAL_META = {
  Completed: [CheckCircle2, "border-zinc-700/60 bg-zinc-800/30 text-zinc-400"],
  Confirmed: [CheckCircle2, "border-white/40 bg-white/10 text-white font-bold"],
  Pending: [Clock3, "border-dashed border-white/25 bg-white/[0.03] text-zinc-300"],
  "At Risk": [AlertTriangle, "border border-white/50 bg-white/[0.06] text-white font-bold"],
  Missing: [XCircle, "border border-white/60 bg-white/10 text-white font-bold"],
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

function MonthView({ cursor, items, selected, onSelect, showDaysHeader = false }) {
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
    <div className="overflow-x-auto okx-scroll rounded-2xl border border-white/[0.08] bg-[#0c0c14]/90 shadow-xl" data-testid="calendar-month-view">
      <div className="min-w-[760px]">
        {showDaysHeader && (
          <div className="grid grid-cols-7 border-b border-white/[0.08] bg-white/[0.03]">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <div key={day} className="border-r border-white/[0.06] last:border-r-0 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-gemini-mono">{day}</div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = isoDay(day);
            const rows = grouped[key] || [];
            const outside = day.getMonth() !== cursor.getMonth();
            const today = key === isoDay(new Date());
            return (
              <div key={key} className={`min-h-[90px] sm:min-h-[105px] border-b border-r border-white/[0.06] p-1.5 transition-colors ${outside ? "bg-black/40 text-zinc-400" : "bg-[#0c0c14]/60 text-zinc-300 hover:bg-white/[0.02]"}`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${today ? "bg-white font-bold text-black shadow-md" : outside ? "text-zinc-400" : "text-zinc-200"}`}>{day.getDate()}</span>
                  {rows.length > 0 && <span className="text-[9px] font-gemini-mono text-zinc-400">{rows.length} ev</span>}
                </div>
                <div className="space-y-1">
                  {rows.slice(0, 3).map((item) => <EntryCard key={item.id} item={item} dense selected={selected?.id === item.id} onSelect={onSelect} />)}
                  {rows.length > 3 && <div className="px-1 text-[9.5px] font-medium text-zinc-400 hover:text-white">+{rows.length - 3} lainnya</div>}
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
    <div className="overflow-x-auto okx-scroll rounded-2xl border border-white/[0.08] bg-[#0c0c14]/90 shadow-xl" data-testid="calendar-week-view">
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((day) => {
          const key = isoDay(day);
          const rows = items.filter((item) => String(item.start_at).slice(0, 10) === key);
          const today = key === isoDay(new Date());
          return (
            <div key={key} className={`min-h-[380px] border-b border-r border-white/[0.06] last:border-r-0 p-2.5 ${today ? "bg-white/[0.02]" : "bg-transparent"}`}>
              <div className="mb-2 border-b border-white/[0.08] pb-2">
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-zinc-500 font-gemini-mono">{new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(day)}</div>
                <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${today ? "bg-white text-black shadow-md" : "text-white"}`}>{day.getDate()}</div>
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
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c14]/90 overflow-hidden shadow-xl" data-testid="calendar-day-view">
      <div className="border-b border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 font-gemini-mono">
        {dateLabel(key)}
      </div>
      {rows.length === 0 && (
        <div className="p-12 text-center text-xs text-zinc-500" data-testid="calendar-empty">
          Tidak ada aktivitas pada hari ini dengan filter aktif.
        </div>
      )}
      {rows.length > 0 && (
        <div className="grid grid-cols-[70px_1fr]">
          {hours.map((h) => {
            const bucket = grouped[h] || [];
            return (
              <div key={h} className="contents">
                <div className="num border-b border-r border-white/[0.06] bg-white/[0.01] px-3 py-3 text-right text-[11px] font-semibold text-zinc-500 font-gemini-mono">
                  {pad(h)}:00
                </div>
                <div className="min-h-[56px] border-b border-white/[0.06] p-2">
                  {bucket.length === 0 ? (
                    <div className="h-full" />
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
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
    <div className="space-y-6" data-testid="calendar-list-view">
      {Object.entries(groups).map(([day, rows]) => (
        <section key={day} className="rounded-2xl border border-white/[0.08] bg-[#0c0c14]/90 p-4 shadow-lg">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{dateLabel(day)}</h3>
          <div className="grid gap-2.5 md:grid-cols-2">{rows.map((item) => <EntryCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={onSelect} />)}</div>
        </section>
      ))}
      {items.length === 0 && <div className="rounded-2xl border border-dashed border-white/[0.1] p-12 text-center text-xs text-zinc-500">Tidak ada aktivitas pada rentang dan filter ini.</div>}
    </div>
  );
}

const ADVANCED_PUBLIC_FILTER_KEYS = [
  "country", "artist", "venue", "organizer", "min_price", "max_price", "min_capacity",
  "age", "sale_status", "pricing", "format", "status", "lat", "lng", "radius_km",
];

function PublicFilters({ filters, setFilters, facets, onApply, onReset, busy, compact }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const rootRef = useRef(null);
  const inputField = "h-9 w-full min-w-0 rounded-lg border border-white/[0.12] bg-[#0c0c14] px-2.5 text-[11px] text-zinc-200 outline-none transition-colors focus:border-white/40";
  const useLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolokasi tidak tersedia di browser ini");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setFilters((current) => ({ ...current, lat: String(coords.latitude), lng: String(coords.longitude), radius_km: current.radius_km || "50" }));
      toast.success("Lokasi digunakan untuk filter jarak");
    }, () => toast.error("Izin lokasi tidak diberikan"));
  };
  const label = (text) => <span className="mb-1 block text-[9px] uppercase font-bold tracking-[0.1em] text-zinc-500 font-gemini-mono">{text}</span>;
  const set = (key) => (value) => setFilters({ ...filters, [key]: value });
  const advancedCount = ADVANCED_PUBLIC_FILTER_KEYS.filter((key) => Boolean(filters[key])).length;
  const statusOptions = [
    { value: "", label: "Semua status" },
    ...(facets.statuses || []).map((item) => ({ value: item.value, label: item.label })),
  ];
  useEffect(() => {
    if (!advancedOpen) return undefined;
    const close = (event) => {
      if (event.key === "Escape" || (event.type === "pointerdown" && !rootRef.current?.contains(event.target))) {
        setAdvancedOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [advancedOpen]);

  if (compact) return null;

  return (
    <div ref={rootRef} className="relative z-40 rounded-xl border border-white/[0.1] bg-[#09090f]/[0.98] p-2 shadow-[0_14px_34px_rgba(0,0,0,0.78)] backdrop-blur-xl sm:p-2.5" data-testid="calendar-public-filters">
      <div className="grid min-w-0 grid-cols-2 items-end gap-1.5 md:grid-cols-4 xl:grid-cols-[minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(8rem,0.9fr)_minmax(9rem,1fr)_auto]">
        <label className="min-w-0">{label("Dari tanggal")}<input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className={inputField} /></label>
        <label className="min-w-0">{label("Sampai tanggal")}<input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className={inputField} /></label>
        <div className="min-w-0">{label("Kota")}<OkxDropdown value={filters.city} onChange={set("city")} options={buildFacetOptions("Semua kota", facets.cities)} placeholder="Semua kota" testId="calendar-filter-city" /></div>
        <div className="min-w-0">{label("Kategori")}<OkxDropdown value={filters.category} onChange={set("category")} options={buildFacetOptions("Semua kategori", facets.categories)} placeholder="Semua kategori" testId="calendar-filter-category" /></div>
        <div className="col-span-2 flex items-center justify-end gap-1.5 md:col-span-4 xl:col-span-1">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            aria-controls="calendar-advanced-filters"
            data-testid="calendar-more-filters-btn"
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.035] px-2.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            <SlidersHorizontal size={13} />
            <span>Filter lainnya</span>
            {advancedCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">{advancedCount}</span>}
            <ChevronDown size={12} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          <button type="button" onClick={() => { setAdvancedOpen(false); onReset(); }} aria-label="Reset seluruh filter" title="Reset seluruh filter" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-zinc-400 transition-colors hover:border-white/25 hover:text-white" data-testid="calendar-public-reset"><RotateCcw size={13} /></button>
          <button type="button" disabled={busy} onClick={() => { setAdvancedOpen(false); onApply(); }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-bold text-black shadow-sm transition-colors hover:bg-zinc-200 disabled:opacity-50" data-testid="calendar-public-apply"><Search size={13} /> Terapkan</button>
        </div>
      </div>

      {advancedOpen && (
        <div id="calendar-advanced-filters" className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-xl border border-white/[0.12] bg-[#09090f] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.94)] okx-scroll sm:p-4" data-testid="calendar-advanced-filters">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>{label("Negara")}<OkxDropdown value={filters.country} onChange={set("country")} options={buildFacetOptions("Semua negara", facets.countries)} placeholder="Semua negara" testId="calendar-filter-country" /></div>
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
            <div>{label("Jarak lokasi")}<OkxDropdown value={filters.radius_km} onChange={set("radius_km")} placeholder="Tanpa batas" testId="calendar-filter-radius" options={[{ value: "", label: "Tanpa batas" }, { value: "10", label: "10 km" }, { value: "25", label: "25 km" }, { value: "50", label: "50 km" }, { value: "100", label: "100 km" }, { value: "250", label: "250 km" }]} /></div>
            <button type="button" onClick={useLocation} className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-[11px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"><Crosshair size={13} /> Gunakan lokasi saya</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ item, onClose, internal, onFollowUp, onDelete, deleting }) {
  if (!item) return null;
  const removable = internal && item.source_type === "calendar_entry";
  return (
    <aside className="rounded-2xl border border-white/[0.1] bg-[#0e0e18] p-5 shadow-2xl space-y-4" data-testid="calendar-detail-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-gemini-mono">Detail Jadwal</div>
          <h3 className="mt-1 text-base font-bold text-white">{item.title}</h3>
        </div>
        <button onClick={onClose} aria-label="Tutup detail" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"><X size={16} /></button>
      </div>
      <div><StatusPill item={item} /></div>
      <dl className="space-y-2.5 text-xs">
        {[
          ["Mulai", `${dateLabel(item.start_at)} · ${timeLabel(item.start_at)}`],
          ["Selesai", `${dateLabel(item.end_at)} · ${timeLabel(item.end_at)}`],
          ["Event ID", item.event_code || item.event_id],
          ["Lokasi", item.location],
          ["Penanggung jawab", item.owner || item.organizer],
          ["Resource", item.resource_name],
          ["Format", item.format],
          ["Kapasitas", item.capacity ? num(item.capacity) : null],
          ["Harga", item.max_price != null ? `${idr(item.min_price)} – ${idr(item.max_price)}` : null],
          ["Catatan", item.notes],
        ].filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-white/[0.06] pb-2">
            <dt className="text-zinc-400 font-gemini-mono text-[11px] font-medium">{label}</dt>
            <dd className="break-words text-zinc-100 font-gemini">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 pt-2">
        {item.public_url && <Link to={item.public_url} className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-all shadow-md">Buka event</Link>}
        {internal && item.resource_id && <button onClick={() => onFollowUp(item)} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs text-zinc-200 hover:border-white/30 hover:bg-white/[0.08] transition-all">Jadwalkan tindak lanjut</button>}
        {removable && (
          <button
            data-testid="calendar-delete-entry-btn"
            disabled={deleting}
            onClick={() => onDelete(item)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.15] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition-all">
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
  const field = "mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#0c0c14] px-3.5 py-2 text-xs text-white outline-none focus:border-white/40 transition-colors";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4" data-testid="calendar-create-modal">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/[0.12] bg-[#0e0e16] p-6 okx-scroll shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-gemini-mono">Scheduling Engine</div>
            <h2 className="text-lg font-bold text-white mt-0.5">Tambah aktivitas</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-[11px] font-medium text-zinc-400">Judul aktivitas</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} /></label>
          <label><span className="text-[11px] font-medium text-zinc-400">Waktu Mulai</span><input required type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className={field} /></label>
          <label><span className="text-[11px] font-medium text-zinc-400">Waktu Selesai</span><input required type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className={field} /></label>
          <div><span className="mb-1 block text-[11px] font-medium text-zinc-400">Jenis resource</span><OkxDropdown value={form.resource_type} onChange={(v) => setForm({ ...form, resource_type: v })} options={["event", "talent", "venue", "vendor", "worker", "sponsor", "tenant"].map((v) => ({ value: v, label: v }))} testId="calendar-create-resource-type" /></div>
          <div><span className="mb-1 block text-[11px] font-medium text-zinc-400">Status</span><OkxDropdown value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["Pending", "Confirmed", "Completed", "At Risk", "Missing"].map((v) => ({ value: v, label: v }))} testId="calendar-create-status" /></div>
          <label><span className="text-[11px] font-medium text-zinc-400">Resource ID</span><input required value={form.resource_id} onChange={(e) => setForm({ ...form, resource_id: e.target.value })} className={field} /></label>
          <label><span className="text-[11px] font-medium text-zinc-400">Nama resource</span><input value={form.resource_name} onChange={(e) => setForm({ ...form, resource_name: e.target.value })} className={field} /></label>
          <label className="sm:col-span-2"><span className="text-[11px] font-medium text-zinc-400">Catatan</span><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-all">Batal</button>
          <button disabled={busy} className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-md">{busy ? "Memeriksa konflik…" : "Simpan & periksa konflik"}</button>
        </div>
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

  const commandHeaderRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    if (!internal || !commandHeaderRef.current) return;
    const updateHeight = () => {
      if (commandHeaderRef.current) {
        setHeaderHeight(commandHeaderRef.current.offsetHeight);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(commandHeaderRef.current);
    return () => observer.disconnect();
  }, [internal, data.available_types, activeCategories, eventFilter, resourceFilter, statusFilter]);

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

  const resetPublicFilters = () => {
    const next = {
      date_from: isoDay(addDays(startOfMonth(new Date()), -31)),
      date_to: isoDay(addMonths(startOfMonth(new Date()), 7)),
      city: initialCity,
      country: "",
      category: "",
      artist: "",
      venue: "",
      organizer: "",
      min_price: "",
      max_price: "",
      min_capacity: "",
      age: "",
      sale_status: "",
      pricing: "",
      format: "",
      status: "",
      lat: "",
      lng: "",
      radius_km: "",
    };
    setFilters(next);
    load(next);
  };

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
          <div className="mt-4 text-xs text-zinc-300">{error}</div>
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

  const operationalFiltersActive =
    activeCategories.size > 0 || !!eventFilter || !!resourceFilter || !!statusFilter;

  return (
    <div
      className="space-y-3 pb-12"
      style={{ "--cal-header-offset": `${headerHeight}px` }}
      data-testid={internal ? "internal-calendar-engine" : "public-calendar-engine"}
    >
      {/* 1. Internal Unified Sticky Command Interface */}
      {internal && (
        <div
          ref={commandHeaderRef}
          className="sticky -top-4 sm:-top-4.5 z-30 -mt-4 sm:-mt-4.5 -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 pt-3 sm:pt-3.5 pb-2 bg-[#07070a] border-b border-white/[0.08] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.9)] space-y-1.5"
        >
          {/* ROW 1: [Calendar & Scheduling] [<] [Hari ini] [>] [Agustus 2026]              [+ Tambah aktivitas] */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300 font-gemini-mono shrink-0">
                <CalendarDays size={10} className="text-zinc-400" />
                Calendar & Scheduling
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  onClick={() => setCursor(
                    view === "month" ? addMonths(cursor, -1)
                      : view === "week" ? addDays(cursor, -7)
                      : view === "day" ? addDays(cursor, -1)
                      : addDays(cursor, -7),
                  )}
                  aria-label="Periode sebelumnya"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-1 text-zinc-300 hover:border-white/25 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => setCursor(view === "day" ? new Date() : startOfMonth(new Date()))}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] font-semibold text-zinc-200 hover:border-white/25 hover:text-white transition-all cursor-pointer whitespace-nowrap"
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
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-1 text-zinc-300 hover:border-white/25 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronRight size={13} />
                </button>
                <span className="ml-1 text-xs sm:text-[13px] font-bold text-white capitalize font-gemini truncate">
                  {view === "day" ? dateLabel(isoDay(cursor), true) : monthLabel(cursor)}
                </span>
              </div>
            </div>

            <button
              data-testid="calendar-add-btn"
              onClick={() => setCreateSeed(data.items[0] || {})}
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus size={12} /> <span className="hidden sm:inline">Tambah aktivitas</span><span className="sm:hidden">Tambah</span>
            </button>
          </div>

          {/* ROW 2: [Event ▼] [Resource ▼] [Status ▼]                     [Bulan] [Minggu] [Hari] [Agenda] */}
          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between pt-1.5 border-t border-white/[0.06]">
            <div
              className="grid grid-cols-3 gap-1 sm:gap-1.5 flex-1 max-w-2xl"
              data-testid="calendar-filter-row"
            >
              <div className="min-w-0">
                <OkxDropdown
                  value={eventFilter}
                  onChange={setEventFilter}
                  options={eventFacetOptions}
                  placeholder="Semua event"
                  searchable={eventFacetOptions.length >= 8}
                  testId="calendar-filter-event"
                  ariaLabel="Filter event"
                />
              </div>
              <div className="min-w-0">
                <OkxDropdown
                  value={resourceFilter}
                  onChange={setResourceFilter}
                  options={RESOURCE_TYPE_OPTIONS}
                  placeholder="Semua resource"
                  testId="calendar-filter-resource"
                  ariaLabel="Filter resource"
                />
              </div>
              <div className="min-w-0">
                <OkxDropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusFacetOptions}
                  placeholder="Semua status"
                  testId="calendar-filter-status"
                  ariaLabel="Filter status"
                />
              </div>
            </div>

            <div
              className="flex items-center justify-between sm:justify-end gap-1 shrink-0 overflow-x-auto no-scrollbar"
              data-testid="calendar-view-selector"
            >
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
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    view === key
                      ? "border-white/40 bg-white/15 text-white font-bold shadow-sm"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={12} /> <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ROW 3: [Kalender Organizer] [Persiapan] [Venue deadline] ...           [Reset filter] */}
          <div
            className="flex items-center gap-1.5 pt-1.5 border-t border-white/[0.06] overflow-x-auto okx-scroll no-scrollbar"
            data-testid="calendar-category-chips"
          >
            <span className="mr-1 text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono shrink-0">
              Kalender {data.calendar_type || "peran"}
            </span>
            <div className="flex items-center gap-1 flex-nowrap shrink-0">
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
                    className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[9.5px] font-medium transition-all duration-150 shrink-0 ${
                      active
                        ? "border-white/50 bg-white/15 text-white font-semibold shadow-sm"
                        : known
                          ? "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.05]"
                          : "border-white/[0.04] text-zinc-600 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {operationalFiltersActive && (
              <button
                type="button"
                onClick={resetOperational}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-medium text-zinc-300 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-all shrink-0"
                data-testid="calendar-reset"
              >
                <X size={10} /> Reset
              </button>
            )}
          </div>

          {/* ROW 4: Day Names (Sen Sel Rab Kam Jum Sab Min) for Month View */}
          {view === "month" && (
            <div className="grid grid-cols-7 border-t border-white/[0.06] pt-1.5 text-center font-gemini-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                <div key={day} className="py-0.5">{day}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Public Filters (if public mode) */}
      {!internal && (
        <div className="sticky top-[65px] z-40 space-y-2 bg-[var(--okx-bg)]/95 pb-2 backdrop-blur-xl" data-testid="calendar-sticky-controls">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono">
                <CalendarDays size={11} className="text-zinc-400" />
                Calendar Engine
              </div>
              <h1 className="editorial mt-1.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                Temukan event dan momentum pentingnya.
              </h1>
              <p className="mt-0.5 max-w-3xl text-[11px] leading-relaxed text-zinc-400 font-gemini sm:text-xs">
                Lihat event, masa penjualan tiket, pembukaan tenant, peluang sponsor, dan rekrutmen workforce dalam satu kalender publik.
              </p>
            </div>
          </div>

          <PublicFilters
            filters={filters}
            setFilters={setFilters}
            facets={data.facets || {}}
            onApply={() => load(filters)}
            onReset={resetPublicFilters}
            busy={busy}
          />

          <div
            className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-white/[0.08] bg-[#0c0c14]/80 p-1.5 sm:p-2 backdrop-blur-md shadow-md"
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
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5 text-zinc-300 hover:border-white/25 hover:text-white transition-all cursor-pointer"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => setCursor(view === "day" ? new Date() : startOfMonth(new Date()))}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:border-white/25 hover:text-white transition-all cursor-pointer"
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
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5 text-zinc-300 hover:border-white/25 hover:text-white transition-all cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
              <span className="ml-2 text-xs sm:text-sm font-bold text-white capitalize">
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
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer ${
                    view === key
                      ? "border-white/40 bg-white/15 text-white font-bold shadow-sm"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Main Calendar Body Grid */}
      {busy ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c14]/80 p-16 text-center text-xs text-zinc-400 font-gemini">
          Menyusun kalender dan memuat jadwal…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/20 bg-white/[0.04] p-6 text-xs text-zinc-300">
          {error}
        </div>
      ) : (
        <div className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`} data-testid="calendar-body">
          <div className="min-w-0">
            {view === "month" ? <MonthView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} showDaysHeader={!internal} />
              : view === "week" ? <WeekView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} />
              : view === "day" ? <DayView cursor={cursor} items={visible} selected={selected} onSelect={setSelected} />
              : <ListView items={visible} selected={selected} onSelect={setSelected} />}
            {internal && visible.length === 0 && !busy && (view === "month" || view === "week") && (
              <div
                data-testid="calendar-empty"
                className="mt-4 rounded-2xl border border-dashed border-white/[0.1] p-12 text-center text-xs text-zinc-400 font-medium"
              >
                Tidak ada aktivitas pada rentang + filter aktif.
              </div>
            )}
          </div>
          {selected && (
            <DetailPanel
              item={selected}
              onClose={() => setSelected(null)}
              internal={internal}
              onFollowUp={setCreateSeed}
              onDelete={removeEntry}
              deleting={deletingId === selected?.id}
            />
          )}
        </div>
      )}

      {/* 6. Status Legend */}
      <div role="group" className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4" aria-label="Legenda status">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono mr-1">Status:</span>
        {Object.entries(PUBLIC_STATUSES).map(([status, [label, Icon, style]]) => (
          <span key={status} title={`Status kalender: ${label}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium font-gemini-mono ${style}`}>
            <Icon size={11} /> {label}
          </span>
        ))}
      </div>

      {/* Create Activity Modal */}
      {createSeed !== null && (
        <CreateEntry
          seed={createSeed}
          onClose={() => setCreateSeed(null)}
          onCreated={() => {
            setCreateSeed(null);
            load(filters);
          }}
        />
      )}
    </div>
  );
}
