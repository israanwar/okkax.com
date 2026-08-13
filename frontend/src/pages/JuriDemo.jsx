import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Check, CircleDot, Map, ShieldAlert, Sparkles } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, apiError, compact, idr, num } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const FRAGMENTS = ["Brief", "Talent", "Rider", "Venue", "Vendor", "Sponsor", "Tenant", "Pekerja", "Ticketing", "Pembayaran", "Laporan keuangan"];

const STATUS_MAP = {
  live: ["Berfungsi", "border-white/45 bg-white/10 text-white"],
  sandbox: ["Simulasi Sandbox", "border-[var(--okx-accent)]/40 bg-[var(--okx-accent)]/10 text-[var(--okx-accent-soft)]"],
  roadmap: ["Roadmap", "border-zinc-600 bg-zinc-500/10 text-zinc-400"],
};

const CAPABILITIES = [
  ["Autentikasi, RBAC 15 peran, isolasi data organisasi", "live"],
  ["Event Studio, AI Event Blueprint, Event Graph", "live"],
  ["Structured Rider Engine & Landed Talent Cost", "live"],
  ["Venue compatibility, vendor matching, workforce", "live"],
  ["Sponsor Exchange & Tenant Exchange (approval → funding)", "live"],
  ["Budget engine, funding gap, break-even, what-if simulator", "live"],
  ["Ticketing, QR ticket, validasi, Economic Ripple", "live"],
  ["Dokumen PDF: invoice, quotation, payment schedule", "live"],
  ["Pembayaran VA, QRIS, e-wallet, kartu, retail, corporate", "sandbox"],
  ["Kartu via Stripe test mode (kartu uji 4242…)", "sandbox"],
  ["Milestone payment, split settlement, refund", "sandbox"],
  ["QR check-in pekerja & supervisor verification", "sandbox"],
  ["Notifikasi email nyata (in-app sudah berfungsi)", "roadmap"],
  ["Integrasi maskapai, hotel, logistik", "roadmap"],
  ["Payment gateway produksi & escrow berizin", "roadmap"],
];

export default function JuriDemo() {
  const nav = useNavigate();
  const { user, adoptSession } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(() => JSON.parse(localStorage.getItem("okkax_juri_steps") || "[]"));
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get("/demo/summary").then(({ data }) => setD(data)).catch((e) => setErr(apiError(e)));
  }, []);

  const mark = (key) => {
    const next = done.includes(key) ? done : [...done, key];
    setDone(next);
    localStorage.setItem("okkax_juri_steps", JSON.stringify(next));
  };

  const go = (key, path) => {
    mark(key);
    nav(path);
  };

  const asPersona = async (persona) => {
    setBusy(persona.email);
    try {
      const { data } = await api.post("/demo/persona-login", { label: persona.label });
      await adoptSession(data.token);
      toast.success(`Masuk sebagai ${persona.label}`);
      nav(persona.label === "Sponsor" ? "/app/sponsor" : persona.label === "Tenant" ? "/app/tenant" : "/app");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy("");
    }
  };

  if (err)
    return (
      <div className="min-h-screen bg-[var(--okx-bg)]">
        <PublicNav />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <p data-testid="juri-error" className="text-sm text-red-400">{err}</p>
          <Link to="/" className="mt-4 inline-block accent-text underline">Kembali ke beranda</Link>
        </div>
      </div>
    );
  if (!d)
    return (
      <div className="min-h-screen bg-[var(--okx-bg)]">
        <PublicNav />
        <div className="mx-auto max-w-3xl px-4 py-24 text-sm text-zinc-500" data-testid="juri-loading">Memuat angka demo…</div>
      </div>
    );

  const ev = d.event;
  const K = d.key_numbers;
  const N = d.network;
  const STEPS = [
    ["brief", "Buka Event Brief", `Brief ${ev.name}: ${ev.event_type}, ${ev.city}, kapasitas ${num(ev.capacity)}.`, `/app/events/${ev.id}/blueprint`],
    ["blueprint", "Lihat AI Blueprint", "Fase, workstream, requirement, risiko — berlabel Estimasi AI dan dapat diedit.", `/app/events/${ev.id}/blueprint`],
    ["graph", "Lihat Event Graph", "Satu Event ID menghubungkan seluruh komponen beserta statusnya.", `/app/events/${ev.id}/graph`],
    ["talent", "Periksa Talent dan Rider", `${N.talents} talent aktif, ${N.rider_items} item rider terstruktur, landed cost otomatis.`, `/app/events/${ev.id}/talent`],
    ["venue", "Periksa Venue dan Vendor", `Compatibility score venue + ${N.vendors} vendor produksi terkunci.`, `/app/events/${ev.id}/venue`],
    ["sponsor", "Lihat Sponsor", `${N.sponsor_commitments} komitmen sponsor senilai ${compact(N.sponsor_value)} mengurangi funding gap.`, `/app/events/${ev.id}/sponsors`],
    ["tenant", "Lihat Tenant", `${N.booths_occupied}/${N.booths_total} booth terisi, pendapatan tenant ${compact(N.tenant_revenue)}.`, `/app/events/${ev.id}/tenants`],
    ["budget", "Lihat Budget", `Funding gap ${compact(K.funding_gap)} dengan break-even ${num(N.break_even_tickets)} tiket.`, `/app/events/${ev.id}/budget`],
    ["buy", "Beli Tiket Sandbox", "Checkout VA, QRIS, e-wallet, retail, atau kartu Stripe test mode.", `/events/${ev.id}`],
    ["qr", "Lihat QR Ticket", `${num(N.tickets_sold)} tiket terjual dari ${num(N.ticket_capacity)} kuota.`, "/app/tickets"],
    ["validate", "Validasi Tiket", "Validasi pertama Valid, validasi kedua Already Used.", "/app/validator"],
    ["ripple", "Lihat Economic Ripple", `Aktivitas ekonomi ${compact(K.economic_activity)} dihitung dari data event.`, `/app/events/${ev.id}/ripple`],
  ];
  const progress = Math.round((done.filter((k) => STEPS.some(([s]) => s === k)).length / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />

      {/* progress */}
      <div className="sticky top-[57px] z-30 border-b border-[var(--okx-border)] bg-[#0a0a0aee] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5 sm:px-6">
          <span className="whitespace-nowrap text-[11px] uppercase tracking-widest text-zinc-500">Progres demo</span>
          <div className="h-1.5 flex-1 bg-[#27272a]">
            <div data-testid="juri-progress-bar" className="h-1.5 bg-[var(--okx-accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span data-testid="juri-progress-value" className="num text-xs text-zinc-300">{progress}%</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        {/* 1 & 2 narrative */}
        <section className="border-b border-[var(--okx-border)] py-14 sm:py-20">
          <span className="inline-block border border-[var(--okx-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] accent-text">
            Demo untuk Juri · 3 menit
          </span>
          <Link
            to="/present"
            data-testid="juri-present-top-btn"
            className="ml-2 inline-block border border-[var(--okx-border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 hover:border-[var(--okx-accent)] hover:accent-text"
          >
            Mode Presentasi
          </Link>
          <h1 className="editorial mt-6 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Industri event tidak kekurangan pihak.
            <br />
            <span className="accent-text">Yang hilang adalah satu sistem.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-sm text-zinc-300 sm:text-base">
            <strong className="text-white">Masalah utama.</strong> Brief, talent, rider, venue, vendor, sponsor,
            tenant, pekerja, ticketing, pembayaran, dan laporan keuangan masih berjalan di kanal yang terpisah —
            WhatsApp, spreadsheet, PDF, dan transfer manual. Satu perubahan kecil memaksa semua pihak
            menghitung ulang.
          </p>
          <div className="mt-6 flex flex-wrap gap-1.5" data-testid="juri-fragments">
            {FRAGMENTS.map((f) => (
              <span key={f} className="border border-[var(--okx-border)] px-2.5 py-1 text-xs text-zinc-500 line-through">{f}</span>
            ))}
          </div>
          <div className="mt-10 border-l-2 border-[var(--okx-accent)] pl-5">
            <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">Solusi OKKAX</h2>
            <p className="mt-3 max-w-2xl text-base text-white sm:text-lg">
              OKKAX mengubah satu brief menjadi satu Event Graph yang dapat dirancang, dibiayai,
              dipublikasikan, dijual, dioperasikan, dan diukur — di bawah satu Event ID.
            </p>
            <div className="num mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span className="accent-text">{ev.event_code}</span>
              <span>{ev.name}</span>
              <span>{ev.city} · {ev.start_date} → {ev.end_date}</span>
              <span>{ev.venue_name}</span>
            </div>
          </div>
        </section>

        {/* 3 key numbers */}
        <section className="border-b border-[var(--okx-border)] py-14">
          <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">
            Empat angka kunci — langsung dari database demo
          </h2>
          <div className="mt-6 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4" data-testid="juri-key-numbers">
            {[
              ["Total Event Cost", K.total_event_cost, "juri-total-cost"],
              ["Confirmed Funding", K.confirmed_funding, "juri-confirmed-funding"],
              ["Funding Gap", K.funding_gap, "juri-funding-gap"],
              ["Economic Activity", K.economic_activity, "juri-economic-activity"],
            ].map(([label, value, tid]) => (
              <div key={label} className="bg-[var(--okx-surface)] p-6">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
                <div data-testid={tid} className="num mt-2 text-2xl font-bold sm:text-3xl">{compact(value)}</div>
                <div className="num mt-1 text-[11px] text-zinc-600">{idr(value)}</div>
              </div>
            ))}
          </div>
          <div className="num mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>{N.talents} talent · {N.rider_items} item rider</span>
            <span>{N.vendors} vendor</span>
            <span>{N.booths_occupied}/{N.booths_total} booth</span>
            <span>{N.workforce_needed} kebutuhan pekerja</span>
            <span>{N.tickets_sold}/{N.ticket_capacity} tiket terjual</span>
            <span>Break-even {num(N.break_even_tickets)} tiket</span>
          </div>
        </section>

        {/* 5 personas */}
        <section className="border-b border-[var(--okx-border)] bg-[var(--okx-ivory)] py-12 text-[#0a0a0a] sm:px-8" style={{ marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
          <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-600 md:text-lg">Persona demo aman</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-700">
            Lima persona sandbox. Klik untuk masuk sekali klik — tidak perlu mengetik kata sandi. Persona ini hanya
            dapat mengakses data sandbox event demo dan tidak memiliki akses administrasi platform.
          </p>
          <div className="mt-6 divide-y divide-[#0a0a0a1a] border-y border-[#0a0a0a1a]" data-testid="juri-personas">
            {d.personas.map((p) => (
              <div key={p.email} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-zinc-600">{p.scope}</div>
                </div>
                <button
                  data-testid={`juri-persona-btn-${p.label.toLowerCase()}`}
                  disabled={busy === p.email}
                  onClick={() => asPersona(p)}
                  className="inline-flex items-center justify-center gap-2 bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--okx-accent)] disabled:opacity-60"
                >
                  {busy === p.email ? "Masuk…" : `Masuk sebagai ${p.label}`} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
          {user && (
            <p className="mt-4 text-xs text-zinc-600" data-testid="juri-current-user">
              Sedang masuk sebagai <strong>{user.name}</strong> ({user.email}). Setiap langkah di bawah akan membuka
              workspace dengan peran ini.
            </p>
          )}
        </section>

        {/* 4 guided steps */}
        <section className="border-b border-[var(--okx-border)] py-14">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">
              Alur demo terpandu — 12 langkah
            </h2>
            <button
              data-testid="juri-reset-progress-btn"
              onClick={() => {
                setDone([]);
                localStorage.removeItem("okkax_juri_steps");
              }}
              className="self-start text-xs text-zinc-500 underline sm:self-auto"
            >
              Reset progres
            </button>
          </div>
          {!user && (
            <p className="mt-3 flex items-start gap-2 text-xs text-[var(--okx-accent-soft)]">
              <ShieldAlert size={13} className="mt-0.5 shrink-0" />
              Pilih persona di atas terlebih dahulu agar setiap langkah terbuka tanpa halaman login.
            </p>
          )}
          <ol className="mt-6" data-testid="juri-steps">
            {STEPS.map(([key, title, body, path], i) => {
              const complete = done.includes(key);
              return (
                <li key={key} className="relative flex gap-4 pb-6 pl-1">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-bold ${
                        complete ? "border-[var(--okx-accent)] bg-[var(--okx-accent)] text-white" : "border-[var(--okx-border)] text-zinc-400"
                      }`}
                    >
                      {complete ? <Check size={14} /> : i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--okx-border)]" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 border-b border-[var(--okx-border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
                      <p className="num mt-0.5 text-xs text-zinc-400">{body}</p>
                    </div>
                    <button
                      data-testid={`juri-step-btn-${key}`}
                      onClick={() => go(key, path)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--okx-border)] px-4 py-2 text-xs font-semibold transition-colors hover:border-[var(--okx-accent)] hover:accent-text"
                    >
                      Buka langkah <ArrowRight size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4 text-xs text-zinc-400">
            <div className="flex items-center gap-2 text-zinc-300"><Sparkles size={14} className="accent-text" /> Tips validasi cepat</div>
            <p className="num mt-2">
              Kode QR contoh: <span className="text-zinc-200">{d.sample_qr}</span> · Kartu uji Stripe test mode:
              <span className="text-zinc-200"> 4242 4242 4242 4242</span>, exp 12/34, CVC 123.
            </p>
          </div>
        </section>

        {/* 6 status */}
        <section className="border-b border-[var(--okx-border)] py-14">
          <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">Penjelasan status fungsi</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.values(STATUS_MAP).map(([label, cls]) => (
              <span key={label} className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${cls}`}>
                <CircleDot size={12} /> {label}
              </span>
            ))}
          </div>
          <ul className="mt-6 divide-y divide-[var(--okx-border)] border-y border-[var(--okx-border)]" data-testid="juri-status-list">
            {CAPABILITIES.map(([label, state]) => {
              const [text, cls] = STATUS_MAP[state];
              return (
                <li key={label} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-zinc-200">{label}</span>
                  <span className={`inline-flex w-fit items-center gap-1.5 border px-2 py-0.5 text-[11px] ${cls}`}>{text}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 7 disclaimer */}
        <section className="py-12">
          <div className="border border-[var(--okx-accent)] bg-[#140700] p-5 text-xs leading-relaxed text-zinc-300" data-testid="juri-disclaimer">
            {d.disclaimer} Tidak ada uang nyata yang ditagihkan — seluruh pembayaran bersifat sandbox, termasuk
            Stripe test mode. Estimasi pajak memerlukan verifikasi profesional dan bukan nasihat pajak.
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/present" data-testid="juri-present-btn" className="inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-5 py-3 text-sm font-semibold">
              <Sparkles size={15} /> Mulai Presentasi (layar penuh, 8 scene)
            </Link>
            <Link to="/discover" data-testid="juri-discover-btn" className="inline-flex items-center justify-center gap-2 border border-[var(--okx-border)] px-5 py-3 text-sm font-semibold hover:border-[var(--okx-accent)]">
              <Map size={15} /> Explore Events
            </Link>
            <Link to={`/events/${ev.id}`} data-testid="juri-public-event-btn" className="inline-flex items-center justify-center border border-[var(--okx-border)] px-5 py-3 text-sm font-semibold hover:border-[var(--okx-accent)]">
              Halaman publik event demo
            </Link>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
