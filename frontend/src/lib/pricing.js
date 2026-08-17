// OKKAX single pricing source of truth.
//
// Authority: docs/32_OKKAX_SUBSCRIPTION_AND_ENTITLEMENT_ARCHITECTURE_MASTER.md
//            docs/33_OKKAX_PRICING_PACKAGING_AND_MONETIZATION_MASTER.md
//            docs/34_OKKAX_PUBLIC_SUBSCRIPTION_EXPERIENCE_MASTER.md
//
// Any public price must consume this file. Do NOT hard-code Rupiah values
// in components, JSON-LD, homepage previews, signup, or checkout. Changing
// a price = editing this file only.
//
// Invariants (do not violate on edit):
//   1. Free = 0 for every role.
//   2. Max >= Pro for every role and billing period.
//   3. Annual = "pay 10 months, use 12" (proYearly == 10 * proMonthly).
//   4. All seven canonical roles must remain present.
//   5. Plan order is stable: free, pro, max.

export const PLAN_ORDER = ["free", "pro", "max"];

export const PLAN_META = {
  free: {
    id: "free",
    label: "Free",
    positioning: "See, start, and participate.",
    intelligence: "Observe",
    eventGraph: "See",
    cta: "Start Free",
    ctaHref: "/register",
  },
  pro: {
    id: "pro",
    label: "Pro",
    positioning: "Understand and operate professionally.",
    intelligence: "Understand",
    eventGraph: "Understand",
    inherits: "Everything in Free, plus",
    cta: "Choose Pro",
    ctaHref: "/register?plan=pro",
    accent: true,
  },
  max: {
    id: "max",
    label: "Max",
    positioning: "Optimize, automate, and scale.",
    intelligence: "Optimize",
    eventGraph: "Optimize",
    inherits: "Everything in Pro, plus",
    cta: "Choose Max",
    ctaHref: "/register?plan=max",
    accent: true,
    highlight: true,
  },
};

// Canonical role order per doc 34 section 5.2.
export const ROLES = [
  { id: "organizer", label: "Organizer", longLabel: "Organizer / Promoter", tagline: "Compile, orchestrate, and run live events." },
  { id: "talent", label: "Talent", longLabel: "Talent", tagline: "Professional bookings, calendar, and career intelligence." },
  { id: "venue", label: "Venue", longLabel: "Venue", tagline: "Bookings, occupancy, and venue performance." },
  { id: "vendor", label: "Vendor", longLabel: "Vendor", tagline: "Opportunities, projects, and profitability." },
  { id: "workforce", label: "Workforce", longLabel: "Workforce", tagline: "Jobs, shifts, and professional growth." },
  { id: "sponsor", label: "Sponsor", longLabel: "Sponsor", tagline: "Fit, campaigns, and sponsorship intelligence." },
  { id: "tenant", label: "Tenant", longLabel: "Tenant", tagline: "Applications, sales, and multi-event performance." },
];

// Canonical prices from doc 33 section 3 and 4.
// Values in Indonesian Rupiah, integer.
export const PRICE_TABLE = {
  organizer: { free: 0, proMonthly: 99000, maxMonthly: 199000, proYearly: 990000, maxYearly: 1990000 },
  sponsor:   { free: 0, proMonthly: 99000, maxMonthly: 199000, proYearly: 990000, maxYearly: 1990000 },
  venue:     { free: 0, proMonthly: 69000, maxMonthly: 139000, proYearly: 690000, maxYearly: 1390000 },
  vendor:    { free: 0, proMonthly: 59000, maxMonthly: 119000, proYearly: 590000, maxYearly: 1190000 },
  talent:    { free: 0, proMonthly: 39000, maxMonthly:  79000, proYearly: 390000, maxYearly:  790000 },
  tenant:    { free: 0, proMonthly: 29000, maxMonthly:  59000, proYearly: 290000, maxYearly:  590000 },
  workforce: { free: 0, proMonthly: 19000, maxMonthly:  39000, proYearly: 190000, maxYearly:  390000 },
};

// Role-aware plan bullets. 5-7 items per plan per doc 34 section 5.3.
// Free bullets must sound like real value, not a stripped shell.
export const ROLE_BULLETS = {
  organizer: {
    free: [
      "1 active event",
      "Basic Event Studio",
      "Network discovery: talent, venue, vendor, workforce, sponsor",
      "Calendar and basic assignments",
      "Basic Event Graph and Ticket Studio",
      "Finance overview and essential documents",
    ],
    pro: [
      "Up to 5 active events",
      "Full Event Studio and reusable blueprint",
      "Smart matching and advanced Network filters",
      "Operational Calendar with dependencies",
      "Event Graph that explains blockers and root cause",
      "Professional Ticket Studio, seating, LivePass operations",
      "Team collaboration and standard automation",
    ],
    max: [
      "Up to 20 active events",
      "Multi-event command center and portfolio Event Graph",
      "Predictive readiness and scenario analysis",
      "Resource and schedule optimization",
      "Budget and revenue forecasting",
      "Ticket demand and capacity intelligence",
      "Advanced workflow automation and financial intelligence",
    ],
  },
  talent: {
    free: [
      "Professional profile and portfolio",
      "Basic availability and rider",
      "Opportunity participation",
      "Booking history and ratings",
      "Basic Event Graph context",
    ],
    pro: [
      "Advanced portfolio and full availability calendar",
      "Smart event matching",
      "Professional rider and technical requirements",
      "Rate and quotation management",
      "Contract and document workflow",
      "Performance, revenue, and opportunity analytics",
      "Schedule-conflict detection",
    ],
    max: [
      "Advanced opportunity intelligence",
      "Cross-event schedule optimization",
      "Income forecasting",
      "Demand and market-position insights",
      "Opportunity comparison",
      "Career and financial intelligence",
    ],
  },
  venue: {
    free: [
      "Venue listing and profile",
      "Capacity and facilities",
      "Basic availability",
      "Inquiries and ratings",
      "Basic analytics",
    ],
    pro: [
      "Full booking calendar",
      "Smart event matching",
      "Detailed facilities and venue configuration",
      "Operational requirements handling",
      "Quotation and booking pipeline",
      "Occupancy and revenue analytics",
      "Event history archive",
    ],
    max: [
      "Occupancy and revenue forecasting",
      "Demand intelligence and event suitability scoring",
      "Capacity and calendar optimization",
      "Conflict prediction and pricing insights",
      "Facility utilization analytics",
      "Operational risk signals",
      "Comparative venue performance",
    ],
  },
  vendor: {
    free: [
      "Company profile with categories and services",
      "Portfolio and ratings",
      "Opportunities feed",
      "Basic quotation and project history",
    ],
    pro: [
      "Professional portfolio and smart matching",
      "Advanced quotation workflow",
      "Availability, project, and assignment management",
      "Contract and document workflow",
      "Revenue, performance, and reputation analytics",
    ],
    max: [
      "Multi-project command center",
      "Advanced opportunity intelligence",
      "Demand and revenue forecasting",
      "Capacity, resource, and schedule optimization",
      "Profitability and quotation intelligence",
      "Operational risk and cross-event insights",
    ],
  },
  workforce: {
    free: [
      "Professional profile with skills and experience",
      "Availability and job discovery",
      "Opportunity receipt and applications",
      "Assignments, work history, ratings",
      "Basic earnings history",
    ],
    pro: [
      "Advanced profile and availability tools",
      "Smart job matching",
      "Calendar and work portfolio",
      "Earnings analytics and conflict detection",
      "Professional performance insights",
    ],
    max: [
      "Career intelligence and income forecasting",
      "Schedule and availability optimization",
      "Opportunity comparison",
      "Skill-demand and market insights",
      "Professional growth analytics",
    ],
  },
  sponsor: {
    free: [
      "Company profile",
      "Event discovery",
      "Sponsorship opportunities feed",
      "Basic campaign history",
    ],
    pro: [
      "Advanced event discovery and smart sponsorship matching",
      "Audience and event-fit information",
      "Proposal and campaign management",
      "Sponsorship portfolio and event comparison",
      "Performance analytics and organizer messaging",
    ],
    max: [
      "Sponsorship portfolio command center",
      "Cross-event opportunity intelligence",
      "Advanced fit and opportunity scoring",
      "Scenario comparison and portfolio allocation",
      "Sponsorship forecasting and executive reporting",
      "Campaign, geographic, and category intelligence",
    ],
  },
  tenant: {
    free: [
      "Business profile",
      "Event discovery",
      "Invitations and basic application history",
    ],
    pro: [
      "Smart opportunity matching",
      "Organizer broadcast access",
      "Application management",
      "Operational requirements and calendar",
      "Sales recording and performance analytics",
    ],
    max: [
      "Multi-event opportunity management",
      "Event, location, and category-fit intelligence",
      "Opportunity comparison and sales forecasting",
      "Event-performance comparison",
      "Profitability and portfolio analytics",
    ],
  },
};

// Grouped capability rows for the detailed comparison table.
// Each row has role-aware cell text keyed by plan. Use empty string for
// "not available" so we can render a discreet dash instead of a lie.
export const COMPARISON_GROUPS = [
  {
    title: "Core operations",
    rows: [
      {
        capability: "Active events",
        organizer: { free: "1", pro: "Up to 5", max: "Up to 20" },
        talent:    { free: "Unlimited profile", pro: "Unlimited profile", max: "Unlimited profile" },
        venue:     { free: "Portfolio", pro: "Portfolio", max: "Portfolio" },
        vendor:    { free: "Portfolio", pro: "Portfolio", max: "Portfolio" },
        workforce: { free: "Unlimited profile", pro: "Unlimited profile", max: "Unlimited profile" },
        sponsor:   { free: "Discovery", pro: "Campaign pipeline", max: "Portfolio pipeline" },
        tenant:    { free: "Discovery", pro: "Application pipeline", max: "Multi-event pipeline" },
      },
      {
        capability: "Event Studio",
        organizer: { free: "Basic", pro: "Full", max: "Advanced portfolio" },
        talent:    { free: "-", pro: "-", max: "-" },
        venue:     { free: "-", pro: "-", max: "-" },
        vendor:    { free: "-", pro: "-", max: "-" },
        workforce: { free: "-", pro: "-", max: "-" },
        sponsor:   { free: "-", pro: "-", max: "-" },
        tenant:    { free: "-", pro: "-", max: "-" },
      },
      {
        capability: "Ticket Studio and LivePass",
        organizer: { free: "Basic", pro: "Professional", max: "Advanced intelligence" },
        talent:    { free: "-", pro: "-", max: "-" },
        venue:     { free: "-", pro: "-", max: "-" },
        vendor:    { free: "-", pro: "-", max: "-" },
        workforce: { free: "-", pro: "-", max: "-" },
        sponsor:   { free: "-", pro: "-", max: "-" },
        tenant:    { free: "-", pro: "-", max: "-" },
      },
    ],
  },
  {
    title: "Network and matching",
    rows: [
      {
        capability: "Discovery",
        organizer: { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
        talent:    { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
        venue:     { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
        vendor:    { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
        workforce: { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
        sponsor:   { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
        tenant:    { free: "Basic", pro: "Advanced filters", max: "Advanced filters" },
      },
      {
        capability: "Smart matching",
        organizer: { free: "-", pro: "Included", max: "Advanced optimization" },
        talent:    { free: "-", pro: "Included", max: "Advanced optimization" },
        venue:     { free: "-", pro: "Included", max: "Advanced optimization" },
        vendor:    { free: "-", pro: "Included", max: "Advanced optimization" },
        workforce: { free: "-", pro: "Included", max: "Advanced optimization" },
        sponsor:   { free: "-", pro: "Included", max: "Advanced optimization" },
        tenant:    { free: "-", pro: "Included", max: "Advanced optimization" },
      },
    ],
  },
  {
    title: "Event Graph",
    rows: [
      {
        capability: "Depth",
        organizer: { free: "See", pro: "Understand", max: "Optimize" },
        talent:    { free: "See", pro: "Understand", max: "Optimize" },
        venue:     { free: "See", pro: "Understand", max: "Optimize" },
        vendor:    { free: "See", pro: "Understand", max: "Optimize" },
        workforce: { free: "See", pro: "Understand", max: "Optimize" },
        sponsor:   { free: "See", pro: "Understand", max: "Optimize" },
        tenant:    { free: "See", pro: "Understand", max: "Optimize" },
      },
      {
        capability: "Dependency and blocker analysis",
        organizer: { free: "-", pro: "Included", max: "Included" },
        talent:    { free: "-", pro: "Included", max: "Included" },
        venue:     { free: "-", pro: "Included", max: "Included" },
        vendor:    { free: "-", pro: "Included", max: "Included" },
        workforce: { free: "-", pro: "Included", max: "Included" },
        sponsor:   { free: "-", pro: "Included", max: "Included" },
        tenant:    { free: "-", pro: "Included", max: "Included" },
      },
      {
        capability: "Cross-event / portfolio graph",
        organizer: { free: "-", pro: "-", max: "Included" },
        talent:    { free: "-", pro: "-", max: "Included" },
        venue:     { free: "-", pro: "-", max: "Included" },
        vendor:    { free: "-", pro: "-", max: "Included" },
        workforce: { free: "-", pro: "-", max: "Included" },
        sponsor:   { free: "-", pro: "-", max: "Included" },
        tenant:    { free: "-", pro: "-", max: "Included" },
      },
    ],
  },
  {
    title: "OKKAX Intelligence",
    rows: [
      {
        capability: "Depth",
        organizer: { free: "Observe", pro: "Understand", max: "Optimize" },
        talent:    { free: "Observe", pro: "Understand", max: "Optimize" },
        venue:     { free: "Observe", pro: "Understand", max: "Optimize" },
        vendor:    { free: "Observe", pro: "Understand", max: "Optimize" },
        workforce: { free: "Observe", pro: "Understand", max: "Optimize" },
        sponsor:   { free: "Observe", pro: "Understand", max: "Optimize" },
        tenant:    { free: "Observe", pro: "Understand", max: "Optimize" },
      },
      {
        capability: "Root cause and recommendations",
        organizer: { free: "-", pro: "Included", max: "Advanced sequencing" },
        talent:    { free: "-", pro: "Included", max: "Advanced sequencing" },
        venue:     { free: "-", pro: "Included", max: "Advanced sequencing" },
        vendor:    { free: "-", pro: "Included", max: "Advanced sequencing" },
        workforce: { free: "-", pro: "Included", max: "Advanced sequencing" },
        sponsor:   { free: "-", pro: "Included", max: "Advanced sequencing" },
        tenant:    { free: "-", pro: "Included", max: "Advanced sequencing" },
      },
      {
        capability: "Forecasting and scenario analysis",
        organizer: { free: "-", pro: "-", max: "Included" },
        talent:    { free: "-", pro: "-", max: "Included" },
        venue:     { free: "-", pro: "-", max: "Included" },
        vendor:    { free: "-", pro: "-", max: "Included" },
        workforce: { free: "-", pro: "-", max: "Included" },
        sponsor:   { free: "-", pro: "-", max: "Included" },
        tenant:    { free: "-", pro: "-", max: "Included" },
      },
    ],
  },
  {
    title: "Analytics, automation, and collaboration",
    rows: [
      {
        capability: "Analytics",
        organizer: { free: "Overview", pro: "Standard", max: "Advanced portfolio" },
        talent:    { free: "Overview", pro: "Standard", max: "Advanced" },
        venue:     { free: "Overview", pro: "Standard", max: "Advanced" },
        vendor:    { free: "Overview", pro: "Standard", max: "Advanced" },
        workforce: { free: "Overview", pro: "Standard", max: "Advanced" },
        sponsor:   { free: "Overview", pro: "Standard", max: "Advanced" },
        tenant:    { free: "Overview", pro: "Standard", max: "Advanced" },
      },
      {
        capability: "Automation",
        organizer: { free: "-", pro: "Standard", max: "Advanced" },
        talent:    { free: "-", pro: "Standard", max: "Advanced" },
        venue:     { free: "-", pro: "Standard", max: "Advanced" },
        vendor:    { free: "-", pro: "Standard", max: "Advanced" },
        workforce: { free: "-", pro: "Standard", max: "Advanced" },
        sponsor:   { free: "-", pro: "Standard", max: "Advanced" },
        tenant:    { free: "-", pro: "Standard", max: "Advanced" },
      },
      {
        capability: "Team collaboration",
        organizer: { free: "Basic", pro: "Team", max: "Advanced permissions" },
        talent:    { free: "Basic", pro: "Included", max: "Included" },
        venue:     { free: "Basic", pro: "Included", max: "Included" },
        vendor:    { free: "Basic", pro: "Included", max: "Included" },
        workforce: { free: "Basic", pro: "Included", max: "Included" },
        sponsor:   { free: "Basic", pro: "Team", max: "Advanced permissions" },
        tenant:    { free: "Basic", pro: "Included", max: "Included" },
      },
    ],
  },
];

// Formatting helper. Indonesian locale gives dots as thousands separator.
export function formatIDR(amount) {
  if (amount === 0) return "Rp0";
  return "Rp" + new Intl.NumberFormat("id-ID").format(amount);
}

// Returns { label, sublabel, amount } for a role/plan/billing combo.
export function priceFor(roleId, planId, billing) {
  const p = PRICE_TABLE[roleId];
  if (!p) return { label: "Rp0", sublabel: "", amount: 0 };
  if (planId === "free") return { label: "Rp0", sublabel: "forever", amount: 0 };
  const key = planId + (billing === "yearly" ? "Yearly" : "Monthly");
  const amount = p[key] ?? 0;
  return {
    label: formatIDR(amount),
    sublabel: billing === "yearly" ? "per year" : "per month",
    amount,
  };
}
