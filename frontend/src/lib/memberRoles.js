const COPILOT_MEMBER_ROLES = new Set([
  "organizer",
  "event_organizer",
  "supervisor",
  "finance_approver",
  "talent",
  "talent_management",
  "artist",
  "band",
  "venue",
  "venue_manager",
  "vendor",
  "supplier",
  "workforce",
  "worker",
  "crew",
  "sponsor",
  "tenant",
]);

export const canAccessMemberCopilot = (role) =>
  COPILOT_MEMBER_ROLES.has(String(role || "").toLowerCase());

// /app/finance is a shared route (Finance & Escrow / Finance & Settlement /
// Finance & Commitments / Payments & Invoices depending on nav label) but the
// page itself surfaces organizer-level escrow balances, vendor payouts, and a
// fund-release action. Only roles that legitimately hold financial authority
// over an event should be able to reach it.
const FINANCE_WORKSPACE_ROLES = new Set([
  "organizer",
  "event_organizer",
  "promoter",
  "supervisor",
  "finance_approver",
  "sponsor",
  "tenant",
]);

export const canAccessFinanceWorkspace = (role) =>
  FINANCE_WORKSPACE_ROLES.has(String(role || "").toLowerCase());
