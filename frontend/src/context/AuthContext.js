import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  const refreshPromiseRef = useRef(null);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const [{ data: list }, active] = await Promise.all([
        api.get("/me/workspaces"),
        api.get("/me/workspace/active").catch((err) => {
          if (err?.response?.status === 403) return { data: { workspace: null } };
          throw err;
        }),
      ]);
      const items = list?.items || [];
      let resolvedActive = active?.data?.workspace || null;

      if (!resolvedActive) {
        const organizationWorkspaces = items.filter(
          (w) => w.organization_id != null
        );
        const personalWorkspace = items.find(
          (w) => w.organization_id == null
        );

        let defaultWorkspace = null;

        if (organizationWorkspaces.length === 1) {
          defaultWorkspace = organizationWorkspaces[0];
        } else if (
          organizationWorkspaces.length === 0 &&
          personalWorkspace
        ) {
          defaultWorkspace = personalWorkspace;
        }

        if (defaultWorkspace) {
          try {
            const { data: activated } = await api.post(
              "/me/workspace/activate",
              {
                organization_id: defaultWorkspace.organization_id ?? null,
                role: defaultWorkspace.role,
              }
            );
            resolvedActive = activated?.workspace || null;
          } catch {
            resolvedActive = null;
          }
        }
      }

      setWorkspaces(items);
      setActiveWorkspace(resolvedActive);
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
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
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
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
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

  // Active workspace adalah execution context frontend.
  // Account roles tetap identitas global, bukan authority workspace.
  const accountRoles = user?.roles || [];
  const isPlatformAdmin =
    accountRoles.includes("super_admin") ||
    accountRoles.includes("platform_admin");

  const effectiveRole =
    activeWorkspace?.role ||
    (isPlatformAdmin ? accountRoles[0] : "audience");

  const effectiveWorkspaceKind =
    activeWorkspace?.kind || (activeWorkspace ? "organization" : null);

  const hasRole = (...roles) => {
    if (!user) return false;
    if (isPlatformAdmin) return true;
    return roles.includes(effectiveRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user, org, loading, login, register, logout, refresh, hasRole,
        adoptSession, loginWithGoogle,
        workspaces, activeWorkspace, workspaceVersion,
        effectiveRole, effectiveWorkspaceKind,
        refreshWorkspaces, switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
