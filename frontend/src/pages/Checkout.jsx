import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, apiError, idr, SANDBOX_NOTICE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Checkout({ embedded = false }) {
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
  const [useStripe, setUseStripe] = useState(false);

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

  if (!tier || !event) return <div className={`${embedded ? "" : "min-h-screen"} bg-[var(--okx-bg)] p-10 text-zinc-400`}>Memuat checkout…</div>;

  const gross = tier.price * qty;
  const fee = Math.round(gross * 0.03);
  const tax = Math.round(gross * 0.11);
  const total = gross + fee + tax;

  const createOrder = async () => {
    setBusy(true);
    try {
      if (useStripe) {
        const { data } = await api.post("/payments/stripe/checkout", {
          event_id: event.id,
          tier_id: tier.id,
          quantity: qty,
          attendees: attendees.map((a) => ({ name: a.name || user?.name || "Attendee" })),
          // Keep the Stripe round-trip inside the workspace shell for logged-in
          // members instead of dropping them back on the public marketing site.
          origin_url: embedded ? `${window.location.origin}/app` : window.location.origin,
        });
        toast.success("Mengalihkan ke Stripe test mode…");
        window.location.href = data.checkout_url;
        return;
      }
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
    <div className={embedded ? "bg-[var(--okx-bg)]" : "min-h-screen bg-[var(--okx-bg)]"} data-testid={embedded ? "audience-checkout-page" : "public-checkout-page"}>
      {!embedded && <PublicNav />}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="border border-white/20 bg-[#141419] px-4 py-3 text-sm text-zinc-300" data-testid="sandbox-notice">
          <ShieldAlert size={15} className="mr-2 inline text-white" />
          {SANDBOX_NOTICE}
        </div>

        <h1 className="editorial mt-8 text-3xl sm:text-4xl text-white">Checkout</h1>
        <p className="mt-2 text-sm text-zinc-300">{event.name} · {tier.name}</p>

        {tickets ? (
          <div className="mt-8 border border-white/30 bg-white/[0.05] p-6" data-testid="checkout-success">
            <CheckCircle2 className="text-white" />
            <h2 className="mt-3 text-base font-bold text-white md:text-lg">Pembayaran sandbox berhasil</h2>
            <p className="mt-1 text-sm text-zinc-300">
              {tickets.length} tiket diterbitkan dengan nomor dan QR unik. Inventory tier telah dikurangi.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tickets.map((t) => (
                <div key={t.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid={`issued-ticket-${t.ticket_number}`}>
                  <div className="num text-sm font-bold text-white">{t.ticket_number}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{t.attendee_name} · {t.tier_name}</div>
                  <div className="num mt-2 break-all text-[11px] text-zinc-300 font-gemini-mono">{t.qr_code}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to="/app/tickets" data-testid="goto-mytickets-btn" className="bg-white px-5 py-2.5 text-center text-sm font-bold text-black hover:bg-zinc-200 shadow-md">
                Buka My Tickets
              </Link>
              <Link to={embedded ? "/app/discover" : "/validator"} className="border border-[var(--okx-border)] px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/[0.04]">
                {embedded ? "Discover Events" : "Validasi QR"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              {!order && (
                <>
                  <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                    <h2 className="text-base font-bold text-white md:text-lg">Jumlah tiket</h2>
                    <div className="mt-3 flex items-center gap-3">
                      <button data-testid="qty-minus-btn" onClick={() => setQty(Math.max(1, qty - 1))} className="border border-[var(--okx-border)] px-4 py-2 text-lg text-white font-bold">−</button>
                      <span data-testid="qty-value" className="num w-10 text-center text-lg font-bold text-white">{qty}</span>
                      <button
                        data-testid="qty-plus-btn"
                        onClick={() => setQty(Math.min(tier.purchase_limit, tier.quantity - tier.sold, qty + 1))}
                        className="border border-[var(--okx-border)] px-4 py-2 text-lg text-white font-bold"
                      >
                        +
                      </button>
                      <span className="text-xs text-zinc-300 font-medium">Maksimum {tier.purchase_limit} per transaksi</span>
                    </div>
                  </section>

                  <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                    <h2 className="text-base font-bold text-white md:text-lg">Data attendee</h2>
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
                          className="w-full border border-[var(--okx-border)] bg-[#0d0d0d] px-3 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-white"
                        />
                      ))}
                    </div>
                  </section>

                  <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                    <h2 className="text-base font-bold text-white md:text-lg">Metode pembayaran</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        data-testid="pay-mode-sandbox"
                        onClick={() => setUseStripe(false)}
                        className={`border px-3 py-3 text-left text-sm font-semibold ${!useStripe ? "border-white bg-white/[0.08] text-white" : "border-[var(--okx-border)] text-zinc-300"}`}
                      >
                        Sandbox internal Okkax
                        <div className="text-[11px] text-zinc-300 mt-0.5 font-normal">VA, QRIS, e-wallet, retail, corporate</div>
                      </button>
                      <button
                        data-testid="pay-mode-stripe"
                        onClick={() => setUseStripe(true)}
                        className={`border px-3 py-3 text-left text-sm font-semibold ${useStripe ? "border-white bg-white/[0.08] text-white" : "border-[var(--okx-border)] text-zinc-300"}`}
                      >
                        Kartu via Stripe test mode
                        <div className="text-[11px] text-zinc-300 mt-0.5 font-normal">Kartu uji 4242 4242 4242 4242</div>
                      </button>
                    </div>
                    {useStripe ? (
                      <p className="mt-4 text-xs text-zinc-300" data-testid="stripe-note">
                        Stripe test mode: nilai rupiah dikonversi ke USD pada kurs indikatif Rp16.000/USD hanya untuk
                        keperluan uji. Tidak ada uang nyata yang ditagihkan.
                      </p>
                    ) : (
                      <>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {methods.map((m) => (
                        <button
                          key={m.key}
                          data-testid={`method-${m.key}`}
                          disabled={!m.available}
                          onClick={() => {
                            setMethod(m);
                            setChannel(m.channels[0]);
                          }}
                          className={`border px-3 py-2.5 text-left text-sm transition-colors font-medium ${
                            method?.key === m.key
                              ? "border-white bg-white/[0.08] text-white font-bold"
                              : "border-[var(--okx-border)] text-zinc-300 hover:border-zinc-500"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {m.group}
                          {!m.available && <div className="text-[10px] text-zinc-400">Future integration</div>}
                        </button>
                      ))}
                    </div>
                    {method && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wider text-zinc-400 font-gemini-mono font-semibold">Channel</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {method.channels.map((c) => (
                            <button
                              key={c}
                              data-testid={`channel-${c.replace(/\s|\//g, "-").toLowerCase()}`}
                              onClick={() => setChannel(c)}
                              className={`border px-3 py-1.5 text-xs font-semibold ${channel === c ? "border-white bg-white text-black" : "border-[var(--okx-border)] text-zinc-300 hover:text-white"}`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                      </>
                    )}
                  </section>
                </>
              )}

              {order && payment && (
                <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid="payment-instruction">
                  <h2 className="text-base font-bold text-white md:text-lg">Instruksi pembayaran sandbox</h2>
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
                        <dt className="text-zinc-400 font-medium">{k}</dt>
                        <dd className="num font-semibold text-white">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      data-testid="simulate-pay-btn"
                      disabled={busy || payment.status === "Simulated Paid"}
                      onClick={() => pay("success")}
                      className="inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-bold text-black hover:bg-zinc-200 shadow-md disabled:opacity-60"
                    >
                      {busy && <Loader2 size={15} className="animate-spin" />} Simulasikan pembayaran berhasil
                    </button>
                    <button
                      data-testid="simulate-fail-btn"
                      disabled={busy}
                      onClick={() => pay("fail")}
                      className="border border-[var(--okx-border)] px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/[0.04]"
                    >
                      Simulasikan gagal
                    </button>
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                <h2 className="text-base font-bold text-white md:text-lg">Ringkasan</h2>
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
                      <dt className="text-zinc-400 font-medium">{k}</dt>
                      <dd className="num font-semibold text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex items-end justify-between border-t border-[var(--okx-border)] pt-4">
                  <span className="text-sm text-zinc-300 font-medium">Total</span>
                  <span data-testid="checkout-total" className="num text-2xl font-bold text-white">{idr(total)}</span>
                </div>
                {!order && (
                  <button
                    data-testid="create-order-btn"
                    disabled={busy}
                    onClick={createOrder}
                    className="mt-5 w-full bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 shadow-md disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? "Memproses…" : useStripe ? "Bayar dengan kartu (Stripe test)" : "Lanjut ke pembayaran"}
                  </button>
                )}
                <p className="mt-3 text-[11px] text-zinc-400 leading-relaxed">
                  Estimasi pajak. Memerlukan verifikasi profesional. Bukan nasihat pajak.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
      {!embedded && <Footer />}
    </div>
  );
}
