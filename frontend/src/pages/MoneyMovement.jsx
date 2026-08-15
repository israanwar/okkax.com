import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const statusClass = (status = "") => {
  const s = String(status).toLowerCase();

  if (
    s.includes("paid") ||
    s.includes("released") ||
    s.includes("settled") ||
    s.includes("completed")
  ) {
    return "text-emerald-400";
  }

  if (
    s.includes("refund") ||
    s.includes("reject") ||
    s.includes("failed")
  ) {
    return "text-red-400";
  }

  return "text-amber-300";
};

export default function MoneyMovement() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/finance/overview")
      .then(({ data }) => setData(data))
      .catch((err) => toast.error(apiError(err)));
  }, []);

  if (!data) {
    return (
      <div className="text-sm text-zinc-500">
        Memuat pergerakan dana OKKAX...
      </div>
    );
  }

  const s = data.summary || {};

  const cards = [
    ["GMV Jaringan", s.network_gmv, CircleDollarSign],
    ["Kewajiban Diamankan", s.secured_obligations, ShieldCheck],
    ["Dana Dilepas", s.released, ArrowUpFromLine],
    ["Saldo Terlindungi", s.protected, Landmark],
    ["Menunggu Settlement", s.pending_settlement, ArrowDownToLine],
    ["Eksposur Refund", s.refund_exposure, RotateCcw],
  ];

  return (
    <div className="space-y-6" data-testid="money-movement">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <Banknote size={15} />
            Commerce & Finance
          </div>

          <h1 className="editorial mt-2 text-2xl sm:text-4xl">
            Pergerakan Dana
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Pantau bagaimana dana, kewajiban, pembayaran, refund, dan settlement
            bergerak melalui jaringan ekonomi OKKAX.
          </p>
        </div>

        <div className="border border-[var(--okx-border)] px-3 py-2 text-xs text-zinc-500">
          Otoritas finansial sandbox
        </div>
      </div>

      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="bg-[var(--okx-surface)] p-4">
            <Icon size={16} className="text-zinc-500" />

            <div className="mt-3 text-[10px] uppercase tracking-wider text-zinc-500">
              {label}
            </div>

            <div className="num mt-1 text-lg font-bold">
              {rupiah(value)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <section className="border border-[var(--okx-border)]">
          <div className="flex items-center justify-between border-b border-[var(--okx-border)] p-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Arus Dana Terbaru
              </h2>

              <p className="mt-1 text-xs text-zinc-600">
                Payment, milestone, settlement, dan refund terbaru.
              </p>
            </div>

            <Activity size={17} className="accent-text" />
          </div>

          <div className="divide-y divide-[var(--okx-border)]">
            {(data.activity || []).slice(0, 30).map((item) => (
              <div
                key={item.id}
                className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <div className="text-sm font-medium">
                    {item.title}
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    {item.event_name || "Platform"} · {item.party}
                  </div>

                  <div className="mt-1 text-[11px] text-zinc-600">
                    {dateTime(item.created_at)}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="num text-sm font-bold">
                    {rupiah(item.amount)}
                  </div>

                  <div
                    className={`mt-1 text-[11px] ${statusClass(item.status)}`}
                  >
                    {item.status}
                  </div>
                </div>
              </div>
            ))}

            {(data.activity || []).length === 0 && (
              <div className="p-8 text-center text-sm text-zinc-500">
                Belum ada aktivitas finansial.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="border border-[var(--okx-border)] p-5">
            <div className="flex items-center gap-2">
              <ReceiptText size={16} className="text-zinc-500" />

              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Ekonomi Infrastruktur
              </h2>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">
                  Fee platform OKKAX
                </span>
                <span className="num">
                  {rupiah(s.platform_fee)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">
                  Fee payment gateway
                </span>
                <span className="num">
                  {rupiah(s.gateway_fee)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">
                  Estimasi pajak
                </span>
                <span className="num">
                  {rupiah(s.tax_estimate)}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-[var(--okx-border)] bg-[var(--okx-accent-tint)] p-5">
            <div className="text-xs uppercase tracking-wider accent-text">
              Prinsip ekonomi OKKAX
            </div>

            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Nilai kerja talent, venue, vendor, workforce, sponsor, dan pihak
              lain bukan revenue OKKAX. Platform memisahkan GMV, kewajiban,
              release, fee infrastruktur, refund, dan settlement.
            </p>
          </div>
        </section>
      </div>

      <section className="border border-[var(--okx-border)]">
        <div className="border-b border-[var(--okx-border)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Status Finansial per Event
          </h2>

          <p className="mt-1 text-xs text-zinc-600">
            Kesiapan finansial berdasarkan Event ID.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-[var(--okx-border)] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Funding</th>
                <th className="px-4 py-3">Secured</th>
                <th className="px-4 py-3">Released</th>
                <th className="px-4 py-3">Protected</th>
                <th className="px-4 py-3">Ticket Revenue</th>
                <th className="px-4 py-3">Readiness</th>
              </tr>
            </thead>

            <tbody>
              {(data.events || []).map((event) => (
                <tr
                  key={event.event_id}
                  className="border-b border-[var(--okx-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {event.name}
                    </div>

                    <div className="mt-0.5 num text-[11px] text-zinc-600">
                      {event.event_code || event.event_id}
                    </div>
                  </td>

                  <td className="num px-4 py-3">
                    {rupiah(event.budget)}
                  </td>

                  <td className="num px-4 py-3">
                    {rupiah(event.confirmed_funding)}
                  </td>

                  <td className="num px-4 py-3">
                    {rupiah(event.secured_obligations)}
                  </td>

                  <td className="num px-4 py-3">
                    {rupiah(event.released)}
                  </td>

                  <td className="num px-4 py-3">
                    {rupiah(event.protected)}
                  </td>

                  <td className="num px-4 py-3">
                    {rupiah(event.ticket_revenue)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="w-28">
                      <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
                        <span>Funding</span>
                        <span className="num">
                          {event.funding_readiness || 0}%
                        </span>
                      </div>

                      <div className="h-1.5 bg-zinc-900">
                        <div
                          className="h-full bg-[var(--okx-accent)]"
                          style={{
                            width: `${Math.min(
                              100,
                              event.funding_readiness || 0
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs leading-relaxed text-zinc-600">
        {data.notice}
      </div>
    </div>
  );
}
