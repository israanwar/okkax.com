import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Boxes, Building2, CircleDollarSign, LineChart, QrCode, Store, Ticket, Users, Workflow } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import { NodeIcon, colorOf as PREVIEW_COLOR } from "@/pages/workspace/BlueprintGraph";

const HERO = "https://images.unsplash.com/photo-1780703913917-c605a6f260d1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwyfHxtYXNzaXZlJTIwY29uY2VydCUyMGNyb3dkJTIwY2luZW1hdGljfGVufDB8fHx8MTc4NjUyMzE4N3ww&ixlib=rb-4.1.0&q=85";

const DOT = { Confirmed: "#ffffff", Pending: "#ff7ab0", "At Risk": "#ff2e7e" };
const PREVIEW_TONE = { get: (k) => PREVIEW_COLOR(k) };

const PREVIEW_NODES = [
  { id: "organizer", label: "Organizer", kind: "Organizer", status: "Confirmed" },
  { id: "venue", label: "Venue", kind: "Venue", status: "Confirmed" },
  { id: "talent", label: "Talent + Rider", kind: "Talent", status: "Confirmed" },
  { id: "vendor", label: "Vendors", kind: "Vendor", status: "Pending" },
  { id: "sponsor", label: "Sponsors", kind: "Sponsor", status: "Pending" },
  { id: "tenant", label: "Tenants", kind: "Tenant", status: "Confirmed" },
  { id: "worker", label: "Workforce", kind: "Worker", status: "At Risk" },
  { id: "ticket", label: "Ticketing", kind: "Ticket tier", status: "Confirmed" },
  { id: "budget", label: "Budget & Funding Gap", kind: "Budget", status: "At Risk" },
];
const PREVIEW_EDGES = [
  ["event", "organizer", "diselenggarakan"], ["event", "venue", "venue"], ["event", "talent", "talent"],
  ["event", "vendor", "vendor"], ["event", "sponsor", "sponsor"], ["event", "tenant", "tenant"],
  ["event", "worker", "workforce"], ["event", "ticket", "ticketing"], ["event", "budget", "budget"],
  ["venue", "vendor", "kebutuhan produksi"], ["sponsor", "budget", "menutup gap"],
  ["ticket", "budget", "pendapatan"], ["tenant", "budget", "pendapatan"],
];
const PW = 640, PH = 560, PCX = 320, PCY = 280;

function GraphPreview() {
  const [active, setActive] = useState("event");
  const nodes = useMemo(() => {
    const N = PREVIEW_NODES.length;
    const out = { event: { x: PCX, y: PCY, a: 0, node: { id: "event", label: "Event", kind: "Event", status: "Confirmed" } } };
    PREVIEW_NODES.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      out[n.id] = { x: PCX + Math.cos(a) * 208, y: PCY + Math.sin(a) * 186, a, node: n };
    });
    return out;
  }, []);
  const linked = new Set(
    PREVIEW_EDGES.filter(([s, t]) => s === active || t === active).flatMap(([s, t]) => [s, t])
  );

  return (
    <div className="relative overflow-hidden border border-[var(--okx-border)] bg-[#080808]" data-testid="graph-preview">
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(#ffffff22 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <svg viewBox={`0 0 ${PW} ${PH}`} className="relative block w-full">
        <defs>
          <radialGradient id="previewCore">
            <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#ff2e7e" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ff2e7e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={PCX} cy={PCY} r={250} fill="url(#previewCore)" pointerEvents="none" />
        <ellipse cx={PCX} cy={PCY} rx={208} ry={186} fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="3 9" pointerEvents="none" />

        {PREVIEW_EDGES.map(([s, t], i) => {
          const a = nodes[s], b = nodes[t];
          const radial = s === "event" || t === "event";
          const on = s === active || t === active;
          const d = radial
            ? `M${a.x},${a.y} L${b.x},${b.y}`
            : `M${a.x},${a.y} Q${(a.x + b.x) / 2 + (PCX - (a.x + b.x) / 2) * 0.4},${(a.y + b.y) / 2 + (PCY - (a.y + b.y) / 2) * 0.4} ${b.x},${b.y}`;
          return (
            <g key={i} pointerEvents="none">
              <path d={d} fill="none" stroke={on ? "#ff2e7e" : "#ffffff"} strokeWidth={on ? 1.5 : 0.7}
                strokeOpacity={on ? 0.85 : 0.11}
                style={{ transition: "stroke-opacity .3s ease, stroke .3s ease, stroke-width .3s ease" }} />
              <path d={d} fill="none" stroke="#ff2e7e" strokeWidth={on ? 1.9 : 1} strokeOpacity={on ? 0.8 : 0.24}
                strokeDasharray="2 24" strokeLinecap="round">
                <animate attributeName="stroke-dashoffset" from="26" to="0" dur={radial ? "6s" : "8s"} repeatCount="indefinite" />
              </path>
            </g>
          );
        })}

        {Object.entries(nodes).map(([id, p]) => {
          const n = p.node;
          const isCore = id === "event";
          const isActive = active === id;
          const faded = !isActive && !linked.has(id);
          const r = isCore ? 30 : 21;
          const anchor = Math.cos(p.a) > 0.12 ? "start" : Math.cos(p.a) < -0.12 ? "end" : "middle";
          const lx = anchor === "start" ? r + 9 : anchor === "end" ? -(r + 9) : 0;
          const ly = anchor === "middle" ? (Math.sin(p.a) > 0 ? r + 16 : -(r + 12)) : 4;
          return (
            <g key={id} data-testid={`graph-preview-node-${id}`} transform={`translate(${p.x},${p.y})`}
              onMouseEnter={() => setActive(id)} onClick={() => setActive(id)}
              style={{ cursor: "pointer", opacity: faded ? 0.32 : 1, transition: "opacity .3s ease" }}>
              {(isCore || isActive) && (
                <circle r={r + 7} fill="none" stroke={isCore ? "#ff7ab0" : "#ffffff"} strokeOpacity="0.4">
                  <animate attributeName="r" values={`${r + 4};${r + 15};${r + 4}`} dur={isCore ? "4s" : "3s"} repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.45;0;0.45" dur={isCore ? "4s" : "3s"} repeatCount="indefinite" />
                </circle>
              )}
              <circle r={r} fill={isCore ? "#ff2e7e" : "#0f0f11"} stroke={isCore ? "#ffffff" : PREVIEW_TONE.get(n.kind)}
                strokeOpacity={isCore ? 0.85 : isActive ? 1 : 0.55} strokeWidth={isCore || isActive ? 2 : 1.2}
                style={{ transition: "stroke-opacity .25s ease" }} />
              <NodeIcon kind={n.kind} size={isCore ? 20 : 14} color={isCore ? "#0a0a0a" : PREVIEW_TONE.get(n.kind)} />
              {!isCore && (
                <circle cx={r * 0.72} cy={-r * 0.72} r="3.2" fill={DOT[n.status]} stroke="#080808" strokeWidth="1" />
              )}
              <text x={lx} y={ly} textAnchor={anchor} fontSize={isCore ? 12.5 : 11} fontWeight={isCore ? 800 : 600}
                fill={isActive || isCore ? "#ffffff" : "#d4d4d8"}>{n.label}</text>
              {isCore && (
                <text x={lx} y={ly + 12} textAnchor={anchor} fontSize="8.4" letterSpacing="0.12em" fill="#71717a">
                  SATU EVENT ID
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--okx-border)] px-4 py-2.5 text-[11px] text-zinc-500">
        <span>Event Graph — satu Event ID menghubungkan seluruh komponen.</span>
        <span className="flex items-center gap-3">
          {Object.entries(DOT).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: v }} /> {k}
            </span>
          ))}
        </span>
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
