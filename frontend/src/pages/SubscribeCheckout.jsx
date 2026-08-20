// Subscription checkout sandbox — same pattern as the ticket checkout in
// Checkout.jsx (order -> payment -> simulate success/fail), applied to a
// Pro/Max subscription plan instead of an event ticket tier.
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert, Loader2, XCircle } from "lucide-react";
import { api, apiError, SANDBOX_NOTICE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PLAN_META, PRICE_TABLE, formatIDR, priceFor, normalizeRoleForPricing } from "@/lib/pricing";

export default function SubscribeCheckout() {
  const { plan } = useParams();
  const [sp] = useSearchParams();
  const billing = sp.get("billing") === "yearly" ? "yearly" : "monthly";
  const nav = useNavigate();
  const { effectiveRole, loading: authLoading } = useAuth();

  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState(null);
  const [channel, setChannel] = useState("");
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const planValid = plan === "pro" || plan === "max";
  const meta = PLAN_META[plan];
  const billableRole = normalizeRoleForPricing(effectiveRole);
  const roleHasPricing = Boolean(PRICE_TABLE[billableRole]);
  const price = priceFor(billableRole, plan, billing);

  useEffect(() => {
    if (authLoading) return;
    if (!planValid) {
      nav("/pricing", { replace: true });
      return;
    }
    if (!roleHasPricing) {
      toast.error("Akun ini tidak memiliki paket berlangganan Pro/Max.");
      setBlocked(true);
      return;
    }
    api.get("/meta/roles").then(({ data }) => {
      setMethods(data.payment_methods);
      const first = data.payment_methods.find((m) => m.available) || data.payment_methods[0];
      setMethod(first);
      setChannel(first?.channels?.[0] || "");
    });
  }, [authLoading, planValid, roleHasPricing, nav]);

  if (blocked) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="subscribe-blocked">
        <XCircle className="mx-auto text-zinc-300" size={28} />
        <h1 className="editorial mt-4 text-2xl text-white">Upgrade tidak tersedia</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Akun Audience adalah workspace personal untuk membeli tiket, bukan workspace profesional. Beralih ke peran
          profesional (Organizer, Talent, Venue, Vendor, Workforce, Sponsor, atau Tenant) untuk berlangganan Pro/Max.
        </p>
        <Link to="/app" className="mt-6 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-zinc-200">
          Kembali ke Workspace
        </Link>
      </div>
    );
  }

  if (authLoading || !planValid || !roleHasPricing || !meta) {
    return <div className="p-10 text-sm text-zinc-500 font-gemini">Memuat checkout…</div>;
  }

  const createOrder = async () => {
    if (!method) return;
    setBusy(true);
    try {
      const { data } = await api.post("/subscription/checkout", {
        plan,
        billing,
        method: method.key,
        method_channel: channel,
      });
      setOrder(data.order);
      setPayment(data.payment);
      toast.success("Order langganan dibuat. Selesaikan pembayaran sandbox.");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const pay = async (outcome) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/subscription/payments/${payment.id}/simulate`, { outcome });
      setPayment(data.payment);
      if (outcome === "success") {
        toast.success(`Paket ${meta.label} berhasil diaktifkan.`);
      } else {
        toast.error("Pembayaran disimulasikan gagal. Paket tidak diaktifkan.");
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const activated = payment?.status === "Simulated Paid";
  const failed = payment?.status === "Failed";

  return (
    <div className="okx-workspace-page font-gemini" data-testid="subscribe-checkout-page">
      <div className="mx-auto max-w-3xl">
        <div className="border border-white/20 bg-[#141419] px-4 py-3 text-sm text-zinc-300" data-testid="subscribe-sandbox-notice">
          <ShieldAlert size={15} className="mr-2 inline text-white" />
          {SANDBOX_NOTICE}
        </div>

        <h1 className="editorial mt-6 text-2xl sm:text-3xl text-white">Berlangganan {meta.label}</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          {billableRole?.charAt(0).toUpperCase() + billableRole?.slice(1)} · {billing === "yearly" ? "Tahunan" : "Bulanan"}
        </p>

        {activated ? (
          <div className="mt-6 border border-white/30 bg-white/[0.05] p-6" data-testid="subscribe-success">
            <CheckCircle2 className="text-white" />
            <h2 className="mt-3 text-base font-bold text-white md:text-lg">Paket {meta.label} berhasil diaktifkan</h2>
            <p className="mt-1 text-sm text-zinc-300">
              Berlaku untuk peran {billableRole} · periode {billing === "yearly" ? "tahunan" : "bulanan"} ·
              total {formatIDR(price.amount)}.
            </p>
            <Link to="/app" data-testid="subscribe-goto-workspace" className="mt-5 inline-block bg-white px-5 py-2.5 text-center text-sm font-bold text-black hover:bg-zinc-200 shadow-md">
              Kembali ke Workspace
            </Link>
          </div>
        ) : failed ? (
          <div className="mt-6 border border-white/20 bg-white/[0.03] p-6" data-testid="subscribe-failed">
            <XCircle className="text-zinc-300" />
            <h2 className="mt-3 text-base font-bold text-white md:text-lg">Pembayaran belum berhasil</h2>
            <p className="mt-1 text-sm text-zinc-400">Paket belum diaktifkan. Anda dapat mencoba lagi.</p>
            <button
              data-testid="subscribe-retry-btn"
              onClick={() => {
                setOrder(null);
                setPayment(null);
              }}
              className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-zinc-200"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              {!order && (
                <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                  <h2 className="text-base font-bold text-white md:text-lg">Metode pembayaran</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {methods.map((m) => (
                      <button
                        key={m.key}
                        data-testid={`subscribe-method-${m.key}`}
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
                            data-testid={`subscribe-channel-${c.replace(/\s|\//g, "-").toLowerCase()}`}
                            onClick={() => setChannel(c)}
                            className={`border px-3 py-1.5 text-xs font-semibold ${channel === c ? "border-white bg-white text-black" : "border-[var(--okx-border)] text-zinc-300 hover:text-white"}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {order && payment && (
                <section className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5" data-testid="subscribe-payment-instruction">
                  <h2 className="text-base font-bold text-white md:text-lg">Instruksi pembayaran sandbox</h2>
                  <dl className="mt-4 divide-y divide-[var(--okx-border)] text-sm">
                    {[
                      ["Order code", order.order_code],
                      ["Payment ref", payment.payment_ref],
                      ["Metode", payment.method_channel],
                      ["Nomor referensi", payment.reference_number],
                      ["Status", payment.status],
                      ["Total", formatIDR(order.total)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2">
                        <dt className="text-zinc-400 font-medium">{k}</dt>
                        <dd className="num font-semibold text-white">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      data-testid="subscribe-simulate-pay-btn"
                      disabled={busy}
                      onClick={() => pay("success")}
                      className="inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-bold text-black hover:bg-zinc-200 shadow-md disabled:opacity-60"
                    >
                      {busy && <Loader2 size={15} className="animate-spin" />} Simulasikan pembayaran berhasil
                    </button>
                    <button
                      data-testid="subscribe-simulate-fail-btn"
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

            <aside className="space-y-4">
              <div className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5">
                <h2 className="text-base font-bold text-white md:text-lg">Ringkasan</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  {[
                    ["Paket", meta.label],
                    ["Peran", billableRole],
                    ["Periode", billing === "yearly" ? "Tahunan" : "Bulanan"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-zinc-400 font-medium">{k}</dt>
                      <dd className="font-semibold text-white capitalize">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex items-end justify-between border-t border-[var(--okx-border)] pt-4">
                  <span className="text-sm text-zinc-300 font-medium">Total</span>
                  <span data-testid="subscribe-total" className="num text-2xl font-bold text-white">{formatIDR(price.amount)}</span>
                </div>
                {!order && (
                  <button
                    data-testid="subscribe-create-order-btn"
                    disabled={busy || !method}
                    onClick={createOrder}
                    className="mt-5 w-full bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 shadow-md disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? "Memproses…" : "Lanjut ke pembayaran"}
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
