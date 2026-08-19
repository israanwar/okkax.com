import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CalendarDays, MapPin, Clock, ShieldCheck, Info, Users, Accessibility } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import StatusBadge from "@/components/StatusBadge";
import { api, idr, num } from "@/lib/api";
import { imageFor } from "@/lib/eventImage";
import { useAuth } from "@/context/AuthContext";

const READINESS_LABEL = {
  organizer_verified: "Organizer Verified",
  venue_confirmed: "Venue Confirmed",
  talent_confirmed: "Talent Confirmed",
  ticketing_active: "Ticketing Active",
  refund_policy_available: "Refund Policy Available",
  accessibility_info_available: "Accessibility Information Available",
};

export default function PublicEvent() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/public/events/${id}`).then(({ data }) => setD(data)).catch((e) => setErr("Event tidak ditemukan atau belum dipublikasikan."));
  }, [id]);

  if (err)
    return (
      <div className="min-h-screen bg-[var(--okx-bg)]">
        <PublicNav />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">{err}</h1>
          <Link to="/discover" className="mt-4 inline-block accent-text underline">Kembali ke Discover</Link>
        </div>
      </div>
    );
  if (!d)
    return (
      <div className="min-h-screen bg-[var(--okx-bg)]">
        <PublicNav />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center text-xs text-zinc-400 font-gemini">
          Memuat data event…
        </div>
      </div>
    );

  const { event: ev, tiers, talents, venue, sponsors, tenant_highlights, schedule, readiness, organizer } = d;

  const buy = (tierId) => {
    if (!user) return nav(`/login?next=/events/${ev.id}`);
    nav(`/checkout/${ev.id}/${tierId}`);
  };

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="relative border-b border-[var(--okx-border)]">
        <img src={imageFor(ev)} alt={ev.name} className="h-64 w-full object-cover opacity-40 sm:h-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a99] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-7xl px-4 pb-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-[var(--okx-accent)] px-2 py-1 font-semibold uppercase tracking-wider text-black">{ev.status}</span>
            <span className="border border-[var(--okx-border)] bg-[#0a0a0acc] px-2 py-1 text-zinc-200">{ev.event_type}</span>
            <span className="num border border-[var(--okx-border)] bg-[#0a0a0acc] px-2 py-1 text-zinc-200 font-gemini-mono">{ev.event_code}</span>
          </div>
          <h1 className="editorial mt-3 text-3xl sm:text-5xl text-white">{ev.name}</h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-4">
            {[
              [CalendarDays, "Tanggal", `${ev.start_date} → ${ev.end_date}`],
              [Clock, "Jam", `${ev.start_time} ${ev.timezone}`],
              [MapPin, "Venue", ev.venue_name || "—"],
              [Users, "Kapasitas", num(ev.capacity)],
            ].map(([Icon, label, value]) => (
              <div key={label} className="bg-[var(--okx-surface)] p-4">
                <Icon size={15} className="accent-text" />
                <div className="mt-2 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold font-gemini-mono">{label}</div>
                <div className="num mt-0.5 text-sm font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Tentang event</h2>
            <p className="mt-3 text-sm text-zinc-200 leading-relaxed">{ev.description}</p>
            <p className="mt-2 text-sm text-zinc-300"><strong className="text-white font-semibold">Tujuan:</strong> {ev.objective}</p>
          </section>

          <section>
            <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Event readiness</h2>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="event-readiness">
              {Object.entries(readiness).map(([k, v]) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium ${v ? "border-white/45 bg-white/10 text-white font-semibold" : "border-white/10 bg-white/[0.02] text-zinc-400"}`}
                >
                  <ShieldCheck size={13} /> {READINESS_LABEL[k]}{v ? "" : " — belum"}
                </span>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-zinc-400">
              <Info size={13} className="mt-0.5 shrink-0" />
              Indikator bersifat faktual atas data yang tercatat di OKKAX. OKKAX tidak memberikan jaminan bahwa
              event tidak akan dibatalkan.
            </p>
          </section>

          {talents.length > 0 && (
            <section>
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Talent & pembicara</h2>
              <div className="mt-3 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2">
                {talents.map((t) => (
                  <div key={t.id} className="bg-[var(--okx-surface)] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">{t.stage_name}</h3>
                        <div className="text-xs text-zinc-400 mt-0.5">{t.category} · {t.genre}</div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{t.bio}</p>
                    {t.slot && <div className="num mt-2 text-xs text-zinc-400 font-gemini-mono">Slot: {t.slot}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {schedule.length > 0 && (
            <section>
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Rundown</h2>
              <div className="mt-3 border border-[var(--okx-border)]">
                {schedule.map((s) => (
                  <div key={s.id} className="flex flex-col gap-1 border-b border-[var(--okx-border)] p-4 last:border-0 sm:flex-row sm:items-center sm:gap-6">
                    <div className="num w-16 text-sm font-bold text-white font-gemini-mono">{s.time}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{s.activity}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{s.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sponsors.length > 0 && (
            <section>
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Sponsors</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {sponsors.map((s) => (
                  <span key={s.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] px-3 py-2 text-sm text-white">
                    {s.sponsor_name} <span className="text-xs text-zinc-400 font-medium">· {s.package_name}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {tenant_highlights.length > 0 && (
            <section>
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Tenant highlights</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {tenant_highlights.map((t) => (
                  <span key={t.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] px-3 py-2 text-sm text-white">
                    {t.business_name} <span className="text-xs text-zinc-400 font-medium">· {t.booth_code}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2">
            {[
              ["Kebijakan refund", ev.refund_policy],
              ["Kebijakan reschedule", ev.reschedule_policy],
              ["Batas usia", ev.age_limit],
              ["Gate information", ev.gate_info],
              ["Aksesibilitas", ev.accessibility],
              ["Kontak dukungan", ev.support_contact],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--okx-surface)] p-5">
                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold font-gemini-mono">{label}</div>
                <div className="mt-1 text-sm text-zinc-200 font-medium">{value || "—"}</div>
              </div>
            ))}
          </section>

          {ev.faq?.length > 0 && (
            <section>
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">FAQ</h2>
              <div className="mt-3 border border-[var(--okx-border)]">
                {ev.faq.map((f, i) => (
                  <details key={i} className="border-b border-[var(--okx-border)] p-4 last:border-0">
                    <summary className="cursor-pointer text-sm font-semibold text-white">{f.q}</summary>
                    <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {venue && (
            <section>
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300 md:text-lg">Venue & peta</h2>
              <div className="mt-3 border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                <h3 className="text-base font-semibold text-white">{venue.name}</h3>
                <p className="text-sm text-zinc-300 mt-1">{venue.address}, {venue.city}</p>
                <div className="num mt-2 text-xs text-zinc-400 font-gemini-mono">Koordinat {venue.lat}, {venue.lng} · Kapasitas {num(Math.max(venue.standing_capacity, venue.seated_capacity))}</div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="venue-map-link"
                  className="mt-3 inline-block text-sm text-white font-semibold underline"
                >
                  Buka di peta
                </a>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-300">
                  {(venue.accessibility || []).map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 border border-[var(--okx-border)] px-2 py-1">
                      <Accessibility size={12} /> {a}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)]" data-testid="public-ticket-tiers">
            <div className="hairline p-4">
              <h2 className="text-base font-bold text-white md:text-lg">Ticket tiers</h2>
              <p className="mt-1 text-xs text-zinc-400 font-medium">Organizer: {organizer?.name || ev.organizer_name}</p>
            </div>
            <div>
              {tiers.length === 0 && <div className="p-4 text-sm text-zinc-400">Belum ada tiket dijual.</div>}
              {tiers.map((t) => {
                const remaining = t.quantity - t.sold;
                return (
                  <div key={t.id} className="border-b border-[var(--okx-border)] p-4 last:border-0" data-testid={`tier-${t.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{t.name}</div>
                        <div className="text-[11px] uppercase tracking-wider text-zinc-300 font-semibold font-gemini-mono mt-0.5">{t.ticket_type}</div>
                      </div>
                      <div className="num text-right text-base font-bold text-white">{t.price ? idr(t.price) : "Gratis"}</div>
                    </div>
                    <ul className="mt-2.5 space-y-1 text-xs text-zinc-300 font-normal">
                      {(t.benefits || []).map((b) => <li key={b}>· {b}</li>)}
                    </ul>
                    <div className="num mt-2.5 text-xs text-zinc-300 font-medium font-gemini-mono">Sisa {num(remaining)} dari {num(t.quantity)} · Maks {t.purchase_limit}/transaksi</div>
                    <button
                      data-testid={`buy-tier-btn-${t.id}`}
                      disabled={remaining <= 0 || !t.active}
                      onClick={() => buy(t.id)}
                      className="mt-3.5 w-full bg-white hover:bg-zinc-200 text-black px-4 py-2.5 text-sm font-bold transition-all shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500 disabled:border disabled:border-white/10"
                    >
                      {remaining <= 0 ? "Habis" : "Beli Tiket"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {d.disclaimer && (
            <div className="border border-white/20 bg-[#141419] p-4 text-xs text-zinc-300" data-testid="demo-disclaimer">
              {d.disclaimer}
            </div>
          )}
        </aside>
      </div>
      <Footer />
    </div>
  );
}
