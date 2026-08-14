import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Wand2, Network, Mic2, Building2, Wrench, HardHat, Handshake, Store, Ticket,
  Wallet, Activity, LineChart, Bell, Menu, X, ShieldCheck, LogOut, ScanLine, ListOrdered, Settings,
  CalendarDays,
} from "lucide-react";
import { Logo } from "@/components/PublicNav";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const NAV = {
  organizer: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/studio", "Event Studio", Wand2],
    ["/app/events", "Events", ListOrdered],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/me", "My Assignments", Settings],
    ["/app/validator", "Ticket Validator", ScanLine],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  role: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/me", "My Assignments", Settings],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  sponsor: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/sponsor", "Opportunities", Handshake],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  tenant: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/tenant", "Opportunities", Store],
    ["/app/calendar", "Calendar", CalendarDays],
    ["/app/tickets", "My Tickets", Ticket],
  ],
  audience: [
    ["/app", "Overview", LayoutDashboard],
    ["/app/tickets", "My Tickets", Ticket],
    ["/app/orders", "Orders & Refunds", Wallet],
  ],
  admin: [["/app/admin", "Admin Panel", ShieldCheck]],
};

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
  if (user.roles?.includes("super_admin") || user.roles?.includes("platform_admin")) links = [...NAV.organizer, ...NAV.admin];

  const markRead = async () => {
    setShowNotif(!showNotif);
    if (!showNotif && notif.unread) {
      await api.post("/notifications/read");
      setNotif((n) => ({ ...n, unread: 0 }));
    }
  };

  const SidebarLinks = ({ onClick }) => (
    <nav className="flex flex-col gap-0.5">
      {links.map(([to, label, Icon]) => (
        <NavLink
          key={to + label}
          to={to}
          end={to === "/app"}
          onClick={onClick}
          data-testid={`side-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
              isActive ? "bg-[var(--okx-accent-tint)] accent-text" : "text-zinc-400 hover:bg-[var(--okx-surface)] hover:text-white"
            }`
          }
        >
          <Icon size={16} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <header className="sticky top-0 z-40 border-b border-[var(--okx-border)] bg-[#0a0a0aee] backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button data-testid="shell-drawer-toggle" onClick={() => setOpen(true)} className="p-1 text-zinc-300 lg:hidden" aria-label="Buka menu">
              <Menu size={20} />
            </button>
            <Logo small />
            <span className="hidden text-xs text-zinc-500 sm:block">Live Event Operating Network</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/discover" className="hidden text-sm text-zinc-400 hover:text-white sm:block">Discover</Link>
            <div className="relative">
              <button data-testid="notif-btn" onClick={markRead} className="relative p-2 text-zinc-300" aria-label="Notifikasi">
                <Bell size={18} />
                {notif.unread > 0 && (
                  <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-[var(--okx-accent)] px-1 text-[10px] font-bold">
                    {notif.unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <div data-testid="notif-panel" className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-auto border border-[var(--okx-border)] bg-[var(--okx-surface)] okx-scroll">
                  {notif.items.length === 0 && <div className="p-4 text-sm text-zinc-500">Belum ada notifikasi.</div>}
                  {notif.items.map((n) => (
                    <div key={n.id} className="border-b border-[var(--okx-border)] p-3 last:border-0">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-[11px] text-zinc-500">{org?.name || user.roles?.join(", ")}</div>
            </div>
            <button
              data-testid="shell-logout-btn"
              onClick={() => {
                logout();
                nav("/");
              }}
              className="border border-[var(--okx-border)] p-2 text-zinc-300 hover:border-[var(--okx-accent)]"
              aria-label="Keluar"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-[var(--okx-border)] py-4 lg:block">
          <SidebarLinks />
          <div className="mt-6 px-3 text-[11px] leading-relaxed text-zinc-600">
            Mode demo kompetisi. Pembayaran sandbox, tanpa uang nyata.
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 border-r border-[var(--okx-border)] bg-[var(--okx-bg)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <Logo small />
                <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="p-1 text-zinc-300"><X size={18} /></button>
              </div>
              <SidebarLinks onClick={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
