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
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const isSuperAdmin = user.roles?.includes("super_admin");

  if (isSuperAdmin) {
    return (
      <div
        data-testid="platform-identity"
        className="hidden px-2 py-1 text-right sm:block"
      >
        <div className="text-sm font-medium leading-tight">{user.name}</div>
        <div className="text-[11px] leading-tight text-zinc-500">
          Super Admin · Platform
        </div>
      </div>
    );
  }

  const wsKey = (w) => {
    if (!w) return "__none__";
    return w.organization_id ?? "__personal__";
  };
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
        className="hidden items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-right transition-colors hover:border-white/10 hover:bg-white/[0.03] sm:flex cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="text-right">
          <div className="text-[13px] font-medium leading-tight text-white">{user.name}</div>
          <div className="text-[10px] leading-tight text-zinc-400">{subtitle}</div>
        </div>
        <ChevronDown size={13} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          data-testid="workspace-selector-panel"
          role="menu"
          className="absolute right-0 z-[100] mt-1.5 w-64 rounded-xl border border-white/[0.12] bg-[#0c0c14] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
        >
          <div className="border-b border-white/[0.08] px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
            Workspace
          </div>
          {!hasOptions && (
            <div className="px-2.5 py-3 text-xs text-zinc-500">
              Tidak ada workspace tersedia untuk akun ini.
            </div>
          )}
          {hasOptions && (
            <div className="space-y-0.5 pt-1">
              {workspaces.map((w) => {
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
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? "bg-white/[0.1] text-white font-semibold border border-white/[0.08]"
                        : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon size={13} className="mt-0.5 shrink-0 text-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{w.label || w.organization_id || "Personal"}</div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">
                        {w.role}{isPersonal ? " · personal" : ""}
                      </div>
                    </div>
                    {isActive && <Check size={13} className="mt-1 shrink-0 text-white" />}
                    {busy === key && !isActive && (
                      <span className="mt-1 text-[9px] text-zinc-500">…</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <div className="mt-1 flex items-start gap-1.5 rounded-lg border border-white/20 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-zinc-300" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
