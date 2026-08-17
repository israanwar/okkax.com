// Company and legal pages. One route per taxonomy entry:
//   /about, /how-it-works, /contact, /terms, /privacy
//
// Each renders as a lightweight but real content page so the header and
// footer links resolve to a genuine destination.

import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MessageSquare } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";

// ============================================================================
// About
// ============================================================================
export function About() {
  return (
    <Shell tagline="About OKKAX" title="Kami membangun operating network untuk live event.">
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
        OKKAX menyatukan brief, jaringan, jadwal, kontrak, ticketing, operasi, dan keuangan pada satu Event ID. Kami percaya industri event tidak kekurangan pihak yang kompeten. Yang hilang adalah satu sistem yang menghubungkan mereka.
      </p>
      <div className="mt-10 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-3">
        {[
          ["North Star", "Live event operating network untuk Indonesia dan regional."],
          ["Prinsip", "Satu concept, satu canonical name, satu clear destination."],
          ["Dampak", "Meningkatkan readiness, mengurangi risiko, dan memperjelas ekonomi event."],
        ].map(([t, b]) => (
          <div key={t} className="bg-[#0a0a0a] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">{t}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-200">{b}</p>
          </div>
        ))}
      </div>
      <ClosingCta primary={["Buka Demo", "/demo"]} secondary={["Discover Events", "/discover"]} />
    </Shell>
  );
}

// ============================================================================
// How It Works
// ============================================================================
export function HowItWorks() {
  const steps = [
    ["01", "Compile brief menjadi Event Blueprint", "Event Studio memvalidasi requirement, budget, dan risiko."],
    ["02", "Connect ke Network", "Talent, Venue, Vendor, Workforce, Sponsor, dan Tenant dicocokkan."],
    ["03", "Secure funding + compliance", "Commerce, Compliance, dan Protected Payment mengunci komitmen."],
    ["04", "Activate ticketing dan gate", "Ticket Studio dan LivePass menyiapkan inventory hingga validator."],
    ["05", "Operate hingga settlement", "Event Graph, Operations, Intelligence, dan Finance bekerja bersama."],
  ];
  return (
    <Shell tagline="How It Works" title="Lima chapter dari ide ke showtime.">
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
        Semua langkah berbagi satu Event ID. Perubahan pada satu node mengalir ke node lain dengan sebab dan akibat yang dapat dijelaskan.
      </p>
      <ol className="mt-10 divide-y divide-[var(--okx-border)] border-y border-[var(--okx-border)]">
        {steps.map(([ord, title, body]) => (
          <li key={ord} className="grid gap-3 py-5 sm:grid-cols-[80px_1fr]">
            <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--okx-accent)]">{ord}</span>
            <div>
              <div className="text-base font-semibold text-white">{title}</div>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <ClosingCta primary={["Buka Demo", "/demo"]} secondary={["Lihat Pricing", "/pricing"]} />
    </Shell>
  );
}

// ============================================================================
// Contact
// ============================================================================
export function Contact() {
  return (
    <Shell tagline="Contact" title="Kami mendengarkan. Selalu.">
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
        Kirim pertanyaan, umpan balik, atau permintaan kerja sama melalui saluran di bawah. Balasan biasanya dalam 1 hari kerja.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a
          href="mailto:hello@okkax.com"
          data-testid="contact-email"
          className="group flex items-start gap-4 border border-[var(--okx-border)] bg-[#0a0a0a] p-6 hover:border-[var(--okx-accent)]"
        >
          <Mail size={22} className="mt-1 shrink-0 text-[var(--okx-accent)]" aria-hidden="true" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Email</div>
            <div className="mt-1 text-base font-semibold text-white">hello@okkax.com</div>
            <div className="mt-1 text-xs text-zinc-500">Kerja sama, pertanyaan bisnis, dukungan.</div>
          </div>
        </a>
        <a
          href="https://wa.me/6282189594190"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="contact-whatsapp"
          className="group flex items-start gap-4 border border-[var(--okx-border)] bg-[#0a0a0a] p-6 hover:border-[var(--okx-accent)]"
        >
          <MessageSquare size={22} className="mt-1 shrink-0 text-[var(--okx-accent)]" aria-hidden="true" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Chat</div>
            <div className="mt-1 text-base font-semibold text-white">WhatsApp</div>
            <div className="mt-1 text-xs text-zinc-500">Untuk balasan cepat pada jam kerja.</div>
          </div>
        </a>
      </div>
      <ClosingCta primary={["Buka Demo", "/demo"]} secondary={["Discover Events", "/discover"]} />
    </Shell>
  );
}

// ============================================================================
// Terms & Conditions
// ============================================================================
export function Terms() {
  return (
    <Shell tagline="Legal" title="Terms & Conditions">
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
        Ringkasan berikut menjelaskan aturan utama penggunaan OKKAX. Terms lengkap akan diterbitkan pada versi rilis publik dan mengikat sejak akun dibuat.
      </p>
      <div className="mt-10 space-y-6 text-sm leading-6 text-zinc-300">
        {[
          ["Layanan", "OKKAX adalah operating network untuk industri live event. Fitur, kapasitas, dan integrasi dapat berbeda per subscription tier."],
          ["Akun", "Pengguna wajib menjaga keamanan kredensial dan bertanggung jawab atas aktivitas yang berjalan di akunnya."],
          ["Konten", "Setiap organisasi memegang kendali atas data privat event dan tidak akan dibagikan tanpa izin eksplisit atau kewajiban hukum."],
          ["Pembayaran", "Pada mode demo semua pembayaran bersifat sandbox. Pada mode produksi, biaya subscription dan ticketing tunduk pada Pricing yang berlaku."],
          ["Batas Tanggung Jawab", "OKKAX menyediakan platform. Keputusan operasional dan komersial tetap di tangan organisasi pengguna."],
        ].map(([t, b]) => (
          <div key={t}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--okx-accent-soft)]">{t}</div>
            <p className="mt-2 text-zinc-300">{b}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-[11px] text-zinc-500">
        Dokumen ini adalah ringkasan operasional untuk mode demo dan bukan pengganti terms lengkap versi rilis.
      </div>
      <ClosingCta primary={["Baca Privacy Policy", "/privacy"]} secondary={["Hubungi Kami", "/contact"]} />
    </Shell>
  );
}

// ============================================================================
// Privacy Policy
// ============================================================================
export function Privacy() {
  return (
    <Shell tagline="Legal" title="Privacy Policy">
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
        Kami memperlakukan data pengguna sebagai kepercayaan. Ringkasan di bawah menjelaskan praktik utama; kebijakan lengkap akan diterbitkan pada versi rilis publik.
      </p>
      <div className="mt-10 space-y-6 text-sm leading-6 text-zinc-300">
        {[
          ["Data yang dikumpulkan", "Data akun, workspace, event, transaksi, dan interaksi yang diperlukan untuk mengoperasikan layanan."],
          ["Basis pemrosesan", "Persetujuan pengguna, pelaksanaan kontrak, kepentingan sah operasional, dan kewajiban hukum."],
          ["Isolasi tenant", "Data privat organisasi dipisahkan per tenant. Cross-organization access dilindungi otorisasi ketat."],
          ["Retensi", "Data dipertahankan selama akun aktif dan sesuai kebutuhan audit atau kewajiban hukum yang berlaku."],
          ["Keamanan", "Kontrol akses berbasis peran, audit trail, isolasi sesi, dan verifikasi sensitif untuk aksi berisiko tinggi."],
          ["Hak pengguna", "Akses, koreksi, penghapusan, dan portabilitas data sesuai jurisdiksi yang berlaku."],
        ].map(([t, b]) => (
          <div key={t}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--okx-accent-soft)]">{t}</div>
            <p className="mt-2 text-zinc-300">{b}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-[11px] text-zinc-500">
        Dokumen ini adalah ringkasan untuk mode demo dan bukan pengganti kebijakan privasi versi rilis.
      </div>
      <ClosingCta primary={["Baca Terms", "/terms"]} secondary={["Hubungi Kami", "/contact"]} />
    </Shell>
  );
}

// ============================================================================
// Shared shell + closing CTA
// ============================================================================
function Shell({ tagline, title, children }) {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <PublicNav />
      <main data-testid={"company-" + tagline.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="mx-auto max-w-4xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent-soft)]">
          {tagline}
        </div>
        <h1 className="editorial mt-6 max-w-3xl text-[clamp(2.2rem,5vw,4.2rem)] leading-[1.0] text-[#f4efec]">
          {title}
        </h1>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function ClosingCta({ primary, secondary }) {
  return (
    <div className="mt-14 flex flex-col gap-3 border-t border-[var(--okx-border)] pt-8 sm:flex-row">
      {primary && (
        <Link
          to={primary[1]}
          data-testid="company-cta-primary"
          className="group inline-flex items-center justify-between gap-2 bg-[var(--okx-accent)] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]"
        >
          {primary[0]}
          <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
      {secondary && (
        <Link
          to={secondary[1]}
          data-testid="company-cta-secondary"
          className="group inline-flex items-center justify-between gap-2 border border-zinc-700 px-5 py-3.5 text-sm font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
        >
          {secondary[0]}
          <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
