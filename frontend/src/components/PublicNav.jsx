import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";

export const Logo = ({ small }) => (
  <Link to="/" data-testid="okkax-logo" className="group flex items-center gap-2.5">
    <span
      aria-hidden="true"
      className={`${small ? "h-7 w-7" : "h-8 w-8"} shrink-0 border border-[#ffffff1a] bg-[#0a0a0a] transition-transform group-hover:scale-105`}
      style={{
        backgroundImage: `url(${LOGO_URL})`,
        backgroundSize: "120%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
    <span className={`font-extrabold tracking-tight ${small ? "text-base" : "text-lg"}`}>OKKAX</span>
    <span className="sr-only">OKKAX — The Event Economy Operating Network</span>
  </Link>
);

const links = [
  { to: "/discover", label: "Discover" },
  { to: "/peta", label: "Peta Ekonomi" },
  { to: "/juri", label: "Demo untuk Juri" },
  { to: "/for/organizers", label: "For Organizers" },
  { to: "/for/sponsors", label: "For Sponsors" },
  { to: "/for/tenants", label: "For Tenants" },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--okx-border)] bg-[#0a0a0acc] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 lg:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase().replace(/ /g, "-")}`}
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/app"
                data-testid="nav-workspace-btn"
                className="hidden bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--okx-accent-hover)] sm:block"
              >
                Workspace
              </Link>
              <button
                data-testid="nav-logout-btn"
                onClick={() => {
                  logout();
                  nav("/");
                }}
                className="hidden border border-[var(--okx-border)] px-3 py-2 text-sm text-zinc-300 hover:text-white sm:block"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="nav-signin-btn"
                className="hidden px-3 py-2 text-sm text-zinc-300 hover:text-white sm:block"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                data-testid="nav-getstarted-btn"
                className="bg-[var(--okx-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--okx-accent-hover)]"
              >
                Compile an Event
              </Link>
            </>
          )}
          <button
            data-testid="nav-mobile-toggle"
            aria-label="Menu"
            onClick={() => setOpen(!open)}
            className="p-2 text-zinc-300 lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--okx-border)] bg-[var(--okx-surface)] px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm text-zinc-300"
                data-testid={`mnav-${l.label.toLowerCase().replace(/ /g, "-")}`}
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link to="/app" onClick={() => setOpen(false)} className="py-2.5 text-sm accent-text">
                  Workspace
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="py-2.5 text-left text-sm text-zinc-300"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="py-2.5 text-sm accent-text">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--okx-border)] bg-[#070707] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-zinc-500">
              OKKAX — Event Economy Operating Network. From event idea to live economy.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Network</h4>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><Link to="/discover">Discover Events</Link></li>
              <li><Link to="/peta">Peta Kota Event</Link></li>
              <li><Link to="/juri">Demo untuk Juri</Link></li>
              <li><Link to="/present">Mode Presentasi</Link></li>
              <li><Link to="/for/sponsors">Sponsor Exchange</Link></li>
              <li><Link to="/for/tenants">Tenant Exchange</Link></li>
              <li><Link to="/validator">Ticket Validator</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Platform</h4>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><Link to="/for/organizers">For Organizers</Link></li>
              <li><Link to="/register">Compile an Event</Link></li>
              <li><Link to="/login">Sign In</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Disclaimer</h4>
            <p className="text-xs leading-relaxed text-zinc-500">
              Seluruh nama, organisasi, talent, harga, rider, transaksi, tiket, dan metrik pada mode demo
              merupakan data fiktif untuk keperluan demonstrasi kompetisi. Pembayaran bersifat sandbox —
              tidak ada uang nyata yang ditagihkan. Estimasi pajak bukan nasihat pajak.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-[var(--okx-border)] pt-6 text-xs text-zinc-600 sm:flex-row">
          <span>© 2026 OKKAX. The Event Economy Operating Network.</span>
          <span>One event. Every moving part.</span>
        </div>
      </div>
    </footer>
  );
}
