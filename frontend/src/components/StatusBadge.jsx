const OK = "text-white border-white/40 bg-white/10";
const WARN = "text-[var(--okx-accent-soft)] border-[var(--okx-accent)]/40 bg-[var(--okx-accent)]/10";
const CRIT = "text-white border-[var(--okx-accent)] bg-[var(--okx-accent)]/25";
const IDLE = "text-zinc-400 border-zinc-700 bg-zinc-500/10";

export const STATUS_STYLES = {
  Confirmed: OK,
  Completed: OK,
  Matched: OK,
  Pending: WARN,
  "Requires Confirmation": WARN,
  "Partially Matched": WARN,
  Draft: IDLE,
  "Not Started": IDLE,
  "In Progress": WARN,
  Missing: CRIT,
  Conflicted: CRIT,
  Blocked: CRIT,
  "At Risk": CRIT,
  Cancelled: IDLE,
};

export default function StatusBadge({ status, className = "", testId }) {
  const style = STATUS_STYLES[status] || IDLE;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
