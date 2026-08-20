import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sparkles, Send, ArrowUpRight, CheckCircle2, AlertCircle,
  Cpu, Handshake, Store, TrendingUp, RefreshCw, Building2, Mic2, Wrench, Briefcase
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, idr, num } from "@/lib/api";

const SAMPLE_QUERIES = [
  {
    label: "Workforce Match",
    query: "Cari job event sebagai FOH Sound Engineer atau Stage Crew di Makassar akhir pekan ini",
    roleHint: "Workforce",
    icon: HardHatIcon,
  },
  {
    label: "Vendor Procurement",
    query: "Pengadaan lighting moving head 380W beam dan LED screen P3.91 untuk panggung outdoor 12x10m",
    roleHint: "Vendor",
    icon: Wrench,
  },
  {
    label: "Talent Roster",
    query: "Rekomendasi talent pop-jazz indie budget 40–60 juta dengan rider teknis minimal",
    roleHint: "Talent",
    icon: Mic2,
  },
  {
    label: "Venue Matching",
    query: "Cek ketersediaan venue indoor kapasitas 1.500–2.500 pax di Jakarta Selatan dengan curfew di atas 23:00",
    roleHint: "Venue",
    icon: Building2,
  },
  {
    label: "Sponsor Acquisition",
    query: "Analisis inventaris sponsor tier Gold dan Platinum yang masih open untuk event musik kampus",
    roleHint: "Sponsor",
    icon: Handshake,
  },
  {
    label: "Tenant Commercial",
    query: "Rekomendasi zonasi booth F&B kuliner dan kebutuhan daya listrik 2.200W di festival 5.000 pax",
    roleHint: "Tenant",
    icon: Store,
  },
  {
    label: "Economic Ripple",
    query: "Hitung simulasi perputaran ekonomi lokal (UMKM, hotel, transportasi) untuk konser 3.000 pax di Bali",
    roleHint: "Organizer",
    icon: TrendingUp,
  },
];

function HardHatIcon(props) {
  return <Briefcase {...props} />;
}

// Guest continuity key: when an unauthenticated visitor hits an action that
// needs a workspace, we stash their last prompt here before sending them to
// /login so it can resume automatically once they're signed in.
const PENDING_PROMPT_KEY = "okkax_pending_copilot_prompt";
// Never surface backend/HTTP internals ("Not authenticated", 401, provider
// names) to a public visitor — always this human-facing fallback instead.
const GUEST_FALLBACK_ERROR = "Gagal menghubungi Okkax Copilot. Silakan coba sesaat lagi.";

// -----------------------------------------------------------------------------
// Public, read-only Okkax Copilot demo for guests on /copilot.
//
// Reuses the exact same guest-safe reasoning engine the homepage composer and
// the floating widget already call (POST /okkax/chat, Depends(get_optional_user)
// server-side) — no second chatbot engine, no event/tenant data, no writes.
// The endpoint itself never executes mutations for anonymous callers; when it
// detects an action that needs a workspace it returns source:"action_gate"
// and we surface a login CTA instead of pretending the action happened.
// -----------------------------------------------------------------------------
function GuestCopilotDemo({ pathname }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const runQuery = async (textOverride) => {
    const q = (textOverride || input).trim();
    if (!q || loading) return;

    const nextMessages = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const { data } = await api.post("/okkax/chat", {
        message: q,
        history: nextMessages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        current_route: pathname,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data?.reply || GUEST_FALLBACK_ERROR,
          needsAuth: data?.source === "action_gate",
        },
      ]);
    } catch (err) {
      // Deliberately not err.response?.data?.detail here — that field can be
      // "Not authenticated"/401/provider text, none of which a guest should see.
      console.error("Guest copilot demo error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: GUEST_FALLBACK_ERROR, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runQuery();
    }
  };

  const stashPendingPrompt = (text) => {
    try {
      sessionStorage.setItem(PENDING_PROMPT_KEY, text);
    } catch {
      // sessionStorage unavailable (private mode/etc.) — CTA still navigates,
      // it just won't auto-resume the prompt after login.
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 font-gemini" data-testid="copilot-guest-page">
      <div className="border-b border-white/[0.08] pb-3.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
          <Sparkles size={11} className="text-zinc-300" />
          Okkax Copilot
        </div>
        <h1 className="editorial mt-1.5 text-xl sm:text-2xl md:text-3xl text-white font-bold tracking-tight">
          Okkax Copilot
        </h1>
        <p className="mt-0.5 text-xs text-zinc-400 max-w-2xl leading-relaxed">
          Demo publik — tanya perencanaan event, budget, dan operasional live event Okkax. Read-only, tanpa perlu akun.
        </p>
      </div>

      {/* Conversation Thread */}
      <div className="rounded-2xl border border-white/[0.1] bg-[#0c0c14] p-3.5 sm:p-4 shadow-xl min-h-[280px] max-h-[55vh] overflow-y-auto space-y-3.5">
        {messages.length === 0 ? (
          <div className="space-y-4 py-2">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Ketik pertanyaan operasional, atau coba salah satu contoh berikut:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_QUERIES.map((sq) => {
                const Icon = sq.icon;
                return (
                  <button
                    key={sq.label}
                    type="button"
                    onClick={() => runQuery(sq.query)}
                    data-testid={`copilot-guest-chip-${sq.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10.5px] font-medium text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
                  >
                    <Icon size={11} className="text-zinc-400" />
                    <span>{sq.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              data-testid={`copilot-guest-message-${m.role}-${idx}`}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl border border-white/[0.1] bg-white/[0.06] px-3.5 py-2 text-xs text-white">
                  {m.content}
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <p className={`text-xs leading-relaxed whitespace-pre-wrap ${m.isError ? "text-red-300" : "text-zinc-200"}`}>
                    {m.content}
                  </p>
                  {m.needsAuth && (
                    <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2">
                      <span className="text-[11px] text-zinc-400">Butuh workspace untuk melanjutkan aksi ini.</span>
                      <Link
                        to="/login?next=/app/copilot"
                        onClick={() => stashPendingPrompt(messages[idx - 1]?.content || "")}
                        data-testid="copilot-guest-cta-login"
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-zinc-200 transition-colors shrink-0"
                      >
                        Masuk untuk melanjutkan
                        <ArrowUpRight size={11} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <p className="text-[11px] text-zinc-400 animate-pulse" data-testid="copilot-guest-loading">
            Memproses…
          </p>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runQuery();
        }}
        className="rounded-2xl border border-white/[0.12] bg-[#0c0c12] p-2 sm:p-2.5 shadow-xl ring-1 ring-white/[0.05] flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanyakan budget, vendor, talent, venue, sponsor, atau simulasi finansial..."
          disabled={loading}
          className="flex-1 bg-transparent px-2.5 py-1.5 text-xs sm:text-[13px] text-white placeholder:text-zinc-400 outline-none font-gemini disabled:opacity-60"
          data-testid="copilot-guest-input"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          data-testid="copilot-guest-send"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
        >
          {loading ? <RefreshCw size={13} className="animate-spin text-black" /> : <Send size={13} className="text-black" />}
          <span className="hidden sm:inline">Kirim</span>
        </button>
      </form>

      <p className="text-[10.5px] text-zinc-500 text-center">
        Demo publik read-only, tidak menyimpan data event.{" "}
        <Link to="/login" className="text-zinc-300 hover:text-white underline underline-offset-2">
          Masuk
        </Link>{" "}
        untuk workspace operasional penuh.
      </p>
    </div>
  );
}

export default function IntelligencePage() {
  const { user } = useAuth();
  const location = useLocation();
  const isInsideWorkspace = location.pathname.startsWith("/app");

  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const runQuery = async (queryText) => {
    const q = queryText || inputQuery;
    if (!q.trim() || loading) return;

    setLoading(true);
    setErrorMessage("");
    setInputQuery(q);

    try {
      const { data } = await api.post("/intelligence/query", {
        query: q,
        client_context: { route: location.pathname }
      });

      if (data) {
        setActiveResult(data);
      }
    } catch (err) {
      console.error("Intelligence query error:", err);
      const msg = err.response?.data?.detail || "Gagal menghubungi Okkax Copilot. Silakan coba sesaat lagi.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Continuity after login: if a guest was routed here to sign in after an
  // action-gated /copilot query, resume that exact prompt once authenticated
  // instead of dropping the context they already typed.
  useEffect(() => {
    if (!user) return;
    let pending = null;
    try {
      pending = sessionStorage.getItem(PENDING_PROMPT_KEY);
    } catch {
      pending = null;
    }
    if (pending) {
      try {
        sessionStorage.removeItem(PENDING_PROMPT_KEY);
      } catch {
        // best-effort cleanup only
      }
      setInputQuery(pending);
      runQuery(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // PUBLIC guest path — /app/copilot is already hard-gated to authenticated
  // users by AppShell, so this branch only ever renders on the public /copilot
  // route for a signed-out visitor.
  if (!user && !isInsideWorkspace) {
    return (
      <div className="min-h-screen bg-[#07070a] text-white">
        <PublicNav />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <GuestCopilotDemo pathname={location.pathname} />
        </main>
        <Footer />
      </div>
    );
  }

  const Content = (
    <div className="mx-auto max-w-5xl space-y-4 font-gemini" data-testid="intelligence-page">
      {/* Top Header Surface */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-3.5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
            <Sparkles size={11} className="text-zinc-300" />
            Okkax Copilot
          </div>
          <h1 className="editorial mt-1.5 text-xl sm:text-2xl md:text-3xl text-white font-bold tracking-tight">
            Okkax Copilot
          </h1>
          <p className="mt-0.5 text-xs text-zinc-400 max-w-2xl leading-relaxed">
            AI operasional terhubung langsung ke database live-event Okkax. Menghubungkan supply dan demand secara deterministik dengan jaminan Provenance.
          </p>
        </div>
        {!isInsideWorkspace && (
          <Link
            to="/app/copilot"
            data-testid="copilot-workspace-cta"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-white/25 hover:text-white transition-colors"
          >
            Lanjutkan di Workspace
            <ArrowUpRight size={12} />
          </Link>
        )}
      </div>

      {/* Query Bar */}
      <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c12] p-2 sm:p-2.5 shadow-xl ring-1 ring-white/[0.05] relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Tanyakan peluang job workforce, pengadaan vendor, slot talent, venue, sponsor, atau modeling finansial..."
            className="flex-1 bg-transparent px-2.5 py-1.5 text-xs sm:text-[13px] text-white placeholder:text-zinc-400 outline-none font-gemini"
            data-testid="intelligence-search-input"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            data-testid="intelligence-submit-btn"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
          >
            {loading ? (
              <RefreshCw size={13} className="animate-spin text-black" />
            ) : (
              <Send size={13} className="text-black" />
            )}
            <span className="hidden sm:inline">Kirim Query</span>
          </button>
        </form>

        {/* Fast Intent Capsule Suggestions */}
        <div className="mt-2.5 flex flex-wrap gap-1 pt-2.5 border-t border-white/[0.06]">
          <span className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider font-gemini-mono self-center mr-1">
            Intent cepat:
          </span>
          {SAMPLE_QUERIES.map((sq) => {
            const Icon = sq.icon;
            return (
              <button
                key={sq.label}
                type="button"
                onClick={() => runQuery(sq.query)}
                data-testid={`intent-chip-${sq.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
              >
                <Icon size={11} className="text-zinc-400" />
                <span>{sq.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 animate-fade-in">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Intelligence Output Display */}
      {activeResult && (
        <div className="space-y-3 rounded-2xl border border-white/[0.1] bg-[#0c0c14] p-3.5 sm:p-4 shadow-2xl animate-fade-in" data-testid="intelligence-response-panel">
          {/* Provenance Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white font-gemini-mono">
                <CheckCircle2 size={11} /> {activeResult.provenance?.status || "verified"}
              </span>
              <span className="text-[11px] text-zinc-300">
                Confidence: <strong className="text-white num">{((activeResult.provenance?.confidence || 0.95) * 100).toFixed(0)}%</strong>
              </span>
              <span className="text-xs text-zinc-400">·</span>
              <span className="text-[11px] text-zinc-300">
                Source: <strong className="text-zinc-100 font-gemini-mono">{activeResult.provenance?.source || "internal_database"}</strong>
              </span>
            </div>
            <div className="text-[9.5px] text-zinc-400 font-gemini-mono">
              Method: {activeResult.provenance?.calculation_method || "Deterministic database query & multi-tier modeling"}
            </div>
          </div>

          {/* Response Title & Summary */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                Intent: {activeResult.intent?.category?.replace(/_/g, " ")}
              </span>
              {activeResult.intent?.target_city && (
                <span className="rounded bg-white/10 px-1.5 py-0.2 text-[9.5px] text-zinc-200">
                  {activeResult.intent.target_city}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-200 leading-relaxed font-medium">
              {activeResult.reply_markdown}
            </p>
          </div>

          {/* Summary Metrics Banner if available */}
          {activeResult.structured_payload?.summary_metrics && Object.keys(activeResult.structured_payload.summary_metrics).length > 0 && (
            <div className="flex flex-wrap gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
              {Object.entries(activeResult.structured_payload.summary_metrics).map(([key, val]) => (
                <div key={key} className="text-left">
                  <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-gemini-mono">
                    {key.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs font-bold text-white num">
                    {typeof val === "number" && val > 10000 ? idr(val) : String(val)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cards Grid */}
          {activeResult.structured_payload?.items && activeResult.structured_payload.items.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
              {activeResult.structured_payload.items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.08] bg-[#12121c] p-3 space-y-1.5 hover:border-white/20 transition-colors"
                  data-testid={`intelligence-item-${idx}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      {item.name || item.role || item.item || item.package || item.category || item.sector}
                    </h3>
                    <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-300 font-gemini-mono">
                      {item.type || item.status || item.readiness || item.slotsLeft || item.metric || (item.rating ? `★ ${item.rating}` : "Verified")}
                    </span>
                  </div>

                  {item.city && (
                    <div className="text-[11px] text-zinc-400 font-medium">
                      Lokasi: <span className="text-zinc-200">{item.city}</span>
                    </div>
                  )}

                  {item.event && (
                    <div className="text-[11px] text-zinc-400 font-medium">
                      Event: <span className="text-zinc-200">{item.event}</span> · {item.location}
                    </div>
                  )}

                  {item.vendor && (
                    <div className="text-xs text-zinc-400 font-medium">
                      Vendor: <span className="text-zinc-200">{item.vendor}</span>
                    </div>
                  )}

                  {item.daily_rate && (
                    <div className="text-xs font-semibold text-white num">
                      Rate: {idr(item.daily_rate)} / hari
                    </div>
                  )}

                  {item.compensation && (
                    <div className="text-xs font-semibold text-white num">
                      Kompensasi: {typeof item.compensation === "number" ? idr(item.compensation) : item.compensation}
                    </div>
                  )}

                  {item.rate && (
                    <div className="text-xs font-semibold text-white num">
                      Rate: {typeof item.rate === "number" ? idr(item.rate) : item.rate}
                    </div>
                  )}

                  {item.estimated_fee && (
                    <div className="text-xs font-semibold text-white num">
                      Estimasi Fee: {idr(item.estimated_fee)}
                    </div>
                  )}

                  {item.price_range && (
                    <div className="text-xs font-semibold text-white num">
                      Rentang: {item.price_range}
                    </div>
                  )}

                  {item.amount && (
                    <div className="text-xs font-semibold text-white num">
                      Nilai: {idr(item.amount)} ({item.share_pct}%)
                    </div>
                  )}

                  {item.capacity && (
                    <div className="text-xs text-zinc-300">
                      Kapasitas: <span className="text-white font-bold num">{num(item.capacity)} pax</span> · Curfew: {item.curfew}
                    </div>
                  )}

                  {item.skills && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.skills.map((s, i) => (
                        <span key={i} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-zinc-300 font-gemini-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.inventory && (
                    <ul className="text-[11px] text-zinc-400 space-y-0.5 pt-0.5">
                      {item.inventory.map((inv, i) => (
                        <li key={i}>· {inv}</li>
                      ))}
                    </ul>
                  )}

                  {item.requirements && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Syarat: {item.requirements}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial Empty / Prompt Guide State */}
      {!activeResult && !loading && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12] p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.03] text-zinc-300">
            <Cpu size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Pusat Intelijen Dua Arah (Two-Way Network Matching)
            </h3>
            <p className="mt-1.5 text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Ketik pertanyaan operasional apa pun atau klik salah satu intent di atas untuk memulai penelusuran live-event terstruktur dari katalog event dan entitas terverifikasi.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (isInsideWorkspace) {
    return Content;
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {Content}
      </main>
      <Footer />
    </div>
  );
}
