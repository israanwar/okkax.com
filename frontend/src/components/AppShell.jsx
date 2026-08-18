import { useEffect, useState, useRef, useCallback } from "react";
import { Link, NavLink, useNavigate, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Wand2, Network, Mic2, Building2, Wrench, HardHat, Handshake, Store, Ticket,
  Wallet, Activity, LineChart, Bell, Menu, X, ShieldCheck, LogOut, ScanLine, ListOrdered, Settings,
  CalendarDays, Globe2, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/PublicNav";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import NotificationPopover from "@/components/NotificationPopover";
import NotificationHistoryModal from "@/components/NotificationHistoryModal";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const NAV = {
  organizer: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/intelligence", "OKKAX Intelligence", Sparkles],
    ["/app/studio", "Event Studio", Wand2],
    ["/app/events", "Events", ListOrdered],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/me", "My Assignments", Settings],
    ["/app/validator", "Ticket Validator", ScanLine],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  role: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/intelligence", "OKKAX Intelligence", Sparkles],
    ["/app/events", "Events", ListOrdered],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/me", "My Assignments", Settings],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  sponsor: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/intelligence", "OKKAX Intelligence", Sparkles],
    ["/app/sponsor", "Opportunities", Handshake],
    ["/app/events", "Events", ListOrdered],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  tenant: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/intelligence", "OKKAX Intelligence", Sparkles],
    ["/app/tenant", "Opportunities", Store],
    ["/app/events", "Events", ListOrdered],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  audience: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/intelligence", "OKKAX Intelligence", Sparkles],
    ["/app/tickets", "My Tickets", Ticket],
    ["/app/orders", "Orders & Refunds", Wallet],
  ],
  admin: [
    ["/app/admin", "Admin Panel", ShieldCheck],
    ["/app/admin/control", "Control Plane", Activity],
    ["/app/intelligence", "OKKAX Intelligence", Sparkles],
  ],
};


const SUPER_ADMIN_NAV = [
  ["/app", "Overview", LayoutDashboard],
  ["/app/intelligence", "OKKAX Intelligence", Sparkles],
  ["/app/admin/control", "Control Plane", Activity],
  ["/app/admin/finance", "Pergerakan Dana", Wallet],
  ["/app/admin", "Admin Panel", ShieldCheck],
  ["/app/events", "Events", ListOrdered],
  ["/app/calendar", "Calendar", CalendarDays],
];

export const EVENT_TABS = [
  ["blueprint", "Blueprint", Wand2],
  ["graph", "Event Graph", Network],
  ["talent", "Talent & Rider", Mic2],
  ["venue", "Venue", Building2],
  ["vendors", "Vendors", Wrench],
  ["workforce", "Workforce", HardHat],
  ["sponsors", "Sponsors", Handshake],
  ["tenants", "Tenants", Store],
  ["tickets", "Tickets", Ticket],
  ["budget", "Budget & Simulator", Wallet],
  ["payments", "Payments", Wallet],
  ["operations", "Operations", Activity],
  ["calendar", "Calendar", CalendarDays],
  ["ripple", "Live Event Impact", LineChart],
];

export default function AppShell({ children }) {
  const { user, org, loading, logout, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState({ items: [], unread: 0, total: 0 });
  const [showNotif, setShowNotif] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const notifBtnRef = useRef(null);
  const nav = useNavigate();

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/notifications?limit=12");
      setNotif(data || { items: [], unread: 0, total: 0 });
    } catch {
      // Ignore
    }
  }, [user]);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  if (loading) return <div className="p-10 text-sm text-zinc-500">Memuat OKKAX…</div>;
  if (!user) return <Navigate to="/login" replace />;

  let links = [];
  if (hasRole("organizer", "event_organizer", "promoter", "supervisor", "finance_approver")) links = NAV.organizer;
  else if (hasRole("sponsor")) links = NAV.sponsor;
  else if (hasRole("tenant")) links = NAV.tenant;
  else if (hasRole("talent", "talent_management", "venue_manager", "vendor", "worker")) links = NAV.role;
  else links = NAV.audience;
  if (user.roles?.includes("super_admin")) {
    links = SUPER_ADMIN_NAV;
  } else if (user.roles?.includes("platform_admin")) {
    links = [...NAV.organizer, ...NAV.admin];
  }

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/read");
      setNotif((prev) => ({
        ...prev,
        unread: 0,
        items: (prev.items || []).map((i) => ({ ...i, read: true })),
      }));
    } catch {
      // Ignore
    }
  };

  const handleMarkSingleRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotif((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        items: (prev.items || []).map((i) =>
          i.id === id ? { ...i, read: true } : i
        ),
      }));
    } catch {
      // Ignore
    }
  };

  const formatUnreadBadge = (count) => {
    if (!count || count <= 0) return null;
    if (count >= 100) return "99+";
    return count.toString();
  };

  const SidebarLinks = ({ onClick }) => (
    <nav className="flex flex-col gap-0.5 px-1.5 font-gemini">
      {links.map(([to, label, Icon]) => (
        <NavLink
          key={to + label}
          to={to}
          end={to === "/app" || to === "/app/admin"}
          onClick={onClick}
          data-testid={`side-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
            }`
          }
        >
          <Icon size={14.5} className="shrink-0" /> <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#07070a] font-gemini">
      <header className="z-50 shrink-0 border-b border-white/[0.08] bg-[#06060a]/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between px-3.5 py-2 sm:px-5">
          <div className="flex items-center gap-2.5">
            <button data-testid="shell-drawer-toggle" onClick={() => setOpen(true)} className="p-1.5 text-zinc-300 lg:hidden rounded-lg hover:bg-white/[0.05]" aria-label="Buka menu">
              <Menu size={18} />
            </button>
            <Logo small />
            <span className="hidden text-[11px] text-zinc-400 sm:block font-gemini-mono">Live Event Operating Network</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/discover" className="hidden text-xs font-semibold text-zinc-400 hover:text-white sm:block px-2.5 py-1 rounded-lg hover:bg-white/[0.04] transition-colors">Discover</Link>
            
            {/* Notification Bell Trigger */}
            <div className="relative">
              <button
                ref={notifBtnRef}
                data-testid="notif-btn"
                onClick={() => setShowNotif((prev) => !prev)}
                className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${
                  showNotif
                    ? "border-white/40 bg-white/15 text-white shadow-sm"
                    : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white"
                }`}
                aria-label="Notifikasi"
              >
                <Bell size={14.5} />
                {notif.unread > 0 && (
                  <span
                    data-testid="notif-badge"
                    className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-extrabold text-black shadow-sm font-gemini-mono"
                  >
                    {formatUnreadBadge(notif.unread)}
                  </span>
                )}
              </button>

              <NotificationPopover
                isOpen={showNotif}
                onClose={() => setShowNotif(false)}
                triggerRef={notifBtnRef}
                notifications={notif.items || []}
                unreadCount={notif.unread || 0}
                totalCount={notif.total || 0}
                onMarkAllRead={handleMarkAllRead}
                onMarkSingleRead={handleMarkSingleRead}
                onOpenHistory={() => setShowHistory(true)}
              />
            </div>

            <NotificationHistoryModal
              isOpen={showHistory}
              onClose={() => {
                setShowHistory(false);
                fetchNotifs();
              }}
              onMarkAllRead={handleMarkAllRead}
              onMarkSingleRead={handleMarkSingleRead}
            />

            <WorkspaceSelector />
            <button
              data-testid="shell-logout-btn"
              onClick={() => {
                logout();
                nav("/");
              }}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-zinc-300 hover:border-white/20 hover:text-white transition-all cursor-pointer"
              aria-label="Keluar"
            >
              <LogOut size={14.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-56 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#060609]/70 py-3.5 lg:block">
          <SidebarLinks />
          <div className="mt-6 px-3 text-[10px] leading-relaxed text-zinc-400 font-gemini-mono">
            Mode demo kompetisi. Pembayaran sandbox, tanpa uang nyata.
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden font-gemini">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-64 border-r border-white/[0.1] bg-[#09090f] p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <Logo small />
                <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="p-1 text-zinc-400 hover:text-white"><X size={16} /></button>
              </div>
              <SidebarLinks onClick={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main
          className="okx-scroll-pane min-w-0 flex-1 overflow-y-auto px-3.5 py-4 sm:px-5 sm:py-4.5"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
