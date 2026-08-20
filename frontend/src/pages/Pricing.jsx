// Public Pricing surface for Free / Pro / Max.
//
// Authority: docs/32_SUBSCRIPTION_AND_ENTITLEMENT_ARCHITECTURE_MASTER.md
//            docs/33_PRICING_PACKAGING_AND_MONETIZATION_MASTER.md
//            docs/34_PUBLIC_SUBSCRIPTION_EXPERIENCE_MASTER.md
//
// Rules honored here:
//   * Single pricing source of truth via @/lib/pricing.
//   * Max = Everything in Pro + exclusive; Pro = Everything in Free + more.
//   * Event Graph: See > Understand > Optimize.
//   * Honest CTA (no Buy Now; checkout not live).
//   * Mobile-first (390 baseline), no horizontal overflow.
//   * Semantic HTML for SEO/AEO/GEO; JSON-LD is truthful.
//   * No emoji, no em-dash, black + OKKAX pink + white palette.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Info, Sparkles, Waypoints } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { useAuth } from "@/context/AuthContext";
import {
  COMPARISON_GROUPS,
  PLAN_META,
  PLAN_ORDER,
  PRICE_TABLE,
  ROLES,
  ROLE_BULLETS,
  formatIDR,
  priceFor,
} from "@/lib/pricing";

const BILLING_TABS = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly", note: "Pay 10 months, use 12" },
];

export default function Pricing() {
  const [role, setRole] = useState("organizer");
  const [billing, setBilling] = useState("monthly");
  const [openGroups, setOpenGroups] = useState(() => new Set([0]));

  const activeRole = useMemo(() => ROLES.find((r) => r.id === role) || ROLES[0], [role]);
  const jsonLd = useMemo(() => buildJsonLd(), []);

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <PublicNav />
      <main data-testid="pricing-page" className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        <Hero />
        <RoleSelector value={role} onChange={setRole} />
        <BillingToggle value={billing} onChange={setBilling} />
        <PlanGrid role={role} activeRole={activeRole} billing={billing} />
        <EventGraphTiers />
        <ComparisonTable role={role} openGroups={openGroups} setOpenGroups={setOpenGroups} />
        <MiniFaq />
        <ClosingCta />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}

/* ------------------------------- HERO ------------------------------------ */

function Hero() {
  return (
    <header className="border-b border-[var(--okx-border)] pb-10 sm:pb-14">
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
        <Sparkles size={15} aria-hidden="true" /> Subscription
      </div>
      <h1 className="editorial mt-5 max-w-4xl text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[0.95] text-[#f4efec]">
        Start free.
        <br />
        <span className="accent-text">Upgrade when your operation needs more intelligence.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
        Free gets you into the network. Pro helps you operate professionally. Max adds advanced portfolio controls for optimization and scale.
      </p>
    </header>
  );
}

/* --------------------------- ROLE SELECTOR ------------------------------- */

function RoleSelector({ value, onChange }) {
  return (
    <section aria-labelledby="pricing-role-heading" className="mt-10 font-gemini">
      <h2 id="pricing-role-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
        Choose your role
      </h2>
      <div
        role="tablist"
        aria-label="Pricing role"
        className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {ROLES.map((r) => {
          const active = value === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`pricing-role-${r.id}`}
              onClick={() => onChange(r.id)}
              className={[
                "shrink-0 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98]",
                active
                  ? "border-white/[0.22] bg-[#1a1a24] text-white shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "border-white/[0.08] bg-[#0c0c11]/80 text-zinc-300 hover:border-white/25 hover:text-white hover:bg-white/[0.04]",
              ].join(" ")}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------- BILLING TOGGLE ------------------------------ */

function BillingToggle({ value, onChange }) {
  return (
    <section aria-labelledby="pricing-billing-heading" className="mt-8 flex flex-wrap items-center gap-4 font-gemini">
      <h2 id="pricing-billing-heading" className="sr-only">
        Billing period
      </h2>
      <div
        role="tablist"
        aria-label="Billing period"
        className="inline-flex rounded-xl border border-white/[0.1] bg-[#0b0b10] p-1 shadow-inner"
      >
        {BILLING_TABS.map((b) => {
          const active = value === b.id;
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`pricing-billing-${b.id}`}
              onClick={() => onChange(b.id)}
              className={[
                "rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer",
                active ? "bg-white text-black shadow-md" : "text-zinc-300 hover:text-white",
              ].join(" ")}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      {value === "yearly" ? (
        <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <Info size={13} aria-hidden="true" />
          Pay 10 months, use 12. Billed annually.
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <Info size={13} aria-hidden="true" />
          Switch to Yearly to pay 10 months and use 12.
        </span>
      )}
    </section>
  );
}

/* ------------------------------ PLAN CARDS ------------------------------- */

function PlanGrid({ role, activeRole, billing }) {
  return (
    <section aria-labelledby="pricing-plans-heading" className="mt-10 font-gemini">
      <h2 id="pricing-plans-heading" className="sr-only">
        Plans for {activeRole.longLabel}
      </h2>
      <div className="mb-4 text-sm text-zinc-400">
        Pricing for <span className="font-bold text-white">{activeRole.longLabel}</span>. {activeRole.tagline}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => (
          <PlanCard key={planId} planId={planId} role={role} billing={billing} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ planId, role, billing }) {
  const meta = PLAN_META[planId];
  const price = priceFor(role, planId, billing);
  const bullets = ROLE_BULLETS[role][planId] || [];
  const isMax = planId === "max";
  const isFree = planId === "free";
  const { user, effectiveRole, loading: authLoading } = useAuth();

  // Free never needs a checkout — keep the original honest register CTA.
  // Pro/Max: logged-out visitors go create/sign in to an account and are
  // brought straight back to this exact plan+billing checkout afterwards
  // (via `next`); a logged-in paid role goes straight to checkout; a
  // logged-in Audience account cannot buy a subscription at all.
  const subscribeTarget = `/app/subscribe/${planId}?billing=${billing}`;
  let ctaHref = meta.ctaHref;
  let ctaDisabled = false;
  let ctaNote = null;
  if (!isFree) {
    if (authLoading) {
      ctaDisabled = true;
    } else if (!user) {
      ctaHref = `/register?role=${role}&plan=${planId}&billing=${billing}&next=${encodeURIComponent(subscribeTarget)}`;
    } else if (effectiveRole === "audience") {
      ctaDisabled = true;
      ctaNote = "Tidak tersedia untuk akun Audience";
    } else {
      ctaHref = subscribeTarget;
    }
  }

  return (
    <article
      data-testid={`pricing-plan-${planId}`}
      className={[
        "relative flex h-full flex-col rounded-2xl border p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)]",
        isMax
          ? "border-white/[0.22] bg-gradient-to-b from-[#181824]/90 to-[#0e0e15]/90 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "border-white/[0.08] bg-[#0c0c11]/85 backdrop-blur-xl shadow-md hover:border-white/25",
      ].join(" ")}
    >
      {isMax && (
        <span
          aria-hidden="true"
          className="absolute -top-3 left-6 rounded-full border border-white/[0.2] bg-[#1a1a26] px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-md font-gemini-mono"
        >
          Recommended for scale
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-bold text-white">{meta.label}</h3>
        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono">
          {meta.intelligence}
        </span>
      </div>
      <p className="mt-2.5 text-sm text-zinc-400 leading-relaxed">{meta.positioning}</p>

      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="font-gemini-mono text-3xl font-bold text-white sm:text-4xl">{price.label}</span>
          <span className="text-xs text-zinc-400">{price.sublabel}</span>
        </div>
        {planId !== "free" && billing === "yearly" && (
          <div className="mt-1 text-[11px] text-zinc-400">
            Equivalent to {formatIDR(Math.round(price.amount / 12))} per month, billed yearly.
          </div>
        )}
        {planId === "free" && (
          <div className="mt-1 text-[11px] text-zinc-400">No card required.</div>
        )}
      </div>

      {meta.inherits && (
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-300 font-medium">
          {meta.inherits}
        </div>
      )}

      <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2.5 items-start">
            <Check size={16} className="mt-0.5 shrink-0 text-zinc-300" aria-hidden="true" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        {ctaDisabled ? (
          <button
            type="button"
            disabled
            data-testid={`pricing-cta-${planId}`}
            title={ctaNote || undefined}
            className="group inline-flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3.5 text-sm font-bold text-zinc-500 shadow-md"
          >
            <span>{ctaNote || meta.cta}</span>
          </button>
        ) : (
          <Link
            to={ctaHref}
            data-testid={`pricing-cta-${planId}`}
            className={[
              "group inline-flex w-full items-center justify-between rounded-xl px-5 py-3.5 text-sm font-bold transition-all shadow-md active:scale-[0.98]",
              isMax
                ? "bg-white text-black hover:bg-zinc-200"
                : isFree
                ? "border border-white/[0.15] bg-white/[0.04] text-zinc-100 hover:border-white/[0.3] hover:bg-white/[0.08]"
                : "bg-white text-black hover:bg-zinc-200",
            ].join(" ")}
          >
            <span>{meta.cta}</span>
            <ArrowUpRight
              size={16}
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        )}
        <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 font-gemini-mono">
          Event Graph: {meta.eventGraph}
        </div>
      </div>
    </article>
  );
}

/* --------------------- EVENT GRAPH TIER DEMONSTRATION -------------------- */

function EventGraphTiers() {
  return (
    <section
      aria-labelledby="pricing-graph-heading"
      className="mt-14 rounded-3xl border border-white/[0.08] bg-[#09090e]/95 p-6 sm:p-8 shadow-xl font-gemini"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300 backdrop-blur-md">
        <Waypoints size={13} className="text-zinc-400" aria-hidden="true" />
        <span>Event Graph Matrix</span>
      </div>
      <h2 id="pricing-graph-heading" className="editorial mt-4 max-w-3xl text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
        See. Understand. Optimize.
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {GRAPH_TIERS.map((tier) => (
          <div
            key={tier.plan}
            data-testid={`pricing-graph-${tier.plan}`}
            className="rounded-2xl border border-white/[0.08] bg-[#0c0c11]/85 backdrop-blur-xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] font-gemini-mono">
              <span className="text-zinc-400">{PLAN_META[tier.plan].label}</span>
              <span className="text-zinc-500">{tier.tier}</span>
            </div>
            <div className="mt-3 text-sm font-bold text-zinc-200">{tier.headline}</div>
            <ul className="mt-3 space-y-1.5 text-xs text-zinc-400">
              {tier.bullets.map((b) => (
                <li key={b} className="flex gap-2 items-center">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const GRAPH_TIERS = [
  {
    plan: "free",
    tier: "See",
    headline: "The ecosystem and its readiness.",
    bullets: ["Nodes and relationships", "Basic readiness status", "Overview of blockers"],
  },
  {
    plan: "pro",
    tier: "Understand",
    headline: "Why the graph is where it is.",
    bullets: [
      "Dependency paths",
      "Blocker and root-cause reasoning",
      "Deadlines and responsibility",
    ],
  },
  {
    plan: "max",
    tier: "Optimize",
    headline: "What to do next, at portfolio scale.",
    bullets: [
      "Cross-event and portfolio graph",
      "Scenario analysis and prediction",
      "Recommended action sequences",
    ],
  },
];

/* ---------------------- DETAILED COMPARISON ------------------------------ */

function ComparisonTable({ role, openGroups, setOpenGroups }) {
  return (
    <section aria-labelledby="pricing-compare-heading" className="mt-16 font-gemini">
      <h2 id="pricing-compare-heading" className="editorial text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
        Compare in detail
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-zinc-400">
        Grouped by capability. Values reflect what the selected role receives. Dash means the capability is not relevant to this role or is not available on that plan.
      </p>
      <div className="mt-8 space-y-3" data-testid="pricing-comparison">
        {COMPARISON_GROUPS.map((group, i) => {
          const open = openGroups.has(i);
          return (
            <div key={group.title} className="rounded-2xl border border-white/[0.08] bg-[#0c0c11]/85 backdrop-blur-xl overflow-hidden shadow-sm">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setOpenGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                }}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-100 font-gemini-mono">
                  {group.title}
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={`shrink-0 text-zinc-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="overflow-x-auto border-t border-white/[0.06]">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono">
                        <th scope="col" className="px-6 py-3 text-left">Capability</th>
                        {PLAN_ORDER.map((p) => (
                          <th key={p} scope="col" className="px-6 py-3 text-left">
                            {PLAN_META[p].label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.capability} className="border-t border-white/[0.06]">
                          <th scope="row" className="px-6 py-3.5 text-left text-zinc-300 font-normal">
                            {row.capability}
                          </th>
                          {PLAN_ORDER.map((p) => {
                            const cell = row[role]?.[p] ?? "-";
                            const missing = cell === "-";
                            return (
                              <td
                                key={p}
                                className={[
                                  "px-6 py-3.5",
                                  missing ? "text-zinc-400" : p === "max" ? "text-white font-semibold" : "text-zinc-200",
                                ].join(" ")}
                              >
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------- FAQ ----------------------------------- */

const FAQ = [
  {
    q: "Does OKKAX have a free plan?",
    a: "Yes. Free gives real access to the network, Event Studio basics, Calendar, basic Event Graph, and Observe-level Intelligence. No card required.",
  },
  {
    q: "Does Max include everything in Pro?",
    a: "Yes. Max is cumulative. Everything in Free and everything in Pro is included, plus Max-exclusive capabilities like forecasting, scenario analysis, and portfolio intelligence.",
  },
  {
    q: "Is annual billing available?",
    a: "Yes. Annual billing follows the same principle for every role: pay 10 months, use 12.",
  },
  {
    q: "How do Free, Pro, and Max differ?",
    a: "Plans differ by operational scale, collaboration, portfolio controls, and advanced Event Graph capabilities. Okkax Copilot is not governed by the retired Intelligence query quota.",
  },
  {
    q: "Are ticketing fees included?",
    a: "Subscription and ticket-transaction economics are separate. Ticketing fees are not part of this subscription and remain configurable per event.",
  },
];

function MiniFaq() {
  return (
    <section aria-labelledby="pricing-faq-heading" className="mt-16 border-t border-white/[0.06] pt-14 font-gemini">
      <h2 id="pricing-faq-heading" className="editorial text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
        Common questions
      </h2>
      <dl className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-2">
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-2xl border border-white/[0.06] bg-[#0c0c11]/60 p-6">
            <dt className="text-sm font-bold text-zinc-100">{item.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-zinc-300">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------------------------- CLOSING CTA -------------------------------- */

function ClosingCta() {
  return (
    <section className="mt-16 rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#14141f] to-[#0a0a0f] p-8 sm:p-14 shadow-[0_32px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] font-gemini">
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300">
            <span>Start the operating network</span>
          </div>
          <h2 className="editorial mt-4 max-w-2xl text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
            No card. No ticketing lock-in. Every plan enters the same network.
          </h2>
        </div>
        <div className="flex flex-col gap-3.5 sm:flex-row">
          <Link
            to="/register"
            className="group inline-flex min-w-52 items-center justify-between rounded-xl bg-white hover:bg-zinc-200 px-6 py-4 text-sm font-bold text-black transition-all shadow-[0_4px_24px_rgba(255,255,255,0.15)] active:scale-[0.98]"
          >
            <span>Start Free</span>
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            to="/discover"
            className="group inline-flex min-w-52 items-center justify-between rounded-xl border border-white/[0.15] bg-white/[0.04] px-6 py-4 text-sm font-semibold text-zinc-100 hover:border-white/[0.3] hover:bg-white/[0.08] transition-all"
          >
            <span>Explore Discover</span>
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- JSON-LD ----------------------------------- */

// Structured data must remain truthful and match visible content.
// We describe OKKAX as an Organization and expose the three plans as
// separate Product offers so search engines and AI systems can answer
// "How much is OKKAX Pro for Organizer?" from the visible page.
function buildJsonLd() {
  const offers = [];
  for (const roleId of Object.keys(PRICE_TABLE)) {
    for (const plan of ["pro", "max"]) {
      const p = PRICE_TABLE[roleId];
      offers.push({
        "@type": "Offer",
        name: `OKKAX ${PLAN_META[plan].label} for ${roleId}`,
        priceCurrency: "IDR",
        price: p[`${plan}Monthly`],
        priceSpecification: [
          {
            "@type": "UnitPriceSpecification",
            price: p[`${plan}Monthly`],
            priceCurrency: "IDR",
            unitCode: "MON",
            billingIncrement: 1,
          },
          {
            "@type": "UnitPriceSpecification",
            price: p[`${plan}Yearly`],
            priceCurrency: "IDR",
            unitCode: "ANN",
            billingIncrement: 1,
          },
        ],
        availability: "https://schema.org/InStock",
      });
    }
  }
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "OKKAX Subscription",
    description:
      "OKKAX subscription plans (Free, Pro, Max) for Organizer, Talent, Venue, Vendor, Workforce, Sponsor, and Tenant. Free forever. Yearly billing pays 10 months and uses 12.",
    brand: { "@type": "Organization", name: "OKKAX", url: "https://okkax.com" },
    offers,
  };
}
