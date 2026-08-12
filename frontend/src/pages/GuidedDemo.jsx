import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { DEMO_EVENT_ID, DISCLAIMER } from "@/lib/api";

const STEPS = [
  ["Event Brief", "Brief Aruna Bold Live Experience 2026: product launch + music festival, Makassar, 2 hari, 2.000 pengunjung, anggaran Rp2.500.000.000.", `/app/events/${DEMO_EVENT_ID}/blueprint`],
  ["AI Event Blueprint", "AI Event Compiler menyusun fase, workstream, requirement, sponsor inventory, tenant zone, ticket recommendation, budget, dan risiko. Semua dapat diedit.", `/app/events/${DEMO_EVENT_ID}/blueprint`],
  ["Event Graph", "Satu Event ID menghubungkan seluruh node: talent, rider, venue, vendor, sponsor, tenant, workforce, ticket tier, budget, funding, risiko, payment.", `/app/events/${DEMO_EVENT_ID}/graph`],
  ["Talent", "Aksara Band dengan base fee Rp400.000.000 dan tim 18 orang dipilih dari talent network.", `/app/events/${DEMO_EVENT_ID}/talent`],
  ["Structured Rider", "Rider menjadi data terstruktur 17 kategori dengan status compatibility dan biaya. Landed Talent Cost dihitung otomatis.", `/app/events/${DEMO_EVENT_ID}/talent`],
  ["Venue Compatibility", "Makassar Convention Hall dengan skor kompatibilitas beserta penjelasan kapasitas, power, curfew, dan anggaran.", `/app/events/${DEMO_EVENT_ID}/venue`],
  ["Vendor & Workforce", "Vendor produksi dicocokkan dengan skor dan alasan. Event jobs dan pekerja dengan simulasi QR check-in.", `/app/events/${DEMO_EVENT_ID}/vendors`],
  ["Budget", "Total Event Cost, Confirmed Funding, Funding Gap, projected ticket revenue, dan break-even dihitung dari data event.", `/app/events/${DEMO_EVENT_ID}/budget`],
  ["Sponsor Commitment", "Sponsor mengajukan minat, organizer menyetujui, funding gap berkurang, milestone pembayaran dibuat.", `/app/events/${DEMO_EVENT_ID}/sponsors`],
  ["Tenant Application", "Tenant memilih booth, mengajukan aplikasi, organizer menyetujui, booth menjadi occupied dan tenant revenue bertambah.", `/app/events/${DEMO_EVENT_ID}/tenants`],
  ["Ticket Setup", "Early Bird, Regular, dan VIP dikonfigurasi lengkap dengan kuota, aturan refund, dan transfer.", `/app/events/${DEMO_EVENT_ID}/tickets`],
  ["Public Event", "Event dipublikasikan dan tampil di OKKAX Discover dengan indikator kesiapan faktual.", `/events/${DEMO_EVENT_ID}`],
  ["Sandbox Payment", "Checkout dengan Virtual Account, QRIS, e-wallet, kartu, atau retail outlet. Tidak ada uang nyata.", `/events/${DEMO_EVENT_ID}`],
  ["QR Ticket", "Nomor tiket dan QR unik diterbitkan, inventory tier berkurang, revenue organizer diperbarui.", "/app/tickets"],
  ["Ticket Validation", "Validasi pertama Valid, validasi kedua Already Used.", "/app/validator"],
  ["Economic Ripple", "Dampak ekonomi dihitung dari biaya, funding, GMV tiket, payout, jumlah bisnis, pekerja, dan room nights.", `/app/events/${DEMO_EVENT_ID}/ripple`],
];

export default function GuidedDemo() {
  const [i, setI] = useState(0);
  const [label, body, link] = STEPS[i];
  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="editorial text-3xl sm:text-4xl">Demo Terpandu OKKAX</h1>
          <Link to="/" data-testid="demo-exit-btn" className="inline-flex items-center gap-1.5 border border-[var(--okx-border)] px-3 py-2 text-xs">
            <X size={14} /> Exit Demo
          </Link>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          16 langkah dari brief hingga Economic Ripple. Masuk sebagai <span className="text-zinc-200">organizer@okkax.id</span> /
          <span className="text-zinc-200"> Okkax#2026</span> untuk mengikuti setiap langkah di workspace.
        </p>

        <div className="mt-8 flex gap-1">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              data-testid={`demo-dot-${idx}`}
              onClick={() => setI(idx)}
              className={`h-1.5 flex-1 transition-colors ${idx <= i ? "bg-[var(--okx-accent)]" : "bg-[#27272a]"}`}
              aria-label={`Langkah ${idx + 1}`}
            />
          ))}
        </div>

        <div className="mt-8 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-6 sm:p-10 fade-up" key={i}>
          <div className="num text-xs uppercase tracking-widest text-zinc-500">Langkah {i + 1} dari {STEPS.length}</div>
          <h2 className="editorial mt-2 text-2xl sm:text-3xl">{label}</h2>
          <p className="mt-4 text-sm text-zinc-300 sm:text-base">{body}</p>
          <Link to={link} data-testid="demo-open-step-btn" className="mt-6 inline-flex items-center gap-2 bg-[var(--okx-accent)] px-5 py-3 text-sm font-semibold">
            Buka langkah ini <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-6 flex justify-between">
          <button data-testid="demo-prev-btn" disabled={i === 0} onClick={() => setI(i - 1)} className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-4 py-2.5 text-sm disabled:opacity-40">
            <ArrowLeft size={15} /> Previous
          </button>
          <button data-testid="demo-next-btn" disabled={i === STEPS.length - 1} onClick={() => setI(i + 1)} className="inline-flex items-center gap-2 border border-[var(--okx-border)] px-4 py-2.5 text-sm disabled:opacity-40">
            Next <ArrowRight size={15} />
          </button>
        </div>

        <p className="mt-8 border border-[var(--okx-accent)] bg-[#140700] p-4 text-xs text-zinc-300">{DISCLAIMER}</p>
      </div>
      <Footer />
    </div>
  );
}
