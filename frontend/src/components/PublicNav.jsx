// OKKAX Public Navigation and Footer.
//
// Single source of truth for the public taxonomy. Header, mobile drawer,
// and footer all render from the same NAV constant so labels and routes
// cannot drift apart.
//
// Design principles:
//   - one concept = one canonical name = one canonical destination
//   - Event Studio contains Event Graph internally; Event Graph is not
//     a separate Products entry
//   - Desktop: premium compact dropdown/mega-menu on hover or click
//   - Mobile: drawer with accordion sections
//   - No em-dash, no emoji, brand palette (black + white + OKKAX pink)

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ChevronDown,
  Instagram,
  Mail,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, LOGO_URL } from "@/lib/api";

// -----------------------------------------------------------------------------
// Canonical navigation taxonomy. Everything downstream (header, mobile drawer,
// footer, structured data if any) reads from this.
// -----------------------------------------------------------------------------
export const NAV = [
  { id: "home", label: "Home", to: "/" },
  {
    id: "explore",
    label: "Explore",
    children: [
      { label: "Discover Events", to: "/discover", note: "Cari event berdasarkan kota, kategori, dan tanggal." },
      { label: "Event Calendar",  to: "/calendar", note: "Jadwal event pada satu kalender." },
      { label: "Live Event Map",  to: "/peta",     note: "Peta interaktif event yang sedang atau akan berlangsung." },
    ],
  },
  {
    id: "products",
    label: "Products",
    children: [
      { label: "Event Studio",       to: "/products/event-studio",       note: "Compile brief menjadi Event Blueprint." },
      { label: "OKKAX Copilot",      to: "/okkax",                       note: "Principal Event Intelligence & Operations Copilot." },
      { label: "Network",            to: "/products/network",            note: "Talent, Venue, Vendor, Workforce, Sponsor, Tenant." },
      { label: "OKKAX Intelligence", to: "/products/intelligence",       note: "Observe. Understand. Optimize." },
      { label: "Ticket Studio",      to: "/products/ticket-studio",      note: "Inventory, seating, ticket products." },
      { label: "LivePass",           to: "/products/livepass",           note: "Live access entitlement, not a file." },
      { label: "Protected Payment",  to: "/products/protected-payment",  note: "Funding aman, protected balance, settlement." },
    ],
  },
  {
    id: "solutions",
    label: "Solutions",
    children: [
      { label: "Organizers", to: "/for/organizers" },
      { label: "Promoters",  to: "/for/promoters"  },
      { label: "Talent",     to: "/for/talent"     },
      { label: "Venues",     to: "/for/venues"     },
      { label: "Vendors",    to: "/for/vendors"    },
      { label: "Workforce",  to: "/for/workforce"  },
      { label: "Sponsors",   to: "/for/sponsors"   },
      { label: "Tenants",    to: "/for/tenants"    },
      { label: "Attendees",  to: "/for/attendees"  },
    ],
  },
  { id: "pricing", label: "Pricing", to: "/pricing" },
  {
    id: "company",
    label: "Company",
    children: [
      { label: "About OKKAX",         to: "/about"         },
      { label: "How It Works",        to: "/how-it-works"  },
      { label: "Contact",             to: "/contact"       },
      { label: "Terms & Conditions",  to: "/terms"         },
      { label: "Privacy Policy",      to: "/privacy"       },
    ],
  },
  { id: "demo", label: "Demo", to: "/demo", mega: "quick-demo" },
];

// Six quick-demo roles per the canonical spec. Supervisor is intentionally
// removed. Roles that do not have a live persona map to a friendly
// register redirect so the button is honest.
export const QUICK_DEMO_ROLES = [
  { id: "organizer", label: "Organizer", persona: "Penyelenggara", destination: "/app" },
  { id: "promoter",  label: "Promoter",  persona: "Penyelenggara", destination: "/app" },
  { id: "vendor",    label: "Vendor",    persona: null,             destination: "/register?role=vendor" },
  { id: "sponsor",   label: "Sponsor",   persona: "Sponsor",        destination: "/app/sponsor" },
  { id: "tenant",    label: "Tenant",    persona: "Tenant",         destination: "/app/tenant" },
  { id: "audience",  label: "Audience",  persona: "Pengunjung",     destination: "/app" },
];

// -----------------------------------------------------------------------------
// Custom SVG marks for platforms lucide-react does not cover (X, WhatsApp).
// -----------------------------------------------------------------------------
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
  { label: "Instagram Isra Anwar",   href: "https://www.instagram.com/okkarhys",  Icon: Instagram },
  { label: "X (Twitter) Isra Anwar", href: "https://x.com/Okkarhys_twit",         Icon: XMark },
  { label: "Email Isra Anwar",       href: "mailto:israanwarr@gmail.com",         Icon: Mail },
  { label: "WhatsApp Isra Anwar",    href: "https://wa.me/6282189594190",         Icon: WhatsAppMark },
];

// -----------------------------------------------------------------------------
// Logo. Also acts as the Home link since it points to "/".
// -----------------------------------------------------------------------------
export const Logo = ({ small }) => (
  <Link
    to="/"
    data-testid="okkax-logo"
    aria-label="OKKAX Home"
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

// -----------------------------------------------------------------------------
// Persona login hook used by Quick Demo Roles both in the header dropdown and
// the mobile drawer. Handles the "persona not live" fallback by redirecting
// to the appropriate register route.
// -----------------------------------------------------------------------------
function useQuickPersonaLogin() {
  const { adoptSession } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState("");
  const enter = async (role) => {
    if (!role.persona) {
      nav(role.destination);
      return;
    }
    setBusy(role.id);
    try {
      const { data } = await api.post("/demo/persona-login", { label: role.persona });
      await adoptSession(data.token);
      toast.success("Masuk sebagai " + role.label);
      nav(role.destination);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy("");
    }
  };
  return { enter, busy };
}

// -----------------------------------------------------------------------------
// Desktop dropdown menu. Opens on hover or click, closes on Escape, mouseleave
// with grace period, or outside click. Renders premium compact panel.
// -----------------------------------------------------------------------------
const MENU_META = {
  explore: {
    eyebrow: "EXPLORE",
    title: "Temukan apa yang sedang terjadi.",
    text: "Jelajahi event melalui daftar, kalender, dan peta live-event.",
  },
  products: {
    eyebrow: "PRODUCTS",
    title: "Satu sistem. Banyak kemampuan.",
    text: "Produk inti OKKAX untuk merancang, menghubungkan, mengakses, dan mengoperasikan live event.",
  },
  solutions: {
    eyebrow: "SOLUTIONS",
    title: "Dibangun untuk seluruh ekosistem.",
    text: "Pengalaman yang relevan untuk setiap pelaku dalam ekonomi live event.",
  },
  company: {
    eyebrow: "COMPANY",
    title: "Kenali OKKAX lebih dalam.",
    text: "Tentang OKKAX, cara kerja platform, kontak, dan informasi legal.",
  },
};

const MENU_NOTES = {
  Organizers: "Rancang dan kendalikan seluruh siklus event.",
  Promoters: "Bangun, biayai, promosikan, dan jalankan event.",
  Talent: "Kelola peluang, booking, jadwal, dan performa.",
  Venues: "Kelola availability, booking, dan utilisasi venue.",
  Vendors: "Temukan project dan kelola layanan event.",
  Workforce: "Bangun reputasi dan temukan pekerjaan event.",
  Sponsors: "Temukan event dan kelola peluang sponsorship.",
  Tenants: "Temukan peluang booth dan partisipasi event.",
  Attendees: "Temukan event, akses LivePass, dan pengalaman event.",
  "About OKKAX": "Visi, positioning, dan alasan OKKAX dibangun.",
  "How It Works": "Lihat bagaimana seluruh sistem OKKAX terhubung.",
  Contact: "Hubungi tim OKKAX.",
  "Terms & Conditions": "Ketentuan penggunaan platform.",
  "Privacy Policy": "Cara OKKAX mengelola dan melindungi data.",
};

function DesktopDropdown({ item, isActive, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(72);
  const closeTimer = useRef(null);
  const wrapRef = useRef(null);

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const header = wrapRef.current
        ?.closest("header")
        ?.getBoundingClientRect();

      if (header) setPanelTop(header.bottom);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const meta = MENU_META[item.id] || {
    eyebrow: item.label.toUpperCase(),
    title: item.label,
    text: "",
  };

  const gridClass =
    item.id === "solutions"
      ? "lg:grid-cols-3"
      : item.id === "products"
      ? "lg:grid-cols-3"
      : item.id === "explore"
      ? "lg:grid-cols-3"
      : "lg:grid-cols-3";

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`nav-${item.id}`}
        onClick={() => setOpen((v) => !v)}
        onFocus={openNow}
        className={[
          "okx-nav-link relative inline-flex items-center gap-1.5 py-2 text-[13px] font-medium tracking-[0.015em] transition-colors",
          isActive
            ? "is-active text-[#f0e9e5]"
            : "text-zinc-400 hover:text-white",
          open ? "text-white" : "",
        ].join(" ")}
      >
        {item.label}

        <ChevronDown
          size={12}
          className={
            "opacity-60 transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
          aria-hidden="true"
        />

        {open && !isActive && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-[13px] h-px bg-[var(--okx-accent)]"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          data-testid={`nav-${item.id}-panel`}
          style={{
            top: `${panelTop}px`,
            width: "min(780px, calc(100vw - 32px))",
          }}
          className="fixed left-1/2 z-[70] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0a0a0ff8] shadow-[0_32px_90px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <div className="grid lg:grid-cols-[155px_minmax(0,1fr)]">
            <div className="border-b border-zinc-800/80 bg-zinc-950/50 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--okx-accent-soft)]">
                {meta.eyebrow}
              </div>

              <div className="max-w-[135px] text-[15px] font-bold leading-[1.25] text-white font-gemini-display">
                {meta.title}
              </div>

              <p className="mt-2 max-w-[135px] text-[10px] leading-[1.45] text-zinc-400 font-gemini">
                {meta.text}
              </p>
            </div>

            <ul className={`grid ${gridClass} bg-[#0b0b10]/80 divide-y divide-zinc-800/60 lg:divide-y-0`}>
              {item.children?.map((c) => (
                <li
                  key={c.to}
                  className="border-b border-zinc-800/60 lg:border-r last:border-r-0"
                >
                  <Link
                    role="menuitem"
                    to={c.to}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    data-testid={`nav-${item.id}-${slug(c.label)}`}
                    className="group flex min-h-[72px] h-full flex-col justify-between p-3.5 transition-all duration-150 hover:bg-[#150d14]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] font-semibold text-zinc-200 transition-colors group-hover:text-white">
                        {c.label}
                      </span>

                      <ArrowUpRight
                        size={14}
                        className="mt-0.5 text-zinc-600 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--okx-accent)]"
                        aria-hidden="true"
                      />
                    </div>

                    <span className="mt-1.5 max-w-[190px] text-[10px] leading-[1.4] text-zinc-400 group-hover:text-zinc-300 transition-colors">
                      {c.note || MENU_NOTES[c.label] || ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickDemoGrid({ onDone, testidPrefix }) {
  const { enter, busy } = useQuickPersonaLogin();
  return (
    <ul className="grid grid-cols-2 gap-1.5 px-1 sm:grid-cols-3">
      {QUICK_DEMO_ROLES.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            disabled={busy === r.id}
            onClick={async () => { await enter(r); onDone?.(); }}
            data-testid={`${testidPrefix}-${r.id}`}
            className="group flex w-full flex-col items-start rounded-lg border border-zinc-800 bg-[#0d0d12] px-3 py-2 text-left text-[12.5px] text-zinc-200 transition-all hover:border-[var(--okx-accent)] hover:bg-[#160a12] disabled:opacity-60"
          >
            <span className="font-semibold text-white">{r.label}</span>
            <span className="text-[10.5px] text-zinc-500">
              {r.persona ? (busy === r.id ? "Masuk..." : "Masuk sekali klik") : "Daftar dulu"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------
export default function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Best-effort active state for top-level items.
  const isItemActive = (item) => {
    if (item.to) return loc.pathname === item.to;
    if (item.children) return item.children.some((c) => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/"));
    return false;
  };

  return (
    <header className="okx-public-nav sticky top-0 z-40 border-b border-zinc-800/80 bg-[#08080ce8] backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6 xl:gap-8">
          <Logo />
          <nav className="okx-nav-type hidden items-center gap-4 lg:flex xl:gap-6" aria-label="Navigasi utama">
            {NAV.map((item) =>
              item.children ? (
                <DesktopDropdown key={item.id} item={item} isActive={isItemActive(item)} />
              ) : (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={item.to === "/"}
                  data-testid={`nav-${item.id}`}
                  className={({ isActive }) =>
                    `okx-nav-link relative py-2 text-[13px] font-medium tracking-[0.015em] ${
                      isActive ? "is-active text-[#f0e9e5]" : "text-zinc-400 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                to="/app"
                data-testid="nav-workspace-btn"
                className="hidden rounded-lg bg-[var(--okx-accent)] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[var(--okx-accent-hover)] hover:shadow-[0_0_16px_rgba(255,46,126,0.35)] sm:block"
              >
                Workspace
              </Link>
              <button
                data-testid="nav-logout-btn"
                onClick={() => { logout(); nav("/"); }}
                className="hidden rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 sm:block transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="nav-signin-btn"
                className="okx-nav-type hidden px-3 py-2 text-[13px] font-medium tracking-[0.015em] text-zinc-300 hover:text-white sm:block transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                data-testid="nav-register-btn"
                className="okx-nav-cta okx-nav-type rounded-lg bg-gradient-to-r from-[#ff2e7e] to-[#ff3b88] px-4 py-2 text-[13px] font-bold tracking-[0.01em] text-white hover:shadow-[0_0_20px_rgba(255,46,126,0.45)] transition-all"
              >
                Build an Event
              </Link>
            </>
          )}
          <button
            data-testid="nav-mobile-toggle"
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 text-zinc-300 lg:hidden rounded-lg hover:bg-zinc-800/60"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} isItemActive={isItemActive} />}
    </header>
  );
}

// -----------------------------------------------------------------------------
// Mobile drawer with accordion sections.
// -----------------------------------------------------------------------------
function MobileMenu({ onClose, isItemActive }) {
  return (
    <div
      data-testid="mobile-menu"
      className="okx-mobile-menu max-h-[calc(100vh-6rem)] overflow-y-auto border-t border-[var(--okx-border)] bg-[var(--okx-surface)] px-4 py-3 lg:hidden"
    >
      <nav className="okx-nav-type flex flex-col gap-1" aria-label="Navigasi mobile">
        {NAV.map((item) =>
          item.children ? (
            <MobileAccordion key={item.id} item={item} onNavigate={onClose} />
          ) : (
            <Link
              key={item.id}
              to={item.to}
              onClick={onClose}
              data-testid={`mnav-${item.id}`}
              className={
                "okx-mobile-link border-b border-[var(--okx-border)]/40 py-3 text-sm " +
                (isItemActive(item) ? "text-white" : "text-zinc-300")
              }
            >
              {item.label}
            </Link>
          )
        )}
        {/* Extra mega section for Demo: quick roles beneath Demo link */}
        <div className="border-b border-[var(--okx-border)]/40 py-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
            <Sparkles size={11} aria-hidden="true" /> Quick Demo Login
          </div>
          <QuickDemoGrid onDone={onClose} testidPrefix="mnav-demo-quick" />
        </div>
        <div className="mt-3 flex flex-col gap-2 pt-2">
          <Link
            to="/login"
            onClick={onClose}
            data-testid="mnav-signin"
            className="border border-[var(--okx-border)] px-4 py-2.5 text-center text-sm font-semibold text-zinc-100"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            onClick={onClose}
            data-testid="mnav-register"
            className="bg-[var(--okx-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            Register
          </Link>
        </div>
      </nav>
    </div>
  );
}

function MobileAccordion({ item, onNavigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--okx-border)]/40 py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`mnav-${item.id}-toggle`}
        className="flex w-full items-center justify-between py-2.5 text-left text-sm text-zinc-200"
      >
        <span>{item.label}</span>
        <ChevronDown size={16} className={"text-zinc-500 transition-transform " + (open ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="mb-2 flex flex-col gap-1 pl-2">
          {item.children.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                onClick={onNavigate}
                data-testid={`mnav-${item.id}-${slug(c.label)}`}
                className="block py-1.5 text-[13px] text-zinc-400 hover:text-white"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Footer. Mirrors the header taxonomy so users get the same map at the bottom.
// -----------------------------------------------------------------------------
export function Footer() {
  return (
    <footer data-testid="public-footer" className="okx-footer border-t border-[var(--okx-border)] bg-[#070707] px-4 sm:px-6">
      <div className="mx-auto max-w-7xl py-14 sm:py-20">
        <FooterHeadline />
        <FooterColumns />
        <FooterMeta />
      </div>
    </footer>
  );
}

function FooterHeadline() {
  return (
    <div className="grid items-end gap-9 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
          Live Event Operating Network
        </div>
        <h2 className="editorial mt-5 max-w-4xl text-[clamp(2.5rem,6vw,5.9rem)] leading-[0.92] text-[#f4efec]">
          Every moving part,<br /><span className="accent-text">working as one.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
          Dari ide pertama hingga showtime, setiap partner, produksi, ticketing, dan pembayaran bekerja sebagai satu pertunjukan.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
        <Link to="/register" data-testid="footer-hero-primary" className="group flex min-w-52 items-center justify-between bg-[var(--okx-accent)] px-5 py-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]">
          Register
          <ArrowUpRight size={18} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        </div>
    </div>
  );
}

function FooterColumns() {
  const explore  = NAV.find((n) => n.id === "explore");
  const products = NAV.find((n) => n.id === "products");
  const solutions = NAV.find((n) => n.id === "solutions");
  const company  = NAV.find((n) => n.id === "company");
  return (
    <div className="mt-14 grid gap-10 border-t border-[var(--okx-border)] py-12 md:grid-cols-12">
      <div className="md:col-span-3">
        <Logo />
        <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">
          Orkestrasi Koneksi, Kolaborasi, Aktivasi &amp; eXperience. Satu Event ID mengikat brief, jaringan, ticketing, hingga settlement.
        </p>
        <div className="mt-6 flex flex-col gap-2 text-sm">
          </div>
      </div>
      <FooterColumn title="Explore"   items={explore.children}   testid="footer-explore" />
      <FooterColumn title="Products"  items={products.children}  testid="footer-products" />
      <FooterColumn title="Solutions" items={solutions.children} testid="footer-solutions" />
      <FooterColumn title="Company"   items={company.children}   testid="footer-company" />
    </div>
  );
}

function FooterColumn({ title, items, testid }) {
  return (
    <div className="md:col-span-2" data-testid={testid}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm text-zinc-400">
        {items.map((c) => (
          <li key={c.to}>
            <Link className="inline-flex items-center gap-1.5 hover:text-white" to={c.to}>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterMeta() {
  return (
    <>
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
    </>
  );
}

// -----------------------------------------------------------------------------
// Small utilities
// -----------------------------------------------------------------------------
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
