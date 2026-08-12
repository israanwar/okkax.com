import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Maximize2, Minimize2, Play, Pause, RotateCcw, X, ExternalLink,
} from "lucide-react";
import { api, apiError, compact, idr, num, DEMO_EVENT_ID } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const FRAGMENTS = ["Brief", "Talent", "Rider", "Venue", "Vendor", "Sponsor", "Tenant", "Pekerja", "Ticketing", "Pembayaran", "Laporan"];

const GRAPH = [
  { key: "talent", label: "Talent + Rider", x: 14, y: 22 },
  { key: "venue", label: "Venue", x: 50, y: 12 },
  { key: "vendor", label: "Vendor", x: 86, y: 22 },
  { key: "sponsor", label: "Sponsor", x: 8, y: 58 },
  { key: "tenant", label: "Tenant", x: 92, y: 58 },
  { key: "workforce", label: "Workforce", x: 24, y: 88 },
  { key: "ticketing", label: "Ticketing", x: 76, y: 88 },
];

function EventGraphStage({ d, animate }) {
  const meta = {
    talent: `${d.network.talents} talent · ${d.network.rider_items} rider`,
    venue: d.event.venue_name,
    vendor: `${d.operations.vendors_confirmed}/${d.operations.vendors_total} confirmed`,
    sponsor: `${d.network.sponsor_commitments} komitmen · ${compact(d.network.sponsor_value)}`,
    tenant: `${d.network.booths_occupied}/${d.network.booths_total} booth`,
    workforce: `${d.operations.workforce_filled}/${d.operations.workforce_needed} pekerja`,
    ticketing: `${num(d.network.tickets_sold)}/${num(d.network.ticket_capacity)} tiket`,
  };
  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {GRAPH.map((n, i) => (
          <line
            key={n.key}
            x1="50"
            y1="50"
            x2={n.x}
            y2={n.y}
            stroke="#FF4500"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
            opacity={animate ? 0.7 : 0.4}
          />
        ))}
      </svg>
      <div className="fade-up absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-[var(--okx-accent)] bg-[#140700] px-5 py-3 text-center">
        <div className="num text-[11px] uppercase tracking-[0.2em] accent-text">{d.event.event_code}</div>
        <div className="mt-1 text-base font-bold sm:text-xl">{d.event.name}</div>
      </div>
      {GRAPH.map((n) => (
        <div
          key={n.key}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          className="fade-up absolute w-[34%] max-w-[220px] -translate-x-1/2 -translate-y-1/2 border border-[var(--okx-border)] bg-[var(--okx-surface)] px-3 py-2 sm:w-auto"
        >
          <div className="text-xs font-semibold sm:text-sm">{n.label}</div>
          <div className="num text-[10px] text-zinc-400 sm:text-xs">{meta[n.key]}</div>
        </div>
      ))}
    </div>
  );
}

const Big = ({ label, value, sub }) => (
  <div className="border-l-2 border-[var(--okx-accent)] pl-4">
    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:text-xs">{label}</div>
    <div className="num mt-1 text-2xl font-bold leading-none sm:text-4xl lg:text-5xl">{value}</div>
    {sub && <div className="num mt-1 text-[10px] text-zinc-500 sm:text-xs">{sub}</div>}
  </div>
);

export default function PresentationMode() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const [full, setFull] = useState(false);
  const wrap = useRef(null);

  const load = useCallback(() => api.get("/demo/summary").then(({ data }) => setD(data)), []);
  useEffect(() => {
    load().catch((e) => toast.error(apiError(e)));
  }, [load]);

  const scenes = d
    ? [
        {
          kicker: "01 · Masalah",
          headline: "Satu event, sebelas sistem yang tidak saling bicara.",
          body: "Brief, talent, rider, venue, vendor, sponsor, tenant, pekerja, ticketing, pembayaran, dan laporan berjalan di kanal terpisah. Satu perubahan memaksa semua pihak menghitung ulang.",
          render: () => (
            <div className="flex flex-wrap gap-2">
              {FRAGMENTS.map((f) => (
                <span
                  key={f}
                  className="fade-up border border-[var(--okx-border)] px-3 py-2 text-sm text-zinc-500 line-through sm:text-lg"
                >
                  {f}
                </span>
              ))}
            </div>
          ),
        },
        {
          kicker: "02 · Event Brief",
          headline: d.event.name,
          body: "Satu brief masuk. Inilah titik awal seluruh ekonomi event.",
          render: () => (
            <div className="grid gap-5 sm:grid-cols-3">
              <Big label="Kota" value={d.brief.city} sub={`${d.brief.days} hari + ${d.brief.setup_days} setup day`} />
              <Big label="Pengunjung" value={num(d.brief.capacity)} sub={d.brief.audience_profile} />
              <Big label="Anggaran" value={compact(d.brief.budget)} sub={idr(d.brief.budget)} />
              <Big label="Headliner" value={d.brief.headliner || "—"} sub={`Fee ${compact(d.brief.headliner_fee)}`} />
              <Big label="Tenant booth" value={num(d.brief.booths)} sub="zona kuliner, UMKM, aktivasi brand" />
              <Big label="Sponsor tier" value={num(d.brief.sponsor_tiers)} sub="presenting hingga category partner" />
            </div>
          ),
        },
        {
          kicker: "03 · Event Compiler",
          headline: "Brief berubah menjadi Blueprint, lalu menjadi Event Graph.",
          body: "AI Event Compiler menyusun fase, workstream, requirement, sponsor inventory, tenant zone, ticket tier, budget, dan risiko — semuanya berlabel dan dapat diedit.",
          render: () => (
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {["Event Brief", "AI Event Blueprint", "Event Graph"].map((s, idx) => (
                <div key={s} className="flex flex-1 items-center gap-3">
                  <div
                    className={`fade-up flex-1 border px-4 py-5 text-center text-sm font-semibold sm:text-lg ${
                      idx === 2 ? "border-[var(--okx-accent)] bg-[#140700] accent-text" : "border-[var(--okx-border)] bg-[var(--okx-surface)]"
                    }`}
                  >
                    {s}
                    <div className="num mt-1 text-[10px] font-normal text-zinc-500 sm:text-xs">
                      {idx === 0 ? "input penyelenggara" : idx === 1 ? "output AI, dapat diedit" : `${d.network.rider_items + d.network.vendors + d.network.booths} komponen terhubung`}
                    </div>
                  </div>
                  {idx < 2 && <ArrowRight className="hidden shrink-0 accent-text sm:block" size={22} />}
                </div>
              ))}
            </div>
          ),
        },
        {
          kicker: "04 · Event Network",
          headline: "Satu Event ID. Setiap bagian yang bergerak.",
          stage: true,
          render: () => <EventGraphStage d={d} animate />,
        },
        {
          kicker: "05 · Biaya dan Pendanaan",
          headline: "Setiap keputusan langsung terlihat pada angka.",
          render: () => (
            <div className="grid gap-5 sm:grid-cols-3">
              <Big label="Total Event Cost" value={compact(d.key_numbers.total_event_cost)} sub={idr(d.key_numbers.total_event_cost)} />
              <Big label="Confirmed Funding" value={compact(d.key_numbers.confirmed_funding)} sub={idr(d.key_numbers.confirmed_funding)} />
              <Big label="Funding Gap" value={compact(d.key_numbers.funding_gap)} sub={idr(d.key_numbers.funding_gap)} />
              <Big label="Landed Talent Cost" value={compact(d.brief.headliner_landed_cost)} sub={`${d.brief.headliner} — fee + pajak + travel + rider`} />
              <Big label="Break-even Tickets" value={num(d.network.break_even_tickets)} sub={`dari kuota ${num(d.network.ticket_capacity)} tiket`} />
              <Big label="Ticket GMV" value={compact(d.ripple.ticket_gmv)} sub={`${num(d.network.tickets_sold)} tiket terjual (sandbox)`} />
            </div>
          ),
        },
        {
          kicker: "06 · Transaksi",
          headline: "Sponsor, tenant, dan tiket mengubah funding secara langsung.",
          render: () => (
            <div className="grid gap-5 sm:grid-cols-3">
              <Big label="Sponsor commitment" value={compact(d.network.sponsor_value)} sub={`${d.network.sponsor_commitments} komitmen disetujui organizer`} />
              <Big label="Tenant booth revenue" value={compact(d.network.tenant_revenue)} sub={`${d.network.booths_occupied}/${d.network.booths_total} booth terisi`} />
              <Big label="Ticket sandbox" value={compact(d.ripple.ticket_gmv)} sub="VA, QRIS, e-wallet, retail, kartu Stripe test mode" />
            </div>
          ),
          actions: [
            ["Jalankan transaksi sandbox", `/events/${DEMO_EVENT_ID}`],
            ["Lihat approval sponsor", `/app/events/${DEMO_EVENT_ID}/sponsors`],
          ],
        },
        {
          kicker: "07 · Operasi",
          headline: "Hari-H terkendali pada satu papan.",
          render: () => (
            <div className="grid gap-5 sm:grid-cols-3">
              <Big label="Event readiness" value={`${d.operations.readiness}%`} sub="dihitung dari status komponen" />
              <Big label="Rider fulfillment" value={`${d.operations.rider_matched}/${d.operations.rider_total}`} sub="item rider matched" />
              <Big label="Workforce coverage" value={`${d.operations.workforce_filled}/${d.operations.workforce_needed}`} sub="pekerja terisi" />
              <Big label="Milestone pembayaran" value={`${d.operations.milestones_paid}/${d.operations.milestones_total}`} sub={`menunggu ${compact(d.operations.milestones_pending_amount)}`} />
              <Big label="Ticket status" value={`${num(d.operations.tickets_sold)}/${num(d.operations.ticket_capacity)}`} sub="terjual dari kuota" />
              <Big label="Incident monitoring" value={`${d.operations.incidents_open} terbuka`} sub={`${d.operations.incidents_total} total tercatat`} />
            </div>
          ),
          actions: [["Buka Command Center", `/app/events/${DEMO_EVENT_ID}/operations`]],
        },
        {
          kicker: "08 · Dampak",
          headline: "Satu event menjadi aktivitas ekonomi yang terukur.",
          render: () => (
            <>
              <div className="grid gap-5 sm:grid-cols-3">
                <Big label="Bisnis terlibat" value={num(d.ripple.businesses_activated)} sub="talent, venue, vendor, tenant" />
                <Big label="Pekerja diaktifkan" value={num(d.ripple.workers_activated)} sub="usher, crew, security, medis" />
                <Big label="Vendor payout" value={compact(d.ripple.vendor_payout)} sub={idr(d.ripple.vendor_payout)} />
                <Big label="Workforce payout" value={compact(d.ripple.workforce_payout)} sub={idr(d.ripple.workforce_payout)} />
                <Big label="Venue income" value={compact(d.ripple.venue_income)} sub={idr(d.ripple.venue_income)} />
                <Big label="Ticket GMV" value={compact(d.ripple.ticket_gmv)} sub={idr(d.ripple.ticket_gmv)} />
              </div>
              <div className="mt-6 border border-[var(--okx-accent)] bg-[#140700] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] accent-text sm:text-xs">Total aktivitas ekonomi event</div>
                <div className="num mt-1 text-3xl font-bold sm:text-5xl">{compact(d.ripple.economic_activity)}</div>
              </div>
            </>
          ),
          actions: [["Buka Economic Ripple", `/app/events/${DEMO_EVENT_ID}/ripple`]],
        },
      ]
    : [];

  const next = useCallback(() => setI((v) => Math.min(scenes.length - 1, v + 1)), [scenes.length]);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else nav("/juri");
      }
    };
    window.addEventListener("keydown", onKey);
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [next, prev, nav]);

  useEffect(() => {
    if (!auto || !scenes.length) return;
    const t = setTimeout(() => (i === scenes.length - 1 ? setAuto(false) : next()), 20000);
    return () => clearTimeout(t);
  }, [auto, i, next, scenes.length]);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrap.current?.requestFullscreen();
    } catch {
      toast.error("Browser menolak mode layar penuh. Gunakan F11 sebagai alternatif.");
    }
  };

  const resetDemo = async () => {
    try {
      await api.post("/demo/reset");
      await load();
      toast.success("Data demo direset");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!d)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--okx-bg)] text-sm text-zinc-500" data-testid="present-loading">
        Memuat data event demo…
      </div>
    );

  const s = scenes[i];

  return (
    <div ref={wrap} data-testid="presentation-root" className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--okx-bg)]">
      {/* header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--okx-border)] px-4 py-2.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center bg-[var(--okx-accent)] text-xs font-extrabold text-white">O</span>
          <span className="text-sm font-extrabold tracking-tight sm:text-base">OKKAX</span>
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:block">
            Event Economy Operating Network
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span data-testid="present-progress" className="num mr-1 text-xs text-zinc-400 sm:text-sm">{i + 1}/{scenes.length}</span>
          <button data-testid="present-auto-btn" onClick={() => setAuto(!auto)} title="Auto-advance 20 detik" className={`border p-2 ${auto ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-400"}`} aria-label="Auto-advance">
            {auto ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button data-testid="present-fullscreen-btn" onClick={toggleFull} className="border border-[var(--okx-border)] p-2 text-zinc-300" aria-label="Layar penuh">
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button data-testid="present-reset-btn" onClick={resetDemo} className="hidden items-center gap-1.5 border border-[var(--okx-border)] px-3 py-2 text-xs text-zinc-300 sm:flex" title="Reset data demo">
            <RotateCcw size={13} /> Reset Demo
          </button>
          <Link data-testid="present-exit-btn" to="/juri" className="border border-[var(--okx-border)] p-2 text-zinc-300" aria-label="Keluar presentasi">
            <X size={15} />
          </Link>
        </div>
      </header>

      <div className="h-[3px] w-full shrink-0 bg-[#27272a]">
        <div className="h-[3px] bg-[var(--okx-accent)] transition-all duration-500" style={{ width: `${((i + 1) / scenes.length) * 100}%` }} />
      </div>

      {/* scene */}
      <main key={i} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 okx-scroll sm:px-10 sm:py-8">
        <div className="mx-auto flex h-full max-w-[1500px] flex-col justify-center">
          <div className="text-[10px] uppercase tracking-[0.22em] accent-text sm:text-xs" data-testid={`scene-kicker-${i + 1}`}>{s.kicker}</div>
          <h1 className="editorial mt-2 max-w-5xl text-2xl leading-[1.06] sm:text-4xl lg:text-5xl" data-testid={`scene-headline-${i + 1}`}>
            {s.headline}
          </h1>
          {s.body && <p className="mt-3 max-w-3xl text-sm text-zinc-400 sm:text-base">{s.body}</p>}
          <div
            className={`mt-7 ${s.stage ? "relative h-[300px] sm:h-[46vh] lg:h-[52vh]" : ""}`}
            data-testid={`scene-content-${i + 1}`}
          >
            {s.render()}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {(s.actions || [["Buka Detail", `/app/events/${DEMO_EVENT_ID}/graph`]]).map(([label, path]) => (
              <Link
                key={label}
                to={path}
                data-testid={`scene-detail-btn-${i + 1}`}
                className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-4 py-2 text-xs font-semibold hover:border-[var(--okx-accent)] hover:accent-text sm:text-sm"
              >
                {label} <ExternalLink size={13} />
              </Link>
            ))}
            <span className="num text-[10px] text-zinc-600 sm:text-xs">Data demonstrasi fiktif · pembayaran sandbox</span>
            {!user && (
              <Link to="/juri" data-testid="present-login-hint" className="text-[10px] text-amber-400 underline sm:text-xs">
                Masuk sebagai persona demo agar tombol detail langsung terbuka
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* footer nav */}
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--okx-border)] px-4 py-2.5 sm:px-8">
        <button
          data-testid="present-prev-btn"
          onClick={prev}
          disabled={i === 0}
          className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-4 py-2 text-xs font-semibold disabled:opacity-40 sm:text-sm"
        >
          <ArrowLeft size={14} /> Previous
        </button>
        <div className="flex gap-1.5">
          {scenes.map((_, idx) => (
            <button
              key={idx}
              data-testid={`present-dot-${idx + 1}`}
              onClick={() => setI(idx)}
              aria-label={`Scene ${idx + 1}`}
              className={`h-1.5 w-6 transition-colors sm:w-9 ${idx <= i ? "bg-[var(--okx-accent)]" : "bg-[#27272a]"}`}
            />
          ))}
        </div>
        <button
          data-testid="present-next-btn"
          onClick={next}
          disabled={i === scenes.length - 1}
          className="inline-flex items-center gap-2 bg-[var(--okx-accent)] px-4 py-2 text-xs font-semibold disabled:opacity-40 sm:text-sm"
        >
          Next <ArrowRight size={14} />
        </button>
      </footer>
    </div>
  );
}
