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

export function EventStudio() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("okkax_brief_draft");
    return saved
      ? JSON.parse(saved)
      : {
          name: "", event_type: "Konser", objective: "", description: "", city: "Makassar",
          venue_preference: "Indoor", start_date: "2026-09-12", days: 1, setup_days: 1, capacity: 1500,
          audience_profile: "", target_age: "18-35", budget: 800000000, currency: "IDR",
          talent_preference: "", talent_category: "Music Band", production_standard: "Balanced",
          attendance_format: "Offline", accessibility: "", sustainability: "", brand_restrictions: "", notes: "",
          ticketed: true, sponsor_requirement: true, tenant_requirement: true, workforce_requirement: true,
        };
  });

  useEffect(() => {
    localStorage.setItem("okkax_brief_draft", JSON.stringify(form));
  }, [form]);

  const submit = async () => {
    if (!form.name) return toast.error("Nama event wajib diisi");
    setBusy(true);
    try {
      const { data } = await api.post("/events", form);
      const id = data.event.id;
      await api.post(`/events/${id}/compile`);
      localStorage.removeItem("okkax_brief_draft");
      toast.success("Brief dikompilasi menjadi Event Blueprint");
      nav(`/app/events/${id}/blueprint`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const fields = STEPS[step][1];

  return (
    <div className="max-w-4xl space-y-4">
      <div className="border-b border-white/[0.08] pb-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
          <Sparkles size={10} className="text-zinc-400" />
          OKKAX Studio AI Integrated
        </div>
        <h1 className="editorial mt-1.5 text-xl sm:text-2xl text-white">OKKAX Event Studio</h1>
        <p className="mt-0.5 text-xs text-zinc-400">
          Guided Event Brief didukung Studio AI Engine. Mengubah parameter brief menjadi Event Blueprint lengkap.
        </p>
      </div>

      <div className="flex gap-1.5">
        {STEPS.map(([label], i) => (
          <button
            key={label}
            data-testid={`studio-step-${i}`}
            onClick={() => setStep(i)}
            className={`flex-1 rounded-xl border py-1.5 px-2.5 text-left text-xs font-semibold transition-all ${
              i === step
                ? "border-white/30 bg-white/[0.1] text-white shadow-sm"
                : i < step
                  ? "border-white/20 bg-white/[0.04] text-zinc-300"
                  : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <span className="font-gemini-mono text-[9px] block opacity-70">Langkah 0{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-4.5 sm:grid-cols-2 shadow-sm">
        {fields.map((k) => (
          <label key={k} className={`block ${["description", "objective", "notes"].includes(k) ? "sm:col-span-2" : ""}`}>
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{FIELD_LABEL[k]}</span>
            {k === "event_type" ? (
              <PremiumSelect data-testid={`studio-${k}-input`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full">
                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </PremiumSelect>
            ) : k === "production_standard" || k === "attendance_format" || k === "venue_preference" ? (
              <PremiumSelect data-testid={`studio-${k}-input`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full">
                {(k === "production_standard" ? ["Lean", "Balanced", "Premium"] : k === "attendance_format" ? ["Offline", "Hybrid", "Virtual"] : ["Indoor", "Outdoor"]).map((t) => <option key={t}>{t}</option>)}
              </PremiumSelect>
            ) : ["description", "objective", "notes", "audience_profile"].includes(k) ? (
              <textarea data-testid={`studio-${k}-input`} rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-1.5 text-xs sm:text-[13px] text-white placeholder:text-zinc-400 outline-none transition-all focus:border-white/40 focus:ring-1 focus:ring-white/20" />
            ) : (
              <input
                data-testid={`studio-${k}-input`}
                type={["days", "setup_days", "capacity", "budget"].includes(k) ? "number" : k === "start_date" ? "date" : "text"}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: ["days", "setup_days", "capacity", "budget"].includes(k) ? Number(e.target.value) : e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-1.5 text-xs sm:text-[13px] text-white placeholder:text-zinc-400 outline-none transition-all focus:border-white/40 focus:ring-1 focus:ring-white/20"
              />
            )}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button data-testid="studio-prev-btn" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed">
          Sebelumnya
        </button>
        {step < STEPS.length - 1 ? (
          <button data-testid="studio-next-btn" onClick={() => setStep(step + 1)} className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]">
            Lanjut
          </button>
        ) : (
          <button data-testid="studio-submit-btn" onClick={submit} disabled={busy} className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait">
            {busy ? "Blueprint Engine bekerja…" : "Build Event Blueprint"}
          </button>
        )}
        <span className="self-center text-[10.5px] text-zinc-400 font-gemini-mono">Autosave aktif</span>
      </div>
    </div>
  );
}
