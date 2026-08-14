import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Logo } from "@/components/PublicNav";
import PremiumSelect from "@/components/PremiumSelect";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/lib/api";

const GOOGLE_MARK_URL = "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";
const AUTH_BACKGROUND_URL = "/assets/okkax-concert-hero-v2.png";
const inputClass = "mt-1.5 h-10 w-full border border-zinc-700 bg-[#111111cc] px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[var(--okx-accent)]";

const ROLE_OPTIONS = [
  ["organizer", "Event Organizer"],
  ["promoter", "Promotor"],
  ["sponsor", "Sponsor"],
  ["tenant", "Tenant & Exhibitor"],
  ["talent_management", "Talent Management"],
  ["venue_manager", "Venue Management"],
  ["vendor", "Production Vendor"],
  ["worker", "Event Crew"],
  ["audience", "Attendee"],
  ["finance_approver", "Finance Approver"],
  ["supervisor", "Event Supervisor"],
];

const DEMO_ACCOUNTS = [
  ["organizer@okkax.id", "Penyelenggara"],
  ["sponsor@okkax.id", "Sponsor"],
  ["tenant@okkax.id", "Tenant"],
  ["audience@okkax.id", "Pengunjung"],
  ["supervisor@okkax.id", "Supervisor"],
];

function Shell({ title, subtitle, children }) {
  return (
    <div
      data-testid="auth-shell"
      className="okx-auth-shell relative h-[100dvh] overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${AUTH_BACKGROUND_URL})`, backgroundPosition: "78% center" }}
    >
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div className="relative grid h-full lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="hidden h-full flex-col justify-between border-r border-white/10 bg-black/25 p-8 backdrop-blur-[2px] lg:flex xl:p-10">
          <Logo />
          <div>
            <div className="mb-6 h-px w-14 bg-[var(--okx-accent)]" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">Live Event Operating Network</div>
            <h2 className="editorial mt-5 max-w-xl text-[clamp(2.8rem,5vw,5.4rem)] leading-[0.9] text-[#f5f0ed]">
              One event.<br /><span className="accent-text">Every moving part.</span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-6 text-zinc-300">
              Setiap pihak, proses, dan pembayaran di balik panggung bekerja sebagai satu pengalaman live yang utuh.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <span className="h-2 w-2 bg-[var(--okx-accent)]" /> Built for live operations
          </div>
        </aside>

        <main className="flex h-full min-h-0 items-center overflow-hidden bg-[#090909a8] px-5 py-4 backdrop-blur-md sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-[620px]">
            <div className="mb-5 lg:hidden"><Logo /></div>
            <div className="flex items-end justify-between gap-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">OKKAX Access</div>
                <h1 className="editorial mt-2 text-3xl text-[#f5f0ed] sm:text-4xl">{title}</h1>
                <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>
              </div>
              <Link to="/" className="hidden shrink-0 text-xs text-zinc-500 hover:text-white sm:block">Back to network</Link>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function GoogleButton({ mode, onClick }) {
  const isRegister = mode === "register";
  return (
    <button
      type="button"
      data-testid={isRegister ? "google-register-btn" : "google-login-btn"}
      onClick={onClick}
      className="mt-5 flex h-11 w-full items-center justify-center gap-3 border border-zinc-300 bg-white px-4 text-sm font-semibold text-[#141414] hover:bg-zinc-100"
    >
      <img src={GOOGLE_MARK_URL} alt="" aria-hidden="true" className="h-[18px] w-[18px]" />
      {isRegister ? "Daftar dengan Google" : "Masuk dengan Google"}
    </button>
  );
}

function Divider({ children }) {
  return (
    <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
      <span className="h-px flex-1 bg-zinc-800" /> {children} <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { login, loginWithGoogle, adoptSession } = useAuth();
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

  const loginAsPersona = async (label) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/demo/persona-login", { label });
      await adoptSession(data.token);
      toast.success(`Masuk sebagai ${label}`);
      nav(sp.get("next") || "/app");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Sign in" subtitle="Masuk ke OKKAX workspace Anda.">
      <GoogleButton mode="login" onClick={loginWithGoogle} />
      <Divider>atau email</Divider>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Email</span>
          <input
            data-testid="login-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
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
            className={inputClass}
          />
        </label>
        {error && <div data-testid="login-error" className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
        <button
          data-testid="login-submit-btn"
          disabled={busy}
          className="h-11 w-full bg-[var(--okx-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)] disabled:opacity-60"
        >
          {busy ? "Memproses…" : "Sign In"}
        </button>
        <div className="flex justify-between text-xs">
          <Link to="/forgot-password" className="text-zinc-400 underline">Lupa kata sandi?</Link>
          <Link to="/register" className="accent-text underline">Buat akun</Link>
        </div>
        <div className="border border-zinc-800 bg-black/30 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0 text-[11px] text-zinc-500">Akses cepat demo</div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {DEMO_ACCOUNTS.map(([emailAddress, persona]) => (
                <button
                  key={emailAddress}
                  type="button"
                  data-testid={`quickfill-${emailAddress.split("@")[0]}`}
                  disabled={busy}
                  onClick={() => loginAsPersona(persona)}
                  className="border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:border-[var(--okx-accent)]"
                >
                  {emailAddress.split("@")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </Shell>
  );
}

export function Register() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "organizer", organization_name: "",
    organization_type: "Corporate Brand", city: "Makassar", terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, loginWithGoogle } = useAuth();
  const nav = useNavigate();

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
    <Shell title="Build an Event" subtitle="Daftarkan akun dan organisasi Anda. Satu pengguna, satu peran operasional.">
      <GoogleButton mode="register" onClick={loginWithGoogle} />
      <Divider>atau isi formulir</Divider>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[["name", "Nama lengkap", "text"], ["email", "Email", "email"], ["password", "Kata sandi (min 6)", "password"], ["city", "Kota", "text"]].map(([key, label, type]) => (
            <label key={key} className="block min-w-0">
              <span className="block truncate text-xs uppercase tracking-wider text-zinc-500">{label}</span>
              <input
                data-testid={`register-${key}-input`}
                type={type}
                required={key !== "city"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="block truncate text-xs uppercase tracking-wider text-zinc-500">Nama organisasi (opsional)</span>
            <input
              data-testid="register-org-input"
              value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block min-w-0">
            <span className="block truncate text-xs uppercase tracking-wider text-zinc-500">Tipe organisasi</span>
            <PremiumSelect
              data-testid="register-orgtype-select"
              value={form.organization_type}
              onChange={(e) => setForm({ ...form, organization_type: e.target.value })}
              className="mt-1.5 w-full"
            >
              {["Corporate Brand", "Event Organizer", "Talent Management", "Venue", "Vendor", "Sponsor", "Tenant / UMKM", "Other"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </PremiumSelect>
          </label>
        </div>
        <label className="block">
          <span className="flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500">
            Peran utama <span className="normal-case tracking-normal text-zinc-600">1 akun = 1 peran</span>
          </span>
          <PremiumSelect
            data-testid="register-role-select"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="mt-1.5 w-full"
          >
            {ROLE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </PremiumSelect>
        </label>
        <label className="flex items-start gap-2 text-[11px] leading-4 text-zinc-400">
          <input
            data-testid="register-terms-checkbox"
            type="checkbox"
            checked={form.terms_accepted}
            onChange={(e) => setForm({ ...form, terms_accepted: e.target.checked })}
            className="mt-0.5 accent-[var(--okx-accent)]"
          />
          Saya menyetujui Terms of Service OKKAX dan telah membaca Privacy Notice. Data sensitif tidak ditampilkan publik.
        </label>
        {error && <div data-testid="register-error" className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
        <button
          data-testid="register-submit-btn"
          disabled={busy}
          className="h-11 w-full bg-[var(--okx-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)] disabled:opacity-60"
        >
          {busy ? "Memproses…" : "Buat akun"}
        </button>
        <div className="text-xs text-zinc-400">
          Sudah punya akun? <Link to="/login" className="accent-text underline">Sign in</Link>
        </div>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const request = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
      toast.success("Permintaan reset diterima.");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Shell title="Reset kata sandi" subtitle="Masukkan email akun OKKAX Anda.">
      {!submitted ? (
        <form onSubmit={request} className="mt-6 space-y-3">
          <input
            data-testid="forgot-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@domain.com"
            className={inputClass}
          />
          <button data-testid="forgot-submit-btn" className="h-11 w-full bg-[var(--okx-accent)] px-4 text-sm font-semibold">
            Kirim tautan reset
          </button>
        </form>
      ) : (
        <div className="mt-6 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4 text-sm text-zinc-300">
          Jika email terdaftar, instruksi reset akan dikirim. Token reset tidak pernah ditampilkan di aplikasi.
        </div>
      )}
      <Link to="/login" className="mt-4 inline-block text-sm text-zinc-400 underline">Kembali ke Sign in</Link>
    </Shell>
  );
}
