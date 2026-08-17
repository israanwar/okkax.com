import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Logo } from "@/components/PublicNav";
import PremiumSelect from "@/components/PremiumSelect";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/lib/api";
import { useCatalogCities } from "@/lib/cities";

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
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
      <div className="okx-aurora-field" data-testid="auth-aurora" aria-hidden="true">
        <div className="okx-aurora-blob" />
      </div>
      <div className="relative z-10 grid h-full lg:grid-cols-[0.92fr_1.08fr]">
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

// -----------------------------------------------------------------------------
// Password helpers.
//
// suggestStrongPassword: 14-char mix of upper, lower, digits, and safe symbols.
// scorePassword: 0..4 heuristic covering length + character class diversity.
// -----------------------------------------------------------------------------
const PWD_UPPER  = "ABCDEFGHJKLMNPQRSTUVWXYZ";  // no I/O to avoid look-alike
const PWD_LOWER  = "abcdefghjkmnpqrstuvwxyz";   // no i/l/o
const PWD_DIGIT  = "23456789";                   // no 0/1
const PWD_SYMBOL = "!@#$%&*?-";                  // no ambiguous glyphs

function pickRandom(source, count) {
  const arr = new Uint32Array(count);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < count; i++) out += source[arr[i] % source.length];
  return out;
}

function suggestStrongPassword() {
  // 4 required + 10 mixed = 14 chars total, then shuffled.
  const required =
    pickRandom(PWD_UPPER, 2) +
    pickRandom(PWD_LOWER, 4) +
    pickRandom(PWD_DIGIT, 4) +
    pickRandom(PWD_SYMBOL, 2);
  const chars = required.split("");
  // Fisher-Yates with crypto entropy.
  const rand = new Uint32Array(chars.length);
  crypto.getRandomValues(rand);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function scorePassword(pwd) {
  if (!pwd) return { score: 0, label: "" };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rx) => rx.test(pwd)).length;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (classes >= 4 && pwd.length >= 12) score = 4;
  const label = ["", "Lemah", "Cukup", "Kuat", "Sangat kuat"][score] || "";
  return { score, label };
}

function PasswordField({ testId, value, onChange, placeholder, autoComplete, showSuggestions = false }) {
  const [visible, setVisible] = useState(false);
  const { score, label } = useMemo(() => scorePassword(value), [value]);
  const strengthTone =
    score >= 4 ? "bg-emerald-400"
    : score === 3 ? "bg-lime-400"
    : score === 2 ? "bg-amber-400"
    : score === 1 ? "bg-orange-500"
    : "bg-zinc-800";
  const strengthText =
    score >= 4 ? "text-emerald-300"
    : score === 3 ? "text-lime-300"
    : score === 2 ? "text-amber-300"
    : score === 1 ? "text-orange-300"
    : "text-zinc-500";

  const generate = () => onChange({ target: { value: suggestStrongPassword() } });
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      toast.success("Kata sandi disalin ke clipboard");
    } catch {
      toast.error("Tidak bisa menyalin, silakan pilih dan salin manual");
    }
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div className="relative">
        <input
          data-testid={testId}
          type={visible ? "text" : "password"}
          required
          minLength={6}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClass} mt-0 pr-24`}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {showSuggestions && (
            <button
              type="button"
              onClick={generate}
              title="Sarankan kata sandi kuat"
              aria-label="Sarankan kata sandi kuat"
              data-testid={`${testId}-suggest`}
              className="rounded-none border border-zinc-700 bg-black/40 p-1.5 text-zinc-300 transition-colors hover:border-[var(--okx-accent)] hover:text-[var(--okx-accent-soft)]"
            >
              <RefreshCw size={13} strokeWidth={1.7} aria-hidden="true" />
            </button>
          )}
          {showSuggestions && value && (
            <button
              type="button"
              onClick={copy}
              title="Salin kata sandi"
              aria-label="Salin kata sandi"
              data-testid={`${testId}-copy`}
              className="rounded-none border border-zinc-700 bg-black/40 p-1.5 text-zinc-300 transition-colors hover:border-[var(--okx-accent)] hover:text-[var(--okx-accent-soft)]"
            >
              <Copy size={13} strokeWidth={1.7} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            title={visible ? "Sembunyikan" : "Tampilkan"}
            aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            data-testid={`${testId}-toggle`}
            className="rounded-none border border-zinc-700 bg-black/40 p-1.5 text-zinc-300 transition-colors hover:border-[var(--okx-accent)] hover:text-[var(--okx-accent-soft)]"
          >
            {visible ? <EyeOff size={13} strokeWidth={1.7} aria-hidden="true" /> : <Eye size={13} strokeWidth={1.7} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {showSuggestions && (
        <div className="flex items-center gap-2" data-testid={`${testId}-strength`}>
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 transition-colors ${i < score ? strengthTone : "bg-zinc-800"}`}
              />
            ))}
          </div>
          <span className={`min-w-[76px] text-right text-[10px] uppercase tracking-[0.14em] ${strengthText}`}>
            {label || "Belum diisi"}
          </span>
        </div>
      )}
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

// Field label with sentence-case (first word capitalised, rest lowercase),
// optional right-side hint. Replaces the previous ALL-CAPS pattern that made
// the register form feel shouty.
function FieldLabel({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="flex items-baseline justify-between gap-2 text-[13px] font-medium tracking-tight text-zinc-300">
        <span className="truncate">{label}</span>
        {hint && <span className="shrink-0 text-[11px] text-zinc-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Register() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "organizer", organization_name: "",
    organization_type: "Corporate Brand", city: "", terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, loginWithGoogle } = useAuth();
  const nav = useNavigate();
  const { cities, loading: citiesLoading } = useCatalogCities();

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldLabel label="Nama lengkap">
            <input
              data-testid="register-name-input"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama Anda"
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Email">
            <input
              data-testid="register-email-input"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="nama@email.com"
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Kata sandi (min 6)">
            <PasswordField
              testId="register-password-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
              showSuggestions
            />
          </FieldLabel>
          <FieldLabel label="Kota">
            <PremiumSelect
              data-testid="register-city-select"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder={citiesLoading ? "Memuat kota..." : "Pilih kota"}
              disabled={citiesLoading}
              className="mt-1.5 w-full"
            >
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </PremiumSelect>
          </FieldLabel>
          <FieldLabel label="Nama organisasi (opsional)">
            <input
              data-testid="register-org-input"
              value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
              placeholder="Nama organisasi Anda"
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Tipe organisasi">
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
          </FieldLabel>
        </div>
        <FieldLabel label="Peran utama" hint="1 akun = 1 peran">
          <PremiumSelect
            data-testid="register-role-select"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="mt-1.5 w-full"
          >
            {ROLE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </PremiumSelect>
        </FieldLabel>
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
