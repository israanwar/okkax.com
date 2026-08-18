import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/PublicNav";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const { adoptSession } = useAuth();
  const done = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      nav("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await api.post("/auth/session", {}, { headers: { "X-Session-ID": sessionId } });
        await adoptSession(data.token);
        window.history.replaceState(null, "", "/app");
        nav("/app", { replace: true });
      } catch (e) {
        setError(apiError(e));
      }
    })();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--okx-bg)] p-8 text-center">
      <Logo />
      {error ? (
        <>
          <p data-testid="auth-callback-error" className="max-w-md text-sm text-zinc-300 font-medium">{error}</p>
          <a href="/login" className="accent-text underline">Kembali ke Sign in</a>
        </>
      ) : (
        <p data-testid="auth-callback-loading" className="text-sm text-zinc-400">Menghubungkan akun Google Anda ke OKKAX…</p>
      )}
    </div>
  );
}
