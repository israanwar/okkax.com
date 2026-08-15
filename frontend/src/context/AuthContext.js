import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  // Phase 01 UX. Workspace state mirrors the server session's
  // `active_workspace` context (backed by /me/workspaces and
  // /me/workspace/active). `workspaceVersion` is a monotonic counter
  // that pages depending on the current workspace can include in their
  // fetch dependencies to force a refetch after a switch, without any
  // page reload.
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const [{ data: list }, active] = await Promise.all([
        api.get("/me/workspaces"),
        api.get("/me/workspace/active").catch((err) => {
          // Backend returns 403 when a previously-activated workspace's
          // membership was revoked. Treat as "no active workspace"; the
          // /me/workspaces list still tells us what is available.
          if (err?.response?.status === 403) return { data: { workspace: null } };
          throw err;
        }),
      ]);
      setWorkspaces(list?.items || []);
      setActiveWorkspace(active?.data?.workspace || null);
    } catch {
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("okkax_token");
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setOrg(data.organization);
      await refreshWorkspaces();
    } catch {
      localStorage.removeItem("okkax_token");
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, [refreshWorkspaces]);

  const switchWorkspace = useCallback(async (payload) => {
    // Backend is authority. We forward the client's PROPOSED
    // organization_id + role; the server validates against active
    // memberships. If it rejects, we surface the error and DO NOT
    // mutate local state. On success we re-read /me/workspace/active
    // so the label reflects the server truth, and bump the version
    // counter so any workspace-scoped page (dashboard, /api/events)
    // re-fetches.
    const { data } = await api.post("/me/workspace/activate", payload);
    await refreshWorkspaces();
    setWorkspaceVersion((v) => v + 1);
    return data?.workspace || null;
  }, [refreshWorkspaces]);

  useEffect(() => {
    // CRITICAL: if returning from Google OAuth callback, skip /auth/me — AuthCallback exchanges session_id first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const adoptSession = async (token) => {
    localStorage.setItem("okkax_token", token);
    await refresh();
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const loginWithGoogle = () => {
    const redirectUrl = window.location.origin + "/app";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("okkax_token", data.token);
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("okkax_token", data.token);
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("okkax_token");
    setUser(false);
    setOrg(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setWorkspaceVersion((v) => v + 1);
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    const r = user.roles || [];
    if (r.includes("super_admin") || r.includes("platform_admin")) return true;
    return roles.some((x) => r.includes(x));
  };

  return (
    <AuthContext.Provider
      value={{
        user, org, loading, login, register, logout, refresh, hasRole,
        adoptSession, loginWithGoogle,
        workspaces, activeWorkspace, workspaceVersion,
        refreshWorkspaces, switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
