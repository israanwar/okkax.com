import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  Sparkles,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Send,
} from "lucide-react";
import OkkaxConcertMotion from "./OkkaxConcertMotion";
import { OKX_EASE, OKX_EASE_FAST } from "./MotionPrimitives";
import { api, idr, num } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COMPOSER_SESSION_KEY = "okkax_homepage_copilot_session_v1";
const COMPOSER_HANDOFF_KEY = "okkax_homepage_copilot_handoff_v1";

const readComposerSession = () => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(COMPOSER_SESSION_KEY) || "null");
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
};

const cleanUserFacingReply = (value) =>
  String(value || "")
    .replace(/\b(?:okkax-intelligence-core-v2|intelligence engine)\b/gi, "Okkax Copilot")
    .replace(/\bpipeline reasoning\b/gi, "analisis")
    .split("\n")
    .filter((line) => !/^\s*(provider|model|engine_key|reasoning_provider|pipeline_stages|debug|internal provenance)\s*:/i.test(line))
    .map((line) => line
      .replace(/^\s*\[(?:FACT|UNKNOWN)\]\s*/i, "")
      .replace(/^\s*\[CALCULATED\]\s*/i, "**Hasil kalkulasi:** ")
      .replace(/^\s*\[ESTIMATE\]\s*/i, "**Estimasi:** ")
      .replace(/^\s*\[RECOMMENDATION\]\s*/i, "**Rekomendasi:** ")
      .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, "")
      .replace(/(^|\s)(?:[:;=8xX][-^']?[)(\/DPpOo])(?=\s|$)/g, "$1"))
    .join("\n")
    .trim();

const formatInline = (text) => {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <span key={index} className="not-italic">{part.slice(1, -1)}</span>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-white/[0.07] px-1 py-0.5 font-gemini-mono text-[0.92em] text-zinc-200">{part.slice(1, -1)}</code>;
    }
    return part.replaceAll("**", "");
  });
};

function ComposerMarkdown({ text }) {
  const lines = String(text || "").split("\n");
  const nodes = [];
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length < 2) {
      tableRows.forEach((row) => nodes.push(<p key={`table-fallback-${nodes.length}`} className="text-xs leading-[1.45] text-zinc-300">{formatInline(row.join(" · "))}</p>));
      tableRows = [];
      return;
    }
    const header = tableRows[0];
    const body = tableRows.slice(2);
    nodes.push(
      <div key={`table-${nodes.length}`} className="my-2 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/20">
        <table className="w-full min-w-[32rem] text-left text-[11.5px]">
          <thead className="border-b border-white/[0.08] bg-white/[0.03]">
            <tr>{header.map((cell, index) => <th key={index} className="px-3 py-2 font-bold text-zinc-200">{formatInline(cell.trim())}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, index) => <td key={index} className="px-3 py-2 text-zinc-300">{formatInline(cell.trim())}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableRows.push(trimmed.split("|").slice(1, -1));
      return;
    }
    if (tableRows.length) flushTable();
    if (!trimmed) {
      nodes.push(<div key={`space-${index}`} className="h-1" />);
    } else if (/^#{2,4}\s/.test(trimmed)) {
      nodes.push(<h4 key={`heading-${index}`} className="font-gemini mb-0.5 mt-2 text-[12.5px] font-bold leading-[1.4] tracking-tight text-white">{formatInline(trimmed.replace(/^#{2,4}\s/, ""))}</h4>);
    } else if (/^[-*]\s/.test(trimmed)) {
      nodes.push(<div key={`bullet-${index}`} className="my-px flex items-start gap-2 text-xs leading-[1.45] text-zinc-300"><span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-zinc-500" /><span>{formatInline(trimmed.slice(2))}</span></div>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      nodes.push(<div key={`number-${index}`} className="my-px flex items-start gap-2 text-xs leading-[1.45] text-zinc-300"><span className="min-w-4 font-gemini-mono text-[10.5px] text-zinc-500">{match[1]}.</span><span>{formatInline(match[2])}</span></div>);
    } else if (trimmed === "---") {
      nodes.push(<div key={`rule-${index}`} className="my-2 h-px bg-white/[0.07]" />);
    } else {
      nodes.push(<p key={`paragraph-${index}`} className="text-xs leading-[1.45] text-zinc-300">{formatInline(trimmed)}</p>);
    }
  });
  if (tableRows.length) flushTable();
  return nodes;
}

const publicStateFromPlan = (plan) => {
  const constraints = plan?.constraints || {};
  const entities = plan?.entities || {};
  return {
    city: entities.city || null,
    capacity: constraints.capacity || null,
    event_budget_ceiling: constraints.target || constraints.budget || null,
    sound_budget_ceiling: constraints.vendor_cap_type === "sound" ? constraints.vendor_max_budget : null,
    sponsor_loss: constraints.sponsor_status === "cancelled" ? constraints.sponsor_expected : null,
  };
};

// Composer no longer exposes these as buttons — Copilot infers event type
// (konser/festival/tour/conference) straight from the natural-language
// prompt on the backend. The array stays only as the data source for which
// contextual starter-prompt set (CONTEXTUAL_STARTERS below) is shown; the
// existing 48-prompt system reads it exactly as it always did.
const COMPOSER_MODES = [
  { id: "concert", label: "Konser Live", prompt: "Saya ingin merancang konser live. Bantu mulai dari kapasitas, budget, venue, dan ticket economics." },
  { id: "festival", label: "Music Fest", prompt: "Saya ingin merancang festival musik. Bantu susun kapasitas, budget, venue, talent, dan risiko operasionalnya." },
  { id: "tour", label: "Tour Production", prompt: "Saya ingin merancang tour production. Bantu petakan kota, routing, logistik, produksi, dan economics-nya." },
  { id: "conference", label: "Conference", prompt: "Saya ingin merancang conference. Bantu susun kapasitas, venue, program, production, dan struktur budgetnya." },
];

// Reasoning-depth selector. Maps to real, already-integrated backend levers
// only (see ask_okkax_copilot's reasoning_mode in okkax_copilot.py) — "fast"
// genuinely skips the LLM planning call, "smarter" genuinely raises Gemini's
// thinking_budget/token/timeout ceilings. No artificial delay either way.
const REASONING_MODES = [
  { id: "fast", label: "Fast" },
  { id: "advanced", label: "Advanced" },
  { id: "smarter", label: "Smarter" },
];
const DEFAULT_REASONING_MODE = "advanced";

const CONTEXTUAL_STARTERS = {
  concert: [
    { id: "concert-plan", label: "Rencana konser Jakarta 8.000 pax", prompt: "Susun rencana awal konser live di Jakarta untuk 8.000 penonton, termasuk keputusan yang harus dikunci lebih dulu." },
    { id: "concert-budget", label: "Budget Rp1,2 M, ceiling Rp950 jt", prompt: "Buat struktur budget konser 8.000 pax dengan baseline Rp1,2 miliar tetapi total pengeluaran maksimal Rp950 juta tanpa mengurangi safety." },
    { id: "concert-bep", label: "Break-even Regular & VIP", prompt: "Hitung break-even konser 8.000 pax jika tiket Regular Rp300 ribu dan VIP Rp650 ribu, lalu jelaskan komposisi inventory yang masuk akal." },
    { id: "concert-venue", label: "Cari venue konser 10.000 pax", prompt: "Cari venue konser di Jakarta untuk 10.000 orang dan jelaskan data apa yang perlu divalidasi sebelum shortlist diputuskan." },
    { id: "concert-lineup", label: "Struktur headliner dan opener", prompt: "Bantu susun struktur lineup konser dengan satu headliner kuat dan tiga opener tanpa membiarkan talent menghabiskan seluruh budget produksi." },
    { id: "concert-production", label: "Sound, lighting, LED & stage", prompt: "Petakan kebutuhan vendor sound, lighting, LED, rigging, dan stage untuk konser 8.000 pax beserta dependency technical rider-nya." },
    { id: "concert-workforce", label: "Security, medical & gate crew", prompt: "Hitung kebutuhan awal security, medical, usher, ticketing gate, dan stage crew untuk konser 8.000 penonton dengan tiga kategori tiket." },
    { id: "concert-sponsor", label: "Paket sponsor konser", prompt: "Susun strategi sponsorship konser 8.000 pax dengan paket yang jelas, category exclusivity, deliverables, dan risiko inventory sponsor." },
    { id: "concert-ticketing", label: "Tier dan alokasi tiket", prompt: "Rancang tier tiket, alokasi guest list, sponsor, media, Regular, dan VIP untuk konser berkapasitas 8.000 orang." },
    { id: "concert-timeline", label: "Critical path H-120", prompt: "Susun critical path produksi konser dari H-120 sampai hari-H, termasuk venue, talent, perizinan, vendor, ticketing, dan rehearsal." },
    { id: "concert-risk", label: "Risiko operasi konser", prompt: "Identifikasi lima risiko operasional terbesar untuk konser 8.000 pax dan urutkan mitigasinya berdasarkan impact serta urgency." },
    { id: "concert-cascade", label: "Headliner batal H-3", prompt: "Analisis efek domino jika headliner konser batal H-3 terhadap ticketing, sponsor, venue, vendor, finance, dan audience." },
  ],
  festival: [
    { id: "festival-bep", label: "Budget & BEP festival 5.000 pax", prompt: "Bantu hitung budget dan break-even festival musik 5.000 pax dengan asumsi yang transparan." },
    { id: "festival-venue", label: "Cari venue Jakarta 8.000 pax", prompt: "Cari venue di Jakarta untuk festival musik 8.000 orang dan pisahkan fakta venue dari hal yang masih perlu dikonfirmasi." },
    { id: "festival-vendors", label: "Vendor festival dua hari", prompt: "Susun kebutuhan vendor produksi festival dua hari dengan tiga panggung, area F&B, backstage, dan gate terpisah." },
    { id: "festival-ticket-price", label: "Harga tiket untuk budget Rp800 jt", prompt: "Berapa struktur harga tiket yang perlu diuji agar festival dengan budget ceiling Rp800 juta dapat mencapai break-even?" },
    { id: "festival-sponsor", label: "Strategi sponsor 5.000 pax", prompt: "Buat strategi sponsor untuk festival musik 5.000 pax, termasuk paket, hak kategori, deliverables, dan target pendanaan." },
    { id: "festival-timeline", label: "Timeline festival H-90", prompt: "Susun timeline produksi festival dari H-90 sampai hari-H dan tunjukkan critical path antar venue, lineup, vendor, izin, dan ticketing." },
    { id: "festival-production", label: "Bagi budget produksi panggung", prompt: "Bagaimana membagi budget sound, stage, LED, lighting, power, dan safety untuk festival tanpa membagi rata secara asal?" },
    { id: "festival-weather", label: "Risiko festival outdoor", prompt: "Apa risiko terbesar festival outdoor saat musim hujan dan perubahan apa yang harus masuk ke operational plan serta go/no-go criteria?" },
    { id: "festival-lineup", label: "Lineup sesuai budget talent", prompt: "Bantu susun struktur lineup festival berdasarkan budget talent, jam panggung, genre, dan daya tarik penjualan tiket." },
    { id: "festival-sponsor-loss", label: "Sponsor Rp200 jt batal", prompt: "Hitung dampak jika sponsor Rp200 juta membatalkan komitmen pada festival 5.000 pax dan berikan skenario penyelamatan tanpa menaikkan harga tiket." },
    { id: "festival-workforce", label: "Shift workforce tiga panggung", prompt: "Susun kebutuhan dan shift workforce untuk festival dua hari tiga panggung, termasuk security, medical, gate, runner, dan crowd control." },
    { id: "festival-operations", label: "Dependency load-in & soundcheck", prompt: "Petakan dependency operasional festival jika load-in baru boleh H-1 pukul 22.00 sementara headliner membutuhkan soundcheck tiga jam." },
  ],
  tour: [
    { id: "tour-plan", label: "Routing tour 5 kota", prompt: "Susun routing tour konser lima kota Jawa-Bali dengan urutan kota yang mempertimbangkan waktu tempuh, load-in, show day, dan recovery crew." },
    { id: "tour-budget", label: "Budget per kota dan pusat", prompt: "Buat struktur budget tour lima kota yang memisahkan biaya pusat, biaya per kota, contingency, dan komponen yang dapat dipakai ulang." },
    { id: "tour-bep", label: "Break-even setiap kota", prompt: "Hitung kerangka break-even tour lima kota berdasarkan kapasitas, ticket mix, biaya tetap pusat, dan biaya variabel per kota." },
    { id: "tour-venue", label: "Shortlist venue multi-kota", prompt: "Bantu cari dan membandingkan kebutuhan venue konser di Jakarta, Bandung, Surabaya, Yogyakarta, dan Bali untuk tour 5.000 pax per kota." },
    { id: "tour-talent", label: "Rider talent lintas kota", prompt: "Petakan keputusan talent, hospitality, transport, dan technical rider yang harus konsisten sepanjang tour lima kota." },
    { id: "tour-vendors", label: "Touring vs local vendor", prompt: "Bandingkan strategi membawa vendor produksi utama sepanjang tour dengan memakai vendor lokal untuk sound, lighting, rigging, dan LED." },
    { id: "tour-workforce", label: "Crew traveling & local", prompt: "Susun model workforce tour yang membedakan core traveling crew, local crew, security, medical, runner, dan batas jam kerja aman." },
    { id: "tour-sponsor", label: "Sponsor nasional & regional", prompt: "Rancang paket sponsorship tour lima kota yang memisahkan hak sponsor nasional, partner regional, activation inventory, dan category conflict." },
    { id: "tour-ticketing", label: "Harga tiket per kota", prompt: "Buat strategi tier tiket tour ketika daya beli, kapasitas venue, dan demand berbeda di setiap kota tanpa mengarang harga lokal." },
    { id: "tour-timeline", label: "Critical path tour H-120", prompt: "Susun critical path tour dari H-120 sampai show terakhir, termasuk kontrak venue, talent, transport, produksi, izin, dan on-sale ticketing." },
    { id: "tour-risk", label: "Satu kota dibatalkan", prompt: "Analisis dampak keuangan dan operasional jika satu kota dalam tour dibatalkan setelah tiket sudah dijual dan vendor sudah dikontrak." },
    { id: "tour-logistics", label: "Turnaround produksi 24 jam", prompt: "Uji kelayakan turnaround produksi tour 24 jam antar kota untuk trucking, rigging, soundcheck, crew rest, dan contingency." },
  ],
  conference: [
    { id: "conference-plan", label: "Conference 2 hari, 1.500 pax", prompt: "Susun rencana conference dua hari di Jakarta untuk 1.500 peserta dengan main stage, breakout rooms, expo, dan networking." },
    { id: "conference-budget", label: "Budget Rp600 jt, max Rp500 jt", prompt: "Buat struktur budget conference dengan baseline Rp600 juta tetapi total pengeluaran maksimal Rp500 juta tanpa mengurangi keamanan dan kualitas program." },
    { id: "conference-bep", label: "BEP tiket, sponsor & exhibitor", prompt: "Hitung kerangka break-even conference 1.500 pax dari tiket, sponsor, dan exhibitor dengan asumsi fee serta complimentary yang jelas." },
    { id: "conference-venue", label: "Venue dengan breakout rooms", prompt: "Cari venue conference di Jakarta untuk 1.500 peserta yang membutuhkan plenary hall, empat breakout rooms, expo area, dan akses loading." },
    { id: "conference-speakers", label: "Struktur speaker & program", prompt: "Susun struktur keynote, panel, workshop, dan moderator untuk conference dua hari dengan alur program yang tidak saling berebut audience." },
    { id: "conference-production", label: "AV, streaming & recording", prompt: "Petakan kebutuhan vendor AV, LED, sound, simultaneous recording, hybrid streaming, internet redundancy, dan technical rehearsal." },
    { id: "conference-workforce", label: "Registration & room crew", prompt: "Susun kebutuhan workforce conference untuk registration, usher, room manager, speaker liaison, technical support, security, dan medical." },
    { id: "conference-sponsor", label: "Paket sponsor & exhibitor", prompt: "Rancang paket sponsor dan exhibitor conference dengan inventory booth, speaking slot, branding, lead capture, serta batas category exclusivity." },
    { id: "conference-ticketing", label: "Early bird sampai corporate", prompt: "Susun tier tiket conference untuk early bird, regular, group, student, dan corporate tanpa mengorbankan target revenue." },
    { id: "conference-timeline", label: "Timeline conference H-90", prompt: "Susun critical path conference dari H-90 sampai hari-H untuk venue, speaker, sponsor, exhibitor, produksi, registrasi, dan run of show." },
    { id: "conference-risk", label: "Risiko program & compliance", prompt: "Identifikasi risiko utama conference terkait perubahan speaker, kepadatan jadwal, kegagalan AV, keamanan data peserta, crowd flow, dan compliance." },
    { id: "conference-cascade", label: "Keynote batal H-2", prompt: "Analisis efek domino jika keynote utama conference batal H-2 terhadap program, sponsor, ticket holder, ruang, produksi, dan komunikasi publik." },
  ],
};

const STARTERS_PER_PAGE = 4;
const DEFAULT_STARTER_PAGES = { concert: 0, festival: 0, tour: 0, conference: 0 };

// Rotates while a request is genuinely pending — never a fixed fake delay,
// just a label cycle for as long as `isThinking` stays true. No internal
// reasoning/chain-of-thought is exposed, only these three neutral phases.
const PROCESSING_STEPS = ["Menganalisis brief…", "Memetakan kebutuhan event…", "Menyusun rekomendasi…"];
const PROCESSING_STEP_INTERVAL_MS = 1600;

// One fixed-height slot shared by the hero intro, the processing state, and
// the response stage. It is deliberately a FIXED height rather than an
// animated one: the hero's concert-motion canvas runs a ResizeObserver that
// reallocates its backing store on every height change, so animating this
// container would repaint/flash the background for the whole transition.
// Fixed height instead means the hero section never resizes, the composer
// and starter prompts never move between states, and a long answer scrolls
// inside the stage rather than growing the page.
//
// Values are sized just above the measured idle hero intro block
// (156 / 183 / 240px at 390 / 900 / 1440) so the idle headline keeps its
// natural placement with a little extra breathing room, while the response
// stage gets a usable reading area.
// Mobile is intentionally taller than the sm tier: the answer wraps to far
// more lines at 390px, so it needs the extra reading area even though its
// idle headline is the shortest.
const INTERACTION_SLOT_HEIGHT = "h-[288px] sm:h-[272px] lg:h-[320px]";

/**
 * -----------------------------------------------------------------------------
 * STITCH AURORA BACKGROUND
 * Pure CSS/SVG & Canvas high-performance ambient fluid wave, concert motion & dot grid (60fps).
 * -----------------------------------------------------------------------------
 */
export function StitchAuroraBackground({ children, className = "", showGrid = true }) {
  return (
    <div className={`relative overflow-hidden bg-transparent ${className}`}>
      {/* 1. Cinematic Concert Motion (Photo Foundation, Moving Beams, Lasers, Crowd Lights, Network Pulses) */}
      <OkkaxConcertMotion />

      {/* 2. High-Precision Blueprint Dot Matrix Grid (Layered ON TOP of Concert Motion) */}
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0 z-[3] opacity-100 stitch-grid-canvas"
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 1.25px, transparent 1.25px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
      )}

      {/* 3. Seamless Bottom Gradient Fade into Canvas */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-[#07070a] z-[5]"
        aria-hidden="true"
      />

      {/* 4. Foreground Content */}
      <div className="relative z-20">{children}</div>
    </div>
  );
}

/**
 * -----------------------------------------------------------------------------
 * GOOGLE STITCH-GRADE HERO COMMAND CAPSULE
 * High-refraction floating command center with mode switcher & suggestion chips.
 * -----------------------------------------------------------------------------
 */
export function StitchHeroCommandCapsule({ className = "", heroIntro = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const restoredSession = useMemo(() => readComposerSession(), []);
  const [selectedMode] = useState(restoredSession?.selectedMode || "concert");
  const [prompt, setPrompt] = useState(restoredSession?.prompt || "");
  const [reasoningMode, setReasoningMode] = useState(
    REASONING_MODES.some((m) => m.id === restoredSession?.reasoningMode)
      ? restoredSession.reasoningMode
      : DEFAULT_REASONING_MODE
  );
  const [isFocused, setIsFocused] = useState(false);
  const [messages, setMessages] = useState(restoredSession?.messages || []);
  const [latestPlan, setLatestPlan] = useState(restoredSession?.semanticPlan || null);
  const [latestCalculation, setLatestCalculation] = useState(restoredSession?.calculation || null);
  const [followUps, setFollowUps] = useState(restoredSession?.followUps || []);
  const [starterPages, setStarterPages] = useState({
    ...DEFAULT_STARTER_PAGES,
    ...(restoredSession?.starterPages || {}),
  });
  const [isThinking, setIsThinking] = useState(false);
  const [processingStepIndex, setProcessingStepIndex] = useState(0);
  const [requestError, setRequestError] = useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = useState("");
  const textareaRef = useRef(null);
  const responseHistoryRef = useRef(null);

  const activeMode = COMPOSER_MODES.find((mode) => mode.id === selectedMode) || COMPOSER_MODES[0];
  const activeStarterList = CONTEXTUAL_STARTERS[activeMode.id];
  const starterPageCount = Math.ceil(activeStarterList.length / STARTERS_PER_PAGE);
  const requestedStarterPage = Number(starterPages[activeMode.id]) || 0;
  const activeStarterPage = ((Math.floor(requestedStarterPage) % starterPageCount) + starterPageCount) % starterPageCount;
  const visibleStarters = activeStarterList.slice(
    activeStarterPage * STARTERS_PER_PAGE,
    (activeStarterPage + 1) * STARTERS_PER_PAGE,
  );

  const handleApplySuggestion = (item) => {
    setPrompt(item.prompt);
    setRequestError("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const rotateStarterPrompts = () => {
    setStarterPages((current) => ({
      ...current,
      [activeMode.id]: (activeStarterPage + 1) % starterPageCount,
    }));
  };

  useEffect(() => {
    try {
      window.sessionStorage.setItem(COMPOSER_SESSION_KEY, JSON.stringify({
        version: 1,
        selectedMode,
        prompt,
        messages,
        semanticPlan: latestPlan,
        calculation: latestCalculation,
        followUps,
        starterPages,
        reasoningMode,
      }));
    } catch {
      // Conversation still works when storage is unavailable.
    }
  }, [followUps, latestCalculation, latestPlan, messages, prompt, reasoningMode, selectedMode, starterPages]);

  useEffect(() => {
    const history = responseHistoryRef.current;
    if (!history || (!messages.length && !isThinking)) return;
    history.scrollTo({
      top: history.scrollHeight,
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  }, [isThinking, messages, shouldReduceMotion]);

  // Grow the textarea to fit its content, then let CSS max-height clamp it so
  // anything longer scrolls inside the field. Resetting to "auto" first is
  // what lets it shrink back down again after a send or a deletion.
  //
  // The empty state is pinned to exactly one row rather than to scrollHeight:
  // Chromium sizes an empty textarea to fit its *placeholder*, and this
  // placeholder wraps to three lines at 390px, which would leave the idle
  // composer needlessly tall on mobile.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const styles = window.getComputedStyle(el);
    const oneRow =
      parseFloat(styles.lineHeight) + parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    el.style.height = "auto";
    el.style.height = `${prompt ? el.scrollHeight : oneRow}px`;
  }, [prompt]);

  // Cycle the processing label only while a request is actually in flight.
  // This never delays or blocks the real response — it just relabels the
  // wait that already exists.
  useEffect(() => {
    if (!isThinking) {
      setProcessingStepIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setProcessingStepIndex((current) => (current + 1) % PROCESSING_STEPS.length);
    }, PROCESSING_STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isThinking]);

  const sendPrompt = async (text, { retry = false } = {}) => {
    const query = String(text || prompt).trim();
    if (!query || isThinking) {
      if (!query) {
        setRequestError("Tulis rencana atau pilih salah satu skenario untuk mulai.");
        textareaRef.current?.focus();
      }
      return;
    }

    const historySource = retry && messages.at(-1)?.role === "user" && messages.at(-1)?.content === query
      ? messages.slice(0, -1)
      : messages;
    const history = historySource
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }));
    const userMessage = { role: "user", content: query, id: `user-${Date.now()}` };
    if (!retry) setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setRequestError("");
    setLastFailedPrompt("");
    setIsThinking(true);

    try {
      const { data } = await api.post("/okkax/chat", {
        message: query,
        history,
        current_route: "/",
        role: user?.roles?.[0] || "anonymous",
        reasoning_mode: reasoningMode,
      });
      const reply = cleanUserFacingReply(data?.reply);
      if (!reply) throw new Error("empty_response");
      setMessages((current) => [...current, { role: "assistant", content: reply, id: `assistant-${Date.now()}` }]);
      setLatestPlan(data?.semantic_plan || null);
      setLatestCalculation(data?.calculation || null);
      setFollowUps(Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 3) : []);
    } catch {
      setRequestError("Okkax Copilot belum dapat menyelesaikan respons ini. Percakapan Anda tetap tersimpan—silakan coba lagi.");
      setLastFailedPrompt(query);
    } finally {
      setIsThinking(false);
    }
  };

  const handleExecute = (e) => {
    if (e) e.preventDefault();
    sendPrompt(prompt);
  };

  const handleReset = () => {
    setMessages([]);
    setPrompt("");
    setLatestPlan(null);
    setLatestCalculation(null);
    setFollowUps([]);
    setRequestError("");
    setLastFailedPrompt("");
    setStarterPages({ ...DEFAULT_STARTER_PAGES });
    try {
      window.sessionStorage.removeItem(COMPOSER_SESSION_KEY);
      window.sessionStorage.removeItem(COMPOSER_HANDOFF_KEY);
    } catch {
      // No-op when storage is unavailable.
    }
    textareaRef.current?.focus();
  };

  const handleStudioHandoff = () => {
    const target = "/app/studio?event_id=new&domain=EVENT&view=brief&from=homepage-copilot";
    try {
      window.sessionStorage.setItem(COMPOSER_HANDOFF_KEY, JSON.stringify({
        version: 1,
        source: "homepage-copilot",
        target,
        conversation: messages.map(({ role, content }) => ({ role, content })),
        semantic_plan: latestPlan,
        calculation: latestCalculation,
        state: publicStateFromPlan(latestPlan),
        saved_at: new Date().toISOString(),
      }));
    } catch {
      // Navigation remains available even when storage is unavailable.
    }
    navigate(user ? target : `/login?next=${encodeURIComponent(target)}`);
  };

  const publicState = publicStateFromPlan(latestPlan);
  const stateItems = [
    publicState.city && ["Kota", publicState.city],
    publicState.capacity && ["Kapasitas", `${num(publicState.capacity)} pax`],
    publicState.event_budget_ceiling && ["Event ceiling", idr(publicState.event_budget_ceiling)],
    publicState.sound_budget_ceiling && ["Sound ceiling", idr(publicState.sound_budget_ceiling)],
    publicState.sponsor_loss && ["Sponsor batal", `−${idr(publicState.sponsor_loss)}`],
  ].filter(Boolean);

  // Which of the three mutually exclusive views occupies the shared slot.
  // The first request gets the dedicated processing view; once an answer
  // exists a follow-up keeps the response stage on screen and renders the
  // thinking indicator inside it, so the answer never disappears mid-turn.
  const hasAnswer = messages.some((message) => message.role === "assistant");
  const slotPhase = isThinking && !hasAnswer
    ? "thinking"
    : messages.length > 0 || requestError
      ? "response"
      : "idle";

  // Fade out is shorter than fade in, so the outgoing view clears before the
  // incoming one settles. AnimatePresence mode="wait" sequences the two.
  const slotTransition = {
    enter: { duration: shouldReduceMotion ? 0.12 : 0.22, ease: OKX_EASE },
    exit: { duration: shouldReduceMotion ? 0.1 : 0.14, ease: OKX_EASE_FAST },
  };
  const slotMotion = {
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0, transition: slotTransition.enter },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -6, transition: slotTransition.exit },
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} data-testid="stitch-command-capsule">
      {/* SHARED HERO INTERACTION SLOT
          One fixed-height band that holds exactly one of: the hero intro
          (idle), the processing state, or the response stage. Because the
          height never changes, the composer and starter prompts below stay
          pinned in place across every state and a long answer scrolls
          inside the stage instead of stretching the homepage. */}
      <div className={`relative mb-3 w-full ${INTERACTION_SLOT_HEIGHT}`} data-testid="hero-interaction-slot" data-phase={slotPhase}>
        <AnimatePresence mode="wait" initial={false}>
          {slotPhase === "idle" && (
            <motion.div key="idle" {...slotMotion} className="flex h-full flex-col items-center justify-center text-center">
              {heroIntro}
            </motion.div>
          )}

          {slotPhase === "thinking" && (
            <motion.div key="thinking" {...slotMotion} className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center" data-testid="homepage-copilot-thinking" aria-live="polite">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
                  <LoaderCircle size={16} className="animate-spin text-zinc-300" />
                </span>
                <div className="font-gemini text-sm font-semibold text-white sm:text-base">{PROCESSING_STEPS[processingStepIndex]}</div>
                <div className="font-gemini text-[11px] text-zinc-500">Okkax Copilot sedang bekerja pada brief Anda.</div>
              </div>
            </motion.div>
          )}

          {slotPhase === "response" && (
            <motion.div key="response" {...slotMotion} className="h-full">
              {/* Solid Okkax surface: no translucency, so the hero's concert
                  lighting behind it can never bleed a color tint through. */}
              <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#07070a] text-left shadow-[0_20px_60px_rgba(0,0,0,0.5)]" data-testid="homepage-copilot-response" aria-live="polite">
                {/* Header + live state chips share one compact row. */}
                <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-3.5 py-2 sm:px-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05]"><Sparkles size={12} className="text-white" /></span>
                  <span className="font-gemini shrink-0 text-[11px] font-bold text-white">Okkax Copilot</span>
                  {stateItems.length > 0 && (
                    <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto okx-scroll" data-testid="homepage-copilot-state">
                      {stateItems.map(([label, value]) => (
                        <span key={label} className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5">
                          <span className="font-gemini-mono text-[8px] uppercase tracking-wider text-zinc-500">{label} </span>
                          <span className="font-gemini text-[10.5px] font-semibold text-zinc-200">{value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={handleReset} className="font-gemini ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200" data-testid="homepage-copilot-reset"><RotateCcw size={11} /> Mulai ulang</button>
                </div>

                {/* The only scrolling region: long answers stay in here. */}
                <div className="relative min-h-0 flex-1">
                <div ref={responseHistoryRef} className="h-full space-y-2.5 overflow-y-auto overscroll-contain okx-scroll px-3.5 py-2.5 sm:px-4" data-testid="homepage-copilot-history">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <div key={message.id} data-testid="homepage-copilot-message" data-role="user" className="flex justify-end">
                        {/* Echoed prompt is context, not content: two lines
                            keep the answer itself the focus of the stage. */}
                        <div className="font-gemini line-clamp-2 max-w-[85%] rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11.5px] leading-5 text-zinc-300">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div key={message.id} data-testid="homepage-copilot-message" data-role="assistant" className="font-gemini">
                        <ComposerMarkdown text={message.content} />
                      </div>
                    )
                  )}
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: shouldReduceMotion ? 0.1 : 0.2, ease: OKX_EASE }}
                      className="flex items-center gap-2.5 text-xs text-zinc-400"
                      data-testid="homepage-copilot-thinking"
                    >
                      <LoaderCircle size={14} className="shrink-0 animate-spin text-zinc-300" />
                      <span className="font-gemini">{PROCESSING_STEPS[processingStepIndex]}</span>
                    </motion.div>
                  )}
                  {requestError && (
                    <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3" data-testid="homepage-copilot-error">
                      <div className="font-gemini flex items-start gap-2.5 text-[11.5px] leading-5 text-amber-100/80"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>{requestError}</span></div>
                      {lastFailedPrompt && <button type="button" onClick={() => sendPrompt(lastFailedPrompt, { retry: true })} className="font-gemini mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-100/15 px-2.5 py-1 text-[11px] font-bold text-amber-50 transition-colors hover:bg-amber-100/[0.08]" data-testid="homepage-copilot-retry"><RotateCcw size={11} /> Coba lagi</button>}
                    </div>
                  )}
                </div>
                {/* Soft fade to the surface colour so a clipped line at the
                    scroll boundary reads as "more below", not as broken text. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#07070a] to-transparent" aria-hidden="true" />
                </div>

                {/* Follow-ups and the Event Studio handoff share one footer row. */}
                {(followUps.length > 0 || hasAnswer) && (
                  <div className="flex shrink-0 items-center gap-2.5 border-t border-white/[0.07] bg-white/[0.02] px-3.5 py-2 sm:px-4">
                    {/* Follow-up chips are secondary: at 390px they would
                        crowd the handoff CTA, so the CTA gets the row. */}
                    {followUps.length > 0 && !isThinking && (
                      <div className="hidden min-w-0 flex-1 gap-1.5 overflow-x-auto okx-scroll sm:flex">
                        {followUps.map((suggestion) => (
                          <button key={suggestion} type="button" onClick={() => { setPrompt(suggestion); setRequestError(""); textareaRef.current?.focus(); }} className="font-gemini shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10.5px] text-zinc-400 transition-colors hover:border-white/20 hover:text-white">{suggestion}</button>
                        ))}
                      </div>
                    )}
                    {hasAnswer && (
                      <button type="button" onClick={handleStudioHandoff} className="font-gemini ml-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-1.5 text-[11px] font-bold text-black transition-all hover:bg-zinc-200 active:scale-[0.98]" data-testid="homepage-copilot-handoff">Lanjutkan di Event Studio <Send size={12} /></button>
                    )}
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Composer — compact conversational input. Configurator-style mode
          buttons and the "Lihat Demo"/"Simulasikan Event" toolbar are gone;
          Copilot infers konser/festival/tour/conference from the prompt text
          itself (backend NLU, unchanged), and a single circular send button
          plus a compact reasoning-depth selector replace the old CTA row. */}
      <div
        className={`relative rounded-3xl border transition-all duration-300 ${
          isFocused
            ? "border-white/[0.28] bg-[#0d0d1c]/95 shadow-[0_28px_90px_rgba(0,0,0,0.95),0_0_60px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.3)]"
            : "border-white/[0.12] bg-[#0a0a14]/85 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(79,70,229,0.1),inset_0_1px_0_rgba(255,255,255,0.16)]"
        } backdrop-blur-3xl p-3 sm:p-3.5 text-left`}
      >
        {/* Top Atmosphere Subtle Specular Highlight */}
        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

        <form onSubmit={handleExecute} className="flex flex-col gap-1.5">
          {/* Main Prompt Input Area. Height is driven by content (see the
              auto-grow effect) and clamped by max-h, so a long prompt stays
              fully editable via the textarea's own internal scroll instead of
              being clipped or pushing the toolbar out of view. */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              data-testid="homepage-copilot-input"
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendPrompt(prompt);
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Tanyakan atau rancang event…"
              className="okx-scroll max-h-[7.5rem] w-full resize-none overflow-y-auto bg-transparent px-1 py-1 text-[14px] leading-6 text-white placeholder-zinc-500 outline-none focus:ring-0 font-gemini sm:text-[15px]"
            />
          </div>

          {/* Footer: reasoning-depth selector (left) + circular send (right). */}
          <div className="flex items-center justify-between gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="composer-reasoning-trigger"
                  aria-label={`Mode reasoning saat ini: ${REASONING_MODES.find((m) => m.id === reasoningMode)?.label}`}
                  className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-gemini text-[11.5px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  <span>{REASONING_MODES.find((m) => m.id === reasoningMode)?.label}</span>
                  <ChevronDown size={12} className="text-zinc-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                data-testid="composer-reasoning-menu"
                className="min-w-[8.5rem] rounded-xl border border-white/[0.1] bg-[#0c0c14] p-1 text-left shadow-2xl"
              >
                {REASONING_MODES.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onSelect={() => setReasoningMode(m.id)}
                    data-testid={`composer-reasoning-option-${m.id}`}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 font-gemini text-[11.5px] text-zinc-300 focus:bg-white/[0.08] focus:text-white"
                  >
                    <span>{m.label}</span>
                    {reasoningMode === m.id && <Check size={12} className="shrink-0 text-white" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="submit"
              data-testid="hero-primary-simulate-btn"
              disabled={isThinking || !prompt.trim()}
              aria-label={messages.length ? "Kirim follow-up ke Okkax Copilot" : "Kirim ke Okkax Copilot"}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed sm:h-10 sm:w-10 ${
                prompt.trim() && !isThinking
                  ? "cursor-pointer bg-[var(--okx-pink-glow)] text-white shadow-[0_4px_20px_rgba(255,46,126,0.35)]"
                  : "bg-white/[0.06] text-zinc-600"
              }`}
            >
              {isThinking ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={16} className="stroke-[2.5]" />}
            </button>
          </div>
        </form>
      </div>

      {/* Four contextual starter prompts, matched to the composer's width.
          Page size stays fixed to prevent layout shift. */}
      <div className="relative mt-1 w-full">
        <div
          className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="hero-suggestions-grid"
          data-preset={activeMode.id}
          data-page={activeStarterPage}
        >
          {visibleStarters.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleApplySuggestion(item)}
              title={item.label}
              aria-label={item.label}
              data-testid={`hero-suggestion-${idx}`}
              data-prompt-id={item.id}
              className={`group flex h-[30px] min-w-0 items-center justify-center gap-1 rounded-md border border-white/[0.07] bg-[#0c0c16]/70 px-2 text-[10px] font-medium text-zinc-300 shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:scale-[0.99] ${idx === visibleStarters.length - 1 ? "pr-7" : ""}`}
            >
              <Sparkles size={10} className="shrink-0 text-zinc-500 transition-colors group-hover:text-white" />
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={rotateStarterPrompts}
          data-testid="hero-suggestions-rotate"
          aria-label={`Ganti contoh ${activeMode.label}, halaman ${activeStarterPage + 1} dari ${starterPageCount}`}
          title="Lihat starter prompt berikutnya"
          className="absolute bottom-[3px] right-[3px] inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-[#101018] text-zinc-500 shadow-sm transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        >
          <RotateCcw size={10} />
        </button>
      </div>
    </div>
  );
}
