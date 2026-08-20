/**
 * Shared, compact, sticky Page Intro wrapper for /app/* workspace pages.
 *
 * This mirrors the sticky command-header grammar already established (and
 * proven) in EventStudio.jsx, Network.jsx, and CalendarBoard.jsx: it goes
 * full-bleed against <main>'s own padding via negative margin, then re-adds
 * its own padding, so it sits flush under AppShell's fixed top bar with no
 * gap and no double-scroll. The background is fully opaque (no `/NN` alpha)
 * so content scrolling underneath never bleeds through, and it sticks at
 * z-30 — below AppShell's header (z-50), above ordinary page content.
 *
 * Callers compose their own title/eyebrow/actions/selectors as children;
 * this component only owns the positioning/background/stacking contract so
 * every page gets identical sticky behavior instead of reimplementing it.
 */
export default function PageIntro({ children, testId = "page-intro", className = "" }) {
  return (
    <section
      className={`sticky -top-4 sm:-top-4.5 z-30 -mx-3.5 -mt-4 space-y-1.5 border-b border-white/[0.08] bg-[#07070a] px-3.5 pb-2.5 pt-3 shadow-[0_8px_24px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:-mx-5 sm:-mt-4.5 sm:px-5 sm:pt-3.5 ${className}`}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

/** Small compact eyebrow badge used at the top of a PageIntro. */
export function PageIntroEyebrow({ icon: Icon, children, tone = "" }) {
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] font-gemini-mono ${
        tone || "border-white/[0.12] bg-white/[0.04] text-zinc-300"
      }`}
    >
      {Icon && <Icon size={11} className="shrink-0" />}
      {children}
    </div>
  );
}

/** Compact H1 title matching the established command-header type scale. */
export function PageIntroTitle({ children, className = "" }) {
  return (
    <h1 className={`text-xs sm:text-sm font-bold text-white font-gemini tracking-tight truncate ${className}`}>
      {children}
    </h1>
  );
}

/** Single-line, truncated description — informative without spending vertical space. */
export function PageIntroDescription({ children }) {
  if (!children) return null;
  return <p className="truncate text-[10.5px] sm:text-[11px] leading-snug text-zinc-400">{children}</p>;
}
