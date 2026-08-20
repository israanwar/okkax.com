import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, SANDBOX_NOTICE } from "@/lib/api";
import PageIntro, { PageIntroEyebrow, PageIntroTitle, PageIntroDescription } from "@/components/PageIntro";

export default function SettingsPage() {
  const { effectiveRole } = useAuth();
  const isAudience = effectiveRole === "audience";
  const [data, setData] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "org" | "payout" | "notifications" | "security"
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", phone: "", city: "" });
  const [orgForm, setOrgForm] = useState({ org_name: "", legal_name: "", tax_id: "", address: "", website: "" });
  const [notifForm, setNotifForm] = useState({ email_notifications: true, push_notifications: true, action_alerts: true, commercial_updates: true });
  const [payoutForm, setPayoutForm] = useState({ bank_name: "", account_number: "", account_holder_name: "" });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [res, methodsRes] = await Promise.all([
        api.get("/settings/me"),
        isAudience ? api.get("/meta/roles") : Promise.resolve(null),
      ]);
      const d = res.data || {};
      setData(d);
      setPaymentMethods(
        (methodsRes?.data?.payment_methods || []).filter(
          (method) => method.available && !["corporate", "international", "paylater"].includes(method.key)
        )
      );
      setProfileForm({
        name: d.user?.name || "",
        bio: d.profile?.bio || "",
        phone: d.profile?.phone || "",
        city: d.profile?.city || d.user?.city || ""
      });
      setOrgForm({
        org_name: d.organization?.org_name || d.user?.organization_name || "",
        legal_name: d.organization?.legal_name || "",
        tax_id: d.organization?.tax_id || "",
        address: d.organization?.address || "",
        website: d.organization?.website || ""
      });
      setNotifForm({
        email_notifications: d.notifications?.email_notifications ?? true,
        push_notifications: d.notifications?.push_notifications ?? true,
        action_alerts: d.notifications?.action_alerts ?? true,
        commercial_updates: d.notifications?.commercial_updates ?? true
      });
      setPayoutForm({
        bank_name: d.payout_method?.bank_name || "Bank Central Asia (BCA)",
        account_number: d.payout_method?.account_number || "",
        account_holder_name: d.payout_method?.account_holder_name || d.user?.name || ""
      });
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [isAudience]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isAudience && ["org", "payout"].includes(activeTab)) {
      setActiveTab("profile");
    }
  }, [activeTab, isAudience]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/settings/profile", profileForm);
      toast.success("Profil berhasil disimpan");
      loadSettings();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/settings/organization", orgForm);
      toast.success("Informasi organisasi berhasil disimpan");
      loadSettings();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNotifs = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = isAudience
        ? {
            email_notifications: notifForm.email_notifications,
            push_notifications: notifForm.push_notifications,
          }
        : notifForm;
      await api.put("/settings/notifications", payload);
      toast.success("Preferensi notifikasi disimpan");
      loadSettings();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePayout = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/wallet/payout-method", payoutForm);
      toast.success("Rekening pencairan dana berhasil diperbarui");
      loadSettings();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = isAudience
    ? [
        { id: "profile", label: "Profil & Identitas" },
        { id: "payment", label: "Metode Pembayaran" },
        { id: "notifications", label: "Notifikasi" },
        { id: "security", label: "Keamanan & Sesi" },
      ]
    : [
        { id: "profile", label: "Profil & Identitas" },
        { id: "org", label: "Organisasi & Legal" },
        { id: "payout", label: "Rekening Payout" },
        { id: "notifications", label: "Notifikasi" },
        { id: "security", label: "Keamanan & Sesi" },
      ];

  const notificationOptions = isAudience
    ? [
        { key: "email_notifications", label: "Email Tiket, Order & Pembayaran", desc: "Bukti transaksi, invoice, status refund, dan pemberitahuan keamanan akun." },
        { key: "push_notifications", label: "Pengingat Event & Gate Access", desc: "Perubahan jadwal, pengingat event, informasi akses, dan status tiket." },
      ]
    : [
        { key: "email_notifications", label: "Notifikasi Email Transaksi & Keamanan", desc: "Menerima bukti transaksi, invoice, dan konfirmasi login." },
        { key: "push_notifications", label: "Push Notification Browser & Mobile", desc: "Pemberitahuan instan saat ada tugas mendesak atau pesan baru." },
        { key: "action_alerts", label: "Action Center Task Alerts", desc: "Peringatan otomatis saat ada penugasan atau milestone deadline." },
        { key: "commercial_updates", label: "Commercial Deals & Opportunities Updates", desc: "Notifikasi saat penawaran sponsor, RFQ, atau booking diterima." },
      ];

  return (
    <div className="space-y-4 font-gemini" data-testid="unified-settings-page">
      <PageIntro testId="settings-page-intro">
        <div className="min-w-0">
          <PageIntroEyebrow>Settings & Governance</PageIntroEyebrow>
          <PageIntroTitle>{isAudience ? "Pengaturan Akun" : "Pengaturan Akun & Organisasi"}</PageIntroTitle>
          <PageIntroDescription>
            {isAudience
              ? "Kelola profil, metode pembayaran yang tersedia, preferensi notifikasi, dan keamanan sesi."
              : "Kelola profil profesional, badan usaha, integrasi rekening bank, preferensi notifikasi, dan keamanan sesi."}
          </PageIntroDescription>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                activeTab === t.id
                  ? "bg-white text-black font-bold shadow-sm"
                  : "border border-white/[0.1] bg-white/[0.02] text-zinc-400 hover:text-white"
              }`}
              data-testid={`settings-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageIntro>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400 font-gemini">Memuat pengaturan…</div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-6 shadow-sm">
          {/* Tab 1: Profile */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">{isAudience ? "Nama Lengkap" : "Nama Lengkap / Stage Name"}</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Email Akun (Permanen)</label>
                <input
                  type="email"
                  disabled
                  value={data?.user?.email || ""}
                  className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-zinc-400 cursor-not-allowed font-gemini-mono"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nomor WhatsApp / Telepon</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+62 812-..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-gemini-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">{isAudience ? "Kota Domisili" : "Kota Domisili Basis"}</label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    placeholder="Contoh: Makassar"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">{isAudience ? "Bio Singkat" : "Bio / Ringkasan Keahlian Profesional"}</label>
                <textarea
                  rows={4}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  placeholder={isAudience ? "Ceritakan sedikit tentang Anda..." : "Ceritakan pengalaman profesional Anda di industri event..."}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Menyimpan…" : "Simpan Perubahan Profil"}
              </button>
            </form>
          )}

          {/* Tab 2: Organization */}
          {!isAudience && activeTab === "org" && (
            <form onSubmit={handleSaveOrg} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Organisasi / Bisnis Publik</label>
                <input
                  type="text"
                  required
                  value={orgForm.org_name}
                  onChange={(e) => setOrgForm({ ...orgForm, org_name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Badan Hukum Resmi (PT / CV / Yayasan)</label>
                <input
                  type="text"
                  value={orgForm.legal_name}
                  onChange={(e) => setOrgForm({ ...orgForm, legal_name: e.target.value })}
                  placeholder="PT Aruna Nusantara Berdaya"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nomor Pokok Wajib Pajak (NPWP)</label>
                  <input
                    type="text"
                    value={orgForm.tax_id}
                    onChange={(e) => setOrgForm({ ...orgForm, tax_id: e.target.value })}
                    placeholder="01.234.567.8-901.000"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-gemini-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Website Resmi Organisasi</label>
                  <input
                    type="url"
                    value={orgForm.website}
                    onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Alamat Kantor Operasional</label>
                <textarea
                  rows={3}
                  value={orgForm.address}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                  placeholder="Alamat lengkap..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Menyimpan…" : "Simpan Data Organisasi"}
              </button>
            </form>
          )}

          {/* Tab 3: Payout */}
          {!isAudience && activeTab === "payout" && (
            <form onSubmit={handleSavePayout} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Bank / Mitra Transfer</label>
                <input
                  type="text"
                  required
                  value={payoutForm.bank_name}
                  onChange={(e) => setPayoutForm({ ...payoutForm, bank_name: e.target.value })}
                  placeholder="Bank Central Asia (BCA), Bank Mandiri, BNI..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nomor Rekening Bank</label>
                <input
                  type="text"
                  required
                  value={payoutForm.account_number}
                  onChange={(e) => setPayoutForm({ ...payoutForm, account_number: e.target.value })}
                  placeholder="Contoh: 8720192841"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none font-gemini-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Pemilik Rekening</label>
                <input
                  type="text"
                  required
                  value={payoutForm.account_holder_name}
                  onChange={(e) => setPayoutForm({ ...payoutForm, account_holder_name: e.target.value })}
                  placeholder="Nama lengkap sesuai buku tabungan..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Menyimpan…" : "Simpan Rekening Payout"}
              </button>
            </form>
          )}

          {isAudience && activeTab === "payment" && (
            <div className="max-w-2xl space-y-4 text-xs" data-testid="audience-payment-methods">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5 text-amber-100">
                <div className="font-semibold">Metode pembayaran checkout — Sandbox/Demo</div>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">{SANDBOX_NOTICE} Metode dipilih saat checkout dan belum disimpan sebagai kartu atau saldo wallet.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((method) => (
                  <div key={method.key} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    <div className="font-semibold text-white">{method.group}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(method.channels || []).map((channel) => (
                        <span key={channel} className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1 text-[10px] text-zinc-400">{channel}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Notifications */}
          {activeTab === "notifications" && (
            <form onSubmit={handleSaveNotifs} className="space-y-4 max-w-xl text-xs">
              <div className="space-y-3">
                {notificationOptions.map((item) => (
                  <label key={item.key} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-all">
                    <input
                      type="checkbox"
                      checked={notifForm[item.key]}
                      onChange={(e) => setNotifForm({ ...notifForm, [item.key]: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black text-white focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-white">{item.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting ? "Menyimpan…" : "Simpan Preferensi Notifikasi"}
              </button>
            </form>
          )}

          {/* Tab 5: Security */}
          {activeTab === "security" && (
            <div className="space-y-4 max-w-xl text-xs">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
                <span className="text-[10px] uppercase font-bold text-emerald-400 font-gemini-mono block">Status Keamanan:</span>
                <div className="font-bold text-emerald-300 mt-0.5">Sesi Terenkripsi & Server-Authoritative</div>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  {isAudience
                    ? "Akses tiket, order, dan pengaturan akun dilindungi dengan token sesi kriptografis."
                    : "Setiap aksi komersial dan penarikan dana dilindungi dengan token sesi kriptografis."}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono block">
                  Perangkat & Sesi Aktif
                </span>
                {(data?.sessions || []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div>
                      <div className="font-semibold text-white">{s.device}</div>
                      {(s.ip || s.location) && <div className="num text-[11px] text-zinc-400 font-gemini-mono mt-0.5">{s.ip ? `IP: ${s.ip}` : ""}{s.ip && s.location ? " · " : ""}{s.location || ""}</div>}
                    </div>
                    <span className="num rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-300 font-gemini-mono">
                      {s.is_current ? "Saat ini" : s.last_active ? new Date(s.last_active).toLocaleDateString("id-ID") : "Sesi aktif"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
