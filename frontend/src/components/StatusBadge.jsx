const OK = "text-zinc-100 border-white/30 bg-white/[0.08] font-bold";
const WARN = "text-zinc-300 border-dashed border-white/25 bg-white/[0.03]";
const CRIT = "text-white border-white/60 bg-white/10 font-bold tracking-wide";
const INFO = "text-zinc-200 border-white/20 bg-white/[0.04]";
const IDLE = "text-zinc-400 border-white/[0.08] bg-white/[0.02]";

export const STATUS_STYLES = {
  Confirmed: OK,
  Published: OK,
  Completed: OK,
  Matched: OK,
  Approved: OK,
  Active: OK,
  Paid: OK,
  Pending: WARN,
  "Requires Confirmation": WARN,
  "Partially Matched": WARN,
  "In Progress": WARN,
  Review: WARN,
  Draft: IDLE,
  "Not Started": IDLE,
  Missing: CRIT,
  Conflicted: CRIT,
  Blocked: CRIT,
  "At Risk": CRIT,
  Rejected: CRIT,
  Cancelled: IDLE,
};

export default function StatusBadge({ status, className = "", testId }) {
  const style = STATUS_STYLES[status] || IDLE;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold font-gemini-mono tracking-tight shadow-sm ${style} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0 animate-pulse" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}
