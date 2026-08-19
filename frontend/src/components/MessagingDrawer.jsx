import { useState, useEffect } from "react";
import { MessageSquare, Send, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function MessagingDrawer() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputContent, setInputContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadConversations = async () => {
    try {
      const res = await api.get("/messages/conversations");
      const items = res.data?.items || [];
      setConversations(items);
    } catch {
      // Ignore unauthorized or offline silently
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
    loadConversations();
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

  return (
    <>
      {/* Header Messages Icon Trigger */}
      <button
        onClick={() => {
          setOpen(true);
          loadConversations();
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
        <DialogContent className="border-white/10 bg-[#0c0c12] text-white sm:max-w-2xl p-0 overflow-hidden font-gemini h-[560px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-[#101018]">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zinc-400" />
              <DialogTitle className="text-sm font-bold text-white">Komunikasi Profesional Berizin</DialogTitle>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 font-gemini-mono">
              <ShieldCheck className="h-3 w-3" /> Relationship Gated
            </span>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left: Conversations List */}
            <div className={`w-full sm:w-2/5 border-r border-white/[0.06] overflow-y-auto divide-y divide-white/[0.04] ${activeConv ? "hidden sm:block" : "block"}`}>
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  Belum ada percakapan aktif. Percakapan terbuka otomatis saat penawaran atau deal disetujui.
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadThread(c.id)}
                    className={`w-full p-3.5 text-left transition-all hover:bg-white/[0.03] cursor-pointer ${
                      activeConv?.id === c.id ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono">
                        {c.relationship_type}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-1 text-[8.5px] font-extrabold text-black font-gemini-mono">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white mt-1 truncate">{c.subject}</div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">{c.last_message}</div>
                  </button>
                ))
              )}
            </div>

            {/* Right: Message Thread */}
            <div className={`flex-1 flex flex-col bg-[#0a0a0e] ${!activeConv ? "hidden sm:flex" : "flex"}`}>
              {activeConv ? (
                <>
                  {/* Context Banner */}
                  <div className="border-b border-white/[0.06] bg-[#12121c] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono truncate">
                        {activeConv.relationship_title || "Kemitraan Resmi Terverifikasi"}
                      </span>
                      <button
                        onClick={() => setActiveConv(null)}
                        className="text-zinc-400 hover:text-white sm:hidden"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white mt-0.5">{activeConv.subject}</h3>
                  </div>

                  {/* Messages Bubble List */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                    {loading ? (
                      <div className="p-8 text-center text-xs text-zinc-500">Memuat pesan…</div>
                    ) : messages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500">Mulai diskusi terkait milestone proyek ini.</div>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className="space-y-0.5">
                          <div className="flex items-baseline justify-between text-[10px] text-zinc-500 font-gemini-mono">
                            <span>{m.sender_name} ({m.sender_role})</span>
                            <span>{String(m.created_at || "").slice(11, 16)}</span>
                          </div>
                          <div className="rounded-xl border border-white/[0.08] bg-[#161622] p-2.5 text-xs text-zinc-200 leading-relaxed max-w-[85%]">
                            {m.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply Composer */}
                  <form onSubmit={handleSendMessage} className="border-t border-white/[0.06] p-2.5 bg-[#101018] flex gap-2">
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
