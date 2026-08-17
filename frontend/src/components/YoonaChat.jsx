import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Layers,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Send,
  Trash2,
  User,
  ArrowRight,
  Calculator,
  Network,
  ScanLine,
  Check,
  Copy,
  Activity,
  Sliders,
  Terminal,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
        <div key={`table-${keyIdx++}`} className="my-2.5 overflow-x-auto rounded border border-zinc-800 bg-[#0a0a0a] font-gemini">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90 font-gemini-display">
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="px-3 py-2 font-semibold text-zinc-200">
                    {formatInlineText(cell.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-gemini-mono tabular-nums text-[11px]">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-800/30 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-zinc-300">
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
        <h4 key={`h3-${keyIdx++}`} className="mt-3.5 mb-1.5 text-sm font-bold text-[#f5eff2] tracking-wide flex items-center gap-1.5 font-gemini-display">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--okx-accent)]" />
          {formatInlineText(line.replace("### ", ""))}
        </h4>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h5 key={`h4-${keyIdx++}`} className="mt-2.5 mb-1 text-[11px] font-semibold text-[var(--okx-accent-soft)] uppercase tracking-wider font-gemini-display">
          {formatInlineText(line.replace("#### ", ""))}
        </h5>
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <div key={`li-${keyIdx++}`} className="flex items-start gap-2 my-0.5 text-xs text-zinc-300 font-gemini">
          <span className="text-[var(--okx-accent)] mt-0.5 font-bold select-none text-[10px]">•</span>
          <span className="flex-1 leading-relaxed">{formatInlineText(line.trim().substring(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)$/);
      elements.push(
        <div key={`oli-${keyIdx++}`} className="flex items-start gap-2 my-1 text-xs text-zinc-300 font-gemini">
          <span className="font-gemini-mono text-[var(--okx-accent)] font-bold text-[11px] min-w-[18px]">
            {match[1]}.
          </span>
          <span className="flex-1 leading-relaxed">{formatInlineText(match[2])}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`space-${keyIdx++}`} className="h-1.5" />);
    } else {
      elements.push(
        <p key={`p-${keyIdx++}`} className="my-1 text-xs leading-relaxed text-zinc-300 font-gemini">
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
          className="inline-flex items-center gap-1 font-semibold text-[var(--okx-accent)] underline decoration-[var(--okx-accent)]/50 hover:text-white transition-colors"
        >
          {label}
          <ArrowRight className="h-2.5 w-2.5 inline" />
        </Link>
      );
    } else {
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--okx-accent)] underline hover:text-white transition-colors"
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
        <strong key={idx} className="font-semibold text-white">
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

const FAST_SCENARIOS = [
  { label: "Konser Stadion 50k", prompt: "Bantu rancang kalkulasi finansial dan teknis sound system konser stadion 50.000 pax" },
  { label: "Festival Musik 5k", prompt: "Hitung alokasi budget dan target tiket konser musik 5.000 pax Rp 1.25 Milyar" },
  { label: "Valuasi Sponsor", prompt: "Bagaimana cara menentukan harga paket Presenting Sponsor dan hak aktivasi brand?" },
  { label: "SOP Scanner Gate", prompt: "Bagaimana SOP validasi scanner tiket QR di gate pintu masuk saat hari H?" },
  { label: "Dampak Ekonomi", prompt: "Bagaimana formula perhitungan multiplier effect ekonomi di Live Event Map (/peta)?" },
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
        "### Halo! Saya Yoona — Principal Event Intelligence & Copilot Resmi OKKAX.\n\nSaya menguasai seluruh aspek operasional live event, kalkulasi budget, arsitektur Event Graph, monetisasi sponsor/tenant, hingga SOP gate scanner di 15+ kota Indonesia.\n\nPilih modul skenario di atas atau tanyakan langsung rencana acara Anda.",
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
    const role = user?.roles?.[0] || "audience";
    api
      .get(`/yoona/suggestions?route=${encodeURIComponent(location.pathname)}&role=${role}`)
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

      const res = await api.post("/yoona/chat", payload);
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
            "Maaf, terjadi kendala koneksi ke mesin inteligensi Yoona. Pastikan backend server aktif.",
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
        content: "Percakapan telah direset. Ada rencana acara atau analisis teknis baru yang ingin kita bahas?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          data-testid="yoona-chat-trigger"
          className="font-gemini fixed bottom-6 right-6 z-50 group flex items-center gap-3 rounded-full border border-[var(--okx-accent)]/60 bg-[#0c060a]/95 backdrop-blur-md px-4 py-3 text-white shadow-[0_8px_32px_rgba(255,46,126,0.3)] transition-all duration-300 hover:scale-105 hover:border-[var(--okx-accent)] hover:shadow-[0_12px_40px_rgba(255,46,126,0.5)] active:scale-95"
          aria-label="Buka Yoona Copilot"
        >
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[var(--okx-accent)] text-white shadow-[0_0_12px_rgba(255,46,126,0.5)]">
            <Layers className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 font-gemini-display">
              <span className="text-xs font-bold tracking-wide text-white">Yoona</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[10px] leading-tight text-zinc-400 font-gemini-mono">Event Copilot</span>
          </div>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          data-testid="yoona-chat-modal"
          className={`font-gemini fixed z-50 flex flex-col border border-[var(--okx-border)] bg-[#0c0c0cf5] shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all duration-200 overflow-hidden ${
            isExpanded
              ? "inset-4 md:inset-8 rounded-xl"
              : isMinimized
              ? "bottom-6 right-6 h-14 w-84 rounded-lg"
              : "bottom-6 right-6 h-[620px] max-h-[88vh] w-[440px] max-w-[calc(100vw-32px)] rounded-xl"
          }`}
        >
          {/* Top Accent Line */}
          <div className="h-0.5 w-full bg-[var(--okx-accent)] opacity-80" />

          {/* Window Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121212] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--okx-accent)] text-white shadow-[0_0_12px_rgba(255,46,126,0.4)]">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold tracking-wide text-white font-gemini-display">Yoona Copilot</h3>
                  <span className="rounded bg-[var(--okx-accent)]/15 border border-[var(--okx-accent)]/30 px-1.5 py-0.2 text-[9px] font-semibold text-[var(--okx-accent-soft)] font-gemini">
                    Principal Intelligence
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-gemini">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>OKKAX Event Operations</span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 text-zinc-400">
              <button
                onClick={clearChat}
                title="Reset Percakapan"
                data-testid="yoona-btn-clear"
                className="rounded p-1 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Perkecil Ukuran" : "Maksimalkan Layar"}
                data-testid="yoona-btn-expand"
                className="hidden sm:block rounded p-1 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Buka Window" : "Minimalkan"}
                data-testid="yoona-btn-minimize"
                className="rounded p-1 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Tutup"
                data-testid="yoona-btn-close"
                className="rounded p-1 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          {!isMinimized && (
            <>
              {/* Fast Scenario Ribbon */}
              <div className="border-b border-zinc-800/60 bg-[#0e0e0e] px-3 py-2 overflow-x-auto whitespace-nowrap okx-custom-scrollbar">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <Sliders className="h-3 w-3 text-[var(--okx-accent)]" /> Modul:
                  </span>
                  {FAST_SCENARIOS.map((sc, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSend(sc.prompt)}
                      disabled={loading}
                      data-testid={`yoona-scenario-${sIdx}`}
                      className="rounded border border-zinc-800/80 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-[var(--okx-accent)] hover:text-white hover:bg-[var(--okx-accent)]/15 transition-all shrink-0"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm okx-custom-scrollbar bg-[#0a0a0a]/50">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    data-testid={`yoona-message-${m.role}-${idx}`}
                    className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                        m.role === "user"
                          ? "bg-zinc-800 text-zinc-200 border border-zinc-700"
                          : "bg-[var(--okx-accent)] text-white shadow-[0_0_10px_rgba(255,46,126,0.3)]"
                      }`}
                    >
                      {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Terminal className="h-4 w-4" />}
                    </div>
                    <div
                      className={`relative max-w-[88%] rounded-lg px-4 py-3 text-xs leading-relaxed group ${
                        m.role === "user"
                          ? "bg-[var(--okx-accent)]/15 border border-[var(--okx-accent)]/35 text-white"
                          : "bg-[#141414] border border-zinc-800/90 text-zinc-200"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        renderFormattedMarkdown(m.content)
                      )}
                      
                      {/* Message Footer */}
                      <div className="mt-2 pt-1 border-t border-zinc-800/40 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                        <div className="flex items-center gap-1.5">
                          {m.engine && <span className="text-[var(--okx-accent-soft)]">{m.engine}</span>}
                          <span>· {m.timestamp}</span>
                        </div>
                        {m.role === "assistant" && (
                          <button
                            onClick={() => copyMessage(m.content, idx)}
                            title="Salin Teks Jawaban"
                            data-testid={`yoona-copy-btn-${idx}`}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-zinc-400 hover:text-white transition-opacity"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="h-2.5 w-2.5 text-emerald-400" />
                                <span className="text-emerald-400">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading state */}
                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--okx-accent)] text-white">
                      <Terminal className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-lg bg-[#141414] border border-zinc-800 px-4 py-3 text-xs text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--okx-accent)] animate-pulse" />
                        <span className="text-[11px] font-mono text-zinc-400">Yoona sedang memproses data event…</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Dynamic Context Suggestions */}
              {suggestions.length > 0 && (
                <div className="border-t border-zinc-800/60 bg-[#0f0f0f] px-3 py-2">
                  <p className="mb-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Activity className="h-3 w-3 text-[var(--okx-accent-soft)]" /> Rekomendasi Pertanyaan:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto okx-custom-scrollbar">
                    {suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(sug)}
                        disabled={loading}
                        data-testid={`yoona-chip-${sIdx}`}
                        className="rounded border border-zinc-800 bg-zinc-900/90 px-2 py-1 text-[11px] text-zinc-300 transition-all hover:border-[var(--okx-accent)]/80 hover:text-white hover:bg-zinc-800"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Elevated Input Bar */}
              <div className="border-t border-zinc-800 bg-[#121212] p-3 rounded-b-xl">
                <div className="relative flex items-center">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tanya Yoona seputar kalkulasi budget, brief, atau strategi acara…"
                    rows={1}
                    data-testid="yoona-chat-input"
                    className="w-full resize-none rounded-lg border border-zinc-800 bg-[#080808] px-3.5 py-2.5 pr-11 text-xs text-white placeholder:text-zinc-500 focus:border-[var(--okx-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--okx-accent)]"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    data-testid="yoona-chat-send"
                    className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--okx-accent)] text-white transition-all hover:bg-[var(--okx-accent-hover)] disabled:opacity-30"
                    aria-label="Kirim Pesan"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-zinc-500">
                  <span className="font-mono">Enter kirim · Shift+Enter baris baru</span>
                  <Link to="/yoona" className="font-semibold text-[var(--okx-accent)] hover:text-white transition-colors">
                    Command Center Layar Penuh →
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
