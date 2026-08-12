import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Building2, CircleDollarSign, LineChart, QrCode, Store, Ticket, Users, Workflow } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, compact, num, DEMO_EVENT_ID } from "@/lib/api";

const HERO = "https://images.unsplash.com/photo-1780703913917-c605a6f260d1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwyfHxtYXNzaXZlJTIwY29uY2VydCUyMGNyb3dkJTIwY2luZW1hdGljfGVufDB8fHx8MTc4NjUyMzE4N3ww&ixlib=rb-4.1.0&q=85";

const GRAPH_PREVIEW = [
  { label: "Event", kind: "Event", status: "Confirmed", x: 50, y: 8 },
  { label: "Talent + Rider", kind: "Talent", status: "Confirmed", x: 12, y: 30 },
  { label: "Venue", kind: "Venue", status: "Confirmed", x: 50, y: 34 },
  { label: "Vendors", kind: "Vendor", status: "Pending", x: 88, y: 30 },
  { label: "Sponsors", kind: "Sponsor", status: "Pending", x: 8, y: 64 },
  { label: "Tenants", kind: "Tenant", status: "Confirmed", x: 34, y: 74 },
  { label: "Workforce", kind: "Worker", status: "At Risk", x: 66, y: 74 },
  { label: "Ticketing", kind: "Ticket", status: "Confirmed", x: 92, y: 64 },
  { label: "Budget & Funding Gap", kind: "Budget", status: "At Risk", x: 50, y: 94 },
];
const EDGES = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [2, 3], [0, 8], [4, 8], [5, 8], [7, 8]];
const DOT = { Confirmed: "#10b981", Pending: "#f59e0b", "At Risk": "#ff4500" };

function GraphPreview() {
  const [active, setActive] = useState(0);
  return (
    <div className="relative h-[420px] w-full overflow-hidden border border-[var(--okx-border)] bg-[#0d0d0d] sm:h-[460px]">
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={GRAPH_PREVIEW[a].x}
            y1={GRAPH_PREVIEW[a].y}
            x2={GRAPH_PREVIEW[b].x}
            y2={GRAPH_PREVIEW[b].y}
            stroke={active === a || active === b ? "#ff4500" : "#27272a"}
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {GRAPH_PREVIEW.map((n, i) => (
        <button
          key={n.label}
          data-testid={`graph-preview-node-${i}`}
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
          onClick={() => setActive(i)}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border px-2.5 py-1.5 text-[11px] font-medium transition-all sm:text-xs ${
            active === i
              ? "border-[var(--okx-accent)] bg-[var(--okx-accent)] text-white"
              : "border-[var(--okx-border)] bg-[var(--okx-surface)] text-zinc-300"
          }`}
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: DOT[n.status] }} />
          {n.label}
        </button>
      ))}
      <div className="absolute bottom-3 left-3 border border-[var(--okx-border)] bg-[#0a0a0aee] px-3 py-2 text-[11px] text-zinc-400">
        Event Graph — satu Event ID menghubungkan seluruh komponen.
      </div>
    </div>
  );
}

const PARTICIPANTS = [
  "Penyelenggara", "Brand", "Promotor", "Event Organizer", "Artis", "Talent Management", "Pembicara",
  "Host & MC", "Venue", "Vendor Produksi", "Sponsor", "Tenant", "Exhibitor", "Pekerja & Freelancer",
  "Hotel", "Transportasi", "Logistik", "Media Partner", "Pembeli Tiket", "Finance Approver",
];

export default function Landing() {
  const [ripple, setRipple] = useState(null);
  useEffect(() => {
    api.get(`/events/${DEMO_EVENT_ID}/ripple`).then(({ data }) => setRipple(data.metrics)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />

      <section className="relative overflow-hidden border-b border-[var(--okx-border)]">
        <img src={HERO} alt="Panggung dan penonton festival" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0add] to-[#0a0a0a99]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="max-w-3xl fade-up">
            <span className="inline-block border border-[var(--okx-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] accent-text">
              Event Economy Operating Network
            </span>
            <h1 className="editorial mt-6 text-4xl leading-[1.02] sm:text-5xl lg:text-7xl">
              One event.
              <br />
              <span className="accent-text">Every moving part.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base text-zinc-300 sm:text-lg">
              OKKAX mengubah satu brief event menjadi jaringan terhubung yang mencakup talent, venue, vendor,
              sponsor, tenant, pekerja, ticketing, pembayaran, operasi, dan dampak ekonomi.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                data-testid="hero-compile-btn"
                className="group inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--okx-accent-hover)]"
              >
                Compile an Event
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/discover"
                data-testid="hero-explore-btn"
                className="inline-flex items-center justify-center border border-[var(--okx-border)] bg-[var(--okx-surface)] px-6 py-3.5 text-sm font-semibold text-white hover:border-zinc-500"
              >
                Explore Events
              </Link>
              <Link
                to={`/juri`}
                data-testid="hero-juri-btn"
                className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold text-zinc-300 underline decoration-[var(--okx-accent)] decoration-2 underline-offset-4 hover:text-white"
              >
                Demo untuk Juri — 3 menit
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              From event idea to live economy. Mode demo kompetisi — pembayaran sandbox, tanpa uang nyata.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">
              Event Graph
            </h2>
            <p className="editorial mt-3 text-3xl sm:text-4xl">Setiap keputusan punya konsekuensi.</p>
            <p className="mt-4 max-w-xl text-sm text-zinc-400 sm:text-base">
              Memilih artis mengaktifkan rider, akomodasi, penerbangan, transportasi, keamanan, dan kebutuhan
              produksi. Mengubah venue mengubah kapasitas tiket, nilai sponsor, jumlah tenant, tenaga kerja, dan
              break-even. Menambah sponsor mengurangi funding gap. OKKAX menghubungkan seluruh dependensi itu
              pada satu Event ID.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                ["Percakapan WhatsApp & spreadsheet terpisah", "Satu Event Graph dengan status per node"],
                ["Rider artis berupa PDF", "Structured Rider Engine dengan compatibility"],
                ["Rekonsiliasi manual", "Payment object, milestone, dan simulated settlement"],
              ].map(([a, b]) => (
                <li key={a} className="grid gap-1 border-l-2 border-[var(--okx-accent)] pl-4 sm:grid-cols-2 sm:gap-6">
                  <span className="text-sm text-zinc-500 line-through">{a}</span>
                  <span className="text-sm font-medium text-white">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <GraphPreview />
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">
            Cara Event Compiler bekerja
          </h2>
          <div className="mt-8 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Workflow, "Brief", "Guided Event Brief menangkap tujuan, kapasitas, anggaran, dan kebutuhan."],
              [Boxes, "AI Blueprint", "AI Event Compiler menyusun fase, workstream, requirement, dan risiko. Semua dapat diedit."],
              [Building2, "Network Match", "Talent, rider, venue, vendor, dan workforce dicocokkan dengan penjelasan skor."],
              [CircleDollarSign, "Live Economy", "Sponsor, tenant, tiket, pembayaran, settlement, dan dampak ekonomi diperbarui otomatis."],
            ].map(([Icon, title, body], i) => (
              <div key={title} className="bg-[var(--okx-surface)] p-6 sm:p-8">
                <Icon size={20} className="accent-text" />
                <div className="mt-4 text-xs text-zinc-500">Langkah {i + 1}</div>
                <h3 className="mt-1 text-base font-semibold md:text-lg">{title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] bg-[var(--okx-ivory)] px-4 py-16 text-[#0a0a0a] sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-600 md:text-lg">
                Network participants
              </h2>
              <p className="editorial mt-3 text-3xl sm:text-4xl">Satu jaringan. Semua pihak.</p>
            </div>
            <Link to="/register" className="text-sm font-semibold underline decoration-2 underline-offset-4">
              Gabung sebagai peran Anda
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {PARTICIPANTS.map((p) => (
              <span key={p} className="border border-[#0a0a0a22] bg-white px-3 py-1.5 text-sm">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] md:grid-cols-3">
          {[
            [Users, "Sponsor Exchange", "Sponsor menemukan event, melihat inventory, mengajukan minat, dan komitmen yang disetujui langsung mengurangi funding gap."],
            [Store, "Tenant Exchange", "Zona tenant, booth dengan kode dan harga, aplikasi, approval, dan pendapatan booth masuk ke funding event."],
            [Ticket, "Ticketing & Payment", "Ticket tier, checkout sandbox dengan VA, QRIS, e-wallet, kartu, dan retail. QR ticket unik dengan validator."],
          ].map(([Icon, title, body]) => (
            <div key={title} className="bg-[var(--okx-surface)] p-6 sm:p-8">
              <Icon size={20} className="accent-text" />
              <h3 className="mt-4 text-base font-semibold md:text-lg">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <LineChart size={18} className="accent-text" />
            <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">
              Economic Ripple — dihitung dari data event
            </h2>
          </div>
          <div className="mt-8 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Economic Activity", ripple ? compact(ripple.total_economic_activity) : "—"],
              ["Businesses Activated", ripple ? num(ripple.businesses_activated) : "—"],
              ["Workers Engaged", ripple ? num(ripple.workers) : "—"],
              ["Hotel Room Nights", ripple ? num(ripple.hotel_room_nights) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--okx-surface)] p-6">
                <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
                <div className="num mt-2 text-2xl font-bold sm:text-3xl">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Data fiktif untuk demonstrasi kompetisi, dihitung dari event demo Aruna Bold Live Experience 2026.
          </p>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 border border-[var(--okx-accent)] bg-[#140700] p-8 sm:p-14">
          <QrCode size={22} className="accent-text" />
          <h2 className="editorial text-3xl sm:text-5xl">From event idea to live economy.</h2>
          <p className="max-w-2xl text-sm text-zinc-300 sm:text-base">
            Jalankan demo terpandu 16 langkah: brief, blueprint, event graph, talent & rider, venue, vendor,
            budget, sponsor, tenant, tiket, publish, sandbox payment, QR ticket, validasi, hingga Economic Ripple.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/juri" data-testid="cta-juri-btn" className="bg-[var(--okx-accent)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]">
              Demo untuk Juri
            </Link>
            <Link to="/demo" data-testid="cta-demo-btn" className="border border-[var(--okx-border)] px-6 py-3.5 text-sm font-semibold hover:border-zinc-500">
              Mulai Demo Terpandu
            </Link>
            <Link to="/discover" data-testid="cta-discover-btn" className="border border-[var(--okx-border)] px-6 py-3.5 text-sm font-semibold hover:border-zinc-500">
              Explore Events
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
