import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, Instagram, Mail, MapPinned, Menu, Radio, ShieldCheck, Waypoints, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";
import LiveTicker from "@/components/LiveTicker";

// Brand-accurate marks untuk platform yang tidak ada di lucide (X, WhatsApp).
// Semua icon (termasuk Instagram/Mail dari lucide) mewarisi currentColor supaya
// mengikuti tema OKKAX: zinc-500 default, --okx-accent saat hover.
function XMark({ size = 17 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function WhatsAppMark({ size = 17 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.83 11.83 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.14 1.6 5.94L.06 24l6.32-1.65a11.87 11.87 0 0 0 5.67 1.44h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.16-3.42-8.43zM12.06 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.64-.23-.37a9.86 9.86 0 1 1 18.26-5.29c0 5.44-4.44 9.88-9.89 9.9zm5.42-7.4c-.3-.15-1.76-.87-2.03-.96-.27-.1-.47-.15-.67.15-.2.29-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.12-.27-.2-.57-.35z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: "Instagram Isra Anwar", href: "https://www.instagram.com/okkarhys", Icon: Instagram },
  { label: "X (Twitter) Isra Anwar", href: "https://x.com/Okkarhys_twit", Icon: XMark },
  { label: "Email Isra Anwar", href: "mailto:israanwarr@gmail.com", Icon: Mail },
  { label: "WhatsApp Isra Anwar", href: "https://wa.me/6282189594190", Icon: WhatsAppMark },
];

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
  { to: "/pricing", label: "Pricing" },
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
      <LiveTicker />
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
          <FooterLinks title="Access" links={[["Pricing", "/pricing"], ["Build an Event", "/register"], ["Sign In", "/login"]]} />
        </div>

        <div className="flex flex-col justify-between gap-5 border-t border-[var(--okx-border)] py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>Dibuat oleh</span>
            <a
              href="https://www.instagram.com/okkarhys"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium tracking-tight text-zinc-200 transition-colors hover:text-[var(--okx-accent)]"
              data-testid="footer-creator-link"
            >
              Isra Anwar
            </a>
          </div>
          <nav aria-label="Sosial media Isra Anwar" className="flex items-center gap-2.5">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                data-testid={`footer-social-${label.split(" ")[0].toLowerCase()}`}
                className="okx-social-tile inline-flex h-10 w-10 items-center justify-center border border-[var(--okx-border)] text-zinc-400"
              >
                <Icon size={18} />
              </a>
            ))}
          </nav>
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
