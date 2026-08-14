import PublicNav, { Footer } from "@/components/PublicNav";
import { Link, useParams } from "react-router-dom";

const CONTENT = {
  organizers: {
    title: "For Organizers",
    lead: "Ubah satu brief menjadi event yang dapat dieksekusi, dibiayai, dijual, dioperasikan, dan diukur.",
    points: [
      ["Event Studio", "Guided brief dengan autosave, validasi, dan preview sebelum dikompilasi."],
      ["Blueprint Engine", "Blueprint berisi fase, workstream, requirement, sponsor inventory, tenant zone, ticket recommendation, budget, dan risiko — semua dapat diedit."],
      ["Event Graph", "Setiap komponen terhubung pada satu Event ID dengan status Draft, Pending, Confirmed, Missing, Conflicted, At Risk, Blocked."],
      ["Budget Engine", "Total Event Cost, Confirmed Funding, Funding Gap, projected ticket revenue, dan break-even dihitung otomatis."],
      ["Command Center", "Countdown, readiness, milestone, run of show, incident, dan aktivitas terbaru."],
    ],
    cta: ["Build an Event", "/register"],
  },
  sponsors: {
    title: "For Sponsors",
    lead: "Temukan event yang cocok dengan brand Anda, lihat inventory, dan kunci komitmen secara terukur.",
    points: [
      ["Discovery", "Cari event berdasarkan kota, kategori, kapasitas, audiens, organizer, dan talent."],
      ["Sponsor Inventory", "Naming rights, presenting, main, supporting, category partner, booth activation, LED exposure, VIP hospitality."],
      ["Alur transparan", "Express interest → negotiation → approval → commitment → payment schedule → deliverable tracking."],
      ["Dampak terukur", "Komitmen yang disetujui langsung mengurangi funding gap event dan tercatat pada Event Graph."],
    ],
    cta: ["Masuk sebagai Sponsor", "/login"],
  },
  tenants: {
    title: "For Tenants",
    lead: "Pilih booth pada event yang tepat, ajukan aplikasi, dan kelola operasional hari-H.",
    points: [
      ["Booth marketplace", "Zona tenant dengan kode booth, ukuran, harga, deposit, kapasitas listrik, dan posisi."],
      ["Compatibility check", "Deteksi sponsor conflict, duplikasi kategori, kapasitas listrik, dan kebutuhan food safety."],
      ["Alur aplikasi", "Apply → review organizer → approval → payment schedule → reserved → check-in → completion."],
      ["Kontribusi funding", "Pendapatan booth yang terkonfirmasi memperkuat funding event."],
    ],
    cta: ["Masuk sebagai Tenant", "/login"],
  },
};

export default function ForPage() {
  const { audience } = useParams();
  const c = CONTENT[audience] || CONTENT.organizers;
  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="editorial text-4xl sm:text-6xl">{c.title}</h1>
        <p className="mt-5 max-w-2xl text-base text-zinc-300 sm:text-lg">{c.lead}</p>
        <div className="mt-12 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2">
          {c.points.map(([t, b]) => (
            <div key={t} className="bg-[var(--okx-surface)] p-6">
              <h2 className="text-base font-semibold md:text-lg">{t}</h2>
              <p className="mt-2 text-sm text-zinc-400">{b}</p>
            </div>
          ))}
        </div>
        <Link to={c.cta[1]} data-testid="for-cta-btn" className="mt-10 inline-block bg-[var(--okx-accent)] px-6 py-3.5 text-sm font-semibold">
          {c.cta[0]}
        </Link>
      </div>
      <Footer />
    </div>
  );
}
