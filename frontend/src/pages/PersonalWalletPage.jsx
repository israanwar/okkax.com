import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, apiError, idr } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageIntro, { PageIntroEyebrow, PageIntroTitle, PageIntroDescription } from "@/components/PageIntro";

export default function PersonalWalletPage() {
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [methodForm, setMethodForm] = useState({
    bank_name: "Bank Central Asia (BCA)",
    account_number: "",
    account_holder_name: "",
    ewallet_type: "GoPay",
    ewallet_phone: ""
  });

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const [{ data: wData }, { data: tData }, { data: pData }] = await Promise.all([
        api.get("/wallet/personal").catch(() => ({ data: null })),
        api.get("/wallet/transactions").catch(() => ({ data: { items: [] } })),
        api.get("/wallet/payouts").catch(() => ({ data: { items: [] } })),
      ]);
      setWallet(wData);
      setTxs(tData.items || []);
      setPayouts(pData.items || []);
      if (wData?.payout_method) {
        setMethodForm(wData.payout_method);
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!amt || amt < 50000) {
      toast.error("Batas minimum penarikan adalah Rp50.000");
      return;
    }
    if (amt > (wallet?.available_balance || 0)) {
      toast.error("Saldo tersedia tidak mencukupi");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/wallet/withdraw", { amount: amt, destination_type: "bank_transfer" });
      toast.success(res.data?.message || "Permintaan penarikan dana berhasil diproses");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      loadWalletData();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMethod = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/wallet/payout-method", methodForm);
      toast.success("Rekening pencairan dana berhasil diperbarui");
      setMethodOpen(false);
      loadWalletData();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 font-gemini" data-testid="personal-wallet-page">
      <PageIntro testId="wallet-page-intro">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <PageIntroEyebrow>Member Payout & Escrow</PageIntroEyebrow>
            <PageIntroTitle>Dompet & Pencairan Penghasilan</PageIntroTitle>
            <PageIntroDescription>
              Pantau honor shift, pelunasan fee talent, termin kontrak vendor, dan ajukan penarikan ke rekening bank Anda.
            </PageIntroDescription>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setMethodOpen(true)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
              data-testid="edit-payout-method-btn"
            >
              Ubah Rekening Payout
            </button>
            <button
              disabled={!wallet?.can_withdraw}
              onClick={() => setWithdrawOpen(true)}
              className="rounded-lg bg-white px-3 py-1 text-[11px] font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-40 cursor-pointer shadow-sm active:scale-[0.98]"
              data-testid="withdraw-cta-btn"
            >
              Tarik Saldo
            </button>
          </div>
        </div>
      </PageIntro>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 font-gemini">Memuat status saldo dompet…</div>
      ) : (
        <>
          {/* Balance Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.1] bg-[#101018]/90 p-4 shadow-sm">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-400 font-gemini-mono">
                Saldo Tersedia (Ready)
              </span>
              <div className="num text-2xl font-bold text-white font-gemini-mono mt-1" data-testid="available-balance">
                {idr(wallet?.available_balance || 0)}
              </div>
              <p className="text-[10.5px] text-zinc-400 mt-1">Siap ditarik ke rekening bank terdaftar.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 shadow-sm">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-400 font-gemini-mono">
                Escrow Terlindungi (Protected)
              </span>
              <div className="num text-2xl font-bold text-white font-gemini-mono mt-1" data-testid="protected-balance">
                {idr(wallet?.protected_balance || 0)}
              </div>
              <p className="text-[10.5px] text-zinc-400 mt-1">Terkunci di escrow hingga milestone selesai.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 shadow-sm">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                Pending Settlement
              </span>
              <div className="num text-2xl font-bold text-white font-gemini-mono mt-1">
                {idr(wallet?.pending_balance || 0)}
              </div>
              <p className="text-[10.5px] text-zinc-400 mt-1">Pekerjaan/kontrak sedang berjalan.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 p-4 shadow-sm">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                Total Akumulasi Penghasilan
              </span>
              <div className="num text-2xl font-bold text-white font-gemini-mono mt-1">
                {idr(wallet?.lifetime_earnings || 0)}
              </div>
              <p className="text-[10.5px] text-zinc-400 mt-1">Histori bruto sejak bergabung di OKKAX.</p>
            </div>
          </div>

          {/* Payout Destination Info Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Tujuan Transfer Payout Terdaftar</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Penarikan saldo otomatis ditransfer ke rekening di bawah ini.</p>
              </div>
              <span className="num rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-400 font-gemini-mono">
                Terverifikasi KYC
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono block">Bank / Saluran:</span>
                <span className="text-white font-semibold mt-0.5 block">{wallet?.payout_method?.bank_name || "BCA"}</span>
              </div>
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono block">Nomor Rekening:</span>
                <span className="num text-white font-semibold mt-0.5 block font-gemini-mono">
                  {wallet?.payout_method?.account_number || "8720192841"}
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono block">Nama Pemilik Rekening:</span>
                <span className="text-white font-semibold mt-0.5 block">
                  {wallet?.payout_method?.account_holder_name || "Akun Terverifikasi"}
                </span>
              </div>
            </div>
          </div>

          {/* Tables: Mutasi Ledger & Payout History */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Mutasi Ledger */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm" data-testid="wallet-transactions-list">
              <div className="border-b border-white/[0.08] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                Mutasi Transaksi Pendapatan
              </div>
              <div className="divide-y divide-white/[0.06]">
                {txs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">Belum ada mutasi transaksi.</div>
                ) : (
                  txs.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] text-xs">
                      <div>
                        <div className="font-semibold text-white">{tx.title}</div>
                        <div className="num text-[11px] text-zinc-400 font-gemini-mono mt-0.5">
                          Ref: {tx.reference} · {String(tx.created_at || "").slice(0, 10)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`num font-bold font-gemini-mono ${tx.type === "credit" ? "text-emerald-400" : "text-zinc-200"}`}>
                          {tx.type === "credit" ? "+" : "-"}{idr(tx.amount)}
                        </span>
                        <StatusBadge status={tx.status === "settled" ? "Confirmed" : "Pending"} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payout History */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl overflow-hidden shadow-sm" data-testid="wallet-payouts-list">
              <div className="border-b border-white/[0.08] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">
                Riwayat Penarikan Dana
              </div>
              <div className="divide-y divide-white/[0.06]">
                {payouts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500">Belum ada pengajuan penarikan dana.</div>
                ) : (
                  payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] text-xs">
                      <div>
                        <div className="font-semibold text-white">Transfer ke {p.bank_name}</div>
                        <div className="num text-[11px] text-zinc-400 font-gemini-mono mt-0.5">
                          Rek: {p.account_number} · {String(p.created_at || "").slice(0, 10)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="num font-bold text-white font-gemini-mono">{idr(p.amount)}</span>
                        <StatusBadge status={p.status === "completed" ? "Confirmed" : "Pending"} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Withdraw Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="border-white/10 bg-[#0c0c12] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="editorial text-xl text-white">
              Tarik Saldo Pendapatan
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleWithdraw} className="space-y-3.5 text-xs">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-zinc-300">
              <span className="text-[10px] uppercase font-bold text-zinc-400 font-gemini-mono block">Saldo Tersedia:</span>
              <div className="num text-lg font-bold text-emerald-400 font-gemini-mono mt-0.5">
                {idr(wallet?.available_balance || 0)}
              </div>
              <div className="num text-[11px] text-zinc-400 font-gemini-mono mt-0.5">
                Tujuan: {wallet?.payout_method?.bank_name} ({wallet?.payout_method?.account_number})
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nominal Penarikan (IDR)</label>
              <input
                type="number"
                required
                min={50000}
                max={wallet?.available_balance || 0}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Contoh: 1000000"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-gemini-mono"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Minimum penarikan Rp50.000. Tidak ada potongan biaya admin.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Memproses…" : "Konfirmasi Tarik Dana"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payout Method Edit Modal */}
      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="border-white/10 bg-[#0c0c12] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="editorial text-xl text-white">
              Rekening Bank Tujuan Payout
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveMethod} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Bank / Mitra</label>
              <input
                type="text"
                required
                value={methodForm.bank_name}
                onChange={(e) => setMethodForm({ ...methodForm, bank_name: e.target.value })}
                placeholder="Bank Central Asia (BCA), Bank Mandiri, BNI..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nomor Rekening</label>
              <input
                type="text"
                required
                value={methodForm.account_number}
                onChange={(e) => setMethodForm({ ...methodForm, account_number: e.target.value })}
                placeholder="Contoh: 8720192841"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-gemini-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Pemilik Rekening (Sesuai KTP/Buku Tabungan)</label>
              <input
                type="text"
                required
                value={methodForm.account_holder_name}
                onChange={(e) => setMethodForm({ ...methodForm, account_holder_name: e.target.value })}
                placeholder="Nama lengkap..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMethodOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Menyimpan…" : "Simpan Rekening"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
