import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Music,
  RotateCcw,
  Send,
  Tent,
  Compass,
  Layers,
} from "lucide-react";
import OkkaxConcertMotion from "./OkkaxConcertMotion";
import { api, idr, num } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
      .replace(/^\s*\[RECOMMENDATION\]\s*/i, "**Rekomendasi:** "))
    .join("\n")
    .trim();

const formatInline = (text) => {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
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
      tableRows.forEach((row) => nodes.push(<p key={`table-fallback-${nodes.length}`} className="text-sm leading-6 text-zinc-300">{formatInline(row.join(" · "))}</p>));
      tableRows = [];
      return;
    }
    const header = tableRows[0];
    const body = tableRows.slice(2);
    nodes.push(
      <div key={`table-${nodes.length}`} className="my-3 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/20">
        <table className="w-full min-w-[32rem] text-left text-xs">
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
      nodes.push(<div key={`space-${index}`} className="h-2" />);
    } else if (/^#{2,4}\s/.test(trimmed)) {
      nodes.push(<h4 key={`heading-${index}`} className="mb-1 mt-3 text-sm font-bold tracking-tight text-white sm:text-base">{formatInline(trimmed.replace(/^#{2,4}\s/, ""))}</h4>);
    } else if (/^[-*]\s/.test(trimmed)) {
      nodes.push(<div key={`bullet-${index}`} className="my-1 flex items-start gap-2.5 text-sm leading-6 text-zinc-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" /><span>{formatInline(trimmed.slice(2))}</span></div>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      nodes.push(<div key={`number-${index}`} className="my-1 flex items-start gap-2.5 text-sm leading-6 text-zinc-300"><span className="min-w-5 font-gemini-mono text-xs text-zinc-500">{match[1]}.</span><span>{formatInline(match[2])}</span></div>);
    } else if (trimmed === "---") {
      nodes.push(<div key={`rule-${index}`} className="my-3 h-px bg-white/[0.07]" />);
    } else {
      nodes.push(<p key={`paragraph-${index}`} className="text-sm leading-6 text-zinc-300">{formatInline(trimmed)}</p>);
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

const COMPOSER_MODES = [
  { id: "concert", label: "Konser Live", icon: Music, prompt: "Saya ingin merancang konser live. Bantu mulai dari kapasitas, budget, venue, dan ticket economics." },
  { id: "festival", label: "Music Fest", icon: Tent, prompt: "Saya ingin merancang festival musik. Bantu susun kapasitas, budget, venue, talent, dan risiko operasionalnya." },
  { id: "tour", label: "Tour Production", icon: Compass, prompt: "Saya ingin merancang tour production. Bantu petakan kota, routing, logistik, produksi, dan economics-nya." },
  { id: "conference", label: "Conference", icon: Layers, prompt: "Saya ingin merancang conference. Bantu susun kapasitas, venue, program, production, dan struktur budgetnya." },
];

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
export function StitchHeroCommandCapsule({ className = "" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const restoredSession = useMemo(() => readComposerSession(), []);
  const [selectedMode, setSelectedMode] = useState(restoredSession?.selectedMode || "concert");
  const [prompt, setPrompt] = useState(restoredSession?.prompt || "");
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
  const [requestError, setRequestError] = useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = useState("");
  const textareaRef = useRef(null);
  const responseEndRef = useRef(null);

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

  const handleSelectMode = (mode) => {
    setSelectedMode(mode.id);
    if (!prompt.trim()) setPrompt(mode.prompt);
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
      }));
    } catch {
      // Conversation still works when storage is unavailable.
    }
  }, [followUps, latestCalculation, latestPlan, messages, prompt, selectedMode, starterPages]);

  useEffect(() => {
    if (messages.length || isThinking) responseEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isThinking, messages]);

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

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} data-testid="stitch-command-capsule">
      {/* Outer Floating Glass Capsule */}
      <div
        className={`relative rounded-3xl border transition-all duration-300 ${
          isFocused
            ? "border-white/[0.28] bg-[#0d0d1c]/95 shadow-[0_28px_90px_rgba(0,0,0,0.95),0_0_60px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.3)]"
            : "border-white/[0.12] bg-[#0a0a14]/85 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(79,70,229,0.1),inset_0_1px_0_rgba(255,255,255,0.16)]"
        } backdrop-blur-3xl p-4 sm:p-5 text-left`}
      >
        {/* Top Atmosphere Subtle Specular Highlight */}
        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

        <form onSubmit={handleExecute} className="flex flex-col gap-4">
          {/* Main Prompt Input Area (Top - Google Stitch Style) */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              data-testid="homepage-copilot-input"
              rows={2}
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
              placeholder="What live event shall we design? (e.g. Konser 15.000 pax di Senayan, kalkulasi staging, rider & tiket)..."
              className="w-full resize-none bg-transparent px-1 py-1 text-base sm:text-lg text-white placeholder-zinc-500 outline-none focus:ring-0 leading-relaxed font-gemini"
            />
          </div>

          {/* Bottom Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
            {/* Left: Mode Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              {COMPOSER_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSelectMode(mode)}
                    data-testid={`hero-mode-${mode.id}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-white text-black font-bold shadow-md scale-[1.02]"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <Icon size={13} className={isActive ? "text-black" : "text-zinc-400"} />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: 1 Secondary CTA + 1 Primary CTA */}
            <div className="flex items-center gap-2.5">
              <Link
                to="/demo"
                data-testid="hero-secondary-demo-btn"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:border-white/30 hover:bg-white/[0.08] hover:text-white transition-all duration-200 cursor-pointer"
              >
                <Compass size={13} className="text-zinc-400" />
                <span>Lihat Demo</span>
              </Link>

              <button
                type="submit"
                data-testid="hero-primary-simulate-btn"
                disabled={isThinking}
                className="group inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 px-4 sm:px-5 py-2 text-xs font-bold text-black shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:cursor-wait disabled:opacity-70"
              >
                <span>{messages.length ? "Kirim Follow-up" : "Simulasikan Event"}</span>
                {isThinking ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />}
              </button>
            </div>
          </div>
        </form>
      </div>

      {(messages.length > 0 || isThinking || requestError) && (
        <section className="mt-3 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#090910]/92 text-left shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl" data-testid="homepage-copilot-response" aria-live="polite">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05]"><Sparkles size={13} className="text-white" /></span>
              <div>
                <div className="text-xs font-bold text-white">Okkax Copilot</div>
                <div className="text-[10px] text-zinc-500">Interactive event reasoning</div>
              </div>
            </div>
            <button type="button" onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200" data-testid="homepage-copilot-reset"><RotateCcw size={11} /> Mulai ulang</button>
          </div>

          {stateItems.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] px-4 py-2.5 sm:flex-wrap sm:px-5" data-testid="homepage-copilot-state">
              {stateItems.map(([label, value]) => (
                <div key={label} className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5">
                  <span className="font-gemini-mono text-[8px] uppercase tracking-wider text-zinc-500">{label}</span>
                  <div className="mt-0.5 text-[11px] font-semibold text-zinc-200">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="max-h-[30rem] space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5" data-testid="homepage-copilot-history">
            {messages.map((message) => (
              <div key={message.id} data-testid="homepage-copilot-message" data-role={message.role} className={message.role === "user" ? "ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-sm leading-6 text-black" : "max-w-none rounded-2xl rounded-tl-md border border-white/[0.06] bg-white/[0.025] px-3.5 py-3.5"}>
                {message.role === "assistant" ? <ComposerMarkdown text={message.content} /> : message.content}
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-xs text-zinc-400" data-testid="homepage-copilot-thinking">
                <LoaderCircle size={14} className="animate-spin text-zinc-300" />
                <span>Okkax Copilot sedang menyusun reasoning dan kalkulasi…</span>
              </div>
            )}
            {requestError && (
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-3.5" data-testid="homepage-copilot-error">
                <div className="flex items-start gap-2.5 text-xs leading-5 text-amber-100/80"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>{requestError}</span></div>
                {lastFailedPrompt && <button type="button" onClick={() => sendPrompt(lastFailedPrompt, { retry: true })} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-100/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-50 transition-colors hover:bg-amber-100/[0.08]" data-testid="homepage-copilot-retry"><RotateCcw size={11} /> Coba lagi</button>}
              </div>
            )}
            <div ref={responseEndRef} />
          </div>

          {followUps.length > 0 && !isThinking && (
            <div className="border-t border-white/[0.06] px-4 py-3 sm:px-5">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Lanjutkan analisis</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {followUps.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => { setPrompt(suggestion); setRequestError(""); textareaRef.current?.focus(); }} className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:text-white">{suggestion}</button>
                ))}
              </div>
            </div>
          )}

          {messages.some((message) => message.role === "assistant") && (
            <div className="flex flex-col justify-between gap-3 border-t border-white/[0.07] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <div className="flex items-center gap-2 text-[10px] text-zinc-500"><CheckCircle2 size={12} className="text-zinc-400" /> Rencana siap dibawa ke workspace saat Anda ingin mengeksekusi.</div>
              <button type="button" onClick={handleStudioHandoff} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition-all hover:bg-zinc-200 active:scale-[0.98]" data-testid="homepage-copilot-handoff">Lanjutkan di Event Studio <Send size={12} /></button>
            </div>
          )}
        </section>
      )}

      {/* Four contextual starter prompts; page size stays fixed to prevent layout shift. */}
      <div className="mx-auto mt-4 w-full max-w-3xl px-1">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500" data-testid="hero-suggestions-context">
            Starter · {activeMode.label}
          </span>
          <button
            type="button"
            onClick={rotateStarterPrompts}
            data-testid="hero-suggestions-rotate"
            aria-label={`Ganti contoh ${activeMode.label}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
          >
            <RotateCcw size={10} />
            Contoh {activeStarterPage + 1}/{starterPageCount}
          </button>
        </div>
        <div
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          data-testid="hero-suggestions-grid"
          data-preset={activeMode.id}
          data-page={activeStarterPage}
        >
          {visibleStarters.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleApplySuggestion(item)}
              data-testid={`hero-suggestion-${idx}`}
              data-prompt-id={item.id}
              className="group flex min-h-[42px] min-w-0 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#0c0c16]/75 px-4 py-2.5 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-white/30 hover:bg-white/[0.08] hover:text-white active:scale-[0.99]"
            >
              <Sparkles size={12} className="shrink-0 text-zinc-400 transition-colors group-hover:text-white" />
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
