// OKKAX Platform Demo. Canonical public championship experience.
//
// Route: /demo   (alias /juri and /judges redirect here, see App.js)
//
// Design goals honored:
//   - Event Graph is the centerpiece and it is interactive: click, hover, focus.
//   - Intelligence and Resolution are inside the graph experience, not lonely
//     sections floating below it.
//   - Deterministic demo. No backend mutation. No LLM call.
//   - Five phases only: COMPILE, CONNECT, RISK, INTELLIGENCE, RESOLVE.
//   - Mobile-first fallback at compact widths, no horizontal overflow, no
//     long pinned sticky.
//   - Motion 70/20/10: restrained transitions dominate, one wow moment is the
//     graph state propagation on Execute.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  MousePointerClick,
  Play,
  Sparkles,
  Waypoints,
  Zap,
  Store,
  Mic2,
  TrendingUp,
  Workflow,
  ShieldCheck,
  Layers,
  Terminal,
  QrCode,
  Users,
  CheckCircle2,
} from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  MotionPanel,
  Reveal,
  RevealGroup,
  RevealItem,
  MaskReveal,
  ScrollProgressBar,
  SpotlightCard,
  CounterNumber,
} from "@/components/MotionPrimitives";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// =============================================================================
// GRAPH DATA MODEL
// -----------------------------------------------------------------------------
// Nine domain nodes on one Event ID. Coordinates target viewBox 720x720 so the
// graph renders as a comfortable square on both desktop and mobile.
// =============================================================================
// Landscape viewBox 940x720. Extra padding around node cluster (~90 px
// nearest node to any edge) guarantees the graph never clips even if the
// container has extra chrome or an unexpected width. Node radius 52 gives
// comfortable click targets down to 390 mobile without overlapping.
const NODES = [
  { id: "event",        label: "Event",             x: 470, y: 90 },
  { id: "requirements", label: "Requirements",      x: 470, y: 230 },
  { id: "talent",       label: "Talent",            x: 130, y: 360 },
  { id: "vendor",       label: "Vendor",            x: 320, y: 380 },
  { id: "venue",        label: "Venue",             x: 570, y: 360 },
  { id: "workforce",    label: "Workforce",         x: 810, y: 360 },
  { id: "gate",         label: "Gate Operations",   x: 720, y: 520 },
  { id: "access",       label: "Access Readiness",  x: 470, y: 580 },
  { id: "showtime",     label: "Showtime",          x: 470, y: 660 },
];

const EDGES = [
  ["event", "requirements"],
  ["requirements", "talent"],
  ["requirements", "vendor"],
  ["requirements", "venue"],
  ["requirements", "workforce"],
  ["venue", "gate"],
  ["workforce", "gate"],
  ["gate", "access"],
  ["talent", "showtime"],
  ["vendor", "showtime"],
  ["access", "showtime"],
];

// Static per-node context. Populated into the side panel when a node is
// selected. Content is the same across phases so users can inspect any node
// meaningfully. Only status/state changes with phase.
const NODE_DETAIL = {
  event: {
    requirement: "Anchor identity for every downstream node.",
    owner: "Organizer",
    deadline: "24 Aug 2026",
    impact: "Unifies Blueprint, Commerce, Ticketing, and Operations.",
    dependency: [],
    next: "Compile requirements from the brief.",
  },
  requirements: {
    requirement: "42 requirement compiled from brief + venue rules.",
    owner: "Event Compiler",
    deadline: "26 Aug 2026",
    impact: "Drives matching for talent, venue, vendor, workforce.",
    dependency: ["event"],
    next: "Confirm foundations first (venue and talent).",
  },
  talent: {
    requirement: "1 headline + 3 supporting acts, rider verified.",
    owner: "Talent Manager",
    deadline: "27 Aug 2026",
    impact: "Fixes Showtime setlist and hospitality plan.",
    dependency: ["requirements"],
    next: "Sign accepted quote and lock schedule.",
  },
  vendor: {
    requirement: "Lighting, sound, LED, rigging locked to spec.",
    owner: "Production Lead",
    deadline: "28 Aug 2026",
    impact: "Sets Showtime production quality floor.",
    dependency: ["requirements"],
    next: "Approve loading and setup timeline.",
  },
  venue: {
    requirement: "Capacity 5000, curfew 01:00, power 400 kVA.",
    owner: "Venue Partner",
    deadline: "01 Sep 2026",
    impact: "Enables Gate Operations design and Access flow.",
    dependency: ["requirements"],
    next: "Lock loading dock schedule with vendors.",
  },
  workforce: {
    requirement: "58 security personnel required for gate coverage.",
    owner: "Operations Lead",
    deadline: "22 Aug 2026 12:00",
    impact: "Blocks Gate Operations, Access Readiness, Showtime.",
    dependency: ["requirements"],
    next: "Ask Okkax Copilot for the fastest safe fix.",
  },
  gate: {
    requirement: "12 gates, dual-lane, 400 person throughput per gate.",
    owner: "Gate Manager",
    deadline: "23 Aug 2026",
    impact: "Feeds Access Readiness and audience arrival flow.",
    dependency: ["venue", "workforce"],
    next: "Reconcile once workforce assignment is confirmed.",
  },
  access: {
    requirement: "LivePass validators live at all 12 gates.",
    owner: "Access Ops",
    deadline: "23 Aug 2026",
    impact: "Controls Showtime doors-open window.",
    dependency: ["gate"],
    next: "Dry-run scan and replay-denial check.",
  },
  showtime: {
    requirement: "Doors open 18:00, headliner 21:15.",
    owner: "Show Caller",
    deadline: "24 Aug 2026",
    impact: "Represents the entire operational readiness of the event.",
    dependency: ["talent", "vendor", "access"],
    next: "Handover to Operations timeline.",
  },
};

// Five phase definitions. Each phase carries a node-state map and a readiness
// number. Selecting a phase deterministically flips the graph.
const PHASES = [
  {
    id: "compile",
    label: "Compile",
    ordinal: "01",
    readiness: 12,
    intro: "Satu brief menjadi satu Event ID.",
    prompt: "Klik EVENT atau REQUIREMENTS untuk melihat detail.",
    focus: "requirements",
    states: {
      event: "confirmed",
      requirements: "active",
      talent: "idle",
      vendor: "idle",
      venue: "idle",
      workforce: "idle",
      gate: "idle",
      access: "idle",
      showtime: "idle",
    },
  },
  {
    id: "connect",
    label: "Connect",
    ordinal: "02",
    readiness: 46,
    intro: "Requirements memicu matching supply.",
    prompt: "Klik node apa pun untuk membaca requirement, owner, dan deadline.",
    focus: "vendor",
    states: {
      event: "confirmed",
      requirements: "confirmed",
      talent: "confirmed",
      vendor: "active",
      venue: "confirmed",
      workforce: "idle",
      gate: "idle",
      access: "idle",
      showtime: "idle",
    },
  },
  {
    id: "risk",
    label: "Risk",
    ordinal: "03",
    readiness: 51,
    intro: "Workforce mengunci Gate. Ketiadaan menjalar.",
    prompt: "Klik WORKFORCE untuk melihat masalah, lalu Show Dependency.",
    focus: "workforce",
    blocker: "workforce",
    states: {
      event: "confirmed",
      requirements: "confirmed",
      talent: "confirmed",
      vendor: "confirmed",
      venue: "confirmed",
      workforce: "blocked",
      gate: "risk",
      access: "risk",
      showtime: "risk",
    },
  },
  {
    id: "intelligence",
    label: "Copilot",
    ordinal: "04",
    readiness: 55,
    intro: "Okkax Copilot menjelaskan sebab dan menyiapkan action.",
    prompt: "Baca rekomendasi. Klik Execute untuk mengubah graph.",
    focus: "workforce",
    blocker: "workforce",
    highlightPath: ["workforce", "gate", "access", "showtime"],
    states: {
      event: "confirmed",
      requirements: "confirmed",
      talent: "confirmed",
      vendor: "confirmed",
      venue: "confirmed",
      workforce: "blocked",
      gate: "risk",
      access: "risk",
      showtime: "risk",
    },
  },
  {
    id: "resolve",
    label: "Resolve",
    ordinal: "05",
    readiness: 92,
    intro: "State propagation nyata. Satu action mengubah rantai.",
    prompt: "Lihat jalur pulih: Workforce ke Gate ke Access ke Showtime.",
    focus: "showtime",
    highlightPath: ["workforce", "gate", "access", "showtime"],
    states: {
      event: "confirmed",
      requirements: "confirmed",
      talent: "confirmed",
      vendor: "confirmed",
      venue: "confirmed",
      workforce: "confirmed",
      gate: "confirmed",
      access: "confirmed",
      showtime: "confirmed",
    },
  },
];

// Intelligence output. Deterministic. Reads the risk phase blocker and returns
// a fully explained recommendation with an Execute button.
const INTELLIGENCE = {
  issue: "Gate Operations at risk. Workforce security 18 posisi kosong.",
  evidence: "Requirement Workforce 58 posisi, terisi 40. Main Gate 22 Aug 12:00.",
  dependencyPath: ["Workforce", "Gate Operations", "Access Readiness", "Showtime"],
  impact: "Rencana staffing saat ini tidak memenuhi minimum gate coverage.",
  recommendation:
    "Broadcast requirement ke security workforce verified di Jakarta dan Sulawesi, prioritaskan kandidat available sebelum 22 Aug 12:00.",
  expected:
    "Gate Operations pulih dari BLOCKED ke READY setelah assignment dikonfirmasi.",
};

// -----------------------------------------------------------------------------
// Node style tokens by state. Kept flat so state changes are one lookup.
// -----------------------------------------------------------------------------
const STATE_STYLE = {
  idle:      { stroke: "rgba(244,239,236,0.22)", text: "rgba(228,228,231,0.55)", chipCls: "border-white/[0.08] text-zinc-500" },
  active:    { stroke: "rgba(244,239,236,0.65)", text: "#f4efec",               chipCls: "border-white/20 text-zinc-300" },
  confirmed: { stroke: "#ffffff",                 text: "#ffffff",               chipCls: "border-white/40 text-white font-bold" },
  risk:      { stroke: "rgba(255,255,255,0.7)",   text: "#d4d4d8",               chipCls: "border-dashed border-white/30 text-zinc-300" },
  blocked:   { stroke: "#ffffff",                 text: "#ffffff",               chipCls: "border-white/60 text-white font-bold" },
};

const STATE_LABEL = {
  idle: "Idle",
  active: "In progress",
  confirmed: "Confirmed",
  risk: "At risk",
  blocked: "Blocked",
};

// =============================================================================
// PAGE
// =============================================================================
export default function Demo() {
  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <style>{`
        @keyframes okxBlockedPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 0.25; }
        }
        @keyframes okxEdgeFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        .okx-node-blocked-ring {
          animation: okxBlockedPulse 1.9s ease-in-out infinite;
          pointer-events: none;
        }
        .okx-edge-active {
          stroke-dasharray: 6 6;
          animation: okxEdgeFlow 1.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .okx-node-blocked-ring { opacity: 0.6; animation: none; }
          .okx-edge-active { animation: none; }
        }
        .okx-node-hit { cursor: pointer; }
        .okx-node-hit:focus { outline: none; }
        .okx-node-hit:focus > circle[data-role="body"] { stroke: var(--okx-accent); stroke-width: 2; }
      `}</style>
      <ScrollProgressBar />
      <PublicNav />
      <main data-testid="demo-page" className="overflow-hidden">
        <Hero />
        <PersonaLensSection />
        <OneEventStrip />
        <GraphExperience />
        <OperatingJourney />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

// =============================================================================
// 01  HERO
// =============================================================================
function Hero() {
  return (
    <section
      aria-labelledby="demo-hero-heading"
      data-testid="demo-hero"
      className="relative border-b border-white/[0.06] px-4 pt-12 pb-12 sm:px-6 sm:pt-16 sm:pb-16 font-gemini"
    >
      <StageAmbience />
      <div className="relative mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md">
          <Sparkles size={13} className="text-zinc-400" aria-hidden="true" />
          <span>Platform Demo</span>
        </div>
        <h1
          id="demo-hero-heading"
          className="editorial mt-5 max-w-4xl text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[0.95] text-[#f4efec]"
        >
          Industri event tidak kekurangan pihak.
          <br />
          <span className="text-white font-bold">Yang hilang adalah satu sistem.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
          OKKAX menggabungkan brief, jaringan, jadwal, kontrak, ticketing, operasi, dan keuangan pada satu Event ID. Coba interaksinya di Event Graph di bawah.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#demo-graph"
            data-testid="demo-hero-cta-primary"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 px-6 py-4 text-sm font-bold text-black transition-all shadow-[0_4px_24px_rgba(255,255,255,0.15)] active:scale-[0.98]"
          >
            <Play size={15} aria-hidden="true" /> Mulai Demo
          </a>
          <a
            href="#demo-graph"
            data-testid="demo-hero-cta-secondary"
            className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.15] bg-white/[0.04] px-6 py-4 text-sm font-semibold text-zinc-100 hover:border-white/[0.3] hover:bg-white/[0.08] transition-all"
          >
            Lihat Event Graph
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 01.5  PERSONA LENS SWITCHER (Point of View 6 Roles + OKKAX Event Copilot)
// =============================================================================
const PERSONA_LENSES = {
  organizer: {
    id: "organizer",
    role: "Organizer",
    badge: "Pusat Kompilasi Event",
    icon: Workflow,
    tagline: "Kompilasi brief menjadi blueprint operasional tanpa kehilangan detail.",
    pain: "Data tersebar di puluhan grup WhatsApp, spreadsheet terpisah, dan risiko dependensi tersembunyi hingga hari H.",
    solution: "Event Studio mengompilasi brief, memetakan Event Graph, dan mengunci seluruh dependensi vendor & talent dalam satu Event ID.",
    copilotPrompt: "Deteksi blocker kritis di Event Graph konser 5.000 pax",
    copilotOutput: "OKKAX Copilot mendeteksi 12 personil sekuriti belum terpenuhi di node Workforce. Mengusulkan alokasi vendor cadangan terverifikasi dalam 3 menit.",
    highlightNodes: ["event", "requirements", "workforce", "gate"],
    dashboardPath: "/app",
    linkLabel: "Buka Dashboard Organizer",
  },
  promotor: {
    id: "promotor",
    role: "Promotor",
    badge: "Yield & Multi-City Portfolio",
    icon: TrendingUp,
    tagline: "Kendali penuh atas portfolio event, kuota tiket dinamis, dan arus kas escrow.",
    pain: "Ketidakpastian likuiditas, lambatnya pencairan tiket pihak ketiga, dan risiko pembatalan sepihak tanpa proteksi.",
    solution: "Protected Payment dengan milestone escrow (DP, Soundcheck, Showtime) + telemetri penjualan tiket real-time lintas kota.",
    copilotPrompt: "Hitung proyeksi break-even dan optimasi tier tiket VIP",
    copilotOutput: "OKKAX Copilot menghitung break-even point tercapai pada 68% kapasitas (3.400 tiket). Menyarankan rilis 200 kursi tambahan di tier Early Bird.",
    highlightNodes: ["event", "access", "showtime"],
    dashboardPath: "/app/events",
    linkLabel: "Buka Dashboard Promotor",
  },
  sponsor: {
    id: "sponsor",
    role: "Sponsor",
    badge: "Aktivasi Brand & ROI Terukur",
    icon: Sparkles,
    tagline: "Pilih inventori aktivasi brand yang transparan dengan data impresi riil.",
    pain: "Ketiadaan kepastian penempatan logo, laporan ROI yang lambat, dan tumpang tindih hak aktivasi antar brand kompetitor.",
    solution: "Sponsor Inventory Marketplace terverifikasi dengan SLA kontrak otomatis dan metrik eksposur audiens terverifikasi.",
    copilotPrompt: "Valuasi paket Presenting Sponsor & estimasi audiens engagement",
    copilotOutput: "OKKAX Copilot memproyeksikan 18.500 impresi langsung dan 4 aktivasi booth interaktif. Nilai paket rekomendasi: Rp 350 Juta.",
    highlightNodes: ["event", "requirements", "vendor"],
    dashboardPath: "/app/sponsor",
    linkLabel: "Buka Portal Sponsor",
  },
  tenant: {
    id: "tenant",
    role: "Tenant",
    badge: "F&B / Merchandise Zone",
    icon: Store,
    tagline: "Klaim booth strategis, pantau traffic penonton, dan terima settlement instan.",
    pain: "Lokasi booth tidak sesuai denah, daya listrik bermasalah, dan pencairan bagi hasil tertahan berminggu-minggu.",
    solution: "Peta zona tenant presisi dengan kepastian pasokan listrik + QRIS Settlement otomatis setiap shift berakhir.",
    copilotPrompt: "Rekomendasi kebutuhan daya listrik dan estimasi transaksi F&B",
    copilotOutput: "OKKAX Copilot merekomendasikan alokasi 16A/220V per booth di Zona A dengan estimasi transaksi 450 cup/jam pada jam istirahat 19:30-20:30.",
    highlightNodes: ["venue", "gate", "showtime"],
    dashboardPath: "/app/tenant",
    linkLabel: "Buka Portal Tenant",
  },
  audience: {
    id: "audience",
    role: "Audience",
    badge: "LivePass Access & Anti-Calo",
    icon: QrCode,
    tagline: "Tiket dinamis tanpa calo, pintu masuk cepat tanpa antrean macet.",
    pain: "Tiket palsu dari calo, screenshot ganda, dan antrean gate berjam-jam karena server tiket konvensional down.",
    solution: "LivePass Dynamic QR berputar tiap 15 detik (anti-screenshot) dengan gate validator offline-first berkecepatan <200ms.",
    copilotPrompt: "Jelaskan cara kerja validasi gate offline LivePass",
    copilotOutput: "OKKAX Copilot: LivePass menggunakan enkripsi kriptografis lokal sehingga scanner gate tetap dapat memvalidasi QR tiket meski sinyal internet di venue mati total.",
    highlightNodes: ["gate", "access", "showtime"],
    dashboardPath: "/app/tickets",
    linkLabel: "Buka Dashboard Tiket (Audience)",
  },
  talent: {
    id: "talent",
    role: "Talent",
    badge: "Rider & Production Compliance",
    icon: Mic2,
    tagline: "Rider teknis terkunci, jadwal soundcheck terjamin, honor aman di escrow.",
    pain: "Rider sound/lighting diabaikan di venue, jadwal panggung molor berjam-jam, dan honor terlambat dibayar penyelenggara.",
    solution: "Compatibility check rider otomatis terhadap spesifikasi venue + pencairan termin terjamin sebelum naik panggung.",
    copilotPrompt: "Periksa kompatibilitas Technical Rider audio 400 kVA dengan venue",
    copilotOutput: "OKKAX Copilot mengonfirmasi daya venue 400 kVA dan sistem line-array D&B 100% kompatibel dengan rider talent utama.",
    highlightNodes: ["talent", "vendor", "showtime"],
    dashboardPath: "/app/me",
    linkLabel: "Buka Dashboard Talent",
  },
  vendor: {
    id: "vendor",
    role: "Vendor",
    badge: "Produksi & Rigging Specs",
    icon: Zap,
    tagline: "Kunci spesifikasi teknis sound, lighting, dan rigging dengan jadwal load-in presisi.",
    pain: "Perubahan spektrum audio/lighting mendadak di venue, jadwal loading molor, dan termin pelunasan produksi tersendat.",
    solution: "Validasi spek teknis panggung otomatis + milestone escrow produksi terjamin (DP, Loading, Show).",
    copilotPrompt: "Validasi kebutuhan sound system Line Array 24-box dan daya genset 250 kVA",
    copilotOutput: "OKKAX Copilot mengonfirmasi kapasitas rigging panggung utama mampu menahan beban 8.5 ton dan genset 250 kVA mencukupi 108 dB SPL di FOH.",
    highlightNodes: ["vendor", "venue", "showtime"],
    dashboardPath: "/app/me",
    linkLabel: "Buka Dashboard Vendor",
  },
  workforce: {
    id: "workforce",
    role: "Workforce",
    badge: "Crew & Field Operations",
    icon: Users,
    tagline: "Manajemen shift kru panggung, usher, security perimeter, dan tim medis darurat.",
    pain: "Ketiadaan briefing tugas terpadu, absensi kru tercecer, dan pembayaran honor harian kru terlambat.",
    solution: "Penugasan shift digital terverifikasi QR + pencairan honor kru harian otomatis berbasis attendance verified.",
    copilotPrompt: "Hitung rasio kebutuhan usher dan security untuk kapasitas 5.000 pax",
    copilotOutput: "OKKAX Copilot menghitung kebutuhan standar industri: 62 Usher (rasio 1:80), 50 Security (rasio 1:100), dan 2 Pos Medis ALS standby.",
    highlightNodes: ["workforce", "gate", "showtime"],
    dashboardPath: "/app/me",
    linkLabel: "Buka Dashboard Workforce",
  },
};

function PersonaLensSection() {
  const [activeKey, setActiveKey] = useState("organizer");
  const [loggingIn, setLoggingIn] = useState(false);
  const { user, adoptSession } = useAuth();
  const nav = useNavigate();
  const p = PERSONA_LENSES[activeKey];
  const Icon = p.icon;

  const scrollToGraph = (e) => {
    e.preventDefault();
    const el = document.getElementById("demo-graph");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleOpenDashboard = async (persona) => {
    if (user) {
      nav(persona.dashboardPath);
      return;
    }
    setLoggingIn(true);
    try {
      const { data } = await api.post("/demo/persona-login", { label: persona.id });
      if (data?.token) {
        await adoptSession(data.token);
        toast.success(`Masuk langsung ke Dashboard ${persona.role}`);
      }
      nav(persona.dashboardPath);
    } catch {
      nav(persona.dashboardPath);
    } finally {
      setLoggingIn(false);
    }
  };
  return (
    <section
      id="demo-persona-lens"
      aria-label="Kacamata Persona dan OKKAX Copilot"
      className="relative border-b border-white/[0.06] bg-[#07070a] px-4 py-16 sm:px-6 sm:py-24 overflow-hidden font-gemini"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[radial-gradient(ellipse_at_top,rgba(255,46,126,0.12),transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-[radial-gradient(circle,rgba(255,46,126,0.05),transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md">
              <Sparkles size={13} className="text-zinc-400" />
              <span>Multi-Role Operating System</span>
            </div>
            <span className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-white/20 to-transparent" aria-hidden="true" />
          </div>

          <h2 className="editorial mt-5 text-3xl sm:text-5xl lg:text-[52px] leading-[1.04] text-[#fbfaf8] tracking-tight">
            Satu ekosistem live.<br />
            <span className="text-white font-bold">8 kacamata peran tanpa kompromi.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-400">
            Setiap stakeholder memegang kunci operasionalnya masing-masing. Pilih peran di bawah untuk melihat bagaimana
            OKKAX dan OKKAX Copilot menyelesaikan friksi industri secara terukur.
          </p>
        </Reveal>

        {/* 8-Role Segmented Audio Ribbon / Dock */}
        <div className="mt-10 p-1.5 rounded-2xl border border-white/[0.08] bg-[#0e0e13]/90 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1">
            {Object.values(PERSONA_LENSES).map((item) => {
              const ItemIcon = item.icon;
              const isActive = item.id === activeKey;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveKey(item.id)}
                  data-testid={`persona-btn-${item.id}`}
                  className={`group relative flex items-center justify-center gap-2 rounded-xl py-3 px-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-[#181822] text-white border border-white/[0.14] shadow-[0_4px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
                  }`}
                >
                  <ItemIcon
                    size={14}
                    className={`transition-colors shrink-0 ${
                      isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  />
                  <span className="truncate">{item.role}</span>
                  {isActive && (
                    <span className="absolute bottom-1 h-1 w-5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Persona Lens Studio Console */}
        <MotionPanel activeKey={activeKey} className="mt-6">
          <div className="relative rounded-3xl border border-white/[0.1] bg-[#0a0a0f]/95 p-6 sm:p-8 lg:p-10 backdrop-blur-3xl shadow-[0_32px_96px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden">
            {/* Top Subtle Light Streak */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-8">
              {/* Header: Title + Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.07]">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.12] text-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    <Icon size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                        Kacamata Peran
                      </span>
                      <span className="h-1 w-1 rounded-full bg-zinc-600" />
                      <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                        {p.badge}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {p.role} Architecture
                    </h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-400 sm:text-right max-w-md leading-relaxed">
                  {p.tagline}
                </p>
              </div>

              {/* Bento Comparison: Friction vs Deterministic Resolution */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Legacy Card */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e14]/80 p-5 sm:p-6 transition-all hover:border-white/[0.12] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                        Tantangan Konvensional
                      </span>
                      <span className="text-[10px] text-zinc-400 font-gemini-mono">Legacy</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-300 font-normal">
                      {p.pain}
                    </p>
                  </div>
                </div>

                {/* OKKAX Architecture Card */}
                <div className="rounded-2xl border border-white/[0.12] bg-[#111118]/90 p-5 sm:p-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200 font-gemini-mono flex items-center gap-1.5">
                        <Sparkles size={11} className="text-zinc-300" />
                        Solusi Terintegrasi OKKAX
                      </span>
                      <span className="text-[10px] text-zinc-300 font-gemini-mono bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.1]">
                        Verified SLA
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-100 font-medium">
                      {p.solution}
                    </p>
                  </div>
                </div>
              </div>

              {/* OKKAX Event Copilot Command Console */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#07070b] p-5 sm:p-6 shadow-inner">
                <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.08] text-zinc-200">
                      <Terminal size={12} />
                    </div>
                    <span className="text-xs font-bold text-zinc-200 font-gemini">
                      OKKAX Event Copilot · Live Operational Inference
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-gemini-mono text-[10px]">
                    <div className="flex items-center gap-1 text-white bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      <span>Ready</span>
                    </div>
                  </div>
                </div>

                {/* Prompt Query Line */}
                <div className="rounded-xl border border-white/[0.06] bg-[#0e0e16] px-3.5 py-2.5 font-gemini-mono text-xs text-zinc-300 flex items-center gap-2">
                  <span className="text-zinc-400 font-bold">❯</span>
                  <span className="truncate">{p.copilotPrompt}</span>
                </div>

                {/* Copilot Response Output */}
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/[0.04] bg-[#0b0b10] p-4 text-xs sm:text-sm leading-relaxed text-zinc-200">
                  <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] mt-1.5 shrink-0" />
                  <span className="font-normal">{p.copilotOutput}</span>
                </div>
              </div>

              {/* Bottom Command Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="#demo-graph"
                    onClick={scrollToGraph}
                    data-testid={`persona-graph-cta-${p.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-5 py-3.5 text-xs sm:text-sm font-bold transition-all shadow-[0_4px_24px_rgba(255,255,255,0.15)] active:scale-[0.98]"
                  >
                    <Waypoints size={15} />
                    <span>Uji Coba di Event Graph</span>
                    <ArrowDown size={14} />
                  </a>

                  <Link
                    to={`/okkax?persona=${p.id}&prompt=${encodeURIComponent(p.copilotPrompt)}`}
                    data-testid={`persona-copilot-cta-${p.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3.5 text-xs sm:text-sm font-semibold text-zinc-200 hover:border-white/[0.25] hover:bg-white/[0.08] hover:text-white transition-all active:scale-[0.98]"
                  >
                    <Layers size={14} className="text-zinc-400" />
                    <span>Buka OKKAX Copilot ({p.role})</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenDashboard(p)}
                  disabled={loggingIn}
                  data-testid={`persona-dashboard-cta-${p.id}`}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors group cursor-pointer"
                >
                  <span className="underline decoration-zinc-600 underline-offset-4 group-hover:decoration-white">
                    {loggingIn ? "Membuka Dashboard..." : p.linkLabel}
                  </span>
                  <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
                </button>
              </div>
            </div>
          </div>
        </MotionPanel>
      </div>
    </section>
  );
}

function StageAmbience() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-40 -top-32 h-[520px] w-[520px] opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,46,126,0.55), transparent 65%)" }}
      />
      <div
        className="absolute -right-40 top-40 h-[420px] w-[420px] opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(244,239,236,0.35), transparent 65%)" }}
      />
    </div>
  );
}

// =============================================================================
// 02  ONE EVENT ID (compact strip)
// =============================================================================
const ECOSYSTEM = [
  "Organizer", "Talent", "Venue", "Vendor", "Workforce", "Sponsor",
  "Tenant", "Ticketing", "Finance", "Compliance", "Operations",
];

function OneEventStrip() {
  return (
    <section
      aria-labelledby="demo-eventid-heading"
      data-testid="demo-eventid"
      className="border-b border-white/[0.06] bg-[#07070a] px-4 py-10 sm:px-6 sm:py-12 font-gemini"
    >
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c11]/80 backdrop-blur-xl p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.5)] flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="rounded-xl border border-white/[0.12] bg-[#14141c] px-4 py-2.5 shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                Event ID
              </div>
              <div className="mt-0.5 font-gemini-mono text-sm font-semibold text-white">okkax://evt-aruna-2026</div>
            </div>
            <h2 id="demo-eventid-heading" className="text-sm text-zinc-300 sm:text-base font-medium">
              <span className="text-white font-semibold">Sebelas fungsi terhubung</span> bekerja pada <span className="text-white font-bold">satu Event ID</span>.
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Sebelas fungsi terhubung">
            {ECOSYSTEM.map((n) => (
              <span
                key={n}
                className="rounded-lg border border-white/[0.07] bg-[#111116] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 hover:border-white/20 transition-colors"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 03  INTERACTIVE GRAPH EXPERIENCE  (centerpiece)
// -----------------------------------------------------------------------------
// State machine:
//   phase          one of PHASES.id
//   selectedId     currently focused node (null shows phase prompt)
//   pathHighlight  when true, dependency path is drawn on top of edges
//   panelView      'phase-prompt' | 'node' | 'intelligence' | 'resolved'
//
// User interactions that drive the machine:
//   click phase chip     -> set phase + reset panelView
//   click node           -> panelView 'node', select node
//   click Show Dependency (on Workforce)  -> pathHighlight true
//   click Ask Intelligence  -> phase 'intelligence', panelView 'intelligence'
//   click Execute recommendation -> phase 'resolve', panelView 'resolved'
// =============================================================================
function GraphExperience() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pathHighlight, setPathHighlight] = useState(false);
  const [panelView, setPanelView] = useState("phase-prompt");
  const [readiness, setReadiness] = useState(PHASES[0].readiness);
  const [intelUnlocked, setIntelUnlocked] = useState(false);
  const [resolveUnlocked, setResolveUnlocked] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);
  const reducedMotion = useReducedMotion();

  const phase = PHASES[phaseIdx];
  const currentStates = phase.states;
  const activePath =
    pathHighlight || phase.highlightPath ? (phase.highlightPath || ["workforce", "gate", "access", "showtime"]) : null;

  useEffect(() => {
    if (reducedMotion) {
      setReadiness(phase.readiness);
      return;
    }
    const from = readiness;
    const to = phase.readiness;
    if (from === to) return;
    const start = performance.now();
    const dur = 900;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setReadiness(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx, reducedMotion]);

  const gotoPhase = useCallback((newIdx) => {
    setPhaseIdx(newIdx);
    setSelectedId(null);
    setPathHighlight(false);
    setPanelView("phase-prompt");
    setPulseTick((t) => t + 1);
  }, []);

  const handleNodeClick = useCallback((id) => {
    setSelectedId(id);
    setPanelView("node");
  }, []);

  const handleShowDependency = useCallback(() => {
    setPathHighlight(true);
  }, []);

  const handleAskIntelligence = useCallback(() => {
    setIntelUnlocked(true);
    setPhaseIdx(PHASES.findIndex((p) => p.id === "intelligence"));
    setSelectedId("workforce");
    setPathHighlight(true);
    setPanelView("intelligence");
  }, []);

  const handleExecute = useCallback(() => {
    setResolveUnlocked(true);
    setPhaseIdx(PHASES.findIndex((p) => p.id === "resolve"));
    setSelectedId("showtime");
    setPathHighlight(true);
    setPanelView("resolved");
    setPulseTick((t) => t + 1);
    toast.success("Assignment terkirim. Graph diperbarui.");
  }, []);

  const handleReset = useCallback(() => {
    gotoPhase(0);
    setIntelUnlocked(false);
    setResolveUnlocked(false);
  }, [gotoPhase]);

  const selectedNode = selectedId ? NODES.find((n) => n.id === selectedId) : null;

  return (
    <section
      id="demo-graph"
      aria-labelledby="demo-graph-heading"
      data-testid="demo-graph"
      className="border-b border-white/[0.06] bg-[#07070a] px-4 py-14 sm:px-6 sm:py-20 font-gemini"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md">
              <Waypoints size={13} aria-hidden="true" />
              <span>Interactive Graph Engine</span>
            </div>
            <h2 id="demo-graph-heading" className="editorial mt-4 max-w-3xl text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] text-[#f4efec]">
              Bulatan cantik saja tidak cukup. <span className="text-white font-bold">Klik dan jelajahi.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={handleReset}
            data-testid="demo-graph-reset"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:border-white/[0.25] hover:bg-white/[0.08] hover:text-white transition-all active:scale-[0.98]"
          >
            Reset demo
          </button>
        </div>

        <PhaseChips
          activeIdx={phaseIdx}
          intelUnlocked={intelUnlocked}
          resolveUnlocked={resolveUnlocked}
          onSelect={gotoPhase}
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-6">
          {/* Graph canvas */}
          <div
            data-testid="demo-graph-canvas"
            className="relative flex flex-col rounded-3xl border border-white/[0.09] bg-[#09090e]/95 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden"
          >
            <GraphHeader phase={phase} readiness={readiness} />
            <div className="h-[440px] sm:h-[520px] lg:h-[620px]">
              <GraphCanvas
                phase={phase}
                selectedId={selectedId}
                pathHighlight={activePath}
                pulseTick={pulseTick}
                onNodeClick={handleNodeClick}
                onNodeSelectById={handleNodeClick}
                reducedMotion={reducedMotion}
              />
            </div>
            <GraphFooterHint phase={phase} panelView={panelView} currentStates={currentStates} onNodeSelectById={handleNodeClick} />
          </div>

          {/* Side panel */}
          <div
            role="region"
            aria-label="Detail panel"
            data-testid="demo-graph-side"
            className="flex min-h-[520px] flex-col rounded-3xl border border-white/[0.09] bg-[#0d0d14]/95 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden lg:min-h-[calc(100%_-_0px)]"
          >
            <SidePanel
              phase={phase}
              panelView={panelView}
              selectedNode={selectedNode}
              currentStates={currentStates}
              pathHighlight={pathHighlight}
              onShowDependency={handleShowDependency}
              onAskIntelligence={handleAskIntelligence}
              onExecute={handleExecute}
              onNodeSelectById={handleNodeClick}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!mql) return;
    setReduced(mql.matches);
    const listener = (e) => setReduced(e.matches);
    mql.addEventListener?.("change", listener);
    return () => mql.removeEventListener?.("change", listener);
  }, []);
  return reduced;
}

function PhaseChips({ activeIdx, intelUnlocked, resolveUnlocked, onSelect }) {
  return (
    <ol
      role="tablist"
      aria-label="Demo phase timeline"
      className="mt-8 -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {PHASES.map((p, i) => {
        const active = i === activeIdx;
        const disabled = (p.id === "intelligence" && !intelUnlocked) || (p.id === "resolve" && !resolveUnlocked);
        return (
          <li key={p.id} className="snap-start">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => onSelect(i)}
              data-testid={`demo-phase-${p.id}`}
              className={[
                "group inline-flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98]",
                active
                  ? "border-white/[0.22] bg-[#1a1a24] text-white shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : disabled
                  ? "border-white/[0.04] bg-transparent text-zinc-600 opacity-60"
                  : "border-white/[0.08] bg-[#0c0c11]/80 text-zinc-300 hover:border-white/25 hover:text-white hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <span className={"font-gemini-mono text-[10px] tracking-[0.16em] " + (active ? "text-white font-bold" : "text-zinc-500")}>
                {p.ordinal}
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">{p.label}</span>
              {disabled && <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-zinc-500">soon</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function GraphHeader({ phase, readiness }) {
  const tone =
    readiness >= 80
      ? "text-white font-bold"
      : readiness >= 55
      ? "text-zinc-200"
      : "text-zinc-400";
  const barTone =
    readiness >= 80
      ? "bg-white"
      : readiness >= 55
      ? "bg-zinc-300"
      : "bg-zinc-500";
  return (
    <div className="border-b border-white/[0.07] p-5 sm:p-6" data-testid="demo-graph-header">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 font-gemini-mono">Event Studio</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white">Aruna Bold Live Experience 2026</div>
          <div className="mt-0.5 text-xs text-zinc-400">Makassar Convention Hall · 24 Aug 2026 · 5.000 audiens</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 font-gemini-mono">Readiness</div>
          <div data-testid="demo-graph-readiness" className={"mt-0.5 font-gemini-mono text-2xl font-bold sm:text-3xl " + tone}>
            {readiness}%
          </div>
        </div>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#181820]" aria-hidden="true">
        <div
          data-testid="demo-graph-readiness-bar"
          className={"h-full rounded-full transition-all duration-700 ease-out " + barTone}
          style={{ width: `${readiness}%` }}
        />
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        <span className="font-gemini-mono font-semibold text-white">
          Phase {phase.ordinal} · {phase.label}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">{phase.intro}</span>
      </div>
    </div>
  );
}

function GraphFooterHint({ phase, panelView, currentStates, onNodeSelectById }) {
  const counts = { confirmed: 0, active: 0, risk: 0, blocked: 0, idle: 0 };
  for (const id of Object.keys(currentStates)) {
    const s = currentStates[id];
    counts[s] = (counts[s] || 0) + 1;
  }
  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.07] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between bg-black/30">
      <div className="flex flex-wrap items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">
        {["confirmed", "active", "risk", "blocked", "idle"].map((k) => {
          if (!counts[k]) return null;
          const style = STATE_STYLE[k];
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: style.stroke === "var(--okx-accent)" ? "#ffffff" : style.stroke }} />
              {STATE_LABEL[k]} <span className="font-gemini-mono text-zinc-300 font-semibold">{counts[k]}</span>
            </span>
          );
        })}
      </div>
      {panelView === "phase-prompt" && (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300 font-medium">
          <MousePointerClick size={12} className="text-white" aria-hidden="true" />
          {phase.prompt}
        </span>
      )}
    </div>
  );
}

function GraphCanvas({ phase, selectedId, pathHighlight, pulseTick, onNodeClick, onNodeSelectById, reducedMotion }) {
  const nodeById = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);
  const [hoverId, setHoverId] = useState(null);

  const pathEdgeSet = useMemo(() => {
    if (!pathHighlight) return new Set();
    const set = new Set();
    for (let i = 0; i < pathHighlight.length - 1; i++) {
      set.add(pathHighlight[i] + "->" + pathHighlight[i + 1]);
      set.add(pathHighlight[i + 1] + "->" + pathHighlight[i]);
    }
    return set;
  }, [pathHighlight]);

  const relatedIds = useMemo(() => {
    if (!hoverId) return new Set();
    const set = new Set([hoverId]);
    for (const [a, b] of EDGES) {
      if (a === hoverId) set.add(b);
      if (b === hoverId) set.add(a);
    }
    return set;
  }, [hoverId]);

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 940 720"
        role="img"
        aria-label={`Event Graph phase ${phase.ordinal} ${phase.label}. Readiness ${phase.readiness} percent. Klik node untuk detail.`}
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="okx-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" fill="none" stroke="rgba(244,239,236,0.035)" strokeWidth="1" />
          </pattern>
          <radialGradient id="okx-blocked-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="940" height="720" fill="url(#okx-grid)" />

        {/* Edges */}
        {EDGES.map(([a, b]) => {
          const na = nodeById[a];
          const nb = nodeById[b];
          const highlighted = pathEdgeSet.has(a + "->" + b);
          const relatedHover = hoverId && (a === hoverId || b === hoverId);
          const stroke = highlighted
            ? "#ffffff"
            : relatedHover
            ? "rgba(244,239,236,0.55)"
            : "rgba(244,239,236,0.12)";
          const width = highlighted ? 2 : relatedHover ? 1.4 : 1;
          return (
            <line
              key={"e-" + a + b}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={stroke}
              strokeWidth={width}
              className={highlighted && !reducedMotion ? "okx-edge-active" : ""}
              data-tick={pulseTick}
              style={{ transition: reducedMotion ? "none" : "stroke 500ms ease, stroke-width 300ms ease" }}
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((n) => {
          const state = phase.states[n.id];
          const style = STATE_STYLE[state] || STATE_STYLE.idle;
          const isSelected = selectedId === n.id;
          const isFocus = phase.focus === n.id && !selectedId;
          const isBlocked = state === "blocked";
          const dimmed = hoverId && !relatedIds.has(n.id);
          const radius = isSelected || isBlocked ? 58 : 52;
          return (
            <g
              key={n.id}
              className="okx-node-hit"
              tabIndex={0}
              role="button"
              aria-label={`${n.label}. Status ${STATE_LABEL[state] || state}. Klik untuk detail.`}
              onClick={() => onNodeClick(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNodeClick(n.id);
                }
              }}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                opacity: dimmed ? 0.35 : 1,
                transition: reducedMotion ? "none" : "opacity 240ms ease",
              }}
            >
              {isBlocked && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={radius + 18}
                  fill="url(#okx-blocked-glow)"
                  className="okx-node-blocked-ring"
                />
              )}
              {isFocus && !isSelected && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={radius + 10}
                  fill="none"
                  stroke="var(--okx-accent)"
                  strokeWidth="1.6"
                  aria-hidden="true"
                />
              )}
              {/* Focus prompt ring (non-selected default focus for a phase) */}
              {isFocus && !isBlocked && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={radius + 8}
                  fill="none"
                  stroke="rgba(244,239,236,0.35)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  aria-hidden="true"
                />
              )}
              {/* Body */}
              <circle
                data-role="body"
                cx={n.x}
                cy={n.y}
                r={radius}
                fill="#0a0a0a"
                stroke={style.stroke}
                strokeWidth={isSelected || isBlocked ? 1.8 : 1.2}
                style={{ transition: reducedMotion ? "none" : "all 400ms ease" }}
              />
              {/* Label. Wrap if two words. */}
              <NodeLabel node={n} textColor={style.text} />
              {/* State dot */}
              <circle
                cx={n.x + radius - 8}
                cy={n.y - radius + 8}
                r="4.2"
                fill={style.stroke === "var(--okx-accent)" ? "var(--okx-accent)" : style.stroke}
                stroke="#050505"
                strokeWidth="1"
                aria-hidden="true"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function NodeLabel({ node, textColor }) {
  const words = node.label.split(" ");
  if (words.length === 1) {
    return (
      <text
        x={node.x}
        y={node.y + 4}
        textAnchor="middle"
        fill={textColor}
        fontSize="11.5"
        fontFamily="var(--font-gemini, 'Google Sans Text', 'Plus Jakarta Sans', system-ui, sans-serif)"
        letterSpacing="0.06em"
        pointerEvents="none"
      >
        {node.label}
      </text>
    );
  }
  return (
    <>
      <text
        x={node.x}
        y={node.y - 3}
        textAnchor="middle"
        fill={textColor}
        fontSize="11"
        fontFamily="var(--font-gemini, 'Google Sans Text', 'Plus Jakarta Sans', system-ui, sans-serif)"
        letterSpacing="0.05em"
        pointerEvents="none"
      >
        {words[0]}
      </text>
      <text
        x={node.x}
        y={node.y + 11}
        textAnchor="middle"
        fill={textColor}
        fontSize="11"
        fontFamily="var(--font-gemini, 'Google Sans Text', 'Plus Jakarta Sans', system-ui, sans-serif)"
        letterSpacing="0.05em"
        pointerEvents="none"
      >
        {words.slice(1).join(" ")}
      </text>
    </>
  );
}

// -----------------------------------------------------------------------------
// Side panel. Renders one of four views based on panelView.
// -----------------------------------------------------------------------------
function SidePanel({
  phase,
  panelView,
  selectedNode,
  currentStates,
  pathHighlight,
  onShowDependency,
  onAskIntelligence,
  onExecute,
  onNodeSelectById,
}) {
  const content = (() => {
    if (panelView === "phase-prompt") {
      return <PanelPhasePrompt phase={phase} currentStates={currentStates} onNodeSelectById={onNodeSelectById} />;
    }
    if (panelView === "node" && selectedNode) {
      return (
        <PanelNodeDetail
          node={selectedNode}
          state={currentStates[selectedNode.id]}
          pathHighlight={pathHighlight}
          onShowDependency={onShowDependency}
          onAskIntelligence={onAskIntelligence}
        />
      );
    }
    if (panelView === "intelligence") {
      return <PanelIntelligence onExecute={onExecute} />;
    }
    if (panelView === "resolved") {
      return <PanelResolved />;
    }
    return <PanelPhasePrompt phase={phase} />;
  })();

  return (
    <MotionPanel activeKey={panelView + (selectedNode?.id || "")} className="h-full">
      {content}
    </MotionPanel>
  );
}

function PanelPhasePrompt({ phase, currentStates, onNodeSelectById }) {
  // Surface the most interesting nodes for the current phase so the panel
  // is never empty. Prioritizes blocked > risk > active > confirmed > idle.
  const priority = { blocked: 0, risk: 1, active: 2, confirmed: 3, idle: 4 };
  const shortlist = NODES
    .map((n) => ({ ...n, state: currentStates[n.id] || "idle" }))
    .sort((a, b) => (priority[a.state] ?? 9) - (priority[b.state] ?? 9))
    .slice(0, 5);
  return (
    <div className="flex h-full flex-col p-5 sm:p-6" data-testid="demo-panel-phase-prompt">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
        Phase {phase.ordinal} · {phase.label}
      </div>
      <h3 className="editorial mt-3 text-xl text-white">{phase.intro}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{phase.prompt}</p>

      <div className="mt-6 border-t border-[var(--okx-border)] pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
          Nodes on this phase
        </div>
        <ul className="mt-3 space-y-1" data-testid="demo-panel-shortlist">
          {shortlist.map((n) => {
            const style = STATE_STYLE[n.state] || STATE_STYLE.idle;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onNodeSelectById?.(n.id)}
                  data-testid={`demo-panel-shortlist-${n.id}`}
                  className="group flex w-full items-center justify-between border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--okx-border)] hover:bg-[#0e0e0e]"
                >
                  <span className="flex items-center gap-2 text-[13px] text-zinc-200">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2"
                      style={{ background: style.stroke === "var(--okx-accent)" ? "var(--okx-accent)" : style.stroke }}
                    />
                    {n.label}
                  </span>
                  <span className={"text-[10px] font-semibold uppercase tracking-[0.16em] " + style.chipCls.split(" ").filter((c) => c.startsWith("text-")).join(" ")}>
                    {STATE_LABEL[n.state]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-5 text-[11px] text-zinc-400">
        <MousePointerClick size={13} aria-hidden="true" />
        Klik salah satu node di atas atau langsung di graph.
      </div>
    </div>
  );
}

function PanelNodeDetail({ node, state, pathHighlight, onShowDependency, onAskIntelligence }) {
  const detail = NODE_DETAIL[node.id];
  const style = STATE_STYLE[state] || STATE_STYLE.idle;
  const isBlocker = state === "blocked";
  return (
    <div className="flex h-full flex-col p-6" data-testid="demo-panel-node">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">Node</div>
          <h3 className="mt-1 text-xl font-semibold text-white">{node.label}</h3>
        </div>
        <span
          className={"inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] " + style.chipCls}
          data-testid="demo-panel-node-state"
        >
          {STATE_LABEL[state] || state}
        </span>
      </div>

      <dl className="mt-5 divide-y divide-[var(--okx-border)] border-y border-[var(--okx-border)]">
        <DetailRow k="Requirement" v={detail.requirement} />
        <DetailRow k="Owner" v={detail.owner} />
        <DetailRow k="Deadline" v={detail.deadline} />
        <DetailRow k="Impact" v={detail.impact} tone={isBlocker ? "accent" : undefined} />
        <DetailRow
          k="Depends on"
          v={
            detail.dependency.length
              ? detail.dependency.map((d) => (NODES.find((n) => n.id === d) || {}).label).filter(Boolean).join(", ")
              : "None"
          }
        />
        <DetailRow k="Next action" v={detail.next} />
      </dl>

      {isBlocker && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row" data-testid="demo-panel-blocker-actions">
          <button
            type="button"
            onClick={onShowDependency}
            data-testid="demo-panel-show-dep"
            disabled={!!pathHighlight}
            className={[
              "inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em]",
              pathHighlight
                ? "border-white/40 bg-white/10 text-white font-bold"
                : "border-zinc-700 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900",
            ].join(" ")}
          >
            {pathHighlight ? "Dependency shown" : "Show dependency"}
          </button>
          <button
            type="button"
            onClick={onAskIntelligence}
            data-testid="demo-panel-ask-intel"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Sparkles size={13} aria-hidden="true" /> Ask Copilot
          </button>
        </div>
      )}

      {!isBlocker && (
        <p className="mt-auto pt-6 text-[11px] text-zinc-400">
          Klik node lain untuk melihat detailnya, atau lanjut ke phase berikutnya.
        </p>
      )}
    </div>
  );
}

function DetailRow({ k, v, tone }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5 sm:grid-cols-[130px_1fr]">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono">{k}</dt>
      <dd className={"text-sm leading-6 " + (tone === "accent" ? "text-white font-medium" : "text-zinc-200")}>
        {v}
      </dd>
    </div>
  );
}

function PanelIntelligence({ onExecute }) {
  return (
    <div className="flex h-full flex-col p-6" data-testid="demo-panel-intel">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300 font-gemini-mono">
        <Sparkles size={13} aria-hidden="true" /> Okkax Copilot
      </div>
      <h3 className="editorial mt-3 text-xl text-white">Grounded on state, not chat.</h3>
      <dl className="mt-4 divide-y divide-white/[0.08] border-y border-white/[0.08] text-sm">
        <IntelRow k="Issue" v={INTELLIGENCE.issue} tone="accent" />
        <IntelRow k="Evidence" v={INTELLIGENCE.evidence} />
        <IntelRow
          k="Dependency"
          v={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-zinc-200">
              {INTELLIGENCE.dependencyPath.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-zinc-400">/</span>}
                  <span className={i === INTELLIGENCE.dependencyPath.length - 1 ? "text-white font-bold" : ""}>{s}</span>
                </span>
              ))}
            </span>
          }
        />
        <IntelRow k="Impact" v={INTELLIGENCE.impact} />
        <IntelRow k="Recommendation" v={INTELLIGENCE.recommendation} />
        <IntelRow k="Expected" v={INTELLIGENCE.expected} tone="white" />
      </dl>
      <button
        type="button"
        onClick={onExecute}
        data-testid="demo-panel-execute"
        className="group mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-5 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
      >
        <Zap size={15} aria-hidden="true" /> Execute recommendation
      </button>
      <div className="mt-3 text-[11px] text-zinc-400">
        Action melewati domain service. Otorisasi tetap berlaku. Demo tidak memodifikasi state produksi.
      </div>
    </div>
  );
}

function IntelRow({ k, v, tone }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5 sm:grid-cols-[130px_1fr]">
      <dt className={
        "text-[10px] font-semibold uppercase tracking-[0.18em] font-gemini-mono " +
        (tone === "accent" || tone === "white" ? "text-white font-bold" : "text-zinc-400")
      }>
        {k}
      </dt>
      <dd className="text-sm leading-6 text-zinc-200">{v}</dd>
    </div>
  );
}

function PanelResolved() {
  return (
    <div className="flex h-full flex-col p-6" data-testid="demo-panel-resolved">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white">Resolved</div>
      <h3 className="editorial mt-3 text-xl text-white">Rantai kritis pulih.</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-300">
        Workforce menuju Gate Operations menuju Access Readiness menuju Showtime kembali confirmed. Readiness naik dari 51% ke 92%.
      </p>
      <ul className="mt-5 space-y-2 border-t border-[var(--okx-border)] pt-4 text-sm">
        {[
          ["Workforce", "18 posisi terisi, 4 cadangan siap panggil."],
          ["Gate Operations", "Coverage minimum tercapai."],
          ["Access Readiness", "Validator on track."],
          ["Showtime", "Doors open siap dijadwalkan."],
        ].map(([label, note]) => (
          <li key={label} className="flex items-start justify-between gap-3 border-b border-[var(--okx-border)] pb-2 last:border-b-0">
            <div>
              <div className="text-[11.5px] font-semibold text-zinc-100">{label}</div>
              <div className="text-[11px] text-zinc-400">{note}</div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 border border-white/30 bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white">
              Confirmed
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6 text-[11px] text-zinc-400">
        Klik Reset demo di kanan atas untuk memutar ulang cerita.
      </div>
    </div>
  );
}

// =============================================================================
// 04  OPERATING JOURNEY (compact 5 chapters)
// =============================================================================
const CHAPTERS = [
  ["Create", "Event Studio, Blueprint", "/app/studio"],
  ["Connect", "Talent, Venue, Vendor, Workforce", "/app/network"],
  ["Secure", "Commerce, Compliance, Funding", "/app/events/evt-aruna-2026/budget"],
  ["Activate", "Ticket Studio, LivePass, Gate", "/app/events/evt-aruna-2026/tickets"],
  ["Operate", "Event Graph, Operations, Intelligence, Finance", "/app/events/evt-aruna-2026/graph"],
];

function OperatingJourney() {
  return (
    <section
      aria-labelledby="demo-journey-heading"
      data-testid="demo-journey"
      className="border-b border-white/[0.06] bg-[#07070a] px-4 py-16 sm:px-6 sm:py-24 font-gemini"
    >
      <div className="mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md">
          <Workflow size={13} aria-hidden="true" />
          <span>Operating Journey</span>
        </div>
        <h2 id="demo-journey-heading" className="editorial mt-5 max-w-3xl text-[clamp(2rem,4vw,3.2rem)] leading-tight text-[#f4efec]">
          Lima chapter dari ide ke <span className="text-white font-bold">showtime</span>.
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-5" data-testid="demo-journey-list">
          {CHAPTERS.map(([label, body, href], i) => (
            <li
              key={label}
              className="rounded-2xl border border-white/[0.08] bg-[#0c0c11]/85 backdrop-blur-xl shadow-md hover:border-white/25 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300 group overflow-hidden"
            >
              <Link
                to={href}
                data-testid={`demo-journey-${label.toLowerCase()}`}
                className="flex h-full flex-col p-5 sm:p-6"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-gemini-mono text-[11px] font-bold tracking-[0.16em] text-zinc-400">
                    CH {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight
                    size={15}
                    className="text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-4 text-lg font-bold text-white group-hover:text-zinc-100 transition-colors">{label}</div>
                <div className="mt-1.5 text-xs leading-5 text-zinc-300">{body}</div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// =============================================================================
// 05  FINAL CTA
// =============================================================================
function FinalCta() {
  const nav = useNavigate();
  return (
    <section
      aria-labelledby="demo-final-heading"
      data-testid="demo-final"
      className="px-4 py-16 sm:px-6 sm:py-28 bg-[#050507] font-gemini"
    >
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#14141f] to-[#0a0a0f] p-8 sm:p-14 lg:p-16 shadow-[0_32px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300">
          <Sparkles size={13} aria-hidden="true" />
          <span>Championship Close</span>
        </div>
        <h2 id="demo-final-heading" className="editorial mt-6 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] text-[#f4efec]">
          One event.
          <br />
          Every moving part.
          <br />
          <span className="text-white font-bold">Working as one.</span>
        </h2>
        <div className="mt-10 flex flex-col gap-3.5 sm:flex-row">
          <button
            type="button"
            onClick={() => nav("/register")}
            data-testid="demo-final-primary"
            className="group inline-flex min-w-52 items-center justify-between rounded-xl bg-white hover:bg-zinc-200 px-6 py-4 text-sm font-bold text-black transition-all shadow-[0_4px_24px_rgba(255,255,255,0.15)] active:scale-[0.98]"
          >
            <span>Build an Event</span>
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
          <Link
            to="/discover"
            data-testid="demo-final-secondary"
            className="group inline-flex min-w-52 items-center justify-between rounded-xl border border-white/[0.15] bg-white/[0.04] px-6 py-4 text-sm font-semibold text-zinc-100 hover:border-white/[0.3] hover:bg-white/[0.08] transition-all"
          >
            <span>Explore OKKAX</span>
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
