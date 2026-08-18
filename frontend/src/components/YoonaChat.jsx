import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  Send,
  Trash2,
  User,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Check,
  Copy,
  Activity,
  Terminal,
  Music,
  Ticket,
  DollarSign,
  ShieldCheck,
  CornerDownLeft,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// -----------------------------------------------------------------------------
// Official OKKAX Brand Mark (Identical to Favicon / Brand Identity)
// -----------------------------------------------------------------------------
export function CopilotIntelligenceIcon({ className = "h-4 w-4", ...props }) {
  return (
    <img
      src="/assets/okkax-x-mark-v3.png"
      alt="OKKAX"
      className={`object-contain ${className}`}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// Markdown & Structured Content Renderer
// -----------------------------------------------------------------------------
function renderFormattedMarkdown(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let keyIdx = 0;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(2);

      elements.push(
        <div key={`table-${keyIdx++}`} className="my-3 overflow-x-auto rounded-xl border border-white/[0.1] bg-[#0c0c14]/90 font-gemini shadow-inner">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.1] bg-white/[0.03] font-gemini-display">
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="px-3.5 py-2.5 font-bold text-zinc-100 uppercase tracking-wider text-[10.5px]">
                    {formatInlineText(cell.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] font-mono tabular-nums text-[11.5px]">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[0.03] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-zinc-300">
                      {formatInlineText(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      inTable = true;
      const cells = line.split("|").slice(1, -1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${keyIdx++}`} className="mt-3.5 mb-2 text-[13.5px] font-bold text-white tracking-tight font-gemini-display flex items-center gap-2">
          <span>{formatInlineText(line.replace("### ", ""))}</span>
        </h4>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h5 key={`h4-${keyIdx++}`} className="mt-3 mb-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-[0.16em] font-mono">
          {formatInlineText(line.replace("#### ", ""))}
        </h5>
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <div key={`li-${keyIdx++}`} className="flex items-start gap-2.5 my-1 text-xs sm:text-[12.5px] text-zinc-300 font-gemini">
          <span className="text-zinc-500 mt-1 font-bold select-none text-[9px] shrink-0">◆</span>
          <span className="flex-1 leading-relaxed">{formatInlineText(line.trim().substring(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)$/);
      elements.push(
        <div key={`oli-${keyIdx++}`} className="flex items-start gap-2.5 my-1.5 text-xs sm:text-[12.5px] text-zinc-300 font-gemini">
          <span className="font-mono text-zinc-400 font-semibold text-[11px] min-w-[20px] shrink-0">
            {match[1]}.
          </span>
          <span className="flex-1 leading-relaxed">{formatInlineText(match[2])}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`space-${keyIdx++}`} className="h-2" />);
    } else {
      elements.push(
        <p key={`p-${keyIdx++}`} className="my-1.5 text-xs sm:text-[12.5px] leading-relaxed text-zinc-300 font-gemini">
          {formatInlineText(line)}
        </p>
      );
    }
  }

  if (inTable) flushTable();
  return elements;
}

function formatInlineText(text) {
  if (!text) return "";

  const parts = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderBoldItalic(text.substring(lastIndex, match.index)));
    }
    const label = match[1];
    const url = match[2];
    if (url.startsWith("/")) {
      parts.push(
        <Link
          key={match.index}
          to={url}
          className="inline-flex items-center gap-1 font-semibold text-white underline decoration-zinc-500 hover:text-zinc-200 transition-colors"
        >
          {label}
          <ArrowRight className="h-2.5 w-2.5 inline text-zinc-400" />
        </Link>
      );
    } else {
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-white underline decoration-zinc-500 hover:text-zinc-200 transition-colors"
        >
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderBoldItalic(text.substring(lastIndex)));
  }

  return parts;
}

function renderBoldItalic(raw) {
  const boldParts = raw.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((sub, sIdx) => {
      if (sub.startsWith("*") && sub.endsWith("*")) {
        return (
          <em key={`${idx}-${sIdx}`} className="italic text-zinc-200">
            {sub.slice(1, -1)}
          </em>
        );
      }
      return sub;
    });
  });
}

// -----------------------------------------------------------------------------
// Curated Fast Scenario Triggers
// -----------------------------------------------------------------------------
const FAST_SCENARIOS = [
  { id: "concert", label: "Konser Stadion 50k", icon: Music, prompt: "Bantu rancang kalkulasi finansial dan teknis sound system konser stadion 50.000 pax" },
  { id: "fest", label: "Festival Musik 5k", icon: Ticket, prompt: "Hitung alokasi budget dan target tiket konser musik 5.000 pax Rp 1.25 Milyar" },
  { id: "sponsor", label: "Valuasi Sponsor", icon: DollarSign, prompt: "Bagaimana cara menentukan harga paket Presenting Sponsor dan hak aktivasi brand?" },
  { id: "scanner", label: "SOP Scanner Gate", icon: ShieldCheck, prompt: "Bagaimana SOP validasi scanner tiket QR di gate pintu masuk saat hari H?" },
  { id: "economy", label: "Dampak Ekonomi", icon: Activity, prompt: "Bagaimana formula perhitungan multiplier effect ekonomi di Live Event Map (/peta)?" },
];

export default function YoonaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "### Halo! Saya OKKAX Copilot — Principal Event Intelligence & Copilot Resmi OKKAX.\n\nSaya menguasai seluruh aspek operasional live event, kalkulasi budget, arsitektur Event Graph, monetisasi sponsor/tenant, hingga SOP gate scanner di 15+ kota Indonesia.\n\nPilih modul skenario di atas atau tanyakan langsung rencana acara Anda.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [suggestions, setSuggestions] = useState([
    "Bantu hitung budget & break-even festival 5.000 pax",
    "Bagaimana cara kerja Event Graph dan status nodenya?",
    "Jelaskan sistem verifikasi scanner tiket di pintu masuk",
    "Bagaimana pembagian benefit untuk Presenting Sponsor?",
  ]);

  const { user } = useAuth();
  const location = useLocation();
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (location.search.includes("copilot=open")) {
      setIsOpen(true);
      setIsMinimized(false);
    }
  }, [location.search]);

  useEffect(() => {
    const role = user?.roles?.[0] || "audience";
    api
      .get(`/okkax/suggestions?route=${encodeURIComponent(location.pathname)}&role=${role}`)
      .then(({ data }) => {
        if (data?.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, [location.pathname, user]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query || !query.trim() || loading) return;

    const userMsg = {
      role: "user",
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const payload = {
        message: query.trim(),
        history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        current_route: location.pathname,
        role: user?.roles?.[0] || "organizer",
      };

      const res = await api.post("/okkax/chat", payload);
      const data = res.data;

      const aiMsg = {
        role: "assistant",
        content: data.reply || "Maaf, saya tidak dapat merespons saat ini.",
        engine: data.engine,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Maaf, terjadi kendala koneksi ke mesin inteligensi OKKAX Copilot. Pastikan backend server aktif.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Percakapan telah direset. Ada rencana acara atau analisis teknis baru yang ingin kita bahas bersama OKKAX Copilot?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Capsule */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          data-testid="yoona-chat-trigger"
          className="font-gemini fixed bottom-6 right-6 z-50 group flex items-center gap-3 rounded-2xl border border-white/[0.16] bg-[#09090e]/95 backdrop-blur-2xl px-4 py-2.5 text-white shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_24px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-300 hover:scale-[1.03] hover:border-white/40 hover:shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_36px_rgba(255,255,255,0.12)] active:scale-[0.98] cursor-pointer"
          aria-label="Buka OKKAX Copilot"
        >
          {/* Official OKKAX Favicon Brand Mark Tile */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.5)] group-hover:border-white/50 transition-all p-1.5">
            <CopilotIntelligenceIcon className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300" />
            <span className="absolute inset-0 rounded-xl bg-white/[0.04] group-hover:bg-white/[0.08] transition-colors pointer-events-none" />
          </div>

          <div className="flex flex-col text-left pr-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-white font-gemini-display">OKKAX</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            </div>
            <span className="text-[10px] font-semibold tracking-wider text-zinc-400 font-mono uppercase group-hover:text-zinc-200 transition-colors">
              Event Copilot
            </span>
          </div>
        </button>
      )}

      {/* Floating Obsidian Command Console */}
      {isOpen && (
        <div
          data-testid="yoona-chat-modal"
          className={`font-gemini fixed z-50 flex flex-col border border-white/[0.14] bg-[#09090e]/98 shadow-[0_32px_100px_rgba(0,0,0,0.95),0_0_30px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-3xl transition-all duration-200 overflow-hidden ${
            isExpanded
              ? "inset-4 md:inset-8 rounded-[32px]"
              : isMinimized
              ? "bottom-6 right-6 h-14 w-88 rounded-2xl"
              : "bottom-6 right-6 h-[650px] max-h-[88vh] w-[460px] max-w-[calc(100vw-32px)] rounded-[28px]"
          }`}
        >
          {/* Top Ambient Highlight Beam */}
          <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-white/[0.35] to-transparent shrink-0" />

          {/* Unified Console Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0c0c14]/90 px-4 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.16] shadow-sm p-1.5 shrink-0">
                <CopilotIntelligenceIcon className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-[13px] font-bold tracking-tight text-white font-gemini-display">OKKAX Copilot</h3>
                  <span className="rounded-full bg-white/[0.06] border border-white/[0.12] px-2 py-0.5 text-[9px] font-semibold text-zinc-300 font-mono">
                    Neural Ops Core
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono mt-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  <span>Real-time Event Graph Intelligence</span>
                </div>
              </div>
            </div>

            {/* Minimalist Action Controls Pill */}
            <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl text-zinc-400">
              <button
                onClick={clearChat}
                title="Reset Percakapan"
                data-testid="yoona-btn-clear"
                className="rounded-lg p-1.5 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Perkecil Ukuran" : "Maksimalkan Layar"}
                data-testid="yoona-btn-expand"
                className="hidden sm:block rounded-lg p-1.5 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Buka Window" : "Minimalkan"}
                data-testid="yoona-btn-minimize"
                className="rounded-lg p-1.5 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Tutup"
                data-testid="yoona-btn-close"
                className="rounded-lg p-1.5 hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Console Body Content */}
          {!isMinimized && (
            <>
              {/* Fast Scenario Ribbon */}
              <div className="border-b border-white/[0.06] bg-[#07070b] px-3.5 py-2 overflow-x-auto whitespace-nowrap okx-custom-scrollbar shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0 font-mono mr-1">
                    Modul:
                  </span>
                  {FAST_SCENARIOS.map((sc) => {
                    const IconComponent = sc.icon;
                    return (
                      <button
                        key={sc.id}
                        onClick={() => handleSend(sc.prompt)}
                        disabled={loading}
                        data-testid={`yoona-scenario-${sc.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.08] px-3 py-1 text-[11px] text-zinc-300 hover:text-white transition-all shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <IconComponent size={11} className="text-zinc-400" />
                        <span>{sc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm okx-custom-scrollbar bg-[#050508]/60">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    data-testid={`yoona-message-${m.role}-${idx}`}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Role Header Indicator */}
                    <div className="flex items-center gap-2 mb-1.5 px-1 text-[10px] text-zinc-500 font-mono">
                      {m.role === "assistant" ? (
                        <>
                          <span className="flex items-center gap-1 text-zinc-300 font-bold">
                            <Sparkles size={10} className="text-zinc-400" />
                            OKKAX Copilot
                          </span>
                          <span>· {m.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <span>{m.timestamp}</span>
                          <span className="text-zinc-400 font-bold">Anda</span>
                        </>
                      )}
                    </div>

                    {/* Bubble Card */}
                    <div
                      className={`relative rounded-2xl p-4 text-xs sm:text-[12.5px] leading-relaxed transition-all ${
                        m.role === "user"
                          ? "max-w-[85%] bg-white/[0.08] border border-white/[0.16] text-white rounded-tr-sm shadow-sm"
                          : "w-full bg-[#101017]/85 border border-white/[0.08] text-zinc-200 rounded-tl-sm shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap font-medium">{m.content}</p>
                      ) : (
                        <div className="leading-relaxed">
                          {renderFormattedMarkdown(m.content)}
                        </div>
                      )}

                      {/* Card Footer Actions for Assistant */}
                      {m.role === "assistant" && (
                        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                          <div className="flex items-center gap-1.5">
                            {m.engine ? (
                              <span className="text-zinc-400">{m.engine}</span>
                            ) : (
                              <span className="text-zinc-500">Event Graph Neural Inference</span>
                            )}
                          </div>
                          <button
                            onClick={() => copyMessage(m.content, idx)}
                            title="Salin Respons"
                            data-testid={`yoona-copy-btn-${idx}`}
                            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/[0.06]"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading State Animation */}
                {loading && (
                  <div className="w-full rounded-2xl bg-[#101017]/80 border border-white/[0.08] p-4 text-xs text-zinc-400 flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] p-1.5">
                      <CopilotIntelligenceIcon className="h-full w-full object-contain animate-spin" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce" />
                          <div className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.2s]" />
                          <div className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.4s]" />
                        </div>
                        <span className="text-[11px] font-mono text-zinc-300 font-semibold">Memproses inferensi data...</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">Menghubungkan Event Graph, alokasi budget, & SOP</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Dynamic Suggestions Strip */}
              {suggestions.length > 0 && (
                <div className="border-t border-white/[0.06] bg-[#07070b] px-3.5 py-2 shrink-0">
                  <div className="mb-1.5 text-[9.5px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <Sparkles className="h-3 w-3 text-zinc-400" />
                    <span>Rekomendasi Pertanyaan:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto okx-custom-scrollbar">
                    {suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(sug)}
                        disabled={loading}
                        data-testid={`yoona-chip-${sIdx}`}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-all text-left flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <span className="truncate">{sug}</span>
                        <ArrowRight size={10} className="text-zinc-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Integrated Studio Command Bar */}
              <div className="border-t border-white/[0.08] bg-[#0c0c14] p-3 shrink-0">
                <div className="relative rounded-2xl border border-white/[0.12] bg-[#06060a] p-2 focus-within:border-white/35 focus-within:shadow-[0_0_24px_rgba(255,255,255,0.06)] transition-all">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tanya kalkulasi anggaran, dependensi rider, SOP venue, atau strategi tiket..."
                    rows={2}
                    data-testid="yoona-chat-input"
                    className="w-full resize-none bg-transparent px-2 py-1 text-xs sm:text-[12.5px] text-white placeholder:text-zinc-500 focus:outline-none leading-relaxed"
                  />

                  {/* Input Toolbar */}
                  <div className="mt-1 pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                      <span className="hidden sm:inline">Enter kirim · Shift+Enter baris baru</span>
                    </div>

                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || loading}
                      data-testid="yoona-chat-send"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-zinc-200 px-3.5 py-1.5 text-xs font-bold text-black transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-white cursor-pointer shadow-sm"
                      aria-label="Kirim Pesan"
                    >
                      <span>Kirim</span>
                      <Send size={11} className="text-black" />
                    </button>
                  </div>
                </div>

                {/* Subfooter */}
                <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-zinc-500 font-gemini">
                  <span className="font-mono text-[9.5px]">Mode Demo Sandbox — OKKAX OS</span>
                  <Link
                    to="/okkax"
                    className="font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>Command Center Layar Penuh</span>
                    <ArrowUpRight size={11} />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
