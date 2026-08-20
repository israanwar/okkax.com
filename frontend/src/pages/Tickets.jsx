import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Compass, CreditCard, QrCode, ReceiptText, Ticket as TicketIcon, ScanLine } from "lucide-react";
import { api, apiError, idr, downloadDoc } from "@/lib/api";
import PageIntro, { PageIntroEyebrow, PageIntroTitle, PageIntroDescription } from "@/components/PageIntro";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export function AudienceOverview() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get("/my/tickets"),
      api.get("/my/orders"),
      api.get("/discover/events"),
    ]).then(([ticketsResult, ordersResult, eventsResult]) => {
      if (!active) return;
      setSummary({
        tickets: ticketsResult.status === "fulfilled" ? ticketsResult.value.data?.items || [] : [],
        orders: ordersResult.status === "fulfilled" ? ordersResult.value.data?.items || [] : [],
        events: eventsResult.status === "fulfilled" ? eventsResult.value.data?.items || [] : [],
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const validTickets = (summary?.tickets || []).filter((ticket) => ticket.status === "valid");
  const latestOrder = summary?.orders?.[0];
  const featuredEvents = (summary?.events || []).slice(0, 3);

  return (
    <div className="space-y-4" data-testid="audience-overview-page">
      <PageIntro testId="audience-overview-page-intro">
        <PageIntroEyebrow>Personal Audience</PageIntroEyebrow>
        <PageIntroTitle>Overview</PageIntroTitle>
        <PageIntroDescription>
          Temukan event, akses tiket, dan pantau pembayaran Anda dalam satu workspace.
        </PageIntroDescription>
      </PageIntro>

      <section className="space-y-4">
        {!summary ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-6 text-xs text-zinc-400">
            Memuat ringkasan…
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/app/tickets" className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 transition-colors hover:bg-white/[0.04]">
                <TicketIcon size={17} className="text-zinc-300" />
                <div className="num mt-3 text-2xl font-bold text-white">{validTickets.length}</div>
                <div className="mt-0.5 text-xs text-zinc-400">Tiket aktif</div>
              </Link>
              <Link to="/app/orders" className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 transition-colors hover:bg-white/[0.04]">
                <ReceiptText size={17} className="text-zinc-300" />
                <div className="num mt-3 text-2xl font-bold text-white">{summary.orders.length}</div>
                <div className="mt-0.5 text-xs text-zinc-400">Order & pembayaran</div>
              </Link>
              <Link to="/app/discover" className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 transition-colors hover:bg-white/[0.04]">
                <Compass size={17} className="text-zinc-300" />
                <div className="mt-3 text-sm font-bold text-white">Discover Events</div>
                <div className="mt-1 text-xs text-zinc-400">Cari pengalaman live berikutnya</div>
              </Link>
            </div>

            {latestOrder && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Order terbaru</div>
                <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-sm font-semibold text-white">{latestOrder.event_name}</div>
                    <div className="num mt-1 text-[11px] text-zinc-400">{latestOrder.order_code} · {formatDate(latestOrder.created_at)}</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="num text-sm font-bold text-white">{idr(latestOrder.total)}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400">{latestOrder.payment?.status || latestOrder.status}</div>
                  </div>
                </div>
              </div>
            )}

            {featuredEvents.length > 0 && (
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-white">Event untuk dijelajahi</h2>
                  <Link to="/app/discover" className="text-xs font-semibold text-zinc-300 hover:text-white">Lihat semua</Link>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {featuredEvents.map((event) => (
                    <Link key={event.id} to={`/app/discover/events/${event.id}`} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 transition-colors hover:bg-white/[0.04]">
                      <div className="line-clamp-1 text-sm font-semibold text-white">{event.name}</div>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400"><CalendarDays size={12} /> {event.start_date || "Tanggal menyusul"}</div>
                      <div className="mt-1 text-[11px] text-zinc-400">{event.city || "Lokasi menyusul"}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function QrBlock({ value }) {
  const cells = [];
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 144; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push((h >> 8) % 3 !== 0);
  }
  return (
    <div className="grid w-32 grid-cols-12 gap-0 bg-white p-1.5" aria-label="Kode QR tiket">
      {cells.map((on, i) => (
        <span key={i} className={`aspect-square ${on ? "bg-black" : "bg-white"}`} />
      ))}
    </div>
  );
}

export function MyTickets() {
  const [items, setItems] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    api.get("/my/tickets").then(({ data }) => setItems(data.items));
  }, []);

  const statusLabel = (status) => {
    if (!status) return "Unknown";

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const statuses = items
    ? [...new Set(items.map((item) => item.status).filter(Boolean))]
    : [];

  const visibleItems =
    !items || statusFilter === "all"
      ? items || []
      : items.filter((item) => item.status === statusFilter);

  return (
    <div className="okx-ticket-page space-y-4" data-testid="tickets-page">
      <PageIntro testId="tickets-chrome">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <PageIntroEyebrow>LivePass & Access</PageIntroEyebrow>
            <PageIntroTitle>My Tickets</PageIntroTitle>
            <PageIntroDescription>
              Tiket, akses event, gate information, dan status LivePass Anda.
            </PageIntroDescription>
          </div>

          {items && (
            <div className="num shrink-0 text-[10.5px] text-zinc-400 font-gemini-mono">
              {items.length} tiket
            </div>
          )}
        </div>

        {items && items.length > 0 && (
          <div className="okx-ticket-filter-row">
            <div
              className="okx-ticket-filter-list"
              role="tablist"
              aria-label="Filter status tiket"
            >
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                className={`okx-ticket-filter text-xs px-2.5 py-1 ${
                  statusFilter === "all" ? "is-active" : ""
                }`}
              >
                Semua {items.length}
              </button>

              {statuses.map((status) => {
                const count = items.filter(
                  (item) => item.status === status
                ).length;

                return (
                  <button
                    key={status}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === status}
                    onClick={() => setStatusFilter(status)}
                    className={`okx-ticket-filter text-xs px-2.5 py-1 ${
                      statusFilter === status ? "is-active" : ""
                    }`}
                  >
                    {statusLabel(status)} {count}
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-zinc-400 font-gemini-mono">
              {visibleItems.length} ditampilkan
            </div>
          </div>
        )}
      </PageIntro>

      <section className="okx-ticket-content">
        {!items && (
          <div className="okx-ticket-state text-xs text-zinc-400 font-gemini">
            Memuat tiket…
          </div>
        )}

        {items && items.length === 0 && (
          <div
            data-testid="mytickets-empty"
            className="okx-ticket-state"
          >
            <TicketIcon className="text-zinc-400" />

            <p className="mt-2 text-xs text-zinc-300">
              Belum ada tiket. Jelajahi OKKAX Discover untuk membeli tiket.
            </p>
          </div>
        )}

        {items && items.length > 0 && visibleItems.length === 0 && (
          <div className="okx-ticket-state text-xs text-zinc-400 font-gemini">
            Tidak ada tiket dengan status ini.
          </div>
        )}

        {items && visibleItems.length > 0 && (
          <div
            className="okx-ticket-grid"
            data-testid="mytickets-list"
          >
            {visibleItems.map((t) => (
              <article
                key={t.id}
                className="okx-ticket-card p-3.5 sm:p-4"
                data-testid={`ticket-card-${t.ticket_number}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="editorial text-lg leading-tight text-white">
                      {t.event_name}
                    </h2>

                    <div className="mt-0.5 text-[11px] text-zinc-300 font-medium">
                      {t.tier_name} · {t.attendee_name}
                    </div>
                  </div>

                  <span
                    className="okx-ticket-status text-[10px] px-2 py-0.5 font-gemini-mono"
                    data-status={t.status || "unknown"}
                  >
                    {statusLabel(t.status)}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="shrink-0">
                    <QrBlock value={t.qr_code} />
                  </div>

                  <div className="min-w-0 flex-1 text-xs text-zinc-300">
                    <div className="num text-xs sm:text-sm font-semibold text-white font-gemini-mono">
                      {t.ticket_number}
                    </div>

                    <div className="num mt-1.5 text-[11px] font-gemini-mono text-zinc-300">
                      {t.event?.start_date} · {t.event?.start_time}
                    </div>

                    {(t.event?.venue_name || t.event?.city) && (
                      <div className="mt-0.5 text-[11px] text-zinc-300">
                        {t.event?.venue_name}
                        {t.event?.venue_name && t.event?.city ? ", " : ""}
                        {t.event?.city}
                      </div>
                    )}

                    {t.event?.gate_info && (
                      <div className="mt-1.5 text-[10.5px] text-zinc-400 font-medium">
                        {t.event.gate_info}
                      </div>
                    )}

                    <div className="num mt-2 break-all text-[9.5px] text-zinc-400 font-gemini-mono">
                      {t.qr_code}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function MyOrders() {
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const load = () => api.get("/my/orders").then(({ data }) => setItems(data.items || []));
  useEffect(() => {
    load();
  }, []);
  const refund = async (id) => {
    try {
      await api.post(`/orders/${id}/refund`, { reason: "Permintaan pembeli", type: "full" });
      toast.success("Refund sandbox diproses");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const pageCount = Math.max(1, Math.ceil((items?.length || 0) / pageSize));
  const pageItems = (items || []).slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4 font-gemini" data-testid="orders-payments-page">
      <PageIntro testId="orders-page-intro">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <PageIntroEyebrow icon={CreditCard}>Audience Transactions</PageIntroEyebrow>
            <PageIntroTitle>Orders & Payments</PageIntroTitle>
            <PageIntroDescription>Riwayat pembelian tiket, status pembayaran, invoice, dan refund Anda.</PageIntroDescription>
          </div>
          {items && <div className="num shrink-0 text-[10.5px] text-zinc-400">{items.length} transaksi</div>}
        </div>
      </PageIntro>

      <section className="space-y-4">
        {!items && <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-6 text-xs text-zinc-400">Memuat order…</div>}
        {items?.length === 0 && <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-6 text-center text-xs text-zinc-400">Belum ada order.</div>}
        {items?.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 shadow-sm" data-testid="orders-list">
            <div className="divide-y divide-white/[0.06]">
              {pageItems.map((o) => {
                const taxLabel = o.fee_policy_snapshot?.tax_status === "estimated" ? "Estimasi pajak" : "Pajak";
                const refundStatus = o.payment?.refund_status;
                return (
                  <article key={o.id} className="p-4 transition-colors hover:bg-white/[0.02] sm:p-5" data-testid={`order-card-${o.id}`}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{o.event_name}</div>
                        <div className="mt-1 text-[11px] text-zinc-300">{o.tier_name} · {o.quantity} tiket</div>
                        <div className="num mt-1 text-[10px] text-zinc-400">{o.order_code} · {formatDate(o.created_at)}</div>
                      </div>
                      <div className="sm:text-right">
                        <div className="num text-base font-bold text-white">{idr(o.total)}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5 sm:justify-end">
                          <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-300">{o.payment?.status || "Status belum tersedia"}</span>
                          {refundStatus && <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-300">Refund: {refundStatus}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                      <div><span className="text-zinc-400">Subtotal</span><div className="num mt-0.5 text-zinc-100">{idr(o.gross)}</div></div>
                      <div><span className="text-zinc-400">Platform fee</span><div className="num mt-0.5 text-zinc-100">{idr(o.platform_fee)}</div></div>
                      {o.tax != null && <div><span className="text-zinc-400">{taxLabel}</span><div className="num mt-0.5 text-zinc-100">{idr(o.tax)}</div></div>}
                      {o.payment?.gateway_fee != null && <div><span className="text-zinc-400">Biaya pembayaran</span><div className="num mt-0.5 text-zinc-100">{idr(o.payment.gateway_fee)}</div></div>}
                      <div><span className="text-zinc-400">Metode pembayaran</span><div className="mt-0.5 text-zinc-100">{o.payment?.method_channel || o.payment?.method || "—"}</div></div>
                      <div><span className="text-zinc-400">Payment ID</span><div className="num mt-0.5 break-all text-zinc-100">{o.payment?.payment_ref || "—"}</div></div>
                    </div>

                    {o.payment?.sandbox_notice && <p className="mt-2 text-[10px] text-zinc-500">{o.payment.sandbox_notice}</p>}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {o.status === "paid" && !refundStatus && (
                        <button data-testid={`refund-btn-${o.id}`} onClick={() => refund(o.id)} className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]">Ajukan refund</button>
                      )}
                      <button
                        data-testid={`invoice-btn-${o.id}`}
                        onClick={async () => {
                          try {
                            await downloadDoc(`/documents/invoice/${o.id}`, `OKKAX-Invoice-${o.order_code}.pdf`);
                            toast.success("Invoice OKKAX diunduh");
                          } catch (e) {
                            toast.error(apiError(e));
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
                      >
                        <ReceiptText size={12} /> Unduh invoice
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3" data-testid="orders-pagination">
                <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] px-2.5 py-1 text-[11px] text-zinc-300 disabled:opacity-30"><ChevronLeft size={13} /> Sebelumnya</button>
                <span className="num text-[11px] text-zinc-400">Halaman {page} dari {pageCount}</span>
                <button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] px-2.5 py-1 text-[11px] text-zinc-300 disabled:opacity-30">Berikutnya <ChevronRight size={13} /></button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function Validator() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const validate = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/tickets/validate", { qr_code: code });
      setResult(data);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };
  const color =
    result?.result === "Valid"
      ? "border-white/40 bg-white/10 text-white font-bold"
      : result?.result === "Already Used"
      ? "border-dashed border-white/30 bg-white/[0.04] text-zinc-300"
      : "border-white/60 bg-white/[0.06] text-zinc-100 font-bold";
  return (
    <div className="max-w-2xl font-gemini">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-4.5 shadow-sm">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
          Access Control
        </div>
        <h2 className="editorial text-xl sm:text-2xl text-white">QR Ticket Validator</h2>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
          Tempel kode QR atau nomor tiket. Validasi pertama menghasilkan Valid, validasi kedua menghasilkan Already Used.
        </p>
        <form onSubmit={validate} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            data-testid="validator-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="OKKAX|EVT-MKS-2026-0001|OKX-TIX-000001"
            aria-label="Kode QR tiket"
            className="flex-1 rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs sm:text-[13px] text-white placeholder:text-zinc-400 outline-none transition-all focus:border-white/40 focus:ring-1 focus:ring-white/20 font-gemini-mono"
          />
          <button
            data-testid="validator-submit-btn"
            disabled={busy || !code}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ScanLine size={13} /> Validasi
          </button>
        </form>
        {result && (
          <div data-testid="validator-result" className={`mt-4 rounded-2xl border p-3.5 backdrop-blur-xl ${color}`}>
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold">
              <QrCode size={16} /> {result.result}
            </div>
            <p className="mt-1 text-xs leading-relaxed">{result.message}</p>
            {result.ticket && (
              <div className="num mt-2.5 rounded-lg border border-white/[0.1] bg-black/30 p-2 text-[11px] text-zinc-300 font-gemini-mono">
                {result.ticket.ticket_number} · {result.ticket.attendee_name} · {result.ticket.tier_name}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
