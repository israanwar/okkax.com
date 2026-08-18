import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
import { api, apiError, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";
import { useAuth } from "@/context/AuthContext";

export function Overview() {
  const { user, hasRole, workspaceVersion, activeWorkspace, effectiveRole } = useAuth();
  const [events, setEvents] = useState([]);
  const [ripple, setRipple] = useState(null);

  const organizerContext = hasRole(
    "organizer",
    "event_organizer",
    "promoter",
    "supervisor",
    "finance_approver"
  );

  useEffect(() => {
    // Hapus state workspace lama sebelum membaca workspace baru.
    setEvents([]);
    setRipple(null);

    if (!organizerContext) return;

    api.get("/events")
      .then(({ data }) => setEvents(data.items || []))
      .catch(() => setEvents([]));

    api.get(`/events/${DEMO_EVENT_ID}/ripple`)
      .then(({ data }) => setRipple(data.metrics))
      .catch(() => setRipple(null));

    // eslint-disable-next-line
  }, [workspaceVersion, effectiveRole]);

  return (
    <div className="space-y-4 font-gemini">
      <div
        className="okx-overview-command rounded-2xl border border-white/[0.08] p-4 sm:p-5 bg-[#0c0c12]/90 backdrop-blur-xl"
        data-testid="overview-command-surface"
      >
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
            <Sparkles size={10} className="text-zinc-400" />
            Live Event OS Command
          </div>
          <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">
            Selamat datang, {user.name}
          </h1>
          <p className="mt-1 text-xs sm:text-[13px] text-zinc-400">
            Peran aktif: <span className="font-semibold text-white">{effectiveRole || "audience"}</span>.{" "}
            {activeWorkspace?.kind === "personal"
              ? "Anda sedang menggunakan workspace personal."
              : "OKKAX menghubungkan setiap komponen event pada satu Event ID."}
          </p>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {organizerContext && (
            <>
              <Link
                to="/app/studio"
                data-testid="overview-studio-btn"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                <Plus size={14} /> Buat Event Brief
              </Link>

              <Link
                to={`/app/events/${DEMO_EVENT_ID}/graph`}
                data-testid="overview-demoevent-btn"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]"
              >
                Buka event demo
              </Link>
            </>
          )}

          {hasRole("sponsor") && (
            <Link
              to="/app/sponsor"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              Lihat peluang sponsor
            </Link>
          )}

          {hasRole("tenant") && (
            <Link
              to="/app/tenant"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              Lihat peluang tenant
            </Link>
          )}

          {hasRole("audience") && (
            <>
              <Link
                to="/discover"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                Jelajahi event
              </Link>

              <Link
                to="/app/tickets"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]"
              >
                Tiket saya
              </Link>
            </>
          )}

          <Link
            to="/demo"
            data-testid="overview-demo-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]"
          >
            <Sparkles size={14} /> Demo Terpandu
          </Link>
        </div>
      </div>

      {events.length > 0 && (
        <div>
          <h2 className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">Event Anda</h2>
          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2" data-testid="overview-events">
            {events.map((ev) => (
              <Link
                key={ev.id}
                to={`/app/events/${ev.id}/blueprint`}
                data-testid={`overview-event-${ev.id}`}
                className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3.5 sm:p-4 transition-all hover:border-white/25 hover:bg-[#12121c] shadow-sm hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="num text-[11px] text-zinc-400 font-gemini-mono">{ev.event_code}</div>
                    <h3 className="text-sm font-semibold text-white md:text-base mt-0.5">{ev.name}</h3>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{ev.event_type} · {ev.city} · {ev.start_date}</div>
                  </div>
                  <StatusBadge status={ev.status === "published" ? "Confirmed" : "Draft"} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-black/40 p-2.5 text-xs">
                  {[["Total cost", compact(ev.total_cost)], ["Funding", compact(ev.confirmed_funding)], ["Gap", compact(ev.funding_gap)]].map(([l, v]) => (
                    <div key={l}>
                      <div className="text-zinc-400 text-[10px] font-medium">{l}</div>
                      <div className="num text-xs sm:text-[13px] font-bold text-white mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {ripple && (
        <div>
          <h2 className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">Live Event Impact — event demo</h2>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total event activity", compact(ripple.total_economic_activity)],
              ["Businesses activated", num(ripple.businesses_activated)],
              ["Workers", num(ripple.workers)],
              ["Ticket GMV", compact(ripple.ticket_gmv)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3 sm:p-3.5">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{l}</div>
                <div className="num mt-1 text-lg sm:text-xl font-bold text-white">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10.5px] text-zinc-400 font-gemini-mono">Data fiktif untuk demonstrasi kompetisi.</p>
        </div>
      )}
    </div>
  );
}

export function EventsList() {
  const { workspaceVersion } = useAuth();
  const [events, setEvents] = useState(null);
  useEffect(() => {
    api.get("/events").then(({ data }) => setEvents(data.items));
    // eslint-disable-next-line
  }, [workspaceVersion]);
  if (!events) return <div className="text-xs text-zinc-400 p-6 font-gemini">Memuat event…</div>;
  return (
    <div className="okx-workspace-page space-y-4 font-gemini" data-testid="events-page">
      <div className="okx-workspace-chrome rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-3.5 sm:p-4" data-testid="events-chrome">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
              Live Event Portfolio
            </div>
            <h1 className="editorial text-xl sm:text-2xl text-white">Events</h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              {events.length} event pada workspace ini.
            </p>
          </div>
          <Link
            to="/app/studio"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
            data-testid="events-new-btn"
          >
            <Plus size={14} /> Event baru
          </Link>
        </div>
      </div>
      <div className="okx-workspace-content">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden divide-y divide-white/[0.06]" data-testid="events-list">
          {events.map((ev) => (
            <Link key={ev.id} to={`/app/events/${ev.id}/blueprint`} className="flex flex-col gap-2 p-3 sm:p-4 transition-all hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="num text-[11px] text-zinc-400 font-gemini-mono">{ev.event_code}</div>
                <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">{ev.name}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{ev.city} · {ev.start_date}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-xs text-zinc-400 font-gemini-mono">Gap {compact(ev.funding_gap)}</span>
                <StatusBadge status={ev.status === "published" ? "Confirmed" : "Draft"} />
              </div>
            </Link>
          ))}
          {events.length === 0 && <div className="p-6 text-center text-xs text-zinc-400 font-gemini">Belum ada event. Mulai dari Event Studio.</div>}
        </div>
      </div>
    </div>
  );
}

const EVENT_TYPES = ["Konser", "Festival musik", "Product launch", "Brand activation", "Conference", "Seminar", "Workshop", "Pameran", "Trade show", "Job fair", "Festival kuliner", "Festival budaya", "Fashion show", "Theater", "Stand-up comedy", "Fan meeting", "Pertandingan olahraga", "Esports", "Fun run", "Campus event", "Community event", "Religious gathering", "Automotive expo", "Property expo", "Tourism event", "Corporate gathering", "Private event", "Wedding exhibition", "Hybrid event", "Virtual event"];

const STEPS = [
  ["Identitas", ["name", "event_type", "objective", "description"]],
  ["Waktu & tempat", ["city", "venue_preference", "start_date", "days", "setup_days"]],
  ["Audiens & anggaran", ["capacity", "audience_profile", "target_age", "budget", "currency"]],
  ["Kebutuhan", ["talent_preference", "talent_category", "production_standard", "attendance_format", "accessibility", "sustainability", "brand_restrictions", "notes"]],
];

const FIELD_LABEL = {
  name: "Nama event", event_type: "Jenis event", objective: "Tujuan", description: "Deskripsi", city: "Kota",
  venue_preference: "Preferensi venue", start_date: "Tanggal mulai", days: "Durasi (hari)", setup_days: "Setup days",
  capacity: "Kapasitas", audience_profile: "Profil audiens", target_age: "Target usia", budget: "Anggaran (IDR)",
  currency: "Mata uang", talent_preference: "Talent preference", talent_category: "Talent category",
  production_standard: "Production standard", attendance_format: "Format attendance", accessibility: "Accessibility",
  sustainability: "Sustainability", brand_restrictions: "Brand restrictions", notes: "Catatan",
};

export { default as EventStudio } from "@/pages/EventStudio";

