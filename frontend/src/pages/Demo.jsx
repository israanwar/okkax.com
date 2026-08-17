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
  MousePointerClick,
  Play,
  Sparkles,
  Waypoints,
  Zap,
} from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";

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
    next: "Ask OKKAX Intelligence for the fastest safe fix.",
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
    label: "Intelligence",
    ordinal: "04",
    readiness: 55,
    intro: "OKKAX Intelligence menjelaskan sebab dan menyiapkan action.",
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
  idle:      { stroke: "rgba(244,239,236,0.22)", text: "rgba(228,228,231,0.55)", chipCls: "border-zinc-700 text-zinc-500" },
  active:    { stroke: "rgba(244,239,236,0.65)", text: "#f4efec",               chipCls: "border-zinc-400 text-zinc-100" },
  confirmed: { stroke: "rgba(134,239,172,0.75)", text: "#dcfce7",               chipCls: "border-emerald-500/70 text-emerald-300" },
  risk:      { stroke: "rgba(253,186,116,0.85)", text: "#fed7aa",               chipCls: "border-amber-400/80 text-amber-300" },
  blocked:   { stroke: "var(--okx-accent)",       text: "#f4efec",               chipCls: "border-[var(--okx-accent)] text-[var(--okx-accent-soft)]" },
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
    <div className="min-h-screen bg-[#050505] text-zinc-100">
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
      <PublicNav />
      <main data-testid="demo-page" className="overflow-hidden">
        <Hero />
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
      className="relative border-b border-[var(--okx-border)] px-4 pt-10 pb-10 sm:px-6 sm:pt-14 sm:pb-12"
    >
      <StageAmbience />
      <div className="relative mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-3 border border-[var(--okx-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] accent-text">
          <Sparkles size={13} aria-hidden="true" /> Platform Demo
        </div>
        <h1
          id="demo-hero-heading"
          className="editorial mt-5 max-w-4xl text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[0.95] text-[#f4efec]"
        >
          Industri event tidak kekurangan pihak.
          <br />
          <span className="accent-text">Yang hilang adalah satu sistem.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
          OKKAX menggabungkan brief, jaringan, jadwal, kontrak, ticketing, operasi, dan keuangan pada satu Event ID. Coba interaksinya di Event Graph di bawah.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#demo-graph"
            data-testid="demo-hero-cta-primary"
            className="group inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-6 py-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]"
          >
            <Play size={15} aria-hidden="true" /> Mulai Demo
          </a>
          <a
            href="#demo-graph"
            data-testid="demo-hero-cta-secondary"
            className="group inline-flex items-center justify-center gap-2 border border-zinc-700 px-6 py-4 text-sm font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
          >
            Lihat Event Graph
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>
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
      className="border-b border-[var(--okx-border)] px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="border border-[var(--okx-accent)] bg-[#100609] px-4 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
                Event ID
              </div>
              <div className="mt-0.5 font-mono text-sm text-white">okkax://evt-aruna-2026</div>
            </div>
            <h2 id="demo-eventid-heading" className="text-sm text-zinc-400 sm:text-base">
              <span className="text-zinc-100">Sebelas fungsi</span> bekerja pada <span className="accent-text">satu Event ID</span>.
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Sebelas fungsi terhubung">
            {ECOSYSTEM.map((n) => (
              <span key={n} className="border border-[var(--okx-border)] px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-400">
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
  const [pulseTick, setPulseTick] = useState(0); // triggers edge flow animation on execute
  const reducedMotion = useReducedMotion();

  const phase = PHASES[phaseIdx];
  const currentStates = phase.states;
  const activePath =
    pathHighlight || phase.highlightPath ? (phase.highlightPath || ["workforce", "gate", "access", "showtime"]) : null;

  // Smoothly animate readiness toward the phase target.
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
      className="border-b border-[var(--okx-border)] px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
              <Waypoints size={13} aria-hidden="true" /> Event Graph
            </div>
            <h2 id="demo-graph-heading" className="editorial mt-4 max-w-3xl text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] text-[#f4efec]">
              Bulatan cantik saja tidak cukup. <span className="accent-text">Klik dan jelajahi.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={handleReset}
            data-testid="demo-graph-reset"
            className="inline-flex items-center gap-2 self-start border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-400 hover:text-white"
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

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-6">
          {/* Graph canvas */}
          <div
            data-testid="demo-graph-canvas"
            className="relative flex flex-col border border-[var(--okx-border)] bg-[#0a0a0a]"
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
            className="flex min-h-[520px] flex-col border border-[var(--okx-border)] bg-[#0a0a0a] lg:min-h-[calc(100%_-_0px)]"
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
                "group inline-flex shrink-0 items-center gap-3 border px-4 py-2 text-left text-sm transition-colors",
                active
                  ? "border-[var(--okx-accent)] bg-[var(--okx-accent-tint)] text-white"
                  : disabled
                  ? "border-[var(--okx-border)] bg-transparent text-zinc-600"
                  : "border-[var(--okx-border)] bg-transparent text-zinc-300 hover:border-zinc-500 hover:text-white",
              ].join(" ")}
            >
              <span className={"font-mono text-[10px] tracking-[0.16em] " + (active ? "text-[var(--okx-accent)]" : "text-zinc-500")}>
                {p.ordinal}
              </span>
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.12em]">{p.label}</span>
              {disabled && <span className="text-[10px] text-zinc-600">soon</span>}
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
      ? "text-emerald-300"
      : readiness >= 55
      ? "text-amber-300"
      : "text-[var(--okx-accent-soft)]";
  const barTone =
    readiness >= 80
      ? "bg-emerald-400"
      : readiness >= 55
      ? "bg-amber-400"
      : "bg-[var(--okx-accent)]";
  return (
    <div className="border-b border-[var(--okx-border)] p-5" data-testid="demo-graph-header">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Event Studio</div>
          <div className="mt-0.5 text-base font-semibold text-white">Aruna Bold Live Experience 2026</div>
          <div className="mt-0.5 text-xs text-zinc-500">Makassar Convention Hall · 24 Aug 2026 · 5.000 audiens</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Readiness</div>
          <div data-testid="demo-graph-readiness" className={"mt-0.5 font-mono text-2xl font-semibold sm:text-3xl " + tone}>
            {readiness}%
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden bg-[#1c1c1f]" aria-hidden="true">
        <div
          data-testid="demo-graph-readiness-bar"
          className={"h-full transition-all duration-700 ease-out " + barTone}
          style={{ width: `${readiness}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        <span className={"font-mono " + (phase.id === "risk" || phase.id === "intelligence" ? "text-[var(--okx-accent-soft)]" : "")}>
          Phase {phase.ordinal} · {phase.label}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">{phase.intro}</span>
      </div>
    </div>
  );
}

function GraphFooterHint({ phase, panelView, currentStates, onNodeSelectById }) {
  // Always render a legend strip so the graph card never feels empty.
  const counts = { confirmed: 0, active: 0, risk: 0, blocked: 0, idle: 0 };
  for (const id of Object.keys(currentStates)) {
    const s = currentStates[id];
    counts[s] = (counts[s] || 0) + 1;
  }
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--okx-border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">
        {["confirmed", "active", "risk", "blocked", "idle"].map((k) => {
          if (!counts[k]) return null;
          const style = STATE_STYLE[k];
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2 w-2" style={{ background: style.stroke === "var(--okx-accent)" ? "var(--okx-accent)" : style.stroke }} />
              {STATE_LABEL[k]} <span className="font-mono text-zinc-400">{counts[k]}</span>
            </span>
          );
        })}
      </div>
      {panelView === "phase-prompt" && (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--okx-accent-soft)]">
          <MousePointerClick size={12} aria-hidden="true" />
          {phase.prompt}
        </span>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// The actual SVG graph. Interactive. Nodes are buttons for keyboard access.
// -----------------------------------------------------------------------------
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

  // A node is "related" to the hovered node if there is a direct edge.
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
        {/* Static ambient grid */}
        <defs>
          <pattern id="okx-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" fill="none" stroke="rgba(244,239,236,0.035)" strokeWidth="1" />
          </pattern>
          <radialGradient id="okx-blocked-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,46,126,0.5)" />
            <stop offset="70%" stopColor="rgba(255,46,126,0)" />
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
            ? "var(--okx-accent)"
            : relatedHover
            ? "rgba(244,239,236,0.55)"
            : "rgba(244,239,236,0.12)";
          const width = highlighted ? 1.8 : relatedHover ? 1.4 : 1;
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
              // key on pulseTick prevents dash animation from being cached between execute phases
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
              {/* Blocked pulse ring. Opacity-only animation for click stability. */}
              {isBlocked && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={radius + 18}
                  fill="url(#okx-blocked-glow)"
                  className="okx-node-blocked-ring"
                  aria-hidden="true"
                />
              )}
              {/* Selection ring */}
              {isSelected && (
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
        fontFamily="ui-sans-serif, system-ui"
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
        fontFamily="ui-sans-serif, system-ui"
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
        fontFamily="ui-sans-serif, system-ui"
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
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
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

      <div className="mt-auto flex items-center gap-2 pt-5 text-[11px] text-zinc-500">
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Node</div>
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
                ? "border-emerald-500/60 text-emerald-300"
                : "border-zinc-700 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900",
            ].join(" ")}
          >
            {pathHighlight ? "Dependency shown" : "Show dependency"}
          </button>
          <button
            type="button"
            onClick={onAskIntelligence}
            data-testid="demo-panel-ask-intel"
            className="inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-[var(--okx-accent-hover)]"
          >
            <Sparkles size={13} aria-hidden="true" /> Ask Intelligence
          </button>
        </div>
      )}

      {!isBlocker && (
        <p className="mt-auto pt-6 text-[11px] text-zinc-500">
          Klik node lain untuk melihat detailnya, atau lanjut ke phase berikutnya.
        </p>
      )}
    </div>
  );
}

function DetailRow({ k, v, tone }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5 sm:grid-cols-[130px_1fr]">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{k}</dt>
      <dd className={"text-sm leading-6 " + (tone === "accent" ? "text-[var(--okx-accent-soft)]" : "text-zinc-200")}>
        {v}
      </dd>
    </div>
  );
}

function PanelIntelligence({ onExecute }) {
  return (
    <div className="flex h-full flex-col p-6" data-testid="demo-panel-intel">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
        <Sparkles size={13} aria-hidden="true" /> OKKAX Intelligence
      </div>
      <h3 className="editorial mt-3 text-xl text-white">Grounded on state, not chat.</h3>
      <dl className="mt-4 divide-y divide-[var(--okx-border)] border-y border-[var(--okx-border)] text-sm">
        <IntelRow k="Issue" v={INTELLIGENCE.issue} tone="accent" />
        <IntelRow k="Evidence" v={INTELLIGENCE.evidence} />
        <IntelRow
          k="Dependency"
          v={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-zinc-200">
              {INTELLIGENCE.dependencyPath.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-[var(--okx-accent)]">/</span>}
                  <span className={i === INTELLIGENCE.dependencyPath.length - 1 ? "text-white" : ""}>{s}</span>
                </span>
              ))}
            </span>
          }
        />
        <IntelRow k="Impact" v={INTELLIGENCE.impact} />
        <IntelRow k="Recommendation" v={INTELLIGENCE.recommendation} />
        <IntelRow k="Expected" v={INTELLIGENCE.expected} tone="emerald" />
      </dl>
      <button
        type="button"
        onClick={onExecute}
        data-testid="demo-panel-execute"
        className="group mt-5 inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]"
      >
        <Zap size={15} aria-hidden="true" /> Execute recommendation
      </button>
      <div className="mt-3 text-[11px] text-zinc-500">
        Action melewati domain service. Otorisasi tetap berlaku. Demo tidak memodifikasi state produksi.
      </div>
    </div>
  );
}

function IntelRow({ k, v, tone }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2.5 sm:grid-cols-[130px_1fr]">
      <dt className={
        "text-[10px] font-semibold uppercase tracking-[0.18em] " +
        (tone === "accent" ? "text-[var(--okx-accent-soft)]" : tone === "emerald" ? "text-emerald-300" : "text-zinc-500")
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Resolved</div>
      <h3 className="editorial mt-3 text-xl text-white">Rantai kritis pulih.</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
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
              <div className="text-[11px] text-zinc-500">{note}</div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 border border-emerald-500/70 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
              Confirmed
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6 text-[11px] text-zinc-500">
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
      className="border-b border-[var(--okx-border)] px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
          Operating journey
        </div>
        <h2 id="demo-journey-heading" className="editorial mt-4 max-w-3xl text-[clamp(1.8rem,3.6vw,2.8rem)] leading-tight text-[#f4efec]">
          Lima chapter dari ide ke <span className="accent-text">showtime</span>.
        </h2>
        <ol className="mt-8 grid gap-3 md:grid-cols-5" data-testid="demo-journey-list">
          {CHAPTERS.map(([label, body, href], i) => (
            <li key={label} className="border border-[var(--okx-border)] bg-[#0a0a0a]">
              <Link
                to={href}
                data-testid={`demo-journey-${label.toLowerCase()}`}
                className="group flex h-full flex-col p-5 hover:bg-[#0e0e0e]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] tracking-[0.16em] text-zinc-500">CH {String(i + 1).padStart(2, "0")}</span>
                  <ArrowUpRight
                    size={14}
                    className="text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3 text-base font-semibold text-white">{label}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-400">{body}</div>
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
      className="px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-5xl border border-[var(--okx-accent)] bg-[#100609] p-8 sm:p-12">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
          <Sparkles size={13} aria-hidden="true" /> Championship close
        </div>
        <h2 id="demo-final-heading" className="editorial mt-6 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] text-[#f4efec]">
          One event.
          <br />
          Every moving part.
          <br />
          <span className="accent-text">Working as one.</span>
        </h2>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => nav("/register")}
            data-testid="demo-final-primary"
            className="group inline-flex min-w-52 items-center justify-between bg-[var(--okx-accent)] px-6 py-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]"
          >
            Build an Event
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
          <Link
            to="/discover"
            data-testid="demo-final-secondary"
            className="group inline-flex min-w-52 items-center justify-between border border-zinc-700 px-6 py-4 text-sm font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
          >
            Explore OKKAX
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
