import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Minus, Plus, ArrowUp, Check, Copy } from "lucide-react";
import { api, fetchCached } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canAccessMemberCopilot } from "@/lib/memberRoles";
import "./OkkaxChat.css";

// -----------------------------------------------------------------------------
// Official Okkax Brand Mark (Identical to Favicon / Brand Identity)
// -----------------------------------------------------------------------------
export function CopilotIntelligenceIcon({ className = "h-4 w-4", ...props }) {
  return (
    <img
      src="/assets/okkax-x-mark-v3.png"
      alt="Okkax"
      className={`object-contain ${className}`}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// Response sanitizer
// Renderer Copilot tidak menampilkan emoji/emotikon sama sekali. Sanitasi hanya
// di layer presentasi — `m.content` di state tetap utuh sehingga payload history
// yang dikirim ke /okkax/chat tidak berubah.
// -----------------------------------------------------------------------------
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;

function sanitizeResponseText(text) {
  if (!text) return "";
  return text.replace(EMOJI_PATTERN, "").replace(/[^\S\r\n]+$/gm, "");
}

// -----------------------------------------------------------------------------
// Markdown & Structured Content Renderer
// Skala tipografi mengikuti referensi Google AI Studio (compact, tanpa heading
// oversized, tanpa italic).
// -----------------------------------------------------------------------------
function renderFormattedMarkdown(text) {
  if (!text) return null;

  const lines = sanitizeResponseText(text).split("\n");
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let inCodeFence = false;
  let codeLines = [];
  let keyIdx = 0;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.length > 2 ? tableRows.slice(2) : [];

      elements.push(
        <div
          key={`table-${keyIdx++}`}
          className="okx-copilot-scroll my-3 overflow-x-auto rounded-lg border border-[#27272a]"
        >
          <table className="w-full border-collapse text-left text-[12px] font-gemini">
            <thead className="border-b border-[#27272a] bg-[#18181b]">
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th
                    key={cIdx}
                    className="whitespace-nowrap border-r border-[#27272a] px-3 py-2 text-[12px] font-semibold text-white last:border-r-0"
                  >
                    {formatInlineText(cell.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="transition-colors hover:bg-white/[0.02]">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="border-r border-t border-[#27272a] px-3 py-2 align-top text-[12px] tabular-nums text-zinc-300 last:border-r-0"
                    >
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

  const flushCode = () => {
    if (codeLines.length > 0) {
      elements.push(
        <div
          key={`code-${keyIdx++}`}
          className="okx-copilot-scroll my-2.5 overflow-x-auto rounded-lg border border-[#27272a] bg-[#09090b] p-3"
        >
          <pre className="font-gemini-mono text-[11px] leading-relaxed text-zinc-200">
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      codeLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block
    if (trimmed.startsWith("```")) {
      if (inCodeFence) {
        flushCode();
        inCodeFence = false;
      } else {
        flushTable();
        inCodeFence = true;
      }
      continue;
    }
    if (inCodeFence) {
      codeLines.push(line);
      continue;
    }

    // Tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableRows.push(line.split("|").slice(1, -1));
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      elements.push(<hr key={`hr-${keyIdx++}`} className="my-4 border-t border-[#27272a]" />);
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h5
          key={`h4-${keyIdx++}`}
          className="mb-1 mt-3.5 font-gemini-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400 first:mt-0"
        >
          {formatInlineText(line.replace("#### ", ""))}
        </h5>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={`h3-${keyIdx++}`}
          className="mb-1 mt-3.5 font-gemini-display text-[13px] font-semibold tracking-tight text-[#f4f4f5] first:mt-0"
        >
          {formatInlineText(line.replace("### ", ""))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3
          key={`h2-${keyIdx++}`}
          className="mb-1.5 mt-4 font-gemini-display text-[14px] font-semibold tracking-tight text-white first:mt-0"
        >
          {formatInlineText(line.replace("## ", ""))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2
          key={`h1-${keyIdx++}`}
          className="mb-2 mt-4 font-gemini-display text-[15px] font-semibold tracking-tight text-white first:mt-0"
        >
          {formatInlineText(line.replace("# ", ""))}
        </h2>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`bq-${keyIdx++}`}
          className="my-2.5 border-l-2 border-zinc-600 pl-3.5 text-[13px] leading-relaxed text-zinc-400"
        >
          {formatInlineText(trimmed.substring(2))}
        </blockquote>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div
          key={`li-${keyIdx++}`}
          className="my-1 flex items-start gap-2 text-[13px] leading-[1.6] text-[#e4e4e7]"
        >
          <span className="mt-[8px] h-[3px] w-[3px] shrink-0 select-none rounded-full bg-zinc-500" />
          <span className="min-w-0 flex-1">{formatInlineText(trimmed.substring(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      elements.push(
        <div
          key={`oli-${keyIdx++}`}
          className="my-1 flex items-start gap-2 text-[13px] leading-[1.6] text-[#e4e4e7]"
        >
          <span className="min-w-[16px] shrink-0 font-gemini-mono text-[11px] font-semibold text-zinc-500">
            {match[1]}.
          </span>
          <span className="min-w-0 flex-1">{formatInlineText(match[2])}</span>
        </div>
      );
    } else if (trimmed === "") {
      // Baris kosong tidak menghasilkan elemen: jarak antar-paragraf sudah
      // ditangani margin yang saling collapse (sama seperti referensi).
      continue;
    } else {
      elements.push(
        <p
          key={`p-${keyIdx++}`}
          className="my-2.5 text-[13px] leading-[1.6] text-[#e4e4e7] first:mt-0 last:mb-0"
        >
          {formatInlineText(line)}
        </p>
      );
    }
  }

  if (inCodeFence) flushCode();
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
      parts.push(renderEmphasis(text.substring(lastIndex, match.index), `pre-${match.index}`));
    }
    const label = match[1];
    const url = match[2];
    if (url.startsWith("/")) {
      parts.push(
        <Link
          key={`lnk-${match.index}`}
          to={url}
          className="font-medium text-white underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-zinc-300"
        >
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={`ext-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-white underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-zinc-300"
        >
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderEmphasis(text.substring(lastIndex), `tail-${lastIndex}`));
  }

  return parts;
}

// Bold tetap bold. Emphasis tunggal (*teks*) dirender TANPA italic sesuai
// requirement renderer — hanya pergeseran weight/warna.
function renderEmphasis(raw, keyPrefix = "e") {
  const codeParts = raw.split(/(`[^`]+`)/g);
  return codeParts.map((chunk, cIdx) => {
    if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${cIdx}`}
          className="rounded border border-[#27272a] bg-[#18181b] px-1.5 py-0.5 font-gemini-mono text-[11.5px] text-zinc-200"
        >
          {chunk.slice(1, -1)}
        </code>
      );
    }
    const boldParts = chunk.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${keyPrefix}-b-${cIdx}-${idx}`} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      const emParts = part.split(/(\*[^*]+\*)/g);
      return emParts.map((sub, sIdx) => {
        if (sub.startsWith("*") && sub.endsWith("*") && sub.length > 2) {
          return (
            <span
              key={`${keyPrefix}-m-${cIdx}-${idx}-${sIdx}`}
              className="font-medium not-italic text-zinc-100"
            >
              {sub.slice(1, -1)}
            </span>
          );
        }
        return sub;
      });
    });
  });
}

// -----------------------------------------------------------------------------
// Curated Fast Scenario Triggers
// -----------------------------------------------------------------------------
const FAST_SCENARIOS = [
  { id: "concert", label: "Konser Stadion 50k", prompt: "Bantu rancang kalkulasi finansial dan teknis sound system konser stadion 50.000 pax" },
  { id: "fest", label: "Festival Musik 5k", prompt: "Hitung alokasi budget dan target tiket konser musik 5.000 pax Rp 1.25 Milyar" },
  { id: "sponsor", label: "Valuasi Sponsor", prompt: "Bagaimana cara menentukan harga paket Presenting Sponsor dan hak aktivasi brand?" },
  { id: "scanner", label: "SOP Scanner Gate", prompt: "Bagaimana SOP validasi scanner tiket QR di gate pintu masuk saat hari H?" },
  { id: "economy", label: "Dampak Ekonomi", prompt: "Bagaimana formula perhitungan multiplier effect ekonomi di Live Event Map (/peta)?" },
];

// Token warna referensi Google AI Studio.
const CTRL_BTN =
  "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-[#27272a] hover:text-white focus-visible:ring-1 focus-visible:ring-white/40 cursor-pointer";

export default function OkkaxChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Halo! Saya Okkax Copilot. Pilih modul di atas atau tanyakan langsung rencana acara Anda.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [suggestions, setSuggestions] = useState([
    "Bantu hitung budget & break-even festival 5.000 pax",
    "Bagaimana cara kerja Event Graph dan status nodenya?",
    "Jelaskan sistem verifikasi scanner tiket di pintu masuk",
    "Bagaimana pembagian benefit untuk Presenting Sponsor?",
  ]);

  const { user, effectiveRole, loading: authLoading } = useAuth();
  const location = useLocation();
  const chatEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (location.search.includes("copilot=open")) {
      setIsOpen(true);
      setIsMinimized(false);
    }
  }, [location.search]);

  const userRole = user?.roles?.[0] || "audience";
  const memberCopilotAllowed = !authLoading && (!user || canAccessMemberCopilot(effectiveRole));
  useEffect(() => {
    if (!memberCopilotAllowed) return;
    fetchCached(`/okkax/suggestions?route=${encodeURIComponent(location.pathname)}&role=${userRole}`, 300_000)
      .then((data) => {
        if (data?.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, [location.pathname, memberCopilotAllowed, userRole]);

  // Scroll internal saja: set scrollTop pada container, bukan scrollIntoView,
  // supaya dokumen di belakang panel tidak ikut ter-scroll.
  const scrollThreadToBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      const raf = requestAnimationFrame(scrollThreadToBottom);
      return () => cancelAnimationFrame(raf);
    }
  }, [messages, loading, isOpen, isMinimized, scrollThreadToBottom]);

  // Composer di-fix-kan default: tidak auto-grow mengikuti isi. Input yang
  // melebihi tinggi default akan di-scroll secara internal oleh textarea itu
  // sendiri (resize-none + overflow-y-auto), bukan memperbesar box.

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
        history: messages.map((m) => ({ role: m.role, content: m.content })),
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
            "Maaf, terjadi kendala koneksi ke mesin inteligensi Okkax Copilot. Pastikan backend server aktif.",
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
    navigator.clipboard.writeText(sanitizeResponseText(text));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Percakapan telah direset. Ada rencana acara atau analisis teknis baru yang ingin kita bahas bersama Okkax Copilot?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  if (!memberCopilotAllowed) return null;

  const padX = "px-3.5";

  // Lebar panel desktop diperkecil ~10% dari referensi (440px -> 396px).
  const shellGeometry = isMinimized
    ? "bottom-3 left-3 right-3 h-14 rounded-2xl sm:left-auto sm:bottom-6 sm:right-6 sm:w-[288px]"
    : "bottom-3 left-3 right-3 h-[620px] max-h-[calc(100dvh-24px)] rounded-2xl sm:left-auto sm:bottom-6 sm:right-6 sm:h-[640px] sm:w-[396px] sm:max-h-[calc(100dvh-48px)] sm:rounded-[24px]";

  return (
    <>
      {/* Floating Trigger Capsule */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          data-testid="okkax-copilot-trigger"
          className="okx-copilot-root font-gemini group fixed bottom-5 right-5 z-50 flex cursor-pointer items-center gap-2.5 rounded-2xl border border-[#27272a] bg-[#09090b]/95 py-2 pl-2 pr-3.5 text-white shadow-[0_16px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-colors hover:border-zinc-500 hover:bg-[#121215] focus-visible:ring-1 focus-visible:ring-white/40 sm:bottom-6 sm:right-6"
          aria-label="Buka Okkax Copilot"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#27272a] bg-[#18181b] p-1.5">
            <CopilotIntelligenceIcon className="h-full w-full object-contain" />
          </span>

          <span className="flex flex-col text-left leading-none">
            <span className="flex items-center gap-1.5">
              <span className="font-gemini-display text-[12.5px] font-semibold tracking-tight text-white">
                Okkax Copilot
              </span>
            </span>
            <span className="mt-1 font-gemini-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover:text-zinc-300">
              Neural Ops Core
            </span>
          </span>
        </button>
      )}

      {/* Floating Command Console */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Okkax Copilot"
          data-testid="okkax-copilot-modal"
          className={`okx-copilot-root font-gemini fixed z-50 flex flex-col overflow-hidden border border-[#27272a] bg-[#09090b] text-[#f4f4f5] shadow-[0_32px_100px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] ${shellGeometry}`}
        >
          {/* Unified Console Header */}
          <header
            className={`flex shrink-0 select-none items-center justify-between gap-2 border-b border-[#27272a] bg-[#09090b] py-3 ${padX}`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#27272a] bg-[#18181b] p-1.5">
                <CopilotIntelligenceIcon
                  className={`h-full w-full object-contain ${loading ? "animate-pulse" : ""}`}
                />
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-gemini-display text-[13px] font-semibold tracking-tight text-white">
                  Okkax Copilot
                </h3>
                <div className="mt-0.5 font-gemini-mono text-[10px] text-zinc-500">
                  <span className="truncate">Real-time Event Graph Intelligence</span>
                </div>
              </div>
            </div>

            {/* Action Controls Pill */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[#27272a] bg-[#121215] p-0.5">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Buka Window" : "Minimalkan"}
                aria-label={isMinimized ? "Buka Window" : "Minimalkan"}
                data-testid="okkax-copilot-btn-minimize"
                className={CTRL_BTN}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Tutup"
                aria-label="Tutup Okkax Copilot"
                data-testid="okkax-copilot-btn-close"
                className={CTRL_BTN}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* Console Body Content */}
          {!isMinimized && (
            <>
              {/* Module / Scenario Chip Rail */}
              <div
                className={`okx-copilot-scroll shrink-0 overflow-x-auto whitespace-nowrap border-b border-[#27272a] bg-[#09090b] py-2 ${padX}`}
              >
                <div className="mx-auto flex w-full max-w-3xl items-center gap-3.5">
                  <span className="mr-0.5 shrink-0 font-gemini-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Modul
                  </span>
                  {FAST_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => handleSend(sc.prompt)}
                      disabled={loading}
                      data-testid={`okkax-copilot-scenario-${sc.id}`}
                      className="shrink-0 cursor-pointer whitespace-nowrap px-1 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation Canvas */}
              <div
                ref={scrollAreaRef}
                role="log"
                aria-live="polite"
                aria-label="Percakapan Okkax Copilot"
                className={`okx-copilot-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#09090b] py-4 ${padX}`}
              >
                <div className="mx-auto w-full max-w-3xl space-y-4">
                  {messages.map((m, idx) => {
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={idx}
                        data-testid={`okkax-copilot-message-${m.role}-${idx}`}
                        className={`flex w-full flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        {isUser ? (
                          /* User Message Bubble */
                          <div className="max-w-[88%] break-words rounded-2xl border border-[#27272a] bg-[#18181b] px-4 py-2.5 text-[13px] leading-[1.6] text-[#f4f4f5] shadow-sm">
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        ) : (
                          /* Assistant Message Block */
                          <div className="w-full min-w-0">
                            <div className="mb-2 flex select-none items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 font-gemini-display text-[11.5px] font-semibold tracking-tight text-white">
                                  Okkax Copilot
                                </span>
                                {m.engine && !/^okkax copilot$/i.test(m.engine) && (
                                  <span className="truncate rounded border border-[#27272a] bg-[#18181b] px-1.5 py-0.5 font-gemini-mono text-[9.5px] text-zinc-400">
                                    {m.engine}
                                  </span>
                                )}
                                <span className="hidden shrink-0 font-gemini-mono text-[9.5px] text-zinc-600 sm:inline">
                                  {m.timestamp}
                                </span>
                              </div>
                              <button
                                onClick={() => copyMessage(m.content, idx)}
                                title="Salin Respons"
                                aria-label="Salin Respons"
                                data-testid={`okkax-copilot-copy-btn-${idx}`}
                                className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-[#18181b] hover:text-white focus-visible:ring-1 focus-visible:ring-white/40"
                              >
                                {copiedIdx === idx ? (
                                  <Check className="h-3.5 w-3.5 text-white" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="okx-copilot-md min-w-0">
                              {renderFormattedMarkdown(m.content)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Loading Indicator */}
                  {loading && (
                    <div className="w-full px-1 py-2" data-testid="okkax-copilot-loading">
                      <span className="animate-pulse font-gemini-mono text-[11px] text-zinc-400">
                        Memproses inferensi Event Graph...
                      </span>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Recommended Question Chips */}
              {suggestions.length > 0 && (
                <div
                  className={`okx-copilot-scroll shrink-0 overflow-x-auto whitespace-nowrap border-t border-[#27272a] bg-[#09090b] py-2 ${padX}`}
                >
                  <div className="mx-auto flex w-full max-w-3xl items-center gap-3.5">
                    <span className="mr-0.5 shrink-0 font-gemini-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Rekomendasi
                    </span>
                    {suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(sug)}
                        disabled={loading}
                        title={sug}
                        data-testid={`okkax-copilot-chip-${sIdx}`}
                        className="max-w-[260px] shrink-0 cursor-pointer truncate px-1 py-1 text-left text-[11px] text-zinc-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Command Composer */}
              <div className={`shrink-0 border-t border-[#27272a] bg-[#09090b] py-3 ${padX}`}>
                <div className="mx-auto w-full max-w-3xl">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-center gap-1 rounded-full border border-[#27272a] bg-[#171717] pl-1.5 pr-1.5 py-1.5 transition-colors focus-within:border-zinc-500"
                  >
                    <button
                      type="button"
                      onClick={clearChat}
                      title="Chat Baru"
                      aria-label="Mulai Chat Baru"
                      data-testid="okkax-copilot-btn-clear"
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Tanya Okkax"
                      rows={1}
                      data-testid="okkax-copilot-chat-input"
                      aria-label="Pesan untuk Okkax Copilot"
                      className="okx-copilot-scroll h-8 w-full min-w-0 resize-none overflow-y-auto bg-transparent py-1 text-[13px] leading-relaxed text-white placeholder:text-zinc-500 focus:outline-none"
                    />

                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      data-testid="okkax-copilot-chat-send"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all focus-visible:ring-1 focus-visible:ring-white/40 ${
                        input.trim() && !loading
                          ? "cursor-pointer bg-white text-black hover:bg-zinc-200 active:scale-95"
                          : "cursor-not-allowed bg-transparent text-zinc-600"
                      }`}
                      aria-label="Kirim Pesan"
                    >
                      <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </form>

                  {/* Console Footer Meta */}
                  <div className="mt-1.5 px-1 text-[9.5px] text-zinc-500">
                    <span className="font-gemini-mono">Mode Demo Sandbox — Okkax OS</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
