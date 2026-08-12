export const STATUS_STYLES = {
  Confirmed: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  Completed: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  Matched: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  Pending: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  "Requires Confirmation": "text-amber-400 border-amber-500/40 bg-amber-500/10",
  "Partially Matched": "text-amber-400 border-amber-500/40 bg-amber-500/10",
  Draft: "text-zinc-400 border-zinc-600 bg-zinc-500/10",
  "Not Started": "text-zinc-400 border-zinc-600 bg-zinc-500/10",
  "In Progress": "text-sky-400 border-sky-500/40 bg-sky-500/10",
  Missing: "text-red-400 border-red-500/40 bg-red-500/10",
  Conflicted: "text-red-400 border-red-500/40 bg-red-500/10",
  Blocked: "text-red-400 border-red-500/40 bg-red-500/10",
  "At Risk": "text-orange-400 border-orange-500/40 bg-orange-500/10",
  Cancelled: "text-zinc-500 border-zinc-700 bg-zinc-800/40",
};

export default function StatusBadge({ status, className = "", testId }) {
  const style = STATUS_STYLES[status] || "text-zinc-300 border-zinc-700 bg-zinc-800/40";
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
