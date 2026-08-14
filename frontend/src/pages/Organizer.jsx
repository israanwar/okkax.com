import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
import { api, apiError, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PremiumSelect from "@/components/PremiumSelect";
import { useAuth } from "@/context/AuthContext";

export function Overview() {
  const { user, hasRole } = useAuth();
  const [events, setEvents] = useState([]);
  const [ripple, setRipple] = useState(null);

  useEffect(() => {
    if (hasRole("organizer", "event_organizer", "promoter", "supervisor", "finance_approver")) {
      api.get("/events").then(({ data }) => setEvents(data.items)).catch(() => {});
    }
    api.get(`/events/${DEMO_EVENT_ID}/ripple`).then(({ data }) => setRipple(data.metrics)).catch(() => {});
    // eslint-disable-next-line
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="editorial text-2xl sm:text-4xl">Selamat datang, {user.name}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Peran aktif: {(user.roles || []).join(", ")}. OKKAX menghubungkan setiap komponen event pada satu Event ID.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/app/studio" data-testid="overview-studio-btn" className="inline-flex items-center gap-2 bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold">
          <Plus size={15} /> Buat Event Brief
        </Link>
        <Link to="/demo" data-testid="overview-demo-btn" className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--okx-accent)]">
          <Sparkles size={15} /> Demo Terpandu
        </Link>
        <Link to={`/app/events/${DEMO_EVENT_ID}/graph`} data-testid="overview-demoevent-btn" className="border border-[var(--okx-border)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--okx-accent)]">
          Buka event demo
        </Link>
      </div>

      {events.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Event Anda</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2" data-testid="overview-events">
            {events.map((ev) => (
              <Link
                key={ev.id}
                to={`/app/events/${ev.id}/blueprint`}
                data-testid={`overview-event-${ev.id}`}
                className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5 transition-colors hover:border-zinc-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="num text-xs text-zinc-500">{ev.event_code}</div>
                    <h3 className="text-base font-semibold md:text-lg">{ev.name}</h3>
                    <div className="text-xs text-zinc-500">{ev.event_type} · {ev.city} · {ev.start_date}</div>
                  </div>
                  <StatusBadge status={ev.status === "published" ? "Confirmed" : "Draft"} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  {[["Total cost", compact(ev.total_cost)], ["Funding", compact(ev.confirmed_funding)], ["Gap", compact(ev.funding_gap)]].map(([l, v]) => (
                    <div key={l}>
                      <div className="text-zinc-500">{l}</div>
                      <div className="num text-sm font-bold">{v}</div>
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
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Live Event Impact — event demo</h2>
          <div className="mt-3 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total event activity", compact(ripple.total_economic_activity)],
              ["Businesses activated", num(ripple.businesses_activated)],
              ["Workers", num(ripple.workers)],
              ["Ticket GMV", compact(ripple.ticket_gmv)],
            ].map(([l, v]) => (
              <div key={l} className="bg-[var(--okx-surface)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">{l}</div>
                <div className="num mt-1 text-lg font-bold">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Data fiktif untuk demonstrasi kompetisi.</p>
        </div>
      )}
    </div>
  );
}

export function EventsList() {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    api.get("/events").then(({ data }) => setEvents(data.items));
  }, []);
  if (!events) return <div className="text-sm text-zinc-500">Memuat event…</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold md:text-lg">Events</h1>
        <Link to="/app/studio" className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold" data-testid="events-new-btn">Event baru</Link>
      </div>
      <div className="border border-[var(--okx-border)]" data-testid="events-list">
        {events.map((ev) => (
          <Link key={ev.id} to={`/app/events/${ev.id}/blueprint`} className="flex flex-col gap-2 border-b border-[var(--okx-border)] p-4 last:border-0 hover:bg-[var(--okx-surface)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="num text-xs text-zinc-500">{ev.event_code}</div>
              <div className="text-sm font-semibold">{ev.name}</div>
              <div className="text-xs text-zinc-500">{ev.city} · {ev.start_date}</div>
            </div>
            <div className="flex items-center gap-4">
              <span className="num text-xs text-zinc-400">Gap {compact(ev.funding_gap)}</span>
              <StatusBadge status={ev.status === "published" ? "Confirmed" : "Draft"} />
            </div>
          </Link>
        ))}
        {events.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">Belum ada event. Mulai dari Event Studio.</div>}
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="editorial text-2xl sm:text-3xl">OKKAX Event Studio</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Guided Event Brief. Draft tersimpan otomatis di perangkat Anda dan dapat dilanjutkan kapan saja.
        </p>
      </div>

      <div className="flex gap-1">
        {STEPS.map(([label], i) => (
          <button
            key={label}
            data-testid={`studio-step-${i}`}
            onClick={() => setStep(i)}
            className={`flex-1 border-b-2 pb-2 text-left text-xs ${i <= step ? "border-[var(--okx-accent)] text-white" : "border-[var(--okx-border)] text-zinc-500"}`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5 sm:grid-cols-2">
        {fields.map((k) => (
          <label key={k} className={`block ${["description", "objective", "notes"].includes(k) ? "sm:col-span-2" : ""}`}>
            <span className="text-xs uppercase tracking-wider text-zinc-500">{FIELD_LABEL[k]}</span>
            {k === "event_type" ? (
              <PremiumSelect data-testid={`studio-${k}-input`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full">
                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </PremiumSelect>
            ) : k === "production_standard" || k === "attendance_format" || k === "venue_preference" ? (
              <PremiumSelect data-testid={`studio-${k}-input`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full">
                {(k === "production_standard" ? ["Lean", "Balanced", "Premium"] : k === "attendance_format" ? ["Offline", "Hybrid", "Virtual"] : ["Indoor", "Outdoor"]).map((t) => <option key={t}>{t}</option>)}
              </PremiumSelect>
            ) : ["description", "objective", "notes", "audience_profile"].includes(k) ? (
              <textarea data-testid={`studio-${k}-input`} rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]" />
            ) : (
              <input
                data-testid={`studio-${k}-input`}
                type={["days", "setup_days", "capacity", "budget"].includes(k) ? "number" : k === "start_date" ? "date" : "text"}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: ["days", "setup_days", "capacity", "budget"].includes(k) ? Number(e.target.value) : e.target.value })}
                className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
              />
            )}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button data-testid="studio-prev-btn" disabled={step === 0} onClick={() => setStep(step - 1)} className="border border-[var(--okx-border)] px-4 py-2.5 text-sm disabled:opacity-40">
          Sebelumnya
        </button>
        {step < STEPS.length - 1 ? (
          <button data-testid="studio-next-btn" onClick={() => setStep(step + 1)} className="bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold">
            Lanjut
          </button>
        ) : (
          <button data-testid="studio-submit-btn" onClick={submit} disabled={busy} className="bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
            {busy ? "Blueprint Engine bekerja…" : "Build Event Blueprint"}
          </button>
        )}
        <span className="self-center text-xs text-zinc-500">Autosave aktif</span>
      </div>
    </div>
  );
}
