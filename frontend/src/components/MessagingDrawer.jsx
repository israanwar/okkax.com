import { useState, useEffect, useMemo } from "react";
import { MessageSquare, Send, X, ShieldCheck, Search, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";

const relativeTime = (iso) => {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}j`;
  const day = Math.round(hr / 24);
  return `${day}h`;
};

const initials = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const counterpartName = (c, myName) => {
  const names = c.participant_names || [];
  const other = names.find((n) => n && n !== myName);
  return other || c.relationship_title || c.subject || "Percakapan";
};

export default function MessagingDrawer() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState(false);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputContent, setInputContent] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const myName = user && user !== false ? user.name || user.email : null;

  const loadConversations = async (opts = {}) => {
    if (opts.showLoading) setConvLoading(true);
    try {
      const res = await api.get("/messages/conversations");
      const items = res.data?.items || [];
      setConversations(items);
      setConvError(false);
    } catch {
      // Silent for background polling; surface only if list is still empty
      setConversations((prev) => {
        if (prev.length === 0) setConvError(true);
        return prev;
      });
    } finally {
      if (opts.showLoading) setConvLoading(false);
    }
  };

  const loadThread = async (convId) => {
    setLoading(true);
    try {
      const res = await api.get(`/messages/conversations/${convId}`);
      setActiveConv(res.data?.conversation);
      setMessages(res.data?.messages || []);
      // Mark as read
      await api.post(`/messages/conversations/${convId}/read`).catch(() => {});
      loadConversations();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations({ showLoading: true });
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputContent.trim() || !activeConv) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/conversations/${activeConv.id}/messages`, {
        content: inputContent.trim()
      });
      setMessages((prev) => [...prev, res.data?.message]);
      setInputContent("");
      loadConversations();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSending(false);
    }
  };

  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const name = counterpartName(c, myName);
      return (
        c.subject?.toLowerCase().includes(q) ||
        name?.toLowerCase().includes(q) ||
        c.relationship_type?.toLowerCase().includes(q)
      );
    });
  }, [conversations, query, myName]);

  return (
    <>
      {/* Header Messages Icon Trigger */}
      <button
        onClick={() => {
          setOpen(true);
          loadConversations({ showLoading: conversations.length === 0 });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white cursor-pointer"
        title="Pesan Profesional"
        data-testid="messages-header-btn"
      >
        <MessageSquare className="h-4 w-4" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-extrabold text-black font-gemini-mono shadow-sm">
            {unreadTotal}
          </span>
        )}
      </button>

      {/* Slide-over Messaging Modal / Drawer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#0c0c12] text-white sm:max-w-2xl p-0 overflow-hidden font-gemini h-[85vh] sm:h-[560px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-[#101018] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-4 w-4 text-zinc-400 shrink-0" />
              <DialogTitle className="text-sm font-bold text-white truncate">Pesan Profesional</DialogTitle>
            </div>
            <span className="hidden xs:flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 font-gemini-mono">
              <ShieldCheck className="h-3 w-3" /> Relationship Gated
            </span>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left: Conversations List */}
            <div className={`w-full sm:w-2/5 border-r border-white/[0.06] flex flex-col ${activeConv ? "hidden sm:flex" : "flex"}`}>
              {conversations.length > 3 && (
                <div className="p-2.5 border-b border-white/[0.06] shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari percakapan..."
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-8 pr-2 text-[11.5px] text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                {convLoading && conversations.length === 0 ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
                    ))}
                  </div>
                ) : convError && conversations.length === 0 ? (
                  <div className="p-6 text-center">
                    <AlertCircle className="h-5 w-5 text-rose-300 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">Gagal memuat percakapan.</p>
                    <button
                      onClick={() => loadConversations({ showLoading: true })}
                      className="mt-2 text-[11px] font-semibold text-white underline underline-offset-2 cursor-pointer"
                    >
                      Coba lagi
                    </button>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    Belum ada percakapan aktif. Percakapan terbuka otomatis saat penawaran atau deal disetujui.
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">Tidak ada hasil untuk "{query}".</div>
                ) : (
                  filteredConversations.map((c) => {
                    const name = counterpartName(c, myName);
                    return (
                      <button
                        key={c.id}
                        onClick={() => loadThread(c.id)}
                        className={`w-full p-3 text-left transition-all hover:bg-white/[0.03] cursor-pointer flex gap-2.5 ${
                          activeConv?.id === c.id ? "bg-white/[0.06]" : ""
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.1] text-[10.5px] font-bold text-zinc-200 font-gemini-mono">
                          {initials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white truncate">{name}</span>
                            <span className="text-[10px] text-zinc-500 font-gemini-mono shrink-0">
                              {relativeTime(c.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[11px] text-zinc-400 truncate">{c.last_message || c.subject}</span>
                            {c.unread_count > 0 && (
                              <span className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-white px-1 text-[8.5px] font-extrabold text-black font-gemini-mono">
                                {c.unread_count}
                              </span>
                            )}
                          </div>
                          <span className="inline-block mt-1 text-[9.5px] uppercase font-bold text-zinc-500 tracking-wide font-gemini-mono">
                            {c.relationship_type}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Message Thread */}
            <div className={`flex-1 flex flex-col bg-[#0a0a0e] min-h-0 min-w-0 ${!activeConv ? "hidden sm:flex" : "flex"}`}>
              {activeConv ? (
                <>
                  {/* Context Banner */}
                  <div className="border-b border-white/[0.06] bg-[#12121c] p-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveConv(null)}
                        className="text-zinc-400 hover:text-white sm:hidden shrink-0 cursor-pointer"
                        aria-label="Kembali ke daftar percakapan"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.1] text-[10px] font-bold text-zinc-200 font-gemini-mono">
                        {initials(counterpartName(activeConv, myName))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {counterpartName(activeConv, myName)}
                          </span>
                          <button
                            onClick={() => setActiveConv(null)}
                            className="hidden sm:block text-zinc-400 hover:text-white cursor-pointer shrink-0"
                            aria-label="Tutup thread"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-[10.5px] text-zinc-400 truncate block">
                          {activeConv.subject}
                          {activeConv.relationship_title ? ` · ${activeConv.relationship_title}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Messages Bubble List */}
                  <div className="flex-1 overflow-y-auto min-w-0 p-3.5 space-y-2.5">
                    {loading ? (
                      <div className="p-8 text-center text-xs text-zinc-500">Memuat pesan…</div>
                    ) : messages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500">Mulai diskusi terkait milestone proyek ini.</div>
                    ) : (
                      messages.map((m) => {
                        const isMine = m.sender_id === user?.id;
                        return (
                          <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                            <div
                              className={`flex items-baseline gap-2 text-[10px] text-zinc-500 font-gemini-mono mb-0.5 ${
                                isMine ? "flex-row-reverse" : ""
                              }`}
                            >
                              <span>{isMine ? "Anda" : m.sender_name}</span>
                              <span>{String(m.created_at || "").slice(11, 16)}</span>
                            </div>
                            <div
                              className={`rounded-xl border p-2.5 text-xs leading-relaxed max-w-[85%] break-words ${
                                isMine
                                  ? "border-white/20 bg-white text-black font-medium"
                                  : "border-white/[0.08] bg-[#161622] text-zinc-200"
                              }`}
                            >
                              {m.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Reply Composer */}
                  <form onSubmit={handleSendMessage} className="border-t border-white/[0.06] p-2.5 bg-[#101018] flex gap-2 shrink-0">
                    <input
                      type="text"
                      required
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                      placeholder="Tulis pesan profesional terkait event..."
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !inputContent.trim()}
                      className="flex items-center justify-center rounded-xl bg-white px-3.5 text-black hover:bg-zinc-200 transition-all disabled:opacity-40 cursor-pointer"
                      aria-label="Kirim pesan"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 text-xs">
                  Pilih percakapan untuk melihat riwayat komunikasi berizin.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
