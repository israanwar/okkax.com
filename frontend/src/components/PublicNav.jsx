import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, MapPinned, Menu, Radio, ShieldCheck, Waypoints, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";

export const Logo = ({ small }) => (
  <Link
    to="/"
    data-testid="okkax-logo"
    aria-label="OKKAX — Live Event Operating Network"
    className={`okkax-logo group inline-flex shrink-0 flex-col items-start ${small ? "w-[82px]" : "w-[132px]"}`}
  >
    <img
      src={LOGO_URL}
      alt="OKKAX"
      className={`okkax-logo-image ${small ? "h-[18px]" : "h-[23px]"} w-auto object-contain`}
    />
    {!small && (
      <span className="okkax-logo-category mt-0.5 text-[7px] font-semibold uppercase leading-none tracking-[0.17em] text-zinc-500">
        Live Event Operating Network
      </span>
    )}
  </Link>
);

const links = [
  { to: "/discover", label: "Discover" },
  { to: "/calendar", label: "Calendar" },
  { to: "/peta", label: "Live Event Map" },
  { to: "/for/organizers", label: "For Organizers" },
  { to: "/for/sponsors", label: "For Sponsors" },
  { to: "/for/tenants", label: "For Tenants" },
  { to: "/juri", label: "Platform Demo" },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="okx-public-nav sticky top-0 z-40 border-b border-[var(--okx-border)] bg-[#0a0a0ae8] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="okx-nav-type hidden items-center gap-6 lg:flex" aria-label="Navigasi utama">
            {links.map((l, index) => (
              <NavLink
                key={l.label}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase().replace(/ /g, "-")}`}
                style={{ "--nav-delay": `${120 + index * 55}ms` }}
                className={({ isActive }) =>
                  `okx-nav-link relative py-2 text-[13px] font-medium tracking-[0.015em] ${
                    isActive ? "is-active text-[#f0e9e5]" : "text-zinc-400"
                  }`
                }
              >
                {l.label}
              </NavLink>
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
                className="okx-nav-type hidden px-3 py-2 text-[13px] font-medium tracking-[0.015em] text-zinc-300 hover:text-white sm:block"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                data-testid="nav-getstarted-btn"
                className="okx-nav-cta okx-nav-type bg-[var(--okx-accent)] px-4 py-2 text-[13px] font-semibold tracking-[0.01em] text-white hover:bg-[var(--okx-accent-hover)]"
              >
                Build an Event
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
        <div className="okx-mobile-menu border-t border-[var(--okx-border)] bg-[var(--okx-surface)] px-4 py-3 lg:hidden">
          <nav className="okx-nav-type flex flex-col gap-1">
            {links.map((l, index) => (
              <Link
                key={l.label}
                to={l.to}
                onClick={() => setOpen(false)}
                className="okx-mobile-link py-2.5 text-sm text-zinc-300"
                style={{ "--mobile-delay": `${index * 45}ms` }}
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
    <footer data-testid="public-footer" className="okx-footer border-t border-[var(--okx-border)] bg-[#070707] px-4 sm:px-6">
      <div className="mx-auto max-w-7xl py-14 sm:py-20">
        <div className="grid items-end gap-9 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
              <Radio size={15} aria-hidden="true" /> Live Event Operating Network
            </div>
            <h2 className="editorial mt-5 max-w-4xl text-[clamp(2.5rem,6vw,5.9rem)] leading-[0.92] text-[#f4efec]">
              Every moving part,<br /><span className="accent-text">working as one.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Dari ide pertama hingga showtime, setiap partner, produksi, ticketing, dan pembayaran bekerja sebagai satu pertunjukan.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link to="/register" className="group flex min-w-52 items-center justify-between bg-[var(--okx-accent)] px-5 py-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]">
              Build an Event <ArrowUpRight size={18} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/discover" className="group flex min-w-52 items-center justify-between border border-zinc-700 px-5 py-4 text-sm font-semibold text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900">
              Discover Events <ArrowUpRight size={18} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-14 grid border-y border-[var(--okx-border)] sm:grid-cols-3">
          {[
            [Waypoints, "One connected network", "People, partners, process, and payment"],
            [MapPinned, "Built for live operations", "From the first brief to show day"],
            [ShieldCheck, "Competition demo", "Secure sandbox — no real payment"],
          ].map(([Icon, title, copy], index) => (
            <div key={title} className={`flex gap-4 py-6 ${index ? "sm:border-l sm:border-[var(--okx-border)] sm:pl-6" : ""} ${index < 2 ? "border-b border-[var(--okx-border)] sm:border-b-0 sm:pr-6" : ""}`}>
              <Icon size={21} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[var(--okx-accent)]" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-zinc-100">{title}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{copy}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-10 py-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo />
            <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">
              Orkestrasi Koneksi, Kolaborasi, Aktivasi &amp; eXperience. Seluruh pihak dan proses di balik live event, terhubung dalam satu sistem.
            </p>
          </div>
          <FooterLinks title="Explore" links={[["Discover Events", "/discover"], ["Event Calendar", "/calendar"], ["Live Event Map", "/peta"], ["Platform Demo", "/juri"]]} />
          <FooterLinks title="Network" links={[["For Organizers", "/for/organizers"], ["For Sponsors", "/for/sponsors"], ["For Tenants", "/for/tenants"], ["Ticket Validator", "/validator"]]} />
          <FooterLinks title="Access" links={[["Build an Event", "/register"], ["Sign In", "/login"]]} />
        </div>

        <div className="flex flex-col justify-between gap-5 border-t border-[var(--okx-border)] pt-6 text-xs leading-5 text-zinc-600 lg:flex-row lg:items-end">
          <div className="max-w-4xl">
            Seluruh nama, organisasi, talent, harga, rider, transaksi, tiket, dan metrik pada mode demo merupakan data fiktif untuk demonstrasi kompetisi. Pembayaran bersifat sandbox; tidak ada uang nyata yang ditagihkan.
          </div>
          <div className="shrink-0 lg:text-right">
            <div>© 2026 OKKAX</div>
            <div className="mt-1 text-zinc-500">One event. Every moving part.</div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }) {
  return (
    <div className="md:col-span-2 last:md:col-span-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm text-zinc-400">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link className="inline-flex items-center gap-1.5 hover:text-white" to={to}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
