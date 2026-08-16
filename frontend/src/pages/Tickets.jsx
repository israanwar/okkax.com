import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QrCode, Ticket as TicketIcon, ScanLine } from "lucide-react";
import { api, apiError, idr, downloadDoc } from "@/lib/api";

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
    <div className="okx-ticket-page">
      <section className="okx-page-command okx-tickets-command">
        <div className="okx-ticket-command-heading">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
              LivePass & Access
            </div>

            <h1 className="editorial text-2xl sm:text-4xl">
              My Tickets
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Tiket, akses event, gate information, dan status LivePass Anda.
            </p>
          </div>

          {items && (
            <div className="num text-xs text-zinc-500">
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
                className={`okx-ticket-filter ${
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
                    className={`okx-ticket-filter ${
                      statusFilter === status ? "is-active" : ""
                    }`}
                  >
                    {statusLabel(status)} {count}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-zinc-600">
              {visibleItems.length} ditampilkan
            </div>
          </div>
        )}
      </section>

      <section className="okx-ticket-content">
        {!items && (
          <div className="okx-ticket-state text-sm text-zinc-500">
            Memuat tiket…
          </div>
        )}

        {items && items.length === 0 && (
          <div
            data-testid="mytickets-empty"
            className="okx-ticket-state"
          >
            <TicketIcon className="text-zinc-600" />

            <p className="mt-3 text-sm text-zinc-400">
              Belum ada tiket. Jelajahi OKKAX Discover untuk membeli tiket.
            </p>
          </div>
        )}

        {items && items.length > 0 && visibleItems.length === 0 && (
          <div className="okx-ticket-state text-sm text-zinc-500">
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
                className="okx-ticket-card"
                data-testid={`ticket-card-${t.ticket_number}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="editorial text-xl leading-tight">
                      {t.event_name}
                    </h2>

                    <div className="mt-1 text-xs text-zinc-500">
                      {t.tier_name} · {t.attendee_name}
                    </div>
                  </div>

                  <span
                    className="okx-ticket-status"
                    data-status={t.status || "unknown"}
                  >
                    {statusLabel(t.status)}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="shrink-0">
                    <QrBlock value={t.qr_code} />
                  </div>

                  <div className="min-w-0 flex-1 text-xs text-zinc-400">
                    <div className="num text-sm font-semibold text-white">
                      {t.ticket_number}
                    </div>

                    <div className="num mt-2">
                      {t.event?.start_date} · {t.event?.start_time}
                    </div>

                    {(t.event?.venue_name || t.event?.city) && (
                      <div className="mt-1">
                        {t.event?.venue_name}
                        {t.event?.venue_name && t.event?.city ? ", " : ""}
                        {t.event?.city}
                      </div>
                    )}

                    {t.event?.gate_info && (
                      <div className="mt-2 text-zinc-500">
                        {t.event.gate_info}
                      </div>
                    )}

                    <div className="num mt-3 break-all text-[10px] text-zinc-600">
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
  const load = () => api.get("/my/orders").then(({ data }) => setItems(data.items));
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
  if (!items) return <div className="p-6 text-sm text-zinc-500">Memuat order…</div>;
  if (items.length === 0) return <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-10 text-center text-sm text-zinc-400">Belum ada order.</div>;
  return (
    <div className="border border-[var(--okx-border)]" data-testid="orders-list">
      {items.map((o) => (
        <div key={o.id} className="flex flex-col gap-3 border-b border-[var(--okx-border)] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="num text-sm font-semibold">{o.order_code}</div>
            <div className="text-xs text-zinc-500">{o.event_name} · {o.tier_name} × {o.quantity}</div>
            <div className="text-xs text-zinc-500">{o.payment?.method_channel} · {o.payment?.status}</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="num text-sm font-bold">{idr(o.total)}</span>
            <span className={`border px-2 py-0.5 text-xs ${o.status === "paid" ? "border-white/45 text-white" : "border-zinc-600 text-zinc-400"}`}>{o.status}</span>
            {o.status === "paid" && (
              <button data-testid={`refund-btn-${o.id}`} onClick={() => refund(o.id)} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]">
                Ajukan refund
              </button>
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
              className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]"
            >
              Unduh invoice
            </button>
          </div>
        </div>
      ))}
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
      ? "border-white/50 bg-white/10 text-white"
      : result?.result === "Already Used"
      ? "border-[var(--okx-accent)]/50 bg-[var(--okx-accent)]/10 text-[var(--okx-accent-soft)]"
      : "border-red-500/50 bg-red-500/10 text-red-400";
  return (
    <div className="max-w-xl">
      <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">QR Ticket Validator</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Tempel kode QR atau nomor tiket. Validasi pertama menghasilkan Valid, validasi kedua menghasilkan Already Used.
      </p>
      <form onSubmit={validate} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          data-testid="validator-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="OKKAX|EVT-MKS-2026-0001|OKX-TIX-000001"
          aria-label="Kode QR tiket"
          className="flex-1 border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
        />
        <button data-testid="validator-submit-btn" disabled={busy || !code} className="inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
          <ScanLine size={15} /> Validasi
        </button>
      </form>
      {result && (
        <div data-testid="validator-result" className={`mt-5 border p-5 ${color}`}>
          <div className="flex items-center gap-2 text-base font-bold md:text-lg">
            <QrCode size={18} /> {result.result}
          </div>
          <p className="mt-1 text-sm">{result.message}</p>
          {result.ticket && (
            <div className="num mt-3 text-xs text-zinc-400">
              {result.ticket.ticket_number} · {result.ticket.attendee_name} · {result.ticket.tier_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
