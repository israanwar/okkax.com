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

      if (header) setPanelTop(header.bottom + 8);
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
      className="relative font-gemini"
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
          "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold tracking-wide transition-all duration-200 cursor-pointer",
          isActive
            ? "bg-white/[0.08] text-white"
            : open
            ? "bg-white/[0.05] text-white"
            : "text-zinc-400 hover:text-white hover:bg-white/[0.03]",
        ].join(" ")}
      >
        <span>{item.label}</span>

        <ChevronDown
          size={12}
          className={
            "opacity-60 transition-transform duration-200 " +
            (open ? "rotate-180 text-white" : "")
          }
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          data-testid={`nav-${item.id}-panel`}
          style={{
            top: `${panelTop}px`,
            width: "min(840px, calc(100vw - 32px))",
          }}
          className="fixed left-1/2 z-[70] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/[0.14] bg-[#0c0c0e]/98 shadow-[0_32px_90px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-3xl"
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          {/* Top ambient lighting accent */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

          <div className="grid lg:grid-cols-[200px_minmax(0,1fr)]">
            <div className="border-b border-white/[0.08] bg-gradient-to-b from-[#141418] to-[#0a0a0c] p-6 lg:border-b-0 lg:border-r">
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.22em] text-zinc-300 font-gemini-mono shadow-sm">
                <Sparkles size={11} className="text-zinc-300" aria-hidden="true" />
                {meta.eyebrow}
              </div>

              <div className="mt-2 text-[15px] font-bold leading-snug text-white">
                {meta.title}
              </div>

              <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-400 font-medium">
                {meta.text}
              </p>
            </div>

            <ul className={`grid ${gridClass} bg-[#08080a]/95 p-3.5 gap-2`}>
              {item.children?.map((c) => (
                <li key={c.to}>
                  <Link
                    role="menuitem"
                    to={c.to}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    data-testid={`nav-${item.id}-${slug(c.label)}`}
                    className="group flex min-h-[76px] h-full flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111114]/90 p-3.5 transition-all duration-200 hover:border-white/30 hover:bg-white/[0.08] hover:shadow-[0_8px_24px_rgba(0,0,0,0.9)] hover:-translate-y-0.5 cursor-pointer shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-bold text-white tracking-tight transition-colors group-hover:text-white drop-shadow-sm">
                        {c.label}
                      </span>

                      <ArrowUpRight
                        size={14}
                        className="mt-0.5 text-zinc-500 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                        aria-hidden="true"
                      />
                    </div>

                    <span className="mt-1.5 text-[11px] leading-snug text-zinc-400 font-medium group-hover:text-zinc-200 transition-colors">
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
    <ul className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-3 font-gemini">
      {QUICK_DEMO_ROLES.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            disabled={busy === r.id}
            onClick={async () => { await enter(r); onDone?.(); }}
            data-testid={`${testidPrefix}-${r.id}`}
            className="group flex w-full flex-col items-start rounded-xl border border-white/[0.08] bg-[#0c0c12]/90 p-3 text-left text-xs transition-all hover:border-white/25 hover:bg-white/[0.04] hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer shadow-sm"
          >
            <span className="font-bold text-white group-hover:text-zinc-100">{r.label}</span>
            <span className="mt-0.5 text-[10px] text-zinc-400 font-gemini-mono">
              {r.persona ? (busy === r.id ? "Masuk..." : "1-Click Direct Access") : "Daftar Akun"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// -----------------------------------------------------------------------------
// Header Component
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
    <header className="okx-public-nav sticky top-0 z-50 border-b border-white/[0.08] bg-[#06060a]/90 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.04)] transition-all font-gemini px-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-5 sm:gap-7 xl:gap-9">
          <Logo />
          <nav className="hidden items-center gap-1.5 lg:flex xl:gap-2.5" aria-label="Navigasi utama">
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
                    `relative rounded-lg px-3 py-2 text-[13px] font-semibold tracking-wide transition-all duration-200 ${
                      isActive
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/app"
                data-testid="nav-workspace-btn"
                className="hidden rounded-xl bg-white hover:bg-zinc-200 px-5 py-2.5 text-xs font-bold text-black transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98] sm:block"
              >
                Workspace
              </Link>
              <button
                data-testid="nav-logout-btn"
                onClick={() => { logout(); nav("/"); }}
                className="hidden rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-white/[0.25] hover:bg-white/[0.06] sm:block transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="nav-signin-btn"
                className="hidden rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-xs sm:text-[13px] font-semibold text-zinc-200 hover:text-white hover:border-white/[0.25] hover:bg-white/[0.06] sm:block transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                data-testid="nav-register-btn"
                className="rounded-xl bg-white hover:bg-zinc-200 px-3 sm:px-5 py-2 sm:py-2.5 text-[11.5px] sm:text-[13px] font-bold text-black transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98] whitespace-nowrap"
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
            className="p-2 sm:p-2.5 text-zinc-300 lg:hidden rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
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
      className="max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-3xl border border-white/[0.1] bg-[#09090f]/98 backdrop-blur-3xl shadow-[0_32px_80px_rgba(0,0,0,0.95)] p-5 mx-3 my-2 lg:hidden font-gemini"
    >
      <nav className="flex flex-col gap-1.5" aria-label="Navigasi mobile">
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
                "rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors " +
                (isItemActive(item) ? "bg-white/[0.08] text-white" : "text-zinc-300 hover:text-white hover:bg-white/[0.04]")
              }
            >
              {item.label}
            </Link>
          )
        )}
        {/* Extra mega section for Demo: quick roles beneath Demo link */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 my-2">
          <div className="mb-3 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.22em] text-zinc-400 font-gemini-mono">
            <Sparkles size={12} aria-hidden="true" /> Quick Demo Direct Access
          </div>
          <QuickDemoGrid onDone={onClose} testidPrefix="mnav-demo-quick" />
        </div>
        <div className="mt-3 flex flex-col gap-2.5 pt-2">
          <Link
            to="/login"
            onClick={onClose}
            data-testid="mnav-signin"
            className="rounded-xl border border-white/[0.15] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-zinc-100 hover:bg-white/[0.08] transition-all"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            onClick={onClose}
            data-testid="mnav-register"
            className="rounded-xl bg-white hover:bg-zinc-200 px-4 py-3 text-center text-sm font-bold text-black transition-all shadow-md active:scale-[0.98]"
          >
            Build an Event
          </Link>
        </div>
      </nav>
    </div>
  );
}

function MobileAccordion({ item, onNavigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0e]/95 p-2.5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`mnav-${item.id}-toggle`}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-bold text-white hover:text-zinc-200 transition-colors cursor-pointer"
      >
        <span>{item.label}</span>
        <ChevronDown size={16} className={"text-zinc-400 transition-transform duration-200 " + (open ? "rotate-180 text-white" : "")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 px-1 pb-1">
          {item.children.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                onClick={onNavigate}
                data-testid={`mnav-${item.id}-${slug(c.label)}`}
                className="block rounded-xl border border-white/[0.08] bg-[#141418]/90 px-3.5 py-2.5 text-[13px] hover:border-white/30 hover:bg-white/[0.08] transition-all"
              >
                <div className="font-bold text-white">{c.label}</div>
                {c.note && <div className="text-[11px] text-zinc-400 font-medium mt-0.5">{c.note}</div>}
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
// -----------------------------------------------------------------------------
// Footer. Redesigned with world-class studio aesthetics and consistent tokens.
// -----------------------------------------------------------------------------
export function Footer() {
  return (
    <footer data-testid="public-footer" className="relative border-t border-white/[0.07] bg-[#050508] px-4 sm:px-6 font-gemini overflow-hidden">
      {/* Ambient top light line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-white/[0.2] to-transparent pointer-events-none" />
      <div className="mx-auto max-w-7xl py-16 sm:py-24">
        <FooterHeadline />
        <FooterColumns />
        <FooterMeta />
      </div>
    </footer>
  );
}

function FooterHeadline() {
  return (
    <div className="rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#14141f] via-[#0b0b10] to-[#060609] p-8 sm:p-14 lg:p-16 shadow-[0_32px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300">
            <Sparkles size={13} className="text-zinc-400" aria-hidden="true" />
            <span>Live Event Operating Network</span>
          </div>
          <h2 className="editorial mt-5 max-w-4xl text-[clamp(2.4rem,5.5vw,5.2rem)] leading-[0.94] text-[#f4efec]">
            Every moving part,
            <br />
            <span className="text-white font-bold">working as one.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
            Dari brief pertama hingga encore showtime — setiap partner, produksi, venue, ticketing, dan pembayaran bekerja sebagai satu kesatuan tanpa fragmentasi file.
          </p>
        </div>
        <div className="flex flex-col gap-3.5 sm:flex-row lg:flex-col shrink-0">
          <Link
            to="/register"
            data-testid="footer-hero-primary"
            className="group inline-flex min-w-52 items-center justify-between rounded-xl bg-white hover:bg-zinc-200 px-6 py-4 text-sm font-bold text-black transition-all shadow-[0_4px_24px_rgba(255,255,255,0.15)] active:scale-[0.98]"
          >
            <span>Build an Event</span>
            <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            to="/demo"
            data-testid="footer-hero-secondary"
            className="group inline-flex min-w-52 items-center justify-between rounded-xl border border-white/[0.15] bg-white/[0.04] px-6 py-4 text-sm font-semibold text-zinc-100 hover:border-white/[0.3] hover:bg-white/[0.08] transition-all"
          >
            <span>Platform Demo</span>
            <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FooterColumns() {
  const explore = NAV.find((n) => n.id === "explore");
  const products = NAV.find((n) => n.id === "products");
  const solutions = NAV.find((n) => n.id === "solutions");
  const company = NAV.find((n) => n.id === "company");

  return (
    <div className="mt-16 grid gap-12 border-t border-white/[0.07] pt-14 md:grid-cols-12">
      {/* Brand Column */}
      <div className="md:col-span-4 lg:col-span-3">
        <Logo />
        <p className="mt-5 text-sm leading-relaxed text-zinc-400">
          Orkestrasi Koneksi, Kolaborasi, Aktivasi &amp; eXperience. Satu Event ID mengikat brief, jaringan, ticketing, hingga milestone settlement.
        </p>

        {/* Live Network Telemetry */}
        <div className="mt-6 flex flex-col gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/30 px-3 py-1 text-[11px] font-medium text-emerald-300 font-gemini-mono w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span>Event Graph Network: Active</span>
          </div>
          <div className="font-gemini-mono text-[11px] text-zinc-500">
            Node latency &lt;200ms · 15+ Cities Synced
          </div>
        </div>
      </div>

      {/* Navigation Columns */}
      <FooterColumn title="Explore" items={explore?.children || []} testid="footer-explore" />
      <FooterColumn title="Products" items={products?.children || []} testid="footer-products" />
      <FooterColumn title="Solutions" items={solutions?.children || []} testid="footer-solutions" />
      <FooterColumn title="Company" items={company?.children || []} testid="footer-company" />
    </div>
  );
}

function FooterColumn({ title, items, testid }) {
  return (
    <div className="md:col-span-2" data-testid={testid}>
      <h3 className="font-gemini-mono text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((c) => (
          <li key={c.to}>
            <Link
              to={c.to}
              className="inline-flex items-center gap-1 text-zinc-400 transition-all duration-200 hover:text-white hover:translate-x-1"
            >
              <span>{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterMeta() {
  return (
    <div className="mt-14 space-y-8">
      {/* Creator & Social Ribbon */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c11]/80 backdrop-blur-xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-white font-bold font-gemini-mono text-sm">
            OK
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
              Designed &amp; Engineered by
            </div>
            <a
              href="https://www.instagram.com/okkarhys"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 text-sm font-bold text-white transition-colors hover:text-zinc-300 inline-flex items-center gap-1"
              data-testid="footer-creator-link"
            >
              <span>Isra Anwar</span>
              <ArrowUpRight size={14} className="text-zinc-400" />
            </a>
          </div>
        </div>

        <nav aria-label="Sosial media Isra Anwar" className="flex items-center gap-2">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              data-testid={`footer-social-${label.split(" ")[0].toLowerCase()}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:bg-white/[0.08] hover:text-white transition-all duration-200 active:scale-95"
            >
              <Icon size={17} />
            </a>
          ))}
        </nav>
      </div>

      {/* Disclaimer & Copyright */}
      <div className="flex flex-col justify-between gap-5 border-t border-white/[0.06] pt-6 text-xs leading-relaxed text-zinc-500 lg:flex-row lg:items-end">
        <div className="max-w-4xl">
          Seluruh nama, organisasi, talent, harga, rider, transaksi, tiket, dan metrik pada mode demo merupakan data fiktif untuk demonstrasi kompetisi. Pembayaran bersifat sandbox; tidak ada uang nyata yang ditagihkan.
        </div>
        <div className="shrink-0 lg:text-right font-gemini-mono text-zinc-400">
          <div>© 2026 OKKAX</div>
          <div className="mt-1 text-zinc-500 text-[11px]">One event. Every moving part.</div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Small utilities
// -----------------------------------------------------------------------------
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
