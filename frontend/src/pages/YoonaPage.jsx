import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Layers,
  Send,
  Trash2,
  User,
  ArrowRight,
  Calculator,
  Network,
  ScanLine,
  TrendingUp,
  Wand2,
  Handshake,
  Download,
  Copy,
  Check,
  Sliders,
  Terminal,
} from "lucide-react";
import PublicNav from "@/components/PublicNav";
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
        <div key={`table-${keyIdx++}`} className="my-3 overflow-x-auto rounded-lg border border-zinc-800 bg-[#090909] font-gemini">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90 font-gemini-display">
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="px-3.5 py-2.5 font-bold text-zinc-100 uppercase tracking-wider text-[11px]">
                    {formatInlineText(cell.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-gemini-mono tabular-nums text-xs">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-800/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 text-zinc-300">
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
        <h4 key={`h3-${keyIdx++}`} className="mt-5 mb-2 text-base font-bold text-[#f5eff2] tracking-wide flex items-center gap-2 font-gemini-display">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--okx-accent)]" />
          {formatInlineText(line.replace("### ", ""))}
        </h4>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h5 key={`h4-${keyIdx++}`} className="mt-3.5 mb-1.5 text-xs font-bold text-[var(--okx-accent-soft)] uppercase tracking-wider font-gemini-display">
          {formatInlineText(line.replace("#### ", ""))}
        </h5>
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <div key={`li-${keyIdx++}`} className="flex items-start gap-2.5 my-1 text-xs sm:text-sm text-zinc-300 font-gemini">
          <span className="text-[var(--okx-accent)] mt-1 select-none font-bold text-[10px]">•</span>
          <span className="flex-1 leading-relaxed">{formatInlineText(line.trim().substring(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)$/);
      elements.push(
        <div key={`oli-${keyIdx++}`} className="flex items-start gap-2.5 my-1 text-xs sm:text-sm text-zinc-300 font-gemini">
          <span className="font-gemini-mono text-[var(--okx-accent)] font-bold text-xs min-w-[22px]">
            {match[1]}.
          </span>
          <span className="flex-1 leading-relaxed">{formatInlineText(match[2])}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`space-${keyIdx++}`} className="h-2" />);
    } else {
      elements.push(
        <p key={`p-${keyIdx++}`} className="my-1.5 text-xs sm:text-sm leading-relaxed text-zinc-300 font-gemini">
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
          className="inline-flex items-center gap-1 font-bold text-[var(--okx-accent)] underline decoration-[var(--okx-accent)]/50 hover:text-white transition-colors"
        >
          {label}
          <ArrowRight className="h-3 w-3 inline" />
        </Link>
      );
    } else {
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-[var(--okx-accent)] underline hover:text-white transition-colors"
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

const STRATEGY_SCENARIOS = [
  {
    title: "1. Brief & Technical Specs",
    icon: Wand2,
    prompts: [
      "Bantu rancang kalkulasi finansial dan teknis sound system konser stadion 50.000 pax",
      "Apa saja hal krusial yang wajib ada di Technical Rider artis internasional?",
      "Bagaimana menyusun timeline operasional W-8 hingga hari H acara?",
    ],
  },
  {
    title: "2. Alokasi Finansial & Break-Even",
    icon: Calculator,
    prompts: [
      "Hitung alokasi budget dan target tiket konser musik 5.000 pax Rp 1.25 Milyar",
      "Berapa persentase ideal untuk dana cadangan (contingency fund)?",
      "Bagaimana strategi menutup funding gap antara sponsor vs penjualan tiket?",
    ],
  },
  {
    title: "3. Event Graph & Rantai Pasok",
    icon: Network,
    prompts: [
      "Jelaskan struktur node Event Graph dan bagaimana menangani node yang statusnya Blocked",
      "Apa hubungan antara node Venue dengan Vendor sound & lighting?",
      "Bagaimana cara memvalidasi node kontrak artis di Event Graph?",
    ],
  },
  {
    title: "4. Monetisasi Sponsor & Tenant",
    icon: Handshake,
    prompts: [
      "Bagaimana cara menentukan harga paket Presenting Sponsor dan hak aktivasi brand?",
      "Berapa harga sewa wajar booth F&B kuliner di event 5.000 pax?",
      "Benefit apa saja yang paling diminati brand korporat saat ini?",
    ],
  },
  {
    title: "5. Gate Control & Validasi Tiket",
    icon: ScanLine,
    prompts: [
      "Bagaimana SOP validasi scanner tiket QR di gate dan pencegahan tiket ganda?",
      "Apa saja metode pembayaran lokal yang didukung sandbox OKKAX?",
      "Bagaimana manajemen antrean penonton saat jam puncak kedatangan?",
    ],
  },
  {
    title: "6. Dampak Ekonomi Regional",
    icon: TrendingUp,
    prompts: [
      "Bagaimana formula perhitungan multiplier effect ekonomi di Live Event Map (/peta)?",
      "Sektor apa saja yang diuntungkan dari live event di kota-kota daerah?",
      "Mengapa ekosistem UMKM dan vendor lokal dicatat dalam metrik perputaran?",
    ],
  },
];

export default function YoonaPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "### Selamat Datang di OKKAX Event Intelligence Command Center!\n\nSaya adalah asisten operasional resmi OKKAX yang menguasai seluruh spektrum operasional, arsitektur data, dan komputasi ekonomi live event di Indonesia.\n\n#### Ruang Lingkup Konsultasi OKKAX Copilot:\n- **Komputasi Finansial & Alokasi Anggaran**: Perhitungan pos biaya (Talent 28%, Produksi 24%, Venue 14%, Marketing 8%, Kru 6%, Contingency 5%).\n- **Analisis Ketergantungan Event Graph**: Mendeteksi potensi blocker antara rider talent, venue, dan vendor teknis.\n- **Valuasi Sponsorship & Zonasi Tenant**: Perancangan hak eksklusif brand & monetisasi booth kuliner.\n- **SOP Gate Management & Validator Scanner**: Prosedur validasi tiket QR cepat anti-duplikasi.\n- **Simulasi Multiplier Effect Regional**: Analisis perputaran ekonomi lokal di 15+ kota besar.\n\nPilih salah satu modul konsultasi di panel kiri atau ketik langsung pertanyaan Anda di bawah.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const { user } = useAuth();
  const location = useLocation();
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        current_route: location.pathname,
        role: user?.roles?.[0] || "organizer",
      };

      const res = await api.post("/okkax/chat", payload);
      const data = res.data;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Maaf, tidak ada respons yang dihasilkan.",
          engine: data.engine,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Maaf, terjadi kendala saat menghubungkan ke mesin AI OKKAX Copilot. Pastikan backend server aktif.",
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

  const exportTranscript = () => {
    const transcriptText = messages
      .map((m) => `[${m.timestamp}] ${m.role === "user" ? "Pengguna" : "OKKAX Copilot"}:\n${m.content}\n`)
      .join("\n---\n\n");
    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okkax-copilot-session-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Percakapan telah direset. Silakan ajukan rencana atau pertanyaan event baru bersama OKKAX Copilot!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white flex flex-col font-gemini">
      <PublicNav />

      {/* Telemetry Header Strip */}
      <div className="border-b border-zinc-800/80 bg-[#0c0c0c] px-4 py-2 text-xs">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4 font-gemini-mono text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-gemini">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              OKKAX Operations Engine · Online
            </span>
            <span className="hidden sm:inline text-zinc-600">|</span>
            <span className="hidden sm:inline text-zinc-300 font-gemini">Live Event Operating Network</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-gemini-mono">
            <span>15+ Kota Terkoneksi</span>
            <span>·</span>
            <span>Grounding: OKKAX Multi-Model DB</span>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Mission Control & Scenarios */}
        <aside className="w-full lg:w-84 shrink-0 flex flex-col gap-4">
          {/* OKKAX Copilot Identity Card */}
          <div className="rounded-xl border border-[var(--okx-border)] bg-[#121212] p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--okx-accent)] text-white shadow-[0_0_12px_rgba(255,46,126,0.4)]">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-wide text-white font-gemini-display">OKKAX Copilot</h1>
                <p className="text-xs font-gemini-mono text-[var(--okx-accent-soft)]">Principal Event Intelligence</p>
              </div>
            </div>
            <p className="mt-3.5 text-xs leading-relaxed text-zinc-400 font-gemini">
              Asisten untuk komputasi finansial, arsitektur dependensi Event Graph, dan manajemen operasional live event di Indonesia.
            </p>
            <div className="mt-4 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="font-gemini">Kecepatan Inferensi</span>
              <span className="font-gemini-mono text-white font-semibold">&lt; 1.0s</span>
            </div>
          </div>

          {/* Preset Topics Accordion */}
          <div className="rounded-xl border border-[var(--okx-border)] bg-[#111111] p-4 flex-1 flex flex-col shadow-md font-gemini">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-gemini-display">
                <Sliders className="h-3.5 w-3.5 text-[var(--okx-accent)]" /> Modul Konsultasi:
              </h2>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-420px)] pr-1 okx-custom-scrollbar">
              {STRATEGY_SCENARIOS.map((scenario, sIdx) => {
                const Icon = scenario.icon;
                return (
                  <div key={sIdx} className="rounded-lg border border-zinc-800/70 bg-[#161616]/70 p-3 hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-3.5 w-3.5 text-[var(--okx-accent)] shrink-0" />
                      <span className="text-xs font-bold text-zinc-200">{scenario.title}</span>
                    </div>
                    <div className="space-y-1">
                      {scenario.prompts.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(p)}
                          disabled={loading}
                          data-testid={`yoona-page-prompt-${sIdx}-${idx}`}
                          className="w-full text-left rounded px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-white hover:bg-[var(--okx-accent)]/15 hover:border-[var(--okx-accent)]/30 border border-transparent transition-all truncate block"
                          title={p}
                        >
                          → {p}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Panel: Conversational Command Deck */}
        <section className="flex-1 rounded-xl border border-[var(--okx-border)] bg-[#111111] flex flex-col shadow-xl overflow-hidden min-h-[640px] lg:min-h-[calc(100vh-170px)]">
          {/* Deck Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#151515] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--okx-accent)]" />
                <span className="text-xs font-bold text-white tracking-wide">Interactive Session Deck</span>
              </div>
              <span className="rounded bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                {user ? `Role: ${user.roles?.[0] || "Organizer"}` : "Mode Tamu"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportTranscript}
                data-testid="yoona-page-export-btn"
                title="Ekspor Transkrip Diskusi"
                className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Ekspor</span>
              </button>
              <button
                onClick={clearChat}
                data-testid="yoona-page-clear-btn"
                title="Bersihkan Percakapan"
                className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Conversation Canvas */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 okx-custom-scrollbar bg-[#090909]/40">
            {messages.map((m, idx) => (
              <div
                key={idx}
                data-testid={`yoona-page-message-${m.role}-${idx}`}
                className={`flex items-start gap-3.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                    m.role === "user"
                      ? "bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm"
                      : "bg-[var(--okx-accent)] text-white shadow-[0_0_10px_rgba(255,46,126,0.4)]"
                  }`}
                >
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Terminal className="h-4 w-4" />}
                </div>
                <div
                  className={`group relative max-w-[90%] sm:max-w-[82%] rounded-xl px-5 py-4 text-sm ${
                    m.role === "user"
                      ? "bg-[var(--okx-accent)]/15 border border-[var(--okx-accent)]/35 text-white"
                      : "bg-[#141414] border border-zinc-800/90 text-zinc-200 shadow-md"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  ) : (
                    renderFormattedMarkdown(m.content)
                  )}

                  <div className="mt-3 pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <div className="flex items-center gap-2">
                      {m.engine && <span className="text-[var(--okx-accent-soft)]">{m.engine}</span>}
                      <span>· {m.timestamp}</span>
                    </div>
                    {m.role === "assistant" && (
                      <button
                        onClick={() => copyMessage(m.content, idx)}
                        data-testid={`yoona-page-copy-${idx}`}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-zinc-400 hover:text-white transition-opacity"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Salin Teks</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--okx-accent)] text-white">
                  <Terminal className="h-4 w-4" />
                </div>
                <div className="rounded-xl bg-[#141414] border border-zinc-800 px-5 py-4 text-xs text-zinc-300">
                  <div className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--okx-accent)] animate-pulse" />
                    <span className="font-mono text-zinc-400">OKKAX Copilot sedang memproses dan mengompilasi model data…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input & Action Bar */}
          <div className="border-t border-zinc-800 bg-[#151515] p-4">
            <div className="relative flex items-center">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ajukan pertanyaan mengenai kalkulasi budget, brief acara, Event Graph, atau SOP scanner gate…"
                rows={2}
                data-testid="yoona-page-input"
                className="w-full resize-none rounded-lg border border-zinc-800 bg-[#080808] px-4 py-3 pr-14 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--okx-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--okx-accent)]"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                data-testid="yoona-page-send-btn"
                className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--okx-accent)] text-white transition-all hover:bg-[var(--okx-accent-hover)] disabled:opacity-30"
                aria-label="Kirim Pesan"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
              <span className="font-mono">Shift+Enter untuk baris baru · Enter untuk mengirim</span>
              <span className="hidden sm:inline text-zinc-400 font-mono">
                OKKAX Operations Copilot
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
