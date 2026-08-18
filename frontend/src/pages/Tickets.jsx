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
    <div className="okx-workspace-page okx-ticket-page" data-testid="tickets-page">
      <section className="okx-workspace-chrome okx-tickets-command" data-testid="tickets-chrome">
        <div className="okx-ticket-command-heading">
          <div>
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] accent-text">
              LivePass & Access
            </div>

            <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white">
              My Tickets
            </h1>

            <p className="mt-1 max-w-2xl text-xs sm:text-[13px] leading-5 text-zinc-400">
              Tiket, akses event, gate information, dan status LivePass Anda.
            </p>
          </div>

          {items && (
            <div className="num text-[11px] text-zinc-400 font-gemini-mono">
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
      </section>

      <section className="okx-workspace-content okx-ticket-content">
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
  if (!items) return <div className="p-6 text-xs text-zinc-400 font-gemini">Memuat order…</div>;
  if (items.length === 0) return <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-6 text-center text-xs text-zinc-400 font-gemini">Belum ada order.</div>;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden font-gemini shadow-sm" data-testid="orders-list">
      <div className="border-b border-white/[0.08] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
        Riwayat Transaksi & Order
      </div>
      <div className="divide-y divide-white/[0.06]">
        {items.map((o) => (
          <div key={o.id} className="flex flex-col gap-3 p-3.5 sm:p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="num text-xs sm:text-sm font-bold text-white font-gemini-mono">{o.order_code}</div>
              <div className="text-[11px] text-zinc-300 mt-0.5">{o.event_name} · {o.tier_name} × {o.quantity}</div>
              <div className="text-[11px] text-zinc-400 mt-0.5 font-gemini-mono">{o.payment?.method_channel} · {o.payment?.status}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="num text-sm sm:text-base font-bold text-white font-gemini-mono">{idr(o.total)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-gemini-mono font-semibold uppercase tracking-wider ${o.status === "paid" ? "border border-white/30 bg-white/10 text-white font-bold" : "border border-white/[0.08] bg-white/[0.02] text-zinc-400"}`}>{o.status}</span>
              {o.status === "paid" && (
                <button
                  data-testid={`refund-btn-${o.id}`}
                  onClick={() => refund(o.id)}
                  className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
                >
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
                className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
              >
                Unduh invoice
              </button>
            </div>
          </div>
        ))}
      </div>
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
