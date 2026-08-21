// Okkax Public Navigation and Footer.
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
//   - No em-dash, no emoji, brand palette (black + white + Okkax pink)

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
import { toPersonaLoginKey } from "@/lib/personaLogin";

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
      { label: "Okkax Copilot",      to: "/copilot",                     note: "Event reasoning, recommendations, and Two-Way Matching." },
      { label: "Network",            to: "/products/network",            note: "Talent, Venue, Vendor, Workforce, Sponsor, Tenant." },
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
      { label: "About Okkax",         to: "/about"         },
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
  { id: "organizer", label: "Organizer", persona: "organizer", destination: "/app" },
  { id: "promoter",  label: "Promoter",  persona: "promoter",  destination: "/app" },
  { id: "vendor",    label: "Vendor",    persona: "vendor",    destination: "/app" },
  { id: "sponsor",   label: "Sponsor",   persona: "sponsor",   destination: "/app/sponsor" },
  { id: "tenant",    label: "Tenant",    persona: "tenant",    destination: "/app/tenant" },
  { id: "audience",  label: "Audience",  persona: "audience",  destination: "/app" },
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
export const Logo = ({ small, compact, to = "/", ariaLabel }) => (
  <Link
    to={to}
    data-testid="okkax-logo"
    aria-label={ariaLabel || (to === "/" ? "Okkax Home" : "Okkax Workspace")}
    title={ariaLabel}
    className={`okkax-logo group inline-flex shrink-0 flex-col items-start transition-[width] duration-200 ease-out ${
      small ? "w-[82px]" : compact ? "w-[112px]" : "w-[132px]"
    }`}
  >
    <img
      src={LOGO_URL}
      alt="Okkax"
      className={`okkax-logo-image w-auto object-contain transition-[height] duration-200 ease-out ${
        small ? "h-[18px]" : compact ? "h-[21px]" : "h-[23px]"
      }`}
    />
    {!small && (
      <span className={`okkax-logo-category mt-0.5 font-semibold uppercase leading-none text-zinc-400 transition-[font-size,letter-spacing] duration-200 ease-out ${
        compact ? "text-[6px] tracking-[0.13em]" : "text-[7px] tracking-[0.17em]"
      }`}>
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
      const { data } = await api.post("/demo/persona-login", { label: toPersonaLoginKey(role.persona) });
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
// with grace period, or outside click. Renders a compact anchored popover.
// -----------------------------------------------------------------------------
const POPOVER_LAYOUT = {
  explore: {
    width: "min(430px, calc(100vw - 32px))",
    grid: "grid-cols-3",
    anchor: "left-0",
  },
  products: {
    width: "min(450px, calc(100vw - 32px))",
    grid: "grid-cols-3",
    anchor: "left-0",
  },
  solutions: {
    width: "min(500px, calc(100vw - 32px))",
    grid: "grid-cols-3",
    anchor: "left-0",
  },
  company: {
    width: "min(450px, calc(100vw - 32px))",
    grid: "grid-cols-3",
    anchor: "right-0",
  },
};

function DesktopDropdown({ item, isActive, onNavigate, compact, closeSignal }) {
  const [open, setOpen] = useState(false);
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
    if (closeSignal > 0) setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const layout = POPOVER_LAYOUT[item.id] || POPOVER_LAYOUT.company;

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
        onClick={openNow}
        onFocus={openNow}
        className={[
          "relative inline-flex items-center rounded-lg font-semibold tracking-wide transition-all duration-200 ease-out cursor-pointer",
          compact ? "gap-1 px-2.5 py-1.5 text-[12px]" : "gap-1.5 px-3 py-2 text-[13px]",
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
          style={{ width: layout.width }}
          className={`absolute top-[calc(100%+8px)] z-[70] overflow-hidden rounded-2xl border border-white/[0.14] bg-[#09090b] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl ${layout.anchor}`}
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <ul className={`grid ${layout.grid} gap-1`}>
            {item.children?.map((child) => (
              <li key={child.to}>
                <Link
                  role="menuitem"
                  to={child.to}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  data-testid={`nav-${item.id}-${slug(child.label)}`}
                  className="group flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-white/[0.08] bg-[#111114] px-2.5 text-[11px] font-semibold tracking-tight text-zinc-200 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
                >
                  <span>{child.label}</span>
                  <ArrowUpRight
                    size={12}
                    className="shrink-0 text-zinc-600 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-200"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
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

const COPILOT_PHASE_SELECTOR = '[data-testid="hero-interaction-slot"]';
const COPILOT_ROOT_SELECTOR = '[data-testid="stitch-command-capsule"]';
const COOKIE_CONSENT_KEY = "okkax_public_cookie_consent_v1";

function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted";
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      // Consent still dismisses for this page when storage is unavailable.
    }
    setVisible(false);
  };

  return (
    <aside
      data-testid="public-cookie-consent"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.1] bg-[#07070a]/[0.98] px-3 py-2 shadow-[0_-12px_36px_rgba(0,0,0,0.72)] backdrop-blur-xl sm:px-5"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 pr-[176px] sm:flex-row sm:items-center sm:gap-4 sm:pr-[190px]">
        <p className="max-w-4xl text-[9.5px] leading-[1.45] text-zinc-400 sm:text-[10.5px]">
          We use cookies and similar technologies to operate our website, improve performance, and analyze usage. By continuing to use this site, you agree to the use of cookies as described in our{" "}
          <Link to="/privacy" className="font-semibold text-zinc-200 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white">
            Privacy policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          data-testid="public-cookie-accept"
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[10.5px] font-bold text-black transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Accept
        </button>
      </div>
    </aside>
  );
}

function useHomepageCopilotNavState() {
  const [phase, setPhase] = useState("idle");
  const [closeSignal, setCloseSignal] = useState(0);
  const lastPhaseRef = useRef("idle");

  useEffect(() => {
    const readPhase = () =>
      document.querySelector(COPILOT_PHASE_SELECTOR)?.getAttribute("data-phase") || "idle";

    const syncPhase = () => {
      const nextPhase = readPhase();
      if (lastPhaseRef.current === nextPhase) return;
      lastPhaseRef.current = nextPhase;
      setPhase(nextPhase);
      setCloseSignal((signal) => signal + 1);
    };

    const closeFromComposerInteraction = (event) => {
      if (event.target instanceof Element && event.target.closest(COPILOT_ROOT_SELECTOR)) {
        setCloseSignal((signal) => signal + 1);
      }
    };

    const observer = new MutationObserver(syncPhase);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-phase"],
    });

    document.addEventListener("pointerdown", closeFromComposerInteraction, true);
    document.addEventListener("focusin", closeFromComposerInteraction, true);
    document.addEventListener("submit", closeFromComposerInteraction, true);
    syncPhase();

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", closeFromComposerInteraction, true);
      document.removeEventListener("focusin", closeFromComposerInteraction, true);
      document.removeEventListener("submit", closeFromComposerInteraction, true);
    };
  }, []);

  return {
    phase,
    compact: phase === "thinking" || phase === "response",
    closeSignal,
  };
}

// -----------------------------------------------------------------------------
// Header Component
// -----------------------------------------------------------------------------
export default function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { phase, compact, closeSignal } = useHomepageCopilotNavState();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Best-effort active state for top-level items.
  const isItemActive = (item) => {
    if (item.to) return loc.pathname === item.to;
    if (item.children) return item.children.some((c) => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/"));
    return false;
  };

  useEffect(() => {
    if (closeSignal > 0) setMobileOpen(false);
  }, [closeSignal]);

  return (
    <>
      <header
        data-testid="public-nav"
        data-copilot-phase={phase}
        data-compact={compact ? "true" : "false"}
        className={`okx-public-nav fixed top-0 left-0 right-0 z-50 w-full border-b border-white/[0.08] bg-[#06060a]/90 font-gemini shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl transition-[padding,background-color] duration-200 ease-out ${
          compact ? "px-3 sm:px-5" : "px-4 sm:px-6"
        }`}
      >
        <div
          data-testid="public-nav-inner"
          className={`mx-auto flex max-w-7xl items-center justify-between transition-[min-height,padding,gap] duration-200 ease-out ${
            compact ? "min-h-[55px] gap-2 py-1.5" : "min-h-[64px] gap-4 py-3"
          }`}
        >
          <div className={`flex items-center transition-[gap] duration-200 ease-out ${
            compact ? "gap-3 sm:gap-5 xl:gap-6" : "gap-5 sm:gap-7 xl:gap-9"
          }`}>
            <Logo compact={compact} />
            <nav className={`hidden items-center transition-[gap] duration-200 ease-out lg:flex ${
              compact ? "gap-0.5 xl:gap-1" : "gap-1.5 xl:gap-2.5"
            }`} aria-label="Navigasi utama">
              {NAV.map((item) =>
                item.children ? (
                  <DesktopDropdown
                    key={item.id}
                    item={item}
                    isActive={isItemActive(item)}
                    compact={compact}
                    closeSignal={closeSignal}
                  />
                ) : (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.to === "/"}
                    data-testid={`nav-${item.id}`}
                    className={({ isActive }) =>
                      `relative rounded-lg font-semibold tracking-wide transition-all duration-200 ease-out ${
                        compact ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]"
                      } ${
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
          <div className={`flex items-center transition-[gap] duration-200 ease-out ${compact ? "gap-2" : "gap-3"}`}>
            {user ? (
              <>
                <Link
                  to="/app"
                  data-testid="nav-workspace-btn"
                  className={`rounded-xl bg-white font-bold text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] ${
                    compact ? "px-3 py-2 text-[11.5px] sm:px-4 sm:py-2 sm:text-xs" : "px-3 py-2 text-[11.5px] sm:px-5 sm:py-2.5 sm:text-xs"
                  }`}
                >
                  Workspace
                </Link>
                <button
                  data-testid="nav-logout-btn"
                  onClick={() => { logout(); nav("/"); }}
                  className={`hidden rounded-xl border border-white/[0.12] bg-white/[0.03] text-xs font-semibold text-zinc-300 transition-all duration-200 hover:text-white hover:border-white/[0.25] hover:bg-white/[0.06] sm:block cursor-pointer ${
                    compact ? "px-3 py-2" : "px-3.5 py-2.5"
                  }`}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  data-testid="nav-signin-btn"
                  className={`hidden rounded-xl border border-white/[0.12] bg-white/[0.03] font-semibold text-zinc-200 transition-all duration-200 hover:text-white hover:border-white/[0.25] hover:bg-white/[0.06] sm:block ${
                    compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-xs sm:text-[13px]"
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  data-testid="nav-register-btn"
                  className={`rounded-xl bg-white font-bold text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] whitespace-nowrap ${
                    compact ? "px-3 py-2 text-[11.5px] sm:px-4 sm:text-xs" : "px-3 py-2 text-[11.5px] sm:px-5 sm:py-2.5 sm:text-[13px]"
                  }`}
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
              className={`text-zinc-300 lg:hidden rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:text-white transition-[padding,color,background-color] duration-200 cursor-pointer shrink-0 ${
                compact ? "p-2" : "p-2 sm:p-2.5"
              }`}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} isItemActive={isItemActive} />}
      </header>
      {/* Flow Spacer to ensure ZERO content overlap behind fixed header */}
      <div className="h-[65px] w-full shrink-0 pointer-events-none" aria-hidden="true" />
      <CookieConsent />
    </>
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
        <ul className="mt-1.5 flex flex-col gap-1 px-1 pb-1">
          {item.children.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                onClick={onNavigate}
                data-testid={`mnav-${item.id}-${slug(c.label)}`}
                className="block rounded-lg border border-white/[0.08] bg-[#141418]/90 px-3 py-2 text-[12.5px] font-semibold text-white hover:border-white/30 hover:bg-white/[0.08] transition-all"
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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-zinc-200 font-gemini-mono w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
            <span>Event Graph Network: Active</span>
          </div>
          <div className="font-gemini-mono text-[11px] text-zinc-400">
            15+ Cities Synced
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
      <h3 className="font-gemini-mono text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300">{title}</h3>
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
      <div className="group relative overflow-hidden rounded-[1.4rem] border border-white/[0.1] bg-[linear-gradient(120deg,rgba(20,20,27,0.96),rgba(8,8,12,0.92))] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-white/[0.055] blur-3xl transition-opacity duration-500 group-hover:opacity-80" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.16] bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.25)] sm:h-16 sm:w-16">
              <span className="editorial text-xl tracking-[-0.05em] text-white sm:text-2xl">OR</span>
              <span aria-hidden="true" className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-[3px] border-[#0c0c11] bg-white shadow-[0_0_12px_rgba(255,255,255,0.65)]" />
            </div>

            <div className="min-w-0">
              <div className="font-gemini-mono text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-400 sm:text-[10px]">
                Designed &amp; Engineered by
              </div>
              <a
                href="https://www.instagram.com/okkarhys"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-2 text-white transition-colors hover:text-zinc-200"
                data-testid="footer-creator-link"
              >
                <span className="editorial truncate text-[1.65rem] leading-none tracking-[-0.025em] sm:text-[2rem]">OKKA RHYS</span>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-zinc-300 transition-all duration-200 group-hover:border-white/25 group-hover:bg-white/[0.1] group-hover:text-white">
                  <ArrowUpRight size={14} />
                </span>
              </a>
              <div className="mt-1.5 font-gemini-mono text-[10px] tracking-[0.08em] text-zinc-500">Isra Anwar · @okkarhys</div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/[0.07] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <span className="hidden font-gemini-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 lg:block">Connect</span>
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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] text-zinc-400 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09] hover:text-white active:translate-y-0 active:scale-95"
                >
                  <Icon size={17} />
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Disclaimer & Copyright */}
      <div className="flex flex-col justify-between gap-5 border-t border-white/[0.06] pt-6 text-xs leading-relaxed text-zinc-400 lg:flex-row lg:items-end font-gemini">
        <div className="max-w-4xl text-zinc-400">
          Seluruh nama, organisasi, talent, harga, rider, transaksi, tiket, dan metrik pada mode demo merupakan data fiktif untuk demonstrasi kompetisi. Pembayaran bersifat sandbox; tidak ada uang nyata yang ditagihkan.
        </div>
        <div className="shrink-0 lg:text-right font-gemini-mono text-zinc-300">
          <div>© 2026 Okkax</div>
          <div className="mt-1 text-zinc-400 text-[11px]">One event. Every moving part.</div>
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

export { Footer as PublicFooter };
