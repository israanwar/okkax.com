import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Wand2, Network, Mic2, Building2, Wrench, HardHat, Handshake, Store, Ticket,
  Wallet, Activity, LineChart, Bell, Menu, X, ShieldCheck, LogOut, ScanLine, ListOrdered, Settings,
  CalendarDays, Globe2, Layers,
} from "lucide-react";
import { Logo } from "@/components/PublicNav";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const NAV = {
  organizer: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/okkax", "OKKAX Copilot", Layers],
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
    ["/app/okkax", "OKKAX Copilot", Layers],
    ["/app/me", "My Assignments", Settings],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  sponsor: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/okkax", "OKKAX Copilot", Layers],
    ["/app/sponsor", "Opportunities", Handshake],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  tenant: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/okkax", "OKKAX Copilot", Layers],
    ["/app/tenant", "Opportunities", Store],
    ["/app/network", "Network", Globe2],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  audience: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/okkax", "OKKAX Copilot", Layers],
    ["/app/tickets", "My Tickets", Ticket],
    ["/app/orders", "Orders & Refunds", Wallet],
  ],
  admin: [
    ["/app/admin", "Admin Panel", ShieldCheck],
    ["/app/admin/control", "Control Plane", Activity],
    ["/app/okkax", "OKKAX Copilot", Layers],
  ],
};


const SUPER_ADMIN_NAV = [
  ["/app", "Overview", LayoutDashboard],
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
  const [notif, setNotif] = useState({ items: [], unread: 0 });
  const [showNotif, setShowNotif] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (user) api.get("/notifications").then(({ data }) => setNotif(data)).catch(() => {});
  }, [user]);

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

  const markRead = async () => {
    setShowNotif(!showNotif);
    if (!showNotif && notif.unread) {
      await api.post("/notifications/read");
      setNotif((n) => ({ ...n, unread: 0 }));
    }
  };

  const SidebarLinks = ({ onClick }) => (
    <nav className="flex flex-col gap-1 px-2 font-gemini">
      {links.map(([to, label, Icon]) => (
        <NavLink
          key={to + label}
          to={to}
          end={to === "/app" || to === "/app/admin"}
          onClick={onClick}
          data-testid={`side-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs sm:text-[13px] font-semibold transition-all ${
              isActive
                ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.08]"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
            }`
          }
        >
          <Icon size={16} className="shrink-0" /> <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#07070a] font-gemini">
      <header className="z-40 shrink-0 border-b border-white/[0.08] bg-[#06060a]/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button data-testid="shell-drawer-toggle" onClick={() => setOpen(true)} className="p-1.5 text-zinc-300 lg:hidden rounded-lg hover:bg-white/[0.05]" aria-label="Buka menu">
              <Menu size={20} />
            </button>
            <Logo small />
            <span className="hidden text-xs text-zinc-400 sm:block font-gemini-mono">Live Event Operating Network</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/discover" className="hidden text-xs font-semibold text-zinc-400 hover:text-white sm:block px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">Discover</Link>
            <div className="relative">
              <button data-testid="notif-btn" onClick={markRead} className="relative p-2 text-zinc-300 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:text-white transition-all cursor-pointer" aria-label="Notifikasi">
                <Bell size={16} />
                {notif.unread > 0 && (
                  <span className="num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black shadow-sm">
                    {notif.unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <div data-testid="notif-panel" className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-auto rounded-2xl border border-white/[0.12] bg-[#0c0c12]/98 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl okx-scroll">
                  {notif.items.length === 0 && <div className="p-4 text-xs text-zinc-400">Belum ada notifikasi.</div>}
                  {notif.items.map((n) => (
                    <div key={n.id} className="border-b border-white/[0.06] p-3.5 last:border-0 hover:bg-white/[0.02]">
                      <div className="text-xs font-bold text-white">{n.title}</div>
                      <div className="mt-1 text-[11px] text-zinc-400">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <WorkspaceSelector />
            <button
              data-testid="shell-logout-btn"
              onClick={() => {
                logout();
                nav("/");
              }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-zinc-300 hover:border-white/20 hover:text-white transition-all cursor-pointer"
              aria-label="Keluar"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-60 shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#060609]/70 py-5 lg:block">
          <SidebarLinks />
          <div className="mt-8 px-4 text-[10.5px] leading-relaxed text-zinc-500 font-gemini-mono">
            Mode demo kompetisi. Pembayaran sandbox, tanpa uang nyata.
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden font-gemini">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 border-r border-white/[0.1] bg-[#09090f] p-5 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <Logo small />
                <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="p-1.5 text-zinc-400 hover:text-white"><X size={18} /></button>
              </div>
              <SidebarLinks onClick={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main
          className="okx-scroll-pane min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
