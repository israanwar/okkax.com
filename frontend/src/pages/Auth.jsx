import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw, Sparkles, Shield, UserCheck, Check } from "lucide-react";
import { Logo } from "@/components/PublicNav";
import PremiumSelect from "@/components/PremiumSelect";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/lib/api";
import { useCatalogCities } from "@/lib/cities";

const GOOGLE_MARK_URL = "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";
const AUTH_BACKGROUND_URL = "/assets/okkax-concert-hero-v2.png";
const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-zinc-800 bg-[#121216] px-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 transition-all duration-200 hover:border-zinc-700 focus:border-[var(--okx-accent)] focus:ring-1 focus:ring-[var(--okx-accent)]/40 font-gemini";

const ROLE_OPTIONS = [
  ["organizer", "Organizer"],
  ["promoter", "Promotor"],
  ["sponsor", "Sponsor"],
  ["tenant", "Tenant"],
  ["talent_management", "Talent"],
  ["vendor", "Vendor"],
  ["worker", "Workforce"],
  ["audience", "Audience"],
  ["venue_manager", "Venue"],
  ["finance_approver", "Finance"],
];

const DEMO_ACCOUNTS = [
  { key: "organizer", label: "Organizer", roleName: "Organizer", email: "organizer@okkax.id", defaultNext: "/app" },
  { key: "promotor", label: "Promotor", roleName: "Promotor", email: "organizer@okkax.id", defaultNext: "/app/events" },
  { key: "sponsor", label: "Sponsor", roleName: "Sponsor", email: "sponsor@okkax.id", defaultNext: "/app/sponsor" },
  { key: "tenant", label: "Tenant", roleName: "Tenant", email: "tenant@okkax.id", defaultNext: "/app/tenant" },
  { key: "audience", label: "Audience", roleName: "Audience", email: "audience@okkax.id", defaultNext: "/app/tickets" },
  { key: "talent", label: "Talent", roleName: "Talent", email: "talent@okkax.id", defaultNext: "/app/me" },
  { key: "vendor", label: "Vendor", roleName: "Vendor", email: "vendor@okkax.id", defaultNext: "/app/me" },
  { key: "workforce", label: "Workforce", roleName: "Workforce", email: "worker@okkax.id", defaultNext: "/app/me" },
];

function Shell({ title, subtitle, children }) {
  return (
    <div
      data-testid="auth-shell"
      className="okx-auth-shell relative min-h-[100dvh] w-full overflow-y-auto bg-black font-gemini"
    >
      {/* High-Precision Blueprint Dot Matrix Grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-100 stitch-grid-canvas"
        style={{
          backgroundImage: "radial-gradient(circle at center, rgba(255, 255, 255, 0.18) 1.25px, transparent 1.25px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 grid min-h-[100dvh] lg:grid-cols-[0.88fr_1.12fr]">
        {/* Left Branding Column */}
        <aside className="hidden h-full flex-col justify-between border-r border-white/10 bg-black/40 p-8 backdrop-blur-md lg:flex xl:p-12">
          <Logo />
          <div>
            <div className="mb-6 h-px w-14 bg-[var(--okx-accent)] shadow-[0_0_12px_var(--okx-accent)]" />
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
              <Sparkles size={13} className="text-[var(--okx-accent)]" />
              <span>Live Event Operating Network</span>
            </div>
            <h2 className="editorial mt-5 max-w-xl text-[clamp(2.8rem,4.5vw,5.2rem)] leading-[0.92] text-[#f5f0ed]">
              One event.<br /><span className="accent-text">Every moving part.</span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-300">
              Setiap talent, vendor, tiket, panggung, dan pembayaran di balik layar bekerja sebagai satu kesatuan pengalaman live.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-2.5 max-w-md">
              {[
                "Event Blueprint Compiler",
                "15+ Kota Verified Network",
                "Anti-Scalp Dynamic LivePass",
                "OKKAX Copilot Intelligence",
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--okx-accent)] shrink-0" />
                  <span className="truncate">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-[var(--okx-accent)] shadow-[0_0_8px_var(--okx-accent)]" /> Built for live operations • 15+ Kota
          </div>
        </aside>

        {/* Right Form Column */}
        <main className="flex min-h-full items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[580px] rounded-2xl border border-zinc-800/80 bg-[#0d0d12]/95 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
            <div className="mb-6 lg:hidden flex justify-between items-center">
              <Logo />
              <Link to="/" className="text-xs text-zinc-400 hover:text-white">← Kembali</Link>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">OKKAX Access</div>
                <h1 className="editorial mt-1.5 text-2xl sm:text-3xl text-[#f5f0ed]">{title}</h1>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400">{subtitle}</p>
              </div>
              <Link to="/" className="hidden shrink-0 text-xs font-medium text-zinc-400 hover:text-white transition-colors sm:block">
                Back to network →
              </Link>
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
      className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-zinc-800 bg-[#141419] px-4 text-sm font-semibold text-zinc-100 shadow-sm transition-all duration-200 hover:border-zinc-600 hover:bg-[#1a1a22] active:scale-[0.99]"
    >
      <img src={GOOGLE_MARK_URL} alt="" aria-hidden="true" className="h-[18px] w-[18px]" />
      {isRegister ? "Daftar dengan Google" : "Masuk dengan Google"}
    </button>
  );
}

function Divider({ children }) {
  return (
    <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
      <span className="h-px flex-1 bg-zinc-800" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Password helpers.
// -----------------------------------------------------------------------------
const PWD_UPPER  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PWD_LOWER  = "abcdefghjkmnpqrstuvwxyz";
const PWD_DIGIT  = "23456789";
const PWD_SYMBOL = "!@#$%&*?-";

function pickRandom(source, count) {
  const arr = new Uint32Array(count);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < count; i++) out += source[arr[i] % source.length];
  return out;
}

function suggestStrongPassword() {
  const required =
    pickRandom(PWD_UPPER, 2) +
    pickRandom(PWD_LOWER, 4) +
    pickRandom(PWD_DIGIT, 4) +
    pickRandom(PWD_SYMBOL, 2);
  const chars = required.split("");
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
    score >= 4 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
    : score === 3 ? "bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.5)]"
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
    <div className="mt-1.5 flex flex-col gap-1.5 font-gemini">
      <div className="relative flex items-center">
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
        <div className="absolute right-1.5 flex items-center gap-1">
          {showSuggestions && (
            <button
              type="button"
              onClick={generate}
              title="Sarankan kata sandi kuat"
              aria-label="Sarankan kata sandi kuat"
              data-testid={`${testId}-suggest`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-[var(--okx-accent)] hover:text-[var(--okx-accent-soft)] transition-colors"
            >
              <RefreshCw size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          {showSuggestions && value && (
            <button
              type="button"
              onClick={copy}
              title="Salin kata sandi"
              aria-label="Salin kata sandi"
              data-testid={`${testId}-copy`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-[var(--okx-accent)] hover:text-[var(--okx-accent-soft)] transition-colors"
            >
              <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            title={visible ? "Sembunyikan" : "Tampilkan"}
            aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            data-testid={`${testId}-toggle`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors"
          >
            {visible ? <EyeOff size={13} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={13} strokeWidth={1.8} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {showSuggestions && (
        <div className="flex items-center gap-2 pt-0.5" data-testid={`${testId}-strength`}>
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < score ? strengthTone : "bg-zinc-800/80"}`}
              />
            ))}
          </div>
          <span className={`min-w-[76px] text-right text-[10px] font-bold uppercase tracking-[0.14em] ${strengthText}`}>
            {label || "Belum diisi"}
          </span>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ label, hint, children }) {
  return (
    <div className="flex flex-col min-w-0 font-gemini">
      <div className="flex h-5 items-center justify-between gap-2 text-[12px] font-medium tracking-tight text-zinc-300">
        <span className="truncate">{label}</span>
        {hint && <span className="shrink-0 text-[10px] text-zinc-500 uppercase tracking-wider">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Login() {
  const [sp] = useSearchParams();
  const rawRoleParam = (sp.get("role") || sp.get("persona") || "").toLowerCase().trim();

  // Normalize role key aliases:
  const targetRole = useMemo(() => {
    if (!rawRoleParam) return null;
    if (rawRoleParam.startsWith("organiz")) return "organizer";
    if (rawRoleParam.startsWith("promot")) return "promotor";
    if (rawRoleParam.startsWith("spons")) return "sponsor";
    if (rawRoleParam.startsWith("tenan")) return "tenant";
    if (rawRoleParam.startsWith("audien")) return "audience";
    if (rawRoleParam.startsWith("talen")) return "talent";
    if (rawRoleParam.startsWith("vendor")) return "vendor";
    if (rawRoleParam.startsWith("work") || rawRoleParam === "crew") return "workforce";
    return rawRoleParam;
  }, [rawRoleParam]);

  // Filter demo accounts: If a specific role is passed, ONLY that role is visible; others are hidden!
  const visibleDemoAccounts = useMemo(() => {
    if (!targetRole) return DEMO_ACCOUNTS;
    const filtered = DEMO_ACCOUNTS.filter(
      (a) => a.key === targetRole || a.roleName.toLowerCase() === targetRole || a.label.toLowerCase() === targetRole
    );
    return filtered.length > 0 ? filtered : DEMO_ACCOUNTS;
  }, [targetRole]);

  const matchingPersona = visibleDemoAccounts.length === 1 ? visibleDemoAccounts[0] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { login, loginWithGoogle, adoptSession } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      toast.success("Berhasil masuk ke OKKAX");
      nav(sp.get("next") || (matchingPersona ? matchingPersona.defaultNext : "/app"));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const loginAsPersona = async (item) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/demo/persona-login", { label: item.key || item.label });
      await adoptSession(data.token);
      toast.success(`Masuk langsung sebagai ${item.roleName || item.label}`);
      nav(sp.get("next") || item.defaultNext || "/app");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Sign in"
      subtitle={matchingPersona ? `Masuk ke OKKAX workspace ${matchingPersona.roleName} Anda.` : "Masuk ke OKKAX workspace Anda."}
    >
      <GoogleButton mode="login" onClick={loginWithGoogle} />
      <Divider>atau email</Divider>

      <form onSubmit={submit} className="space-y-3.5">
        <FieldLabel label="Email">
          <input
            data-testid="login-email-input"
            type="email"
            required
            autoComplete="email"
            placeholder={matchingPersona ? matchingPersona.email : "nama@domain.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </FieldLabel>

        <FieldLabel label="Kata sandi">
          <PasswordField
            testId="login-password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan kata sandi"
            autoComplete="current-password"
          />
        </FieldLabel>

        {error && (
          <div data-testid="login-error" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          data-testid="login-submit-btn"
          disabled={busy}
          className="h-[52px] w-full rounded-xl bg-white hover:bg-zinc-200 text-black px-5 text-[15px] font-bold tracking-wide transition-all duration-200 shadow-[0_4px_24px_rgba(255,255,255,0.15)] disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 font-gemini cursor-pointer"
        >
          {busy ? "Memproses…" : "Sign In"}
        </button>

        <div className="flex justify-between text-xs pt-1">
          <Link to="/forgot-password" className="text-zinc-400 hover:text-white transition-colors">
            Lupa kata sandi?
          </Link>
          <Link
            to={targetRole ? `/register?role=${targetRole}` : "/register"}
            className="text-[var(--okx-accent-soft)] hover:underline font-semibold"
          >
            Belum punya akun? Buat akun →
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800/90 bg-black/40 p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <UserCheck size={13} className="text-[var(--okx-accent)]" />
              <span>
                {matchingPersona ? `Akses Cepat Demo Persona (${matchingPersona.roleName})` : "Akses Cepat Demo Persona"}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500">1-Klik Sign In</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleDemoAccounts.map((item) => (
              <button
                key={item.key}
                type="button"
                data-testid={`quickfill-${item.key}`}
                disabled={busy}
                onClick={() => loginAsPersona(item)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5 ${
                  matchingPersona
                    ? "border-[var(--okx-accent)] bg-[var(--okx-accent)]/15 text-white shadow-[0_0_12px_rgba(255,46,126,0.35)]"
                    : "border-zinc-800 bg-[#141418] text-zinc-300 hover:border-[var(--okx-accent)] hover:text-white hover:bg-[var(--okx-accent)]/10"
                }`}
              >
                <span>{matchingPersona ? `1-Klik Masuk sebagai ${item.roleName}` : item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Shell>
  );
}

export function Register() {
  const [sp] = useSearchParams();
  const rawRoleParam = (sp.get("role") || sp.get("persona") || "").toLowerCase().trim();

  const initialRole = useMemo(() => {
    if (rawRoleParam.startsWith("talent")) return "talent_management";
    if (rawRoleParam.startsWith("promot")) return "promoter";
    if (rawRoleParam.startsWith("spons")) return "sponsor";
    if (rawRoleParam.startsWith("tenan")) return "tenant";
    if (rawRoleParam.startsWith("audien") || rawRoleParam === "pengunjung") return "audience";
    if (rawRoleParam.startsWith("organiz")) return "organizer";
    return "organizer";
  }, [rawRoleParam]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: initialRole,
    organization_name: "",
    organization_type: "Corporate Brand",
    city: "Jakarta",
    terms_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, loginWithGoogle } = useAuth();
  const nav = useNavigate();
  const { cities } = useCatalogCities();

  const submit = async (e) => {
    e.preventDefault();
    if (!form.terms_accepted) return setError("Anda harus menyetujui Terms dan Privacy Notice.");
    setBusy(true);
    setError("");
    try {
      await register(form);
      toast.success("Akun OKKAX berhasil dibuat");
      nav("/app");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Build an Event"
      subtitle="Daftarkan akun dan organisasi Anda. Satu pengguna, satu peran operasional."
    >
      <GoogleButton mode="register" onClick={loginWithGoogle} />
      <Divider>atau isi formulir</Divider>

      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Row 1: Nama & Email */}
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

          {/* Row 2: Nama Organisasi & Tipe Organisasi */}
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

          {/* Row 3: Kota Operasional & Peran Utama */}
          <FieldLabel label="Kota operasional">
            <PremiumSelect
              data-testid="register-city-select"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Pilih kota"
              className="mt-1.5 w-full"
            >
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </PremiumSelect>
          </FieldLabel>

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
        </div>

        {/* Row 4: Kata Sandi Full-Width */}
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

        {/* Terms and conditions */}
        <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer pt-1">
          <input
            data-testid="register-terms-checkbox"
            type="checkbox"
            checked={form.terms_accepted}
            onChange={(e) => setForm({ ...form, terms_accepted: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-[var(--okx-accent)] accent-[var(--okx-accent)] shrink-0"
          />
          <span className="leading-snug">
            Saya menyetujui <span className="text-zinc-200">Terms of Service</span> OKKAX dan telah membaca <span className="text-zinc-200">Privacy Notice</span>. Data sensitif tidak ditampilkan publik.
          </span>
        </label>

        {error && (
          <div data-testid="register-error" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          data-testid="register-submit-btn"
          disabled={busy}
          className="h-[52px] w-full rounded-xl bg-white hover:bg-zinc-200 text-black px-5 text-[15px] font-bold tracking-wide transition-all duration-200 shadow-[0_4px_24px_rgba(255,255,255,0.15)] disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 font-gemini cursor-pointer"
        >
          {busy ? "Memproses…" : "Buat Akun"}
        </button>

        <div className="text-center text-xs text-zinc-400 pt-2">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-[var(--okx-accent-soft)] hover:underline font-semibold">
            Sign in di sini →
          </Link>
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
        <form onSubmit={request} className="mt-6 space-y-4">
          <FieldLabel label="Email Terdaftar">
            <input
              data-testid="forgot-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domain.com"
              className={inputClass}
            />
          </FieldLabel>
          <button
            data-testid="forgot-submit-btn"
            className="h-[52px] w-full rounded-xl bg-white hover:bg-zinc-200 text-black px-5 text-[15px] font-bold tracking-wide transition-all duration-200 shadow-[0_4px_24px_rgba(255,255,255,0.15)] active:scale-[0.99] flex items-center justify-center font-gemini cursor-pointer"
          >
            Kirim Tautan Reset
          </button>
        </form>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-[#121216] p-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          Jika email terdaftar di sistem kami, instruksi reset akan dikirimkan. Token reset tidak pernah ditampilkan langsung di aplikasi demi keamanan.
        </div>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-xs text-zinc-400 hover:text-white underline">
          Kembali ke Sign in
        </Link>
      </div>
    </Shell>
  );
}
