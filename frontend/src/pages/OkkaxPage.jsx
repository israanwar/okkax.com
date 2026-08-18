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
  Store,
  Mic2,
  Workflow,
  Sparkles,
  QrCode,
  Users,
  ArrowUpRight,
} from "lucide-react";
import PublicNav from "@/components/PublicNav";
import { CopilotIntelligenceIcon } from "@/components/OkkaxChat";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ScrollProgressBar, SpotlightCard, MotionPanel } from "@/components/MotionPrimitives";

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
          <span className="inline-block h-2 w-2 rounded-full bg-white" />
          {formatInlineText(line.replace("### ", ""))}
        </h4>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h5 key={`h4-${keyIdx++}`} className="mt-3.5 mb-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider font-gemini-display">
          {formatInlineText(line.replace("#### ", ""))}
        </h5>
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <div key={`li-${keyIdx++}`} className="flex items-start gap-2.5 my-1 text-xs sm:text-sm text-zinc-300 font-gemini">
          <span className="text-zinc-400 mt-1 select-none font-bold text-[10px]">•</span>
          <span className="flex-1 leading-relaxed">{formatInlineText(line.trim().substring(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)$/);
      elements.push(
        <div key={`oli-${keyIdx++}`} className="flex items-start gap-2.5 my-1 text-xs sm:text-sm text-zinc-300 font-gemini">
          <span className="font-gemini-mono text-zinc-400 font-bold text-xs min-w-[22px]">
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
          className="inline-flex items-center gap-1 font-bold text-white underline decoration-zinc-500 hover:text-zinc-300 transition-colors"
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
          className="inline-flex items-center gap-1 font-bold text-white underline decoration-zinc-500 hover:text-zinc-300 transition-colors"
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

const PERSONAS_CONFIG = [
  {
    id: "organizer",
    label: "Organizer",
    icon: Workflow,
    badge: "Kompilasi & Operasional",
    description: "Kompilasi brief, pemetaan Event Graph, dan penyelesaian blocker rantai pasok.",
    modules: [
      {
        title: "1. Blocker & Event Graph",
        icon: Network,
        prompts: [
          "Deteksi blocker kritis di Event Graph konser 5.000 pax",
          "Bantu susun Event Blueprint lengkap dari brief konser festival",
          "Apa hubungan antara node Venue dengan Vendor sound & lighting?",
        ],
      },
      {
        title: "2. Kalkulasi Anggaran & Biaya",
        icon: Calculator,
        prompts: [
          "Hitung alokasi budget dan target tiket konser musik 5.000 pax Rp 1.25 Milyar",
          "Berapa persentase ideal untuk dana cadangan (contingency fund)?",
          "Bagaimana menyusun timeline operasional W-8 hingga hari H acara?",
        ],
      },
    ],
  },
  {
    id: "promotor",
    label: "Promotor",
    icon: TrendingUp,
    badge: "Yield & Multi-City Portfolio",
    description: "Proyeksi break-even, optimasi penjualan tiket, dan manajemen arus kas escrow.",
    modules: [
      {
        title: "1. Break-Even & Yield Tiket",
        icon: TrendingUp,
        prompts: [
          "Hitung proyeksi break-even dan optimasi tier tiket VIP",
          "Bagaimana strategi menutup funding gap antara sponsor vs penjualan tiket?",
          "Berapa harga patokan tiket untuk konser indoor 3.000 pax?",
        ],
      },
      {
        title: "2. Portfolio Lintas Kota",
        icon: Network,
        prompts: [
          "Bagaimana formula perhitungan multiplier effect ekonomi di Live Event Map (/peta)?",
          "Simulasi portfolio tur konser musik di Jakarta, Bandung, dan Surabaya",
        ],
      },
    ],
  },
  {
    id: "sponsor",
    label: "Sponsor",
    icon: Sparkles,
    badge: "Aktivasi Brand & ROI",
    description: "Valuasi paket sponsor, jaminan hak eksklusif, dan estimasi impresi audiens.",
    modules: [
      {
        title: "1. Valuasi & Inventori Sponsor",
        icon: Handshake,
        prompts: [
          "Valuasi paket Presenting Sponsor & estimasi audiens engagement",
          "Bagaimana cara menentukan harga paket Presenting Sponsor dan hak aktivasi brand?",
          "Benefit apa saja yang paling diminati brand korporat saat ini?",
        ],
      },
    ],
  },
  {
    id: "tenant",
    label: "Tenant",
    icon: Store,
    badge: "F&B / Merchandise Zone",
    description: "Kebutuhan daya listrik, estimasi volume transaksi, dan settlement bagi hasil.",
    modules: [
      {
        title: "1. Zonasi & Settlement Booth",
        icon: Store,
        prompts: [
          "Rekomendasi kebutuhan daya listrik dan estimasi transaksi F&B",
          "Berapa harga sewa wajar booth F&B kuliner di event 5.000 pax?",
          "Bagaimana alur settlement otomatis bagi hasil QRIS di OKKAX?",
        ],
      },
    ],
  },
  {
    id: "audience",
    label: "Audience",
    icon: QrCode,
    badge: "LivePass Access & Gate",
    description: "Validasi tiket dinamis anti-screenshot dan prosedur scan cepat di pintu masuk.",
    modules: [
      {
        title: "1. LivePass & Validasi Gate",
        icon: ScanLine,
        prompts: [
          "Jelaskan cara kerja validasi gate offline LivePass anti-calo",
          "Bagaimana SOP validasi scanner tiket QR di gate dan pencegahan tiket ganda?",
          "Apa saja metode pembayaran lokal yang didukung sandbox OKKAX?",
        ],
      },
    ],
  },
  {
    id: "talent",
    label: "Talent",
    icon: Mic2,
    badge: "Rider & Compliance",
    description: "Pemeriksaan kompatibilitas rider teknis panggung dan jadwal termin honor.",
    modules: [
      {
        title: "1. Technical Rider & Soundcheck",
        icon: Mic2,
        prompts: [
          "Periksa kompatibilitas Technical Rider audio 400 kVA dengan venue",
          "Apa saja hal krusial yang wajib ada di Technical Rider artis internasional?",
          "Bagaimana skema pencairan honor talent berbasis milestone termin di OKKAX?",
        ],
      },
    ],
  },
  {
    id: "vendor",
    label: "Vendor",
    icon: Network,
    badge: "Produksi & Rigging Specs",
    description: "Validasi spek audio/lighting/LED dan proteksi milestone pembayaran produksi.",
    modules: [
      {
        title: "1. Produksi & Spek Panggung",
        icon: Network,
        prompts: [
          "Validasi kebutuhan sound system Line Array 24-box dan daya genset 250 kVA",
          "Bagaimana standar rigging ground support untuk beban LED P3 12x6 meter?",
          "Bagaimana alur milestone pembayaran vendor produksi di OKKAX?",
        ],
      },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    icon: Users,
    badge: "Crew & Field Operations",
    description: "Manajemen shift kru panggung, usher, security, dan pencairan honor harian.",
    modules: [
      {
        title: "1. Shift Kru & Crowd Safety",
        icon: Users,
        prompts: [
          "Hitung rasio kebutuhan usher dan security untuk kapasitas 5.000 pax",
          "Bagaimana SOP penugasan Liaison Officer (LO) untuk headliner talent?",
          "Bagaimana verifikasi absensi QR dan pencairan honor kru harian di OKKAX?",
        ],
      },
    ],
  },
];

export default function OkkaxPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialPersona = searchParams.get("persona") || searchParams.get("role") || "organizer";
  const initialPrompt = searchParams.get("prompt") || "";

  const [activePersona, setActivePersona] = useState(initialPersona);
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
  const chatEndRef = useRef(null);
  const autoPromptRan = useRef(false);

  const personaObj = PERSONAS_CONFIG.find((p) => p.id === activePersona) || PERSONAS_CONFIG[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send prompt if provided in URL search parameters
  useEffect(() => {
    if (initialPrompt && !autoPromptRan.current) {
      autoPromptRan.current = true;
      handleSend(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

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
        role: activePersona || user?.roles?.[0] || "organizer",
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
        content: `Mode **${personaObj.label}** aktif. Silakan ajukan rencana, kalkulasi, atau konsultasi operasional live event bersama OKKAX Copilot!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col font-gemini">
      <ScrollProgressBar />
      <PublicNav />

      {/* Telemetry Header Strip */}
      <div className="border-b border-zinc-800/80 bg-[#0c0c0c] px-4 py-2 text-xs">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4 font-gemini-mono text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-white font-semibold font-gemini">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              OKKAX Operations Engine · Online
            </span>
            <span className="hidden sm:inline text-zinc-600">|</span>
            <span className="hidden sm:inline text-zinc-300 font-gemini">Principal Event Intelligence</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-gemini-mono">
            <span className="text-zinc-300">Mode: {personaObj.label} Lens</span>
            <span>·</span>
            <span>15+ Kota Terkoneksi</span>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Mission Control & Scenarios */}
        <aside className="w-full lg:w-84 shrink-0 flex flex-col gap-4">
          {/* Persona Role Switcher Strip */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 shadow-lg">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between font-gemini-mono">
              <span>PILIH KACAMATA PERAN:</span>
              <span className="text-zinc-300 font-mono">8 Roles</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PERSONAS_CONFIG.map((p) => {
                const PIcon = p.icon;
                const isActive = p.id === activePersona;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePersona(p.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isActive
                        ? "border-white/40 bg-white/[0.1] text-white shadow-sm"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <PIcon size={14} className={isActive ? "text-white" : "text-zinc-500"} />
                    <span className="text-[11px] font-semibold mt-1">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Topics Accordion per Persona */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 flex-1 flex flex-col shadow-md font-gemini">
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5 font-gemini-display">
                  <Sliders className="h-3.5 w-3.5 text-zinc-400" /> Modul {personaObj.label}:
                </h2>
                <p className="text-[10px] text-zinc-400 mt-0.5">{personaObj.description}</p>
              </div>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-450px)] pr-1 okx-custom-scrollbar">
              {personaObj.modules.map((scenario, sIdx) => {
                const Icon = scenario.icon;
                return (
                  <div key={sIdx} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/20 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs font-bold text-zinc-200">{scenario.title}</span>
                    </div>
                    <div className="space-y-1">
                      {scenario.prompts.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(p)}
                          disabled={loading}
                          data-testid={`okkax-page-prompt-${sIdx}-${idx}`}
                          className="w-full text-left rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-white/20 border border-transparent transition-all leading-snug block cursor-pointer"
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
        <section className="flex-1 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl flex flex-col shadow-xl overflow-hidden min-h-[640px] lg:min-h-[calc(100vh-170px)]">
          {/* Deck Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#09090f] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="text-xs font-bold text-white tracking-wide">Interactive Copilot Session</span>
              </div>
              <span className="rounded-full bg-white/[0.08] border border-white/[0.15] px-2.5 py-0.5 text-[10px] font-mono text-zinc-300">
                Kacamata: {personaObj.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportTranscript}
                data-testid="okkax-page-export-btn"
                title="Ekspor Transkrip Diskusi"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Ekspor</span>
              </button>
              <button
                onClick={clearChat}
                data-testid="okkax-page-clear-btn"
                title="Bersihkan Percakapan"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Conversation Canvas */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 okx-custom-scrollbar bg-[#060609]/40">
            {messages.map((m, idx) => (
              <div
                key={idx}
                data-testid={`okkax-page-message-${m.role}-${idx}`}
                className={`flex items-start gap-3.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    m.role === "user"
                      ? "bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm"
                      : "bg-gradient-to-br from-zinc-800 via-[#151522] to-zinc-950 border border-white/[0.2] text-white shadow-sm p-1"
                  }`}
                >
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <CopilotIntelligenceIcon className="h-full w-full object-contain" />}
                </div>
                <div
                  className={`group relative max-w-[90%] sm:max-w-[84%] rounded-2xl px-5 py-4 text-sm ${
                    m.role === "user"
                      ? "bg-white/[0.08] border border-white/[0.15] text-white"
                      : "bg-[#121218] border border-white/[0.08] text-zinc-200 shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-white/[0.06] text-[10px] text-zinc-500 font-gemini-mono">
                    <span className="font-semibold text-zinc-400">
                      {m.role === "user" ? "Anda" : "OKKAX Copilot Intelligence"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{m.timestamp}</span>
                      <button
                        onClick={() => copyMessage(m.content, idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white cursor-pointer"
                        title="Salin Teks"
                      >
                        {copiedIdx === idx ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="leading-relaxed">
                    {m.role === "assistant" ? renderFormattedMarkdown(m.content) : m.content}
                  </div>

                  {m.role === "assistant" && idx > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                      <Link
                        to="/demo"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-all"
                      >
                        <Network size={12} className="text-zinc-400" />
                        <span>Lihat Event Graph</span>
                      </Link>
                      <Link
                        to="/products/event-studio"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-all"
                      >
                        <Workflow size={12} className="text-zinc-400" />
                        <span>Buka Event Studio</span>
                      </Link>
                      <Link
                        to="/peta"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-all"
                      >
                        <TrendingUp size={12} className="text-zinc-400" />
                        <span>Live Event Map</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 via-[#151522] to-zinc-950 border border-white/[0.2] text-white shadow-sm p-1">
                  <CopilotIntelligenceIcon className="h-full w-full object-contain animate-spin" />
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-[#121218] px-5 py-4 text-xs text-zinc-400 flex items-center gap-3">
                  <div className="flex space-x-1.5">
                    <div className="h-2 w-2 rounded-full bg-zinc-300 animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.2s]" />
                    <div className="h-2 w-2 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>OKKAX Copilot sedang melakukan komputasi data operasional...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Action Chips Strip */}
          <div className="border-t border-white/[0.08] bg-[#09090f] px-5 py-2.5 flex items-center gap-2 overflow-x-auto okx-custom-scrollbar">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono shrink-0">
              💡 Cepat:
            </span>
            {personaObj.modules[0]?.prompts?.slice(0, 3).map((promptText, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSend(promptText)}
                disabled={loading}
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/[0.08] transition-all truncate max-w-[280px] cursor-pointer"
                title={promptText}
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Chat Input Console */}
          <div className="border-t border-white/[0.08] bg-[#0c0c12] p-4">
            <div className="relative flex items-center rounded-xl border border-white/[0.12] bg-[#060609] px-4 py-2.5 focus-within:border-white/40 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Tanyakan pada OKKAX Copilot seputar ${personaObj.label.toLowerCase()} (e.g. kalkulasi budget, blocker graph, rider, vendor)...`}
                rows={1}
                disabled={loading}
                className="w-full resize-none bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none okx-custom-scrollbar max-h-32"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                data-testid="okkax-page-send-btn"
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-30 transition-all shadow-md cursor-pointer"
              >
                <Send className="h-4 w-4 text-black" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-gemini-mono">
              <span>Tekan Enter untuk mengirim · Shift+Enter untuk baris baru</span>
              <span>OKKAX Event Intelligence Core v2.4</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
