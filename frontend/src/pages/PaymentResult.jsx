import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, idr } from "@/lib/api";

export function PaymentSuccess() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const [state, setState] = useState({ status: "checking", tickets: [], order: null });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) return setState({ status: "error", tickets: [] });
    let stop = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/stripe/status/${sessionId}`);
        if (stop) return;
        if (data.payment_status === "paid") {
          setState({ status: "paid", tickets: data.tickets, order: data.order });
          return;
        }
        if (["expired", "failed"].includes(data.payment_status)) {
          setState({ status: "failed", tickets: [] });
          return;
        }
        if (tries > 12) return setState({ status: "timeout", tickets: [] });
        setTimeout(() => setTries((t) => t + 1), 2500);
      } catch {
        setState({ status: "error", tickets: [] });
      }
    };
    poll();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line
  }, [sessionId, tries]);

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {state.status === "checking" && (
          <div data-testid="stripe-checking" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-center">
            <Loader2 className="mx-auto animate-spin accent-text" />
            <p className="mt-4 text-sm text-zinc-400">Memverifikasi pembayaran kartu di Stripe test mode…</p>
          </div>
        )}
        {state.status === "paid" && (
          <div data-testid="stripe-success" className="border border-[var(--okx-accent)]/45 bg-[var(--okx-accent)]/10 p-8">
            <CheckCircle2 className="accent-text" />
            <h1 className="editorial mt-3 text-3xl">Pembayaran kartu berhasil</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {state.order?.order_code} · {state.order?.tier_name} × {state.order?.quantity} · {idr(state.order?.total)}
              {" "}(Stripe test mode — tidak ada uang nyata).
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {state.tickets.map((t) => (
                <div key={t.id} className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-4" data-testid={`stripe-ticket-${t.ticket_number}`}>
                  <div className="num text-sm font-semibold">{t.ticket_number}</div>
                  <div className="text-xs text-zinc-500">{t.attendee_name} · {t.tier_name}</div>
                  <div className="num mt-2 break-all text-[11px] text-zinc-500">{t.qr_code}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link to="/app/tickets" className="bg-[var(--okx-accent)] px-5 py-2.5 text-center text-sm font-semibold">My Tickets</Link>
              <Link to="/app/orders" className="border border-[var(--okx-border)] px-5 py-2.5 text-center text-sm font-semibold">Orders & Invoice</Link>
            </div>
          </div>
        )}
        {["failed", "error", "timeout"].includes(state.status) && (
          <div data-testid="stripe-failed" className="border border-red-500/40 bg-red-500/5 p-8">
            <XCircle className="text-red-400" />
            <h1 className="editorial mt-3 text-2xl">Pembayaran belum terkonfirmasi</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Status Stripe belum "paid". Anda dapat mencoba lagi atau memakai metode sandbox internal OKKAX.
            </p>
            <Link to="/discover" className="mt-5 inline-block bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold">Kembali ke Discover</Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div data-testid="stripe-cancel" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8">
          <h1 className="editorial text-2xl">Pembayaran dibatalkan</h1>
          <p className="mt-2 text-sm text-zinc-400">Order Anda tetap berstatus awaiting payment dan tidak ada tiket yang diterbitkan.</p>
          <Link to="/discover" className="mt-5 inline-block bg-[var(--okx-accent)] px-5 py-2.5 text-sm font-semibold">Kembali ke Discover</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
