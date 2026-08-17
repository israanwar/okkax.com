// Public Pricing surface for Free / Pro / Max.
//
// Authority: docs/32_SUBSCRIPTION_AND_ENTITLEMENT_ARCHITECTURE_MASTER.md
//            docs/33_PRICING_PACKAGING_AND_MONETIZATION_MASTER.md
//            docs/34_PUBLIC_SUBSCRIPTION_EXPERIENCE_MASTER.md
//
// Rules honored here:
//   * Single pricing source of truth via @/lib/pricing.
//   * Max = Everything in Pro + exclusive; Pro = Everything in Free + more.
//   * Intelligence: Observe > Understand > Optimize.
//   * Event Graph: See > Understand > Optimize.
//   * Honest CTA (no Buy Now; checkout not live).
//   * Mobile-first (390 baseline), no horizontal overflow.
//   * Semantic HTML for SEO/AEO/GEO; JSON-LD is truthful.
//   * No emoji, no em-dash, black + OKKAX pink + white palette.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Info, Sparkles, Waypoints } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
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
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <PublicNav />
      <main data-testid="pricing-page" className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        <Hero />
        <RoleSelector value={role} onChange={setRole} />
        <BillingToggle value={billing} onChange={setBilling} />
        <PlanGrid role={role} activeRole={activeRole} billing={billing} />
        <IntelligenceTiers />
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
        Free gets you into the network. Pro helps you operate professionally. Max gives you the deepest OKKAX Intelligence for optimization and scale.
      </p>
    </header>
  );
}

/* --------------------------- ROLE SELECTOR ------------------------------- */

function RoleSelector({ value, onChange }) {
  return (
    <section aria-labelledby="pricing-role-heading" className="mt-10">
      <h2 id="pricing-role-heading" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
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
                "shrink-0 border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--okx-accent)] bg-[var(--okx-accent-tint)] text-white"
                  : "border-[var(--okx-border)] bg-transparent text-zinc-400 hover:border-zinc-500 hover:text-zinc-100",
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
    <section aria-labelledby="pricing-billing-heading" className="mt-8 flex flex-wrap items-center gap-4">
      <h2 id="pricing-billing-heading" className="sr-only">
        Billing period
      </h2>
      <div
        role="tablist"
        aria-label="Billing period"
        className="inline-flex border border-[var(--okx-border)] bg-[#0b0b0b]"
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
                "px-4 py-2 text-sm font-semibold transition-colors",
                active ? "bg-[var(--okx-accent)] text-white" : "text-zinc-400 hover:text-zinc-100",
              ].join(" ")}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      {value === "yearly" ? (
        <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
          <Info size={13} aria-hidden="true" />
          Pay 10 months, use 12. Billed annually.
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
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
    <section aria-labelledby="pricing-plans-heading" className="mt-10">
      <h2 id="pricing-plans-heading" className="sr-only">
        Plans for {activeRole.longLabel}
      </h2>
      <div className="mb-4 text-sm text-zinc-500">
        Pricing for <span className="font-semibold text-zinc-200">{activeRole.longLabel}</span>. {activeRole.tagline}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
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
  return (
    <article
      data-testid={`pricing-plan-${planId}`}
      className={[
        "relative flex h-full flex-col border p-6 sm:p-7",
        isMax
          ? "border-[var(--okx-accent)] bg-[#100609]"
          : "border-[var(--okx-border)] bg-[#0c0c0c]",
      ].join(" ")}
    >
      {isMax && (
        <span
          aria-hidden="true"
          className="absolute -top-3 left-6 border border-[var(--okx-accent)] bg-[#050505] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--okx-accent)]"
        >
          Recommended for scale
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-semibold text-white">{meta.label}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {meta.intelligence}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{meta.positioning}</p>

      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-white sm:text-4xl">{price.label}</span>
          <span className="text-xs text-zinc-500">{price.sublabel}</span>
        </div>
        {planId !== "free" && billing === "yearly" && (
          <div className="mt-1 text-[11px] text-zinc-500">
            Equivalent to {formatIDR(Math.round(price.amount / 12))} per month, billed yearly.
          </div>
        )}
        {planId === "free" && (
          <div className="mt-1 text-[11px] text-zinc-500">No card required.</div>
        )}
      </div>

      {meta.inherits && (
        <div className="mt-5 border-l-2 border-[var(--okx-accent)] pl-3 text-xs uppercase tracking-[0.18em] text-[var(--okx-accent-soft)]">
          {meta.inherits}
        </div>
      )}

      <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-[var(--okx-accent)]" aria-hidden="true" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          to={meta.ctaHref}
          data-testid={`pricing-cta-${planId}`}
          className={[
            "group inline-flex w-full items-center justify-between px-5 py-3 text-sm font-semibold transition-colors",
            isMax
              ? "bg-[var(--okx-accent)] text-white hover:bg-[var(--okx-accent-hover)]"
              : isFree
              ? "border border-zinc-700 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
              : "bg-white text-black hover:bg-zinc-200",
          ].join(" ")}
        >
          {meta.cta}
          <ArrowUpRight
            size={16}
            className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
        <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          Event Graph: {meta.eventGraph}
        </div>
      </div>
    </article>
  );
}

/* --------------------- INTELLIGENCE TIER DEMONSTRATION ------------------- */

function IntelligenceTiers() {
  return (
    <section
      aria-labelledby="pricing-intel-heading"
      className="mt-16 border-t border-[var(--okx-border)] pt-14"
    >
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
        <Sparkles size={14} aria-hidden="true" /> OKKAX Intelligence
      </div>
      <h2 id="pricing-intel-heading" className="editorial mt-4 max-w-3xl text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight text-[#f4efec]">
        Observe. Understand. Optimize.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
        Intelligence is grounded in your authorized event state. Each plan reveals more of the same operating truth.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {INTELLIGENCE_DEMOS.map((demo) => (
          <IntelligenceCard key={demo.plan} {...demo} />
        ))}
      </div>
    </section>
  );
}

const INTELLIGENCE_DEMOS = [
  {
    plan: "free",
    tier: "Observe",
    prompt: "What is happening?",
    body: [
      { label: "Readiness", value: "68%" },
      { label: "Venue", value: "Ready" },
      { label: "Vendor", value: "At risk" },
      { label: "Workforce", value: "Blocked" },
      { label: "Ticketing", value: "Pending" },
    ],
  },
  {
    plan: "pro",
    tier: "Understand",
    prompt: "Why is it happening?",
    narrative:
      "Gate Operations is at risk. Root cause: 12 security positions remain unfilled.",
    path: ["Workforce", "Security", "Gate Operations", "Access Readiness"],
  },
  {
    plan: "max",
    tier: "Optimize",
    prompt: "What is the best next action?",
    steps: [
      "Complete security assignment",
      "Finalize gate configuration",
      "Allocate validator teams",
      "Run access-readiness check",
    ],
    footnote: "Scenario and impact analysis available on Max.",
  },
];

function IntelligenceCard({ plan, tier, prompt, body, narrative, path, steps, footnote }) {
  return (
    <div
      data-testid={`pricing-intel-${plan}`}
      className="flex h-full flex-col border border-[var(--okx-border)] bg-[#0b0b0b] p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
          {PLAN_META[plan].label}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {tier}
        </span>
      </div>
      <div className="mt-3 text-xs italic text-zinc-500">Q. {prompt}</div>
      <div className="mt-4 flex-1 text-sm">
        {body && (
          <dl className="space-y-1.5 font-mono text-[12.5px] text-zinc-300">
            {body.map((row) => (
              <div key={row.label} className="flex justify-between border-b border-dashed border-zinc-800 py-1">
                <dt className="text-zinc-500">{row.label}</dt>
                <dd className="text-zinc-100">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {narrative && (
          <div className="text-zinc-200">
            <p>{narrative}</p>
            {path && (
              <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] text-zinc-500">
                {path.map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    {i > 0 && <span className="text-[var(--okx-accent)]" aria-hidden="true">/</span>}
                    <span className={i === path.length - 1 ? "text-zinc-200" : ""}>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {steps && (
          <ol className="space-y-1.5 text-zinc-200">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-2">
                <span className="w-5 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--okx-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {footnote && (
        <div className="mt-4 text-[11px] text-zinc-500">{footnote}</div>
      )}
    </div>
  );
}

/* --------------------- EVENT GRAPH TIER DEMONSTRATION -------------------- */

function EventGraphTiers() {
  return (
    <section
      aria-labelledby="pricing-graph-heading"
      className="mt-14 border border-[var(--okx-border)] bg-[#0a0a0a] p-6 sm:p-8"
    >
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
        <Waypoints size={14} aria-hidden="true" /> Event Graph
      </div>
      <h2 id="pricing-graph-heading" className="editorial mt-4 max-w-3xl text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
        See. Understand. Optimize.
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {GRAPH_TIERS.map((tier) => (
          <div
            key={tier.plan}
            data-testid={`pricing-graph-${tier.plan}`}
            className="border border-[var(--okx-border)] bg-[#050505] p-5"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em]">
              <span className="text-[var(--okx-accent-soft)]">{PLAN_META[tier.plan].label}</span>
              <span className="text-zinc-500">{tier.tier}</span>
            </div>
            <div className="mt-3 text-sm text-zinc-200">{tier.headline}</div>
            <ul className="mt-3 space-y-1.5 text-xs text-zinc-500">
              {tier.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 bg-[var(--okx-accent)]" aria-hidden="true" />
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
    <section aria-labelledby="pricing-compare-heading" className="mt-16">
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
            <div key={group.title} className="border border-[var(--okx-border)] bg-[#0a0a0a]">
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
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-100">
                  {group.title}
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="overflow-x-auto border-t border-[var(--okx-border)]">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        <th scope="col" className="px-5 py-3 text-left font-semibold">Capability</th>
                        {PLAN_ORDER.map((p) => (
                          <th key={p} scope="col" className="px-5 py-3 text-left font-semibold">
                            {PLAN_META[p].label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.capability} className="border-t border-[var(--okx-border)]">
                          <th scope="row" className="px-5 py-3 text-left text-zinc-300 font-normal">
                            {row.capability}
                          </th>
                          {PLAN_ORDER.map((p) => {
                            const cell = row[role]?.[p] ?? "-";
                            const missing = cell === "-";
                            return (
                              <td
                                key={p}
                                className={[
                                  "px-5 py-3",
                                  missing ? "text-zinc-600" : p === "max" ? "text-white" : "text-zinc-200",
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
    q: "What is the difference between Free, Pro, and Max Intelligence?",
    a: "Free observes the state, Pro explains why (root cause and dependency paths), Max recommends optimized action sequences and supports scenario analysis.",
  },
  {
    q: "Are ticketing fees included?",
    a: "Subscription and ticket-transaction economics are separate. Ticketing fees are not part of this subscription and remain configurable per event.",
  },
];

function MiniFaq() {
  return (
    <section aria-labelledby="pricing-faq-heading" className="mt-16 border-t border-[var(--okx-border)] pt-14">
      <h2 id="pricing-faq-heading" className="editorial text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
        Common questions
      </h2>
      <dl className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-2">
        {FAQ.map((item) => (
          <div key={item.q}>
            <dt className="text-sm font-semibold text-zinc-100">{item.q}</dt>
            <dd className="mt-2 text-sm leading-6 text-zinc-400">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------------------------- CLOSING CTA -------------------------------- */

function ClosingCta() {
  return (
    <section className="mt-16 border border-[var(--okx-border)] bg-[#0c0c0c] p-8 sm:p-10">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
            Start the operating network
          </div>
          <h2 className="editorial mt-3 max-w-2xl text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-[#f4efec]">
            No card. No ticketing lock-in. Every plan enters the same network.
          </h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/register"
            className="group inline-flex min-w-52 items-center justify-between bg-[var(--okx-accent)] px-5 py-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]"
          >
            Start Free
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            to="/discover"
            className="group inline-flex min-w-52 items-center justify-between border border-zinc-700 px-5 py-4 text-sm font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
          >
            Explore Discover
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
