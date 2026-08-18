import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Ticket,
  Wallet,
  UserCheck,
  Building2,
  Wrench,
  HardHat,
  Handshake,
  Store,
  Calendar,
  AlertTriangle,
  Info,
  CheckCheck,
  BellOff,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";

export function formatRelativeTime(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin}m lalu`;
    if (diffHour < 24) return `${diffHour}j lalu`;
    if (diffDay === 1) return "Kemarin";
    if (diffDay < 7) return `${diffDay} hr lalu`;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function getCategoryMeta(type, kind) {
  const monoStyle = {
    color: "text-zinc-200",
    bg: "bg-white/[0.04] border-white/[0.1]",
  };

  switch (type) {
    case "ticket_sale":
    case "ticket_sale_aggregated":
    case "ticket_issue":
      return {
        icon: Ticket,
        ...monoStyle,
        badge: "Tiket",
      };
    case "payment":
    case "tenant_payment":
    case "budget_alert":
      return {
        icon: Wallet,
        ...monoStyle,
        badge: "Keuangan",
      };
    case "talent_confirmation":
    case "talent_booking":
    case "talent_rider":
    case "talent_update":
      return {
        icon: UserCheck,
        ...monoStyle,
        badge: "Talent",
      };
    case "venue_booking":
    case "venue_permit":
      return {
        icon: Building2,
        ...monoStyle,
        badge: "Venue",
      };
    case "vendor_quotation":
    case "vendor_loading":
      return {
        icon: Wrench,
        ...monoStyle,
        badge: "Vendor",
      };
    case "workforce_assignment":
    case "workforce_shift":
      return {
        icon: HardHat,
        ...monoStyle,
        badge: "Workforce",
      };
    case "sponsor_confirmed":
    case "sponsor_interest":
    case "sponsor_report":
      return {
        icon: Handshake,
        ...monoStyle,
        badge: "Sponsor",
      };
    case "tenant_application":
    case "tenant_booth":
    case "tenant_notice":
      return {
        icon: Store,
        ...monoStyle,
        badge: "Tenant",
      };
    case "calendar_conflict":
      return {
        icon: AlertTriangle,
        ...monoStyle,
        badge: "Jadwal",
      };
    case "schedule_update":
      return {
        icon: Calendar,
        ...monoStyle,
        badge: "Kalender",
      };
    default:
      if (kind === "warning") {
        return {
          icon: AlertTriangle,
          ...monoStyle,
          badge: "Perhatian",
        };
      }
      return {
        icon: Info,
        ...monoStyle,
        badge: "Info",
      };
  }
}

export default function NotificationPopover({
  isOpen,
  onClose,
  triggerRef,
  notifications,
  unreadCount,
  totalCount,
  onMarkAllRead,
  onMarkSingleRead,
  onOpenHistory,
  loading = false,
}) {
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  // Position calculation relative to trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef?.current || !popoverRef?.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(400, window.innerWidth - 24);
    let left = triggerRect.right - width;

    // Boundary check
    if (left < 12) left = 12;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }

    const top = triggerRect.bottom + 8;
    const maxHeight = Math.min(window.innerHeight - top - 16, 560);

    popoverRef.current.style.position = "fixed";
    popoverRef.current.style.top = `${top}px`;
    popoverRef.current.style.left = `${left}px`;
    popoverRef.current.style.width = `${width}px`;
    popoverRef.current.style.maxHeight = `${maxHeight}px`;
  }, [triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef, updatePosition]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleItemClick = async (notif) => {
    if (!notif.read && onMarkSingleRead) {
      onMarkSingleRead(notif.id);
    }
    onClose();
    if (notif.destination) {
      navigate(notif.destination);
    }
  };

  return createPortal(
    <div
      ref={popoverRef}
      data-testid="notif-panel"
      role="dialog"
      aria-label="Notification Center"
      className="z-[99999] flex flex-col rounded-2xl border border-white/[0.12] bg-[#09090f]/98 shadow-[0_24px_70px_rgba(0,0,0,0.95)] backdrop-blur-2xl font-gemini select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      {/* 1. Fixed Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-[#07070b]">
        <div className="flex items-center gap-2">
          <span className="font-gemini-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-200">
            Notifikasi
          </span>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-white px-1.5 py-0.2 text-[9.5px] font-bold text-black font-gemini-mono">
              {unreadCount} baru
            </span>
          ) : (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.2 text-[9px] font-medium text-zinc-400 font-gemini-mono">
              Semua terbaca
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            data-testid="notif-mark-all-read"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <CheckCheck size={13} className="text-zinc-400" />
            <span>Tandai semua dibaca</span>
          </button>
        )}
      </div>

      {/* 2. Scrollable Body */}
      <div
        className="flex-1 overflow-y-auto okx-scroll divide-y divide-white/[0.04]"
        tabIndex={0}
      >
        {loading ? (
          <div className="p-8 text-center space-y-2 text-zinc-500">
            <div className="animate-pulse flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-white/[0.03] rounded-xl" />
              ))}
            </div>
            <p className="text-xs">Memuat notifikasi…</p>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div
            data-testid="notif-empty-state"
            className="flex flex-col items-center justify-center p-10 text-center text-zinc-400 space-y-2"
          >
            <div className="rounded-full bg-white/[0.04] p-3 border border-white/[0.06] text-zinc-500">
              <BellOff size={20} />
            </div>
            <div className="text-xs font-semibold text-zinc-300">
              Tidak ada notifikasi baru.
            </div>
            <p className="text-[11px] text-zinc-400 max-w-[240px] leading-relaxed">
              Seluruh pembaruan operasional event akan muncul di sini.
            </p>
          </div>
        ) : (
          notifications.map((notif) => {
            const meta = getCategoryMeta(notif.type, notif.kind);
            const Icon = meta.icon;
            const isUnread = !notif.read;

            return (
              <div
                key={notif.id}
                data-testid={`notif-item-${notif.id}`}
                onClick={() => handleItemClick(notif)}
                className={`group relative flex items-start gap-3 p-3 transition-all cursor-pointer ${
                  isUnread
                    ? "bg-white/[0.04] hover:bg-white/[0.07]"
                    : "hover:bg-white/[0.02] opacity-80 hover:opacity-100"
                }`}
              >
                {/* Unread Accent Indicator */}
                {isUnread && (
                  <span
                    data-testid="notif-unread-dot"
                    className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                )}

                {/* Category Icon */}
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.bg}`}
                >
                  <Icon size={13} className={meta.color} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`text-xs truncate ${
                        isUnread
                          ? "font-bold text-white"
                          : "font-medium text-zinc-300"
                      }`}
                    >
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0 font-gemini-mono">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>

                  {notif.event_name && (
                    <div className="text-[10px] font-semibold text-zinc-400 truncate">
                      {notif.event_name}
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-300 leading-snug break-words">
                    {notif.body}
                  </p>

                  {/* Aggregated extra badge if any */}
                  {notif.metadata?.count > 1 && (
                    <div className="pt-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-white/10 border border-white/20 px-1.5 py-0.2 text-[9px] font-bold text-white font-gemini-mono">
                        <Sparkles size={9} /> {notif.metadata.count} transaksi
                      </span>
                    </div>
                  )}
                </div>

                <ChevronRight
                  size={13}
                  className="shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:text-zinc-300 transition-all mt-1"
                />
              </div>
            );
          })
        )}
      </div>

      {/* 3. Fixed Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-white/[0.08] px-4 py-2.5 bg-[#07070b]">
        <span className="text-[10px] text-zinc-400 font-gemini-mono">
          {totalCount ? `${totalCount} riwayat total` : "Histori notifikasi"}
        </span>

        <button
          type="button"
          data-testid="notif-view-all"
          onClick={() => {
            onClose();
            if (onOpenHistory) onOpenHistory();
          }}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-white hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <span>Lihat semua notifikasi</span>
          <ChevronRight size={12} />
        </button>
      </div>
    </div>,
    document.body
  );
}
