import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, User, Building2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Header identity dropdown. The identity block itself remains the
// visible surface (user name + org label). Clicking it toggles a
// compact selector that lists every workspace surfaced by
// /me/workspaces. Selecting an item calls /me/workspace/activate; on
// success the parent context re-reads /me/workspace/active and bumps
// the workspace version so any workspace-scoped view refetches.
//
// Frontend is not the authority. We only forward what the server told
// us in /me/workspaces (organization_id + role); a rejection surfaces
// as an inline error and local state stays unchanged.
export default function WorkspaceSelector() {
  const {
    user, org, workspaces, activeWorkspace, switchWorkspace,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // stores the ws key being switched to
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  const wsKey = (w) => (w?.organization_id ?? "__personal__");
  const activeKey = wsKey(activeWorkspace);
  const hasOptions = (workspaces?.length || 0) > 0;

  // Prefer active workspace's server-given label; fall back to legacy
  // org name so single-org accounts without an explicit activation
  // still get a meaningful subtitle.
  const subtitle = activeWorkspace?.label
    || org?.name
    || (user.roles || []).join(", ");

  const onPick = async (w) => {
    setError("");
    const key = wsKey(w);
    if (key === activeKey) { setOpen(false); return; }
    setBusy(key);
    try {
      await switchWorkspace({
        organization_id: w.organization_id ?? null,
        role: w.role,
      });
      setOpen(false);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Gagal berpindah workspace";
      setError(String(detail));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="workspace-identity-btn"
        onClick={() => setOpen((o) => !o)}
        className="hidden items-center gap-2 border border-transparent px-2 py-1 text-right transition-colors hover:border-[var(--okx-border)] sm:flex"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="text-right">
          <div className="text-sm font-medium leading-tight">{user.name}</div>
          <div className="text-[11px] leading-tight text-zinc-500">{subtitle}</div>
        </div>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          data-testid="workspace-selector-panel"
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 border border-[var(--okx-border)] bg-[var(--okx-surface)] shadow-lg"
        >
          <div className="border-b border-[var(--okx-border)] px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
            Workspace
          </div>
          {!hasOptions && (
            <div className="px-3 py-4 text-xs text-zinc-500">
              Tidak ada workspace tersedia untuk akun ini.
            </div>
          )}
          {hasOptions && workspaces.map((w) => {
            const key = wsKey(w);
            const isActive = key === activeKey;
            const isPersonal = w.organization_id == null;
            const Icon = isPersonal ? User : Building2;
            return (
              <button
                key={key}
                data-testid={`workspace-option-${isPersonal ? "personal" : w.organization_id}`}
                onClick={() => onPick(w)}
                disabled={!!busy}
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--okx-accent-tint)] accent-text"
                    : "text-zinc-200 hover:bg-black/40"
                }`}
              >
                <Icon size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{w.label || w.organization_id || "Personal"}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    {w.role}{isPersonal ? " · personal" : ""}
                  </div>
                </div>
                {isActive && <Check size={14} className="mt-1 shrink-0 accent-text" />}
                {busy === key && !isActive && (
                  <span className="mt-1 text-[10px] text-zinc-500">…</span>
                )}
              </button>
            );
          })}
          {error && (
            <div className="flex items-start gap-2 border-t border-[var(--okx-border)] bg-black/40 px-3 py-2 text-xs text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
