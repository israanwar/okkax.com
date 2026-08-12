import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Logo } from "@/components/PublicNav";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/lib/api";

const ROLE_OPTIONS = [
  ["organizer", "Organizer / Corporate Buyer"],
  ["event_organizer", "Event Organizer"],
  ["promoter", "Promotor"],
  ["sponsor", "Sponsor"],
  ["tenant", "Tenant / Exhibitor"],
  ["talent_management", "Talent Management"],
  ["venue_manager", "Venue Manager"],
  ["vendor", "Vendor"],
  ["worker", "Worker / Freelancer"],
  ["audience", "Audience / Ticket Buyer"],
  ["finance_approver", "Finance Approver"],
  ["supervisor", "Event Supervisor"],
];

const DEMO_ACCOUNTS = [
  ["admin@okkax.id", "Super Administrator"],
  ["organizer@okkax.id", "Organizer + Event Organizer"],
  ["sponsor@okkax.id", "Sponsor"],
  ["tenant@okkax.id", "Tenant"],
  ["audience@okkax.id", "Audience"],
  ["supervisor@okkax.id", "Event Supervisor"],
];

function Shell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between border-r border-[var(--okx-border)] bg-[#070707] p-10 lg:flex">
        <Logo />
        <div>
          <h2 className="editorial text-4xl leading-tight">One event.<br /><span className="accent-text">Every moving part.</span></h2>
          <p className="mt-4 max-w-sm text-sm text-zinc-400">
            OKKAX — The Event Economy Operating Network. Brief, blueprint, talent, venue, vendor, sponsor,
            tenant, tiket, pembayaran, operasi, dan dampak ekonomi dalam satu jaringan.
          </p>
        </div>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Akun demo</div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {DEMO_ACCOUNTS.map(([e, r]) => (
              <li key={e}><span className="text-zinc-200">{e}</span> — {r}</li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-zinc-500">Kata sandi semua akun demo: <span className="text-zinc-200">Okkax#2026</span></div>
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto w-full max-w-md">
          <h1 className="editorial mt-8 text-3xl sm:text-4xl lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      toast.success("Berhasil masuk ke OKKAX");
      nav(sp.get("next") || "/app");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Sign in" subtitle="Masuk ke OKKAX workspace Anda.">
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Email</span>
          <input
            data-testid="login-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Kata sandi</span>
          <input
            data-testid="login-password-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
          />
        </label>
        {error && <div data-testid="login-error" className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
        <button
          data-testid="login-submit-btn"
          disabled={busy}
          className="w-full bg-[var(--okx-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)] disabled:opacity-60"
        >
          {busy ? "Memproses…" : "Sign In"}
        </button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-zinc-400 underline">Lupa kata sandi?</Link>
          <Link to="/register" className="accent-text underline">Buat akun</Link>
        </div>
        <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-3">
          <div className="text-xs text-zinc-500">Akses cepat demo</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map(([e]) => (
              <button
                key={e}
                type="button"
                data-testid={`quickfill-${e.split("@")[0]}`}
                onClick={() => {
                  setEmail(e);
                  setPassword("Okkax#2026");
                }}
                className="border border-[var(--okx-border)] px-2 py-1 text-xs text-zinc-300 hover:border-[var(--okx-accent)]"
              >
                {e.split("@")[0]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Shell>
  );
}

export function Register() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", roles: ["organizer"], organization_name: "",
    organization_type: "Corporate Brand", city: "Makassar", terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register } = useAuth();
  const nav = useNavigate();

  const toggleRole = (r) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.terms_accepted) return setError("Anda harus menyetujui Terms dan Privacy Notice.");
    setBusy(true);
    setError("");
    try {
      await register(form);
      toast.success("Akun OKKAX dibuat");
      nav("/app");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Compile an Event" subtitle="Daftarkan akun dan organisasi Anda. Satu pengguna dapat memiliki beberapa peran.">
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {[["name", "Nama lengkap", "text"], ["email", "Email", "email"], ["password", "Kata sandi (min 6)", "password"], ["city", "Kota", "text"]].map(([k, label, type]) => (
            <label key={k} className="block">
              <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
              <input
                data-testid={`register-${k}-input`}
                type={type}
                required={k !== "city"}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
              />
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Nama organisasi (opsional)</span>
            <input
              data-testid="register-org-input"
              value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
              className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Tipe organisasi</span>
            <select
              data-testid="register-orgtype-select"
              value={form.organization_type}
              onChange={(e) => setForm({ ...form, organization_type: e.target.value })}
              className="mt-1 w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none"
            >
              {["Corporate Brand", "Event Organizer", "Talent Management", "Venue", "Vendor", "Sponsor", "Tenant / UMKM", "Other"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-500">Peran</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                data-testid={`register-role-${k}`}
                onClick={() => toggleRole(k)}
                className={`border px-3 py-1.5 text-xs ${form.roles.includes(k) ? "border-[var(--okx-accent)] bg-[var(--okx-accent)] text-white" : "border-[var(--okx-border)] text-zinc-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-zinc-400">
          <input
            data-testid="register-terms-checkbox"
            type="checkbox"
            checked={form.terms_accepted}
            onChange={(e) => setForm({ ...form, terms_accepted: e.target.checked })}
            className="mt-0.5"
          />
          Saya menyetujui Terms of Service OKKAX dan telah membaca Privacy Notice. Data sensitif tidak
          ditampilkan publik.
        </label>
        {error && <div data-testid="register-error" className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
        <button
          data-testid="register-submit-btn"
          disabled={busy}
          className="w-full bg-[var(--okx-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)] disabled:opacity-60"
        >
          {busy ? "Memproses…" : "Buat akun"}
        </button>
        <div className="text-sm text-zinc-400">
          Sudah punya akun? <Link to="/login" className="accent-text underline">Sign in</Link>
        </div>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState("request");
  const nav = useNavigate();

  const request = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setToken(data.demo_token || "");
      setStage("reset");
      toast.success("Tautan reset dibuat (mode demo menampilkan token).");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Kata sandi diperbarui. Silakan masuk.");
      nav("/login");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Shell title="Reset kata sandi" subtitle="Masukkan email akun OKKAX Anda.">
      {stage === "request" ? (
        <form onSubmit={request} className="mt-8 space-y-4">
          <input
            data-testid="forgot-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@domain.com"
            className="w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
          />
          <button data-testid="forgot-submit-btn" className="w-full bg-[var(--okx-accent)] px-4 py-3 text-sm font-semibold">
            Kirim tautan reset
          </button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-8 space-y-4">
          <input
            data-testid="reset-token-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token reset"
            className="w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none"
          />
          <input
            data-testid="reset-password-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kata sandi baru"
            className="w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none"
          />
          <button data-testid="reset-submit-btn" className="w-full bg-[var(--okx-accent)] px-4 py-3 text-sm font-semibold">
            Simpan kata sandi
          </button>
        </form>
      )}
      <Link to="/login" className="mt-4 inline-block text-sm text-zinc-400 underline">Kembali ke Sign in</Link>
    </Shell>
  );
}
