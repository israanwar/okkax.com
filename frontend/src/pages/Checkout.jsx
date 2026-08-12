import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, apiError, idr, SANDBOX_NOTICE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Checkout() {
  const { eventId, tierId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [tier, setTier] = useState(null);
  const [event, setEvent] = useState(null);
  const [methods, setMethods] = useState([]);
  const [qty, setQty] = useState(1);
  const [attendees, setAttendees] = useState([{ name: "" }]);
  const [method, setMethod] = useState(null);
  const [channel, setChannel] = useState("");
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState(null);

  useEffect(() => {
    api.get(`/public/events/${eventId}`).then(({ data }) => {
      setEvent(data.event);
      setTier(data.tiers.find((t) => t.id === tierId));
    });
    api.get("/meta/roles").then(({ data }) => {
      setMethods(data.payment_methods);
      setMethod(data.payment_methods[0]);
      setChannel(data.payment_methods[0].channels[0]);
    });
  }, [eventId, tierId]);

  useEffect(() => {
    setAttendees((prev) => Array.from({ length: qty }, (_, i) => prev[i] || { name: "" }));
  }, [qty]);

  if (!tier || !event) return <div className="min-h-screen bg-[var(--okx-bg)] p-10 text-zinc-500">Memuat checkout…</div>;

  const gross = tier.price * qty;
  const fee = Math.round(gross * 0.03);
  const tax = Math.round(gross * 0.11);
  const total = gross + fee + tax;

  const createOrder = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/checkout", {
        event_id: event.id,
        tier_id: tier.id,
        quantity: qty,
        attendees: attendees.map((a) => ({ name: a.name || user?.name || "Attendee" })),
        method: method.key,
        method_channel: channel,
      });
      setOrder(data.order);
      setPayment(data.payment);
      toast.success("Order dibuat. Selesaikan pembayaran sandbox.");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const pay = async (outcome) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/payments/${payment.id}/simulate`, { outcome });
      setPayment(data.payment);
      if (outcome === "success") {
        setTickets(data.tickets);
        toast.success("Pembayaran sandbox berhasil. QR ticket diterbitkan.");
      } else {
        toast.error("Pembayaran disimulasikan gagal.");
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="border border-[var(--okx-accent)] bg-[#140700] px-4 py-3 text-sm" data-testid="sandbox-notice">
          <ShieldAlert size={15} className="mr-2 inline accent-text" />
          {SANDBOX_NOTICE}
        </div>

        <h1 className="editorial mt-8 text-3xl sm:text-4xl">Checkout</h1>
        <p className="mt-2 text-sm text-zinc-400">{event.name} · {tier.name}</p>

        {tickets ? (
          <div className="mt-8 border border-emerald-500/40 bg-emerald-500/5 p-6" data-testid="checkout-success">
            <CheckCircle2 className="text-emerald-400" />
            <h2 className="mt-3 text-base font-semibold md:text-lg">Pembayaran sandbox berhasil</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {tickets.length} tiket diterbitkan dengan nomor dan QR unik. Inventory tier telah dikurangi.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tickets.map((t) => (
                <div key={t.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid={`issued-ticket-${t.ticket_number}`}>
                  <div className="num text-sm font-semibold">{t.ticket_number}</div>
                  <div className="text-xs text-zinc-500">{t.attendee_name} · {t.tier_name}</div>
                  <div className="num mt-2 break-all text-[11px] text-zinc-500">{t.qr_code}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to="/app/tickets" data-testid="goto-mytickets-btn" className="bg-[var(--okx-accent)] px-5 py-2.5 text-center text-sm font-semibold">
                Buka My Tickets
              </Link>
              <Link to="/validator" className="border border-[var(--okx-border)] px-5 py-2.5 text-center text-sm font-semibold">
                Validasi QR
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              {!order && (
                <>
                  <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                    <h2 className="text-base font-semibold md:text-lg">Jumlah tiket</h2>
                    <div className="mt-3 flex items-center gap-3">
                      <button data-testid="qty-minus-btn" onClick={() => setQty(Math.max(1, qty - 1))} className="border border-[var(--okx-border)] px-4 py-2 text-lg">−</button>
                      <span data-testid="qty-value" className="num w-10 text-center text-lg font-bold">{qty}</span>
                      <button
                        data-testid="qty-plus-btn"
                        onClick={() => setQty(Math.min(tier.purchase_limit, tier.quantity - tier.sold, qty + 1))}
                        className="border border-[var(--okx-border)] px-4 py-2 text-lg"
                      >
                        +
                      </button>
                      <span className="text-xs text-zinc-500">Maksimum {tier.purchase_limit} per transaksi</span>
                    </div>
                  </section>

                  <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                    <h2 className="text-base font-semibold md:text-lg">Data attendee</h2>
                    <div className="mt-3 space-y-3">
                      {attendees.map((a, i) => (
                        <input
                          key={i}
                          data-testid={`attendee-input-${i}`}
                          value={a.name}
                          onChange={(e) => {
                            const next = [...attendees];
                            next[i] = { name: e.target.value };
                            setAttendees(next);
                          }}
                          placeholder={`Nama attendee ${i + 1}`}
                          aria-label={`Nama attendee ${i + 1}`}
                          className="w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm outline-none focus:border-[var(--okx-accent)]"
                        />
                      ))}
                    </div>
                  </section>

                  <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                    <h2 className="text-base font-semibold md:text-lg">Metode pembayaran</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {methods.map((m) => (
                        <button
                          key={m.key}
                          data-testid={`method-${m.key}`}
                          disabled={!m.available}
                          onClick={() => {
                            setMethod(m);
                            setChannel(m.channels[0]);
                          }}
                          className={`border px-3 py-2.5 text-left text-sm transition-colors ${
                            method?.key === m.key
                              ? "border-[var(--okx-accent)] bg-[#1c0a02]"
                              : "border-[var(--okx-border)] hover:border-zinc-500"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {m.group}
                          {!m.available && <div className="text-[10px] text-zinc-500">Future integration</div>}
                        </button>
                      ))}
                    </div>
                    {method && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wider text-zinc-500">Channel</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {method.channels.map((c) => (
                            <button
                              key={c}
                              data-testid={`channel-${c.replace(/\s|\//g, "-").toLowerCase()}`}
                              onClick={() => setChannel(c)}
                              className={`border px-3 py-1.5 text-xs ${channel === c ? "border-[var(--okx-accent)] accent-text" : "border-[var(--okx-border)] text-zinc-300"}`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}

              {order && payment && (
                <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid="payment-instruction">
                  <h2 className="text-base font-semibold md:text-lg">Instruksi pembayaran sandbox</h2>
                  <dl className="mt-4 divide-y divide-[var(--okx-border)] text-sm">
                    {[
                      ["Order code", order.order_code],
                      ["Payment ref", payment.payment_ref],
                      ["Metode", payment.method_channel],
                      ["Nomor referensi", payment.reference_number],
                      ["Status", payment.status],
                      ["Total", idr(order.total)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2">
                        <dt className="text-zinc-500">{k}</dt>
                        <dd className="num font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      data-testid="simulate-pay-btn"
                      disabled={busy || payment.status === "Simulated Paid"}
                      onClick={() => pay("success")}
                      className="inline-flex items-center justify-center gap-2 bg-[var(--okx-accent)] px-5 py-3 text-sm font-semibold disabled:opacity-60"
                    >
                      {busy && <Loader2 size={15} className="animate-spin" />} Simulasikan pembayaran berhasil
                    </button>
                    <button
                      data-testid="simulate-fail-btn"
                      disabled={busy}
                      onClick={() => pay("fail")}
                      className="border border-[var(--okx-border)] px-5 py-3 text-sm font-semibold text-zinc-300"
                    >
                      Simulasikan gagal
                    </button>
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                <h2 className="text-base font-semibold md:text-lg">Ringkasan</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  {[
                    ["Tier", tier.name],
                    ["Harga satuan", idr(tier.price)],
                    ["Jumlah", qty],
                    ["Subtotal", idr(gross)],
                    ["Platform fee (3%)", idr(fee)],
                    ["Estimasi pajak (11%)", idr(tax)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-zinc-500">{k}</dt>
                      <dd className="num">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex items-end justify-between border-t border-[var(--okx-border)] pt-4">
                  <span className="text-sm text-zinc-400">Total</span>
                  <span data-testid="checkout-total" className="num text-2xl font-bold">{idr(total)}</span>
                </div>
                {!order && (
                  <button
                    data-testid="create-order-btn"
                    disabled={busy}
                    onClick={createOrder}
                    className="mt-5 w-full bg-[var(--okx-accent)] px-4 py-3 text-sm font-semibold hover:bg-[var(--okx-accent-hover)] disabled:opacity-60"
                  >
                    {busy ? "Memproses…" : "Lanjut ke pembayaran"}
                  </button>
                )}
                <p className="mt-3 text-[11px] text-zinc-500">
                  Estimasi pajak. Memerlukan verifikasi profesional. Bukan nasihat pajak.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
