import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X,
  CheckCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BellOff,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatRelativeTime, getCategoryMeta } from "./NotificationPopover";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_TABS = [
  { id: "all", label: "Semua" },
  { id: "ticket_sale", label: "Tiket" },
  { id: "payment", label: "Keuangan" },
  { id: "talent_confirmation", label: "Talent" },
  { id: "vendor_quotation", label: "Vendor" },
  { id: "sponsor_confirmed", label: "Sponsor" },
  { id: "tenant_application", label: "Tenant" },
  { id: "venue_booking", label: "Venue & Izin" },
];

const AUDIENCE_CATEGORY_TABS = [
  { id: "all", label: "Semua" },
  { id: "ticket_issue", label: "Tiket" },
  { id: "payment", label: "Pembayaran" },
  { id: "event_reminder", label: "Pengingat" },
  { id: "schedule_update", label: "Perubahan Event" },
];

export default function NotificationHistoryModal({
  isOpen,
  onClose,
  onMarkAllRead,
  onMarkSingleRead,
}) {
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");

  const limit = 25;
  const categoryTabs = effectiveRole === "audience" ? AUDIENCE_CATEGORY_TABS : CATEGORY_TABS;

  useEffect(() => {
    setCategory("all");
    setPage(1);
  }, [effectiveRole]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        unread_only: unreadOnly ? "true" : "false",
      });
      if (category && category !== "all") {
        params.append("category", category);
      }

      const { data } = await api.get(`/notifications/history?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unread || 0);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [page, category, unreadOnly]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.body?.toLowerCase().includes(q) ||
      item.event_name?.toLowerCase().includes(q)
    );
  });

  const handleItemClick = async (notif) => {
    if (!notif.read && onMarkSingleRead) {
      onMarkSingleRead(notif.id);
      setItems((prev) =>
        prev.map((i) => (i.id === notif.id ? { ...i, read: true } : i))
      );
    }
    if (notif.destination) {
      onClose();
      navigate(notif.destination);
    }
  };

  const handleMarkAll = async () => {
    if (onMarkAllRead) {
      await onMarkAllRead();
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      setUnreadCount(0);
    }
  };

  return createPortal(
    <div
      data-testid="notif-history-modal"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 font-gemini"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div className="relative flex h-full max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-white/[0.12] bg-[#09090f] shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-[#07070b]">
          <div className="flex items-center gap-3">
            <h2 className="font-gemini-mono text-sm font-bold uppercase tracking-wider text-white">
              Riwayat Notifikasi
            </h2>
            <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-400 font-gemini-mono">
              {total} Total · {unreadCount} Belum dibaca
            </span>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="notif-history-mark-all"
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/25 transition-all"
              >
                <CheckCheck size={13} />
                <span>Tandai semua dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
              aria-label="Tutup modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar: Category Tabs & Search */}
        <div className="flex flex-col gap-2 border-b border-white/[0.06] bg-[#07070b]/60 px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategory(tab.id);
                  setPage(1);
                }}
                className={`inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  category === tab.id
                    ? "bg-white/15 text-white font-bold border border-white/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => {
                  setUnreadOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-white/20 bg-zinc-900 text-white focus:ring-0 cursor-pointer"
              />
              <span>Hanya unread</span>
            </label>

            <div className="relative min-w-[180px]">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                placeholder="Cari notifikasi…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-7 pr-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Body: Scrollable Feed */}
        <div className="flex-1 overflow-y-auto okx-scroll divide-y divide-white/[0.04] p-2 sm:p-3">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Memuat data riwayat…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center text-zinc-500 space-y-2">
              <BellOff size={24} className="text-zinc-600" />
              <p className="text-xs">Tidak ada notifikasi yang sesuai filter.</p>
            </div>
          ) : (
            filteredItems.map((notif) => {
              const meta = getCategoryMeta(notif.type, notif.kind);
              const Icon = meta.icon;
              const isUnread = !notif.read;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex items-center justify-between gap-4 rounded-xl p-3 transition-all cursor-pointer ${
                    isUnread
                      ? "bg-white/[0.04] hover:bg-white/[0.07]"
                      : "hover:bg-white/[0.02] opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.bg}`}
                    >
                      <Icon size={13} className={meta.color} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs ${
                            isUnread
                              ? "font-bold text-white"
                              : "font-medium text-zinc-300"
                          }`}
                        >
                          {notif.title}
                        </span>
                        {isUnread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                        )}
                        {notif.event_name && (
                          <span className="rounded bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.2 text-[9.5px] text-zinc-400 font-gemini-mono">
                            {notif.event_name}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {notif.body}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-zinc-500 font-gemini-mono">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                    <ExternalLink
                      size={13}
                      className="text-zinc-600 hover:text-white transition-colors"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Pagination */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.08] px-5 py-3 bg-[#07070b]">
          <span className="text-xs text-zinc-400 font-gemini-mono">
            Halaman {page} dari {totalPages} ({total} record)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-white/25 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={13} /> Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-white/25 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Selanjutnya <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
