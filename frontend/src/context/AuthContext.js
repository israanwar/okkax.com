import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

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
    } catch {
      localStorage.removeItem("okkax_token");
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

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
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    const r = user.roles || [];
    if (r.includes("super_admin") || r.includes("platform_admin")) return true;
    return roles.some((x) => r.includes(x));
  };

  return (
    <AuthContext.Provider
      value={{ user, org, loading, login, register, logout, refresh, hasRole, adoptSession, loginWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
