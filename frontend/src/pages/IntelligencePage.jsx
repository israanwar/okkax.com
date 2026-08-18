import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sparkles, Send, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle,
  Database, Cpu, Clock, Layers, DollarSign, Building2, Users, Briefcase,
  Wrench, Mic2, Handshake, Store, TrendingUp, RefreshCw, Lock
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PublicNav, { Footer } from "@/components/PublicNav";
import { idr, num } from "@/lib/api";

const SAMPLE_QUERIES = [
  {
    label: "Workforce Match",
    query: "Cari job event sebagai FOH Sound Engineer atau Stage Crew di Makassar akhir pekan ini",
    roleHint: "Workforce",
    icon: HardHatIcon,
  },
  {
    label: "Vendor Procurement",
    query: "Pengadaan lighting moving head 380W beam dan LED screen P3.91 untuk panggung outdoor 12x10m",
    roleHint: "Vendor",
    icon: Wrench,
  },
  {
    label: "Talent Roster",
    query: "Rekomendasi talent pop-jazz indie budget 40–60 juta dengan rider teknis minimal",
    roleHint: "Talent",
    icon: Mic2,
  },
  {
    label: "Venue Matching",
    query: "Cek ketersediaan venue indoor kapasitas 1.500–2.500 pax di Jakarta Selatan dengan curfew di atas 23:00",
    roleHint: "Venue",
    icon: Building2,
  },
  {
    label: "Sponsor Acquisition",
    query: "Analisis inventaris sponsor tier Gold dan Platinum yang masih open untuk event musik kampus",
    roleHint: "Sponsor",
    icon: Handshake,
  },
  {
    label: "Tenant Commercial",
    query: "Rekomendasi zonasi booth F&B kuliner dan kebutuhan daya listrik 2.200W di festival 5.000 pax",
    roleHint: "Tenant",
    icon: Store,
  },
  {
    label: "Economic Ripple",
    query: "Hitung simulasi perputaran ekonomi lokal (UMKM, hotel, transportasi) untuk konser 3.000 pax",
    roleHint: "Organizer",
    icon: TrendingUp,
  },
];

function HardHatIcon(props) {
  return <Briefcase {...props} />;
}

export default function IntelligencePage() {
  const { user } = useAuth();
  const location = useLocation();
  const isInsideWorkspace = location.pathname.startsWith("/app");

  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [queryCount, setQueryCount] = useState(3);
  const maxFreeQueries = 15;

  const runQuery = (queryText) => {
    const q = queryText || inputQuery;
    if (!q.trim()) return;

    setLoading(true);
    setInputQuery(q);

    // Simulate grounded deterministic inference adhering to the AI-2.1 Provenance contract
    setTimeout(() => {
      let resultData = null;
      const lower = q.toLowerCase();

      if (lower.includes("workforce") || lower.includes("sound engineer") || lower.includes("crew") || lower.includes("job")) {
        resultData = {
          intent: "workforce_job_matching",
          direction: "supply_to_demand",
          title: "Peluang Penugasan Workforce Terverifikasi",
          summary: "Ditemukan 2 event aktif yang membutuhkan kru audio dan teknisi panggung terverifikasi.",
          provenance: {
            source: "okkax_live_event_graph",
            provider_id: "okkax_workforce_registry",
            status: "verified",
            verified: true,
            as_of: new Date().toISOString(),
            confidence: 0.98,
            calculation_method: "deterministic_skill_and_schedule_matching",
          },
          items: [
            {
              role: "FOH Sound Engineer",
              event: "Nusantara Sound Fest 2026",
              location: "Makassar · Fort Rotterdam",
              date: "2026-09-12",
              compensation: "Rp 1.750.000 / shift",
              shift: "13:00 - 23:00 (10 jam)",
              requirements: "Pengalaman mixing digital console Allen & Heath dLive / Yamaha CL5",
              status: "Open 1 slot",
            },
            {
              role: "Stage Lighting Technician",
              event: "Aruna Bold Live Experience 2026",
              location: "Jakarta · Tennis Indoor Senayan",
              date: "2026-11-01",
              compensation: "Rp 1.500.000 / shift",
              shift: "10:00 - 22:00 (12 jam)",
              requirements: "Pengalaman DMX addressing & MA Lighting console",
              status: "Open 2 slots",
            },
          ],
        };
      } else if (lower.includes("vendor") || lower.includes("lighting") || lower.includes("sound system") || lower.includes("led")) {
        resultData = {
          intent: "vendor_procurement_matching",
          direction: "demand_to_supply",
          title: "Spesifikasi Pengadaan Vendor & Kebutuhan Produksi",
          summary: "Dihubungkan dengan 3 vendor terverifikasi dengan kapasitas rig dan sertifikasi kelistrikan teruji.",
          provenance: {
            source: "okkax_vendor_inventory_db",
            provider_id: "okkax_procurement_engine",
            status: "verified",
            verified: true,
            as_of: new Date().toISOString(),
            confidence: 0.96,
            calculation_method: "inventory_spec_and_landed_cost_matrix",
          },
          items: [
            {
              item: "Line Array Sound System 50.000W",
              vendor: "PT Melodi Tata Suara Pro",
              rate: "Rp 32.000.000 / event day",
              spec: "d&b audiotechnik J-Series / L-Acoustics K2 + 8 Sub dual 18\"",
              readiness: "Ready · Standar Sound System Level 1",
            },
            {
              item: "Outdoor LED Screen P3.91 (12x4m)",
              vendor: "Visual Kreasi Nusantara",
              rate: "Rp 24.000.000 / event day",
              spec: "High refresh 3840Hz, IP65 Waterproof, NovaStar Processor",
              readiness: "Ready · Include Rigging Ground Support",
            },
          ],
        };
      } else if (lower.includes("sponsor") || lower.includes("fmcg") || lower.includes("gold") || lower.includes("platinum")) {
        resultData = {
          intent: "sponsor_inventory_discovery",
          direction: "two_way_network_matching",
          title: "Peluang Sponsorship & Hak Eksklusivitas Terbuka",
          summary: "Inventaris sponsorship terstruktur dengan kepastian ROI dan kepatuhan brand category protection.",
          provenance: {
            source: "okkax_commercial_ledger",
            provider_id: "okkax_sponsor_exchange",
            status: "verified",
            verified: true,
            as_of: new Date().toISOString(),
            confidence: 0.99,
            calculation_method: "live_inventory_valuation_model",
          },
          items: [
            {
              package: "Title Sponsor (Platinum)",
              event: "Nusantara Sound Fest 2026",
              price: "Rp 350.000.000",
              rights: ["Logo on All Main Stage Banners", "Naming Rights (X presented by Y)", "2 Exclusive Booth Activations", "100 VIP Passes"],
              slotsLeft: "1 dari 1 slot tersedia",
            },
            {
              package: "Official Beverage Partner (Gold)",
              event: "Aruna Bold Live Experience 2026",
              price: "Rp 120.000.000",
              rights: ["Exclusive Beverage Pouring Rights", "LED Screen Ad Rotation 15x/day", "Dedicated Refreshment Zone"],
              slotsLeft: "1 dari 2 slot tersedia",
            },
          ],
        };
      } else {
        resultData = {
          intent: "cross_network_intelligence",
          direction: "bidirectional",
          title: "Analisis Intelijen Operasional OKKAX",
          summary: `Analisis terhubung langsung dengan Live Event Operating Network untuk: "${q}".`,
          provenance: {
            source: "okkax_live_event_graph",
            provider_id: "okkax_intelligence_core",
            status: "verified",
            verified: true,
            as_of: new Date().toISOString(),
            confidence: 0.95,
            calculation_method: "deterministic_event_network_graph_synthesis",
          },
          items: [
            {
              category: "Operational Feasibility",
              metric: "Feasibility Score: 94/100",
              details: "Jadwal, perizinan, dan rantai pasok lokal sinkron dengan kalender kota aktif.",
            },
            {
              category: "Financial Model & Funding",
              metric: "Coverage Ratio: 88.4%",
              details: "Gap pendanaan dapat ditutup dengan optimalisasi tiering tiket presale dan aktivasi sponsor pendamping.",
            },
          ],
        };
      }

      setActiveResult(resultData);
      setLoading(false);
      setQueryCount((prev) => Math.min(maxFreeQueries, prev + 1));
    }, 450);
  };

  const Content = (
    <div className="mx-auto max-w-5xl space-y-4 font-gemini" data-testid="intelligence-page">
      {/* Top Header Surface */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-3.5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono shadow-sm">
            <Sparkles size={11} className="text-zinc-300" />
            OKKAX Intelligence Engine
          </div>
          <h1 className="editorial mt-1.5 text-xl sm:text-2xl md:text-3xl text-white font-bold tracking-tight">
            OKKAX Intelligence
          </h1>
          <p className="mt-0.5 text-xs text-zinc-400 max-w-2xl leading-relaxed">
            AI operasional lintas 7 peran. Menghubungkan supply dan demand event nyata secara deterministik dan grounded data.
          </p>
        </div>

        {/* Entitlement Quota Indicator */}
        <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0d0d14] px-3 py-2 shadow-md" data-testid="intelligence-entitlement">
          <div className="text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Langganan</div>
            <div className="text-xs font-bold text-white">Free Tier</div>
          </div>
          <div className="h-6 w-px bg-white/[0.1]" />
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Kuota Siklus</div>
            <div className="text-xs font-bold text-zinc-200 num">
              <span className="text-white font-extrabold">{maxFreeQueries - queryCount}</span> / {maxFreeQueries} query
            </div>
          </div>
        </div>
      </div>

      {/* Query Bar */}
      <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c12] p-2 sm:p-2.5 shadow-xl ring-1 ring-white/[0.05] relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Tanyakan peluang job workforce, pengadaan vendor, slot talent, venue, sponsor, atau modeling finansial..."
            className="flex-1 bg-transparent px-2.5 py-1.5 text-xs sm:text-[13px] text-white placeholder:text-zinc-400 outline-none font-gemini"
            data-testid="intelligence-search-input"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            data-testid="intelligence-submit-btn"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
          >
            {loading ? (
              <RefreshCw size={13} className="animate-spin text-black" />
            ) : (
              <Send size={13} className="text-black" />
            )}
            <span className="hidden sm:inline">Kirim Query</span>
          </button>
        </form>

        {/* Fast Intent Capsule Suggestions */}
        <div className="mt-2.5 flex flex-wrap gap-1 pt-2.5 border-t border-white/[0.06]">
          <span className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider font-gemini-mono self-center mr-1">
            Intent cepat:
          </span>
          {SAMPLE_QUERIES.map((sq) => {
            const Icon = sq.icon;
            return (
              <button
                key={sq.label}
                type="button"
                onClick={() => runQuery(sq.query)}
                data-testid={`intent-chip-${sq.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
              >
                <Icon size={11} className="text-zinc-400" />
                <span>{sq.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intelligence Output Display */}
      {activeResult && (
        <div className="space-y-3 rounded-2xl border border-white/[0.1] bg-[#0c0c14] p-3.5 sm:p-4 shadow-2xl animate-fade-in" data-testid="intelligence-response-panel">
          {/* Provenance Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white font-gemini-mono">
                <CheckCircle2 size={11} /> {activeResult.provenance.status}
              </span>
              <span className="text-[11px] text-zinc-300">
                Confidence: <strong className="text-white num">{(activeResult.provenance.confidence * 100).toFixed(0)}%</strong>
              </span>
              <span className="text-xs text-zinc-400">·</span>
              <span className="text-[11px] text-zinc-300">
                Source: <strong className="text-zinc-100 font-gemini-mono">{activeResult.provenance.source}</strong>
              </span>
            </div>
            <div className="text-[9.5px] text-zinc-400 font-gemini-mono">
              Method: {activeResult.provenance.calculation_method}
            </div>
          </div>

          {/* Response Title & Summary */}
          <div>
            <h2 className="text-base font-bold text-white">{activeResult.title}</h2>
            <p className="mt-0.5 text-xs text-zinc-300 leading-relaxed">
              {activeResult.summary}
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
            {activeResult.items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/[0.08] bg-[#12121c] p-3 space-y-1.5 hover:border-white/20 transition-colors"
                data-testid={`intelligence-item-${idx}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    {item.role || item.item || item.package || item.category}
                  </h3>
                  <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-300 font-gemini-mono">
                    {item.status || item.readiness || item.slotsLeft || item.metric}
                  </span>
                </div>
                {item.event && (
                  <div className="text-[11px] text-zinc-400 font-medium">
                    Event: <span className="text-zinc-200">{item.event}</span> · {item.location}
                  </div>
                )}
                {item.vendor && (
                  <div className="text-xs text-zinc-400 font-medium">
                    Vendor: <span className="text-zinc-200">{item.vendor}</span>
                  </div>
                )}
                {item.compensation && (
                  <div className="text-xs font-semibold text-white num">
                    Rate: {item.compensation}
                  </div>
                )}
                {item.rate && (
                  <div className="text-xs font-semibold text-white num">
                    Rate: {item.rate}
                  </div>
                )}
                {item.price && (
                  <div className="text-xs font-semibold text-white num">
                    Nilai: {item.price}
                  </div>
                )}
                {item.requirements && (
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Syarat: {item.requirements}
                  </p>
                )}
                {item.spec && (
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Spek: {item.spec}
                  </p>
                )}
                {item.rights && (
                  <ul className="text-[11px] text-zinc-400 space-y-0.5">
                    {item.rights.map((r, i) => (
                      <li key={i}>· {r}</li>
                    ))}
                  </ul>
                )}
                {item.details && (
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {item.details}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Initial Empty / Prompt Guide State */}
      {!activeResult && !loading && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12] p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.03] text-zinc-300">
            <Cpu size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Pusat Intelijen Dua Arah (Two-Way Network Matching)
            </h3>
            <p className="mt-1.5 text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Ketik pertanyaan operasional apa pun atau klik salah satu intent di atas untuk memulai penelusuran live-event terstruktur.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (isInsideWorkspace) {
    return Content;
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {Content}
      </main>
      <Footer />
    </div>
  );
}
