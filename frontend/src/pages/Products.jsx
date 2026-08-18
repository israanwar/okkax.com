// Product showcase routes. One page per canonical product concept.
// Route: /products/:slug
//
// Six products per the Products dropdown in PublicNav. Event Graph is
// deliberately NOT a standalone product; it is a capability inside Event
// Studio and appears on the /demo page instead.
//
// Data rule: PUBLIC readers see sanitized public read projections drawn
// from canonical backend catalogs. No hardcoded sample entities.
// Protected detail and actions remain gated behind sign-in and role.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Lock,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Waypoints,
  Zap,
} from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, apiError, compact, idr, num } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Reveal,
  RevealGroup,
  RevealItem,
  MaskReveal,
  MotionPanel,
  ScrollProgressBar,
  CounterNumber,
  SpotlightCard,
} from "@/components/MotionPrimitives";

// ============================================================================
// EVENT STUDIO  (preserved interactive experience)
// ============================================================================

const EVENT_TYPES = {
  Concert: {
    description: "Live music production with talent, venue, production, workforce, ticketing, and access dependencies.",
    requirements: [
      ["Venue", "ready", "Venue capacity and date are compatible.", "Production layout can proceed."],
      ["Talent", "ready", "Headline talent availability is confirmed.", "Show programming can proceed."],
      ["Production Vendor", "ready", "Production partner is available.", "Technical planning can proceed."],
      ["Workforce", "risk", "12 security positions remain unfilled.", "Gate Operations and Access Readiness are blocked."],
      ["Ticketing", "pending", "Ticket inventory has not been activated.", "Public sales cannot begin."],
      ["Permits", "ready", "Core event permit requirement is recorded.", "No critical compliance blocker detected."],
    ],
  },
  Conference: {
    description: "Conference orchestration across venue, speakers, AV, workforce, access, and operational schedules.",
    requirements: [
      ["Venue", "ready", "Conference venue is available.", "Room planning can proceed."],
      ["Speakers", "ready", "Core speaker availability is confirmed.", "Agenda planning can proceed."],
      ["AV Vendor", "ready", "AV requirement is covered.", "Technical production can proceed."],
      ["Workforce", "risk", "8 registration staff remain unassigned.", "Guest arrival flow is at risk."],
      ["Access", "pending", "Delegate access rules are incomplete.", "Check-in setup cannot finalize."],
      ["Permits", "ready", "No critical permit blocker detected.", "Operational planning can continue."],
    ],
  },
  Exhibition: {
    description: "Exhibition planning across venue zones, exhibitors, vendors, workforce, access, and tenant operations.",
    requirements: [
      ["Venue", "ready", "Exhibition venue is available.", "Floor planning can proceed."],
      ["Exhibitors", "ready", "Initial exhibitor allocation exists.", "Zone planning can proceed."],
      ["Vendor", "ready", "Booth production support is available.", "Build schedule can proceed."],
      ["Workforce", "risk", "Loading crew requirement is incomplete.", "Build-in schedule is at risk."],
      ["Access", "pending", "Exhibitor access has not been finalized.", "Operational access remains incomplete."],
      ["Compliance", "ready", "Core compliance requirement is recorded.", "No critical compliance blocker detected."],
    ],
  },
  "Brand Activation": {
    description: "Brand activation planning across location, production, crew, audience access, and campaign operations.",
    requirements: [
      ["Location", "ready", "Activation location is available.", "Spatial design can proceed."],
      ["Production", "ready", "Production support is available.", "Build planning can proceed."],
      ["Brand Team", "ready", "Brand owner requirement is recorded.", "Approval workflow can proceed."],
      ["Workforce", "risk", "Field crew is below requirement.", "Activation readiness is at risk."],
      ["Access", "pending", "Audience access flow is incomplete.", "Entry operations cannot finalize."],
      ["Compliance", "ready", "Core compliance requirement is recorded.", "No critical compliance blocker detected."],
    ],
  },
  "Private Event": {
    description: "Private event planning with venue, suppliers, guests, staffing, access, and payment dependencies.",
    requirements: [
      ["Venue", "ready", "Venue is available.", "Event setup can proceed."],
      ["Suppliers", "ready", "Core suppliers are available.", "Procurement can proceed."],
      ["Guest Plan", "ready", "Guest requirement is recorded.", "Hospitality planning can proceed."],
      ["Workforce", "risk", "Guest service staffing is incomplete.", "Arrival experience is at risk."],
      ["Access", "pending", "Guest access rule is incomplete.", "Entry setup cannot finalize."],
      ["Payment", "ready", "Funding requirement is recorded.", "Commercial planning can continue."],
    ],
  },
};

function EventStudioProduct() {
  const [eventType, setEventType] = useState("Concert");
  const [compiled, setCompiled] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [selected, setSelected] = useState("Workforce");

  const model = EVENT_TYPES[eventType];
  const readiness = resolved ? 92 : 68;

  const requirements = model.requirements.map(([name, status, detail, impact]) => ({
    name,
    status:
      resolved && (name === "Workforce" || name === "Ticketing" || name === "Access")
        ? "ready"
        : status,
    detail,
    impact,
  }));

  const current = requirements.find((item) => item.name === selected) || requirements[0];

  const statusLabel = (status) =>
    status === "ready" ? "READY" : status === "risk" ? "AT RISK" : "PENDING";

  const statusClass = (status) =>
    status === "ready"
      ? "text-emerald-300 border-emerald-500/40 bg-emerald-950/40 rounded-full"
      : status === "risk"
      ? "text-amber-300 border-amber-500/40 bg-amber-950/40 rounded-full"
      : "text-zinc-400 border-white/[0.1] bg-white/[0.03] rounded-full";

  const chooseType = (type) => {
    setEventType(type);
    setCompiled(false);
    setResolved(false);
    setSelected("Workforce");
  };

  return (
    <ProductShell testid="event-studio-product" title="From event intent to executable operations." tagline="EVENT STUDIO" lead="Pilih jenis event, compile kebutuhan utamanya, lalu lihat bagaimana OKKAX membentuk Blueprint, Event ID, dependency, readiness, dan rekomendasi operasional." interactive>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SpotlightCard className="overflow-hidden">
          <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-b border-white/[0.08] p-6 lg:border-b-0 lg:border-r bg-[#09090f]/60">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                01 · EVENT INTENT
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">What are you building?</p>
              <div className="mt-4 grid gap-2">
                {Object.keys(EVENT_TYPES).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={eventType === type}
                    onClick={() => chooseType(type)}
                    className={
                      "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all cursor-pointer " +
                      (eventType === type
                        ? "border-white/40 bg-white/[0.1] text-white shadow-sm"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white")
                    }
                  >
                    <span>{type}</span>
                    <span className="text-zinc-400">&rarr;</span>
                  </button>
                ))}
              </div>
              <p className="mt-5 text-xs leading-5 text-zinc-400">{model.description}</p>
              <button
                type="button"
                onClick={() => { setCompiled(true); setResolved(false); setSelected("Workforce"); }}
                data-testid="event-studio-compile"
                className="mt-6 w-full rounded-xl bg-white hover:bg-zinc-200 text-black px-4 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                Compile Event Blueprint
              </button>
            </div>

            <div className="min-w-0">
              {!compiled ? (
                <div className="flex min-h-[470px] items-center justify-center p-8">
                  <div className="max-w-md text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.04] text-xl text-white shadow-sm">
                      <Sparkles size={22} aria-hidden="true" />
                    </div>
                    <h2 className="editorial mt-6 text-2xl text-white">Ready to compile.</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      Event Studio mengubah intent menjadi requirement, dependency, readiness, dan satu Event ID yang dapat digunakan oleh seluruh sistem OKKAX.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col gap-4 border-b border-white/[0.08] p-6 sm:flex-row sm:items-end sm:justify-between bg-[#09090f]/60">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                        EVENT BLUEPRINT COMPILED
                      </div>
                      <h2 className="editorial mt-2 text-2xl text-white">{eventType} Blueprint</h2>
                      <div className="mt-1 font-mono text-xs text-zinc-400">
                        EVENT ID · DEMO-EVT-2026-0001
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">Readiness</div>
                      <div data-testid="event-studio-readiness" className="mt-1 font-mono text-2xl font-bold text-white">{readiness}%</div>
                    </div>
                  </div>

                  <div className="grid xl:grid-cols-[1fr_330px]">
                    <div className="border-b border-white/[0.08] p-6 xl:border-b-0 xl:border-r">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                          02 · EVENT GRAPH
                        </div>
                        <div className="text-[10px] text-zinc-400 font-gemini-mono">Click a node to inspect</div>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {requirements.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setSelected(item.name)}
                            data-testid={`event-studio-node-${item.name.toLowerCase().replace(/[^a-z0-9]/g,'')}`}
                            className={
                              "min-h-[88px] rounded-xl border p-3.5 text-left transition-all cursor-pointer " +
                              (selected === item.name
                                ? "border-white/40 bg-white/[0.1] shadow-sm"
                                : "border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]")
                            }
                          >
                            <div className="text-sm font-semibold text-zinc-100">{item.name}</div>
                            <div className={"mt-3 inline-flex border px-2.5 py-0.5 text-[9px] font-bold tracking-[0.16em] " + statusClass(item.status)}>
                              {statusLabel(item.status)}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-6 border-t border-white/[0.08] pt-5">
                        <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">
                          Critical dependency path
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-gemini-mono">
                          <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-amber-300 font-semibold">Workforce</span>
                          <span className="text-zinc-600">&rarr;</span>
                          <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-zinc-300">Gate Operations</span>
                          <span className="text-zinc-600">&rarr;</span>
                          <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-zinc-300">Access Readiness</span>
                          <span className="text-zinc-600">&rarr;</span>
                          <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-zinc-300">Showtime</span>
                        </div>
                      </div>
                    </div>

                    <aside className="p-6 bg-[#09090f]/40">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                        NODE INSPECTOR
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-white">{current.name}</h3>
                      <div className={"mt-3 inline-flex border px-2.5 py-0.5 text-[9px] font-bold tracking-[0.16em] " + statusClass(current.status)}>
                        {statusLabel(current.status)}
                      </div>
                      <dl className="mt-6 space-y-5">
                        <div>
                          <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">Evidence</dt>
                          <dd className="mt-1.5 text-xs leading-5 text-zinc-300">{current.detail}</dd>
                        </div>
                        <div>
                          <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">Impact</dt>
                          <dd className="mt-1.5 text-xs leading-5 text-zinc-300">{current.impact}</dd>
                        </div>
                      </dl>
                    </aside>
                  </div>

                  <div className="border-t border-white/[0.08] bg-[#07070b] p-6">
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                          03 · OKKAX INTELLIGENCE
                        </div>
                        {!resolved ? (
                          <>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-200">
                              Workforce adalah blocker utama. 12 posisi security belum terisi dan memengaruhi Gate Operations, Access Readiness, lalu Showtime.
                            </p>
                            <p className="mt-2 text-xs leading-5 text-zinc-400 font-gemini">
                              Recommendation: review available workforce, complete assignments, then finalize access setup.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-300 font-medium">
                              Demo action applied. Critical workforce and access blockers are now resolved.
                            </p>
                            <p className="mt-2 text-xs leading-5 text-zinc-400 font-gemini">
                              Readiness changed from 68% to 92% in this deterministic simulation.
                            </p>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={resolved}
                        onClick={() => { setResolved(true); setSelected("Workforce"); }}
                        data-testid="event-studio-run"
                        className="min-w-[190px] rounded-xl bg-white hover:bg-zinc-200 text-black px-5 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                      >
                        {resolved ? "Recommendation Applied" : "Run Recommendation"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>Blueprint</span><span>&rarr;</span><span>Network</span><span>&rarr;</span>
          <span>Ticket Studio</span><span>&rarr;</span><span>LivePass</span><span>&rarr;</span>
          <span>Operations</span><span>&rarr;</span><span>Finance</span>
        </div>

        <CtaRow primary={["Build an Event", "/register"]} secondary={["Explore Full Demo", "/demo"]} />
      </section>
    </ProductShell>
  );
}

// ============================================================================
// NETWORK  (real backend catalogs, public read projection)
// ============================================================================

const NETWORK_TYPES = ["All", "Talent", "Venue", "Vendor", "Workforce", "Tenant"];

// Normalize each catalog entity to a single shape for the unified network view.
function normalizeTalent(t) {
  return {
    id: t.id,
    type: "Talent",
    name: t.name,
    city: t.city || "",
    category: t.category || t.genre || "Music",
    rating: typeof t.rating === "number" ? t.rating : t.delivery_score ? Math.round((t.delivery_score / 20) * 10) / 10 : null,
    portfolio: t.portfolio || 0,
    verified: t.fee_status === "Verified Fee" || t.verified === true,
    availability: (t.availability || []).length,
    teaser: t.bio || "",
    accent: `${t.duration_min || 0} min set • ${t.completed_events || 0} events`,
  };
}
function normalizeVenue(v) {
  return {
    id: v.id,
    type: "Venue",
    name: v.name,
    city: v.city || "",
    category: (v.event_types && v.event_types[0]) || "Multi-purpose",
    rating: typeof v.rating === "number" ? v.rating : v.delivery_score ? Math.round((v.delivery_score / 20) * 10) / 10 : null,
    portfolio: (v.facilities || []).length,
    verified: !!v.verified || v.delivery_score > 85,
    availability: (v.availability || []).length,
    teaser: `${v.address || ""}`.trim(),
    accent: `${v.area_sqm ? v.area_sqm + " sqm" : ""}${v.curfew ? " • curfew " + v.curfew : ""}`,
  };
}
function normalizeVendor(v) {
  return {
    id: v.id,
    type: "Vendor",
    name: v.name,
    city: v.city || "",
    category: v.category || (v.capabilities && v.capabilities[0]) || "Production",
    rating: typeof v.rating === "number" ? v.rating : v.delivery_score ? Math.round((v.delivery_score / 20) * 10) / 10 : null,
    portfolio: v.portfolio || 0,
    verified: v.verified === true || v.document_status === "Verified",
    availability: null,
    teaser: (v.capabilities || []).slice(0, 3).join(", "),
    accent: `${v.completed_events || 0} events • ${v.experience_years || 0}y exp`,
  };
}
function normalizeWorker(w) {
  return {
    id: w.id,
    type: "Workforce",
    name: w.name,
    city: w.city || "",
    category: w.category || (w.skills && w.skills[0]) || "Crew",
    rating: typeof w.rating === "number" ? w.rating : null,
    portfolio: w.completed_events || 0,
    verified: w.verified === true || w.attendance_rate > 90,
    availability: (w.availability || []).length,
    teaser: (w.skills || []).slice(0, 3).join(", "),
    accent: `${w.attendance_rate || 0}% attendance • ${w.experience_years || 0}y`,
  };
}
function normalizeTenant(t) {
  return {
    id: t.id,
    type: "Tenant",
    name: t.business_name,
    city: t.city || "",
    category: t.product_category || "Tenant",
    rating: typeof t.rating === "number" ? t.rating : null,
    portfolio: t.completed_events || (t.event_history || []).length,
    verified: t.food_safety === true,
    availability: null,
    teaser: t.description || "",
    accent: `${(t.products || []).slice(0, 1).join("")}${t.experience_years ? " • " + t.experience_years + "y" : ""}`,
  };
}

function useNetworkCatalog() {
  const [data, setData] = useState({ items: [], loading: true, err: "" });
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [t, v, vn, w, tn] = await Promise.all([
          api.get("/catalog/talents"),
          api.get("/catalog/venues"),
          api.get("/catalog/vendors"),
          api.get("/catalog/workers"),
          api.get("/catalog/tenants"),
        ]);
        if (cancel) return;
        const items = []
          .concat((t.data?.items || t.data || []).map(normalizeTalent))
          .concat((v.data?.items || v.data || []).map(normalizeVenue))
          .concat((vn.data?.items || vn.data || []).map(normalizeVendor))
          .concat((w.data?.items || w.data || []).map(normalizeWorker))
          .concat((tn.data?.items || tn.data || []).map(normalizeTenant));
        setData({ items, loading: false, err: "" });
      } catch (e) {
        if (cancel) return;
        setData({ items: [], loading: false, err: apiError(e) });
      }
    })();
    return () => { cancel = true; };
  }, []);
  return data;
}

function NetworkProduct() {
  const { user } = useAuth();
  const { items, loading, err } = useNetworkCatalog();
  const [type, setType] = useState("All");
  const [city, setCity] = useState("All");
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [limit, setLimit] = useState(24);

  const cities = useMemo(() => {
    const set = new Set(items.map((x) => x.city).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((x) => {
      if (type !== "All" && x.type !== type) return false;
      if (city !== "All" && x.city !== city) return false;
      if (verifiedOnly && !x.verified) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${x.name} ${x.category} ${x.city} ${x.teaser}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, type, city, verifiedOnly, query]);

  const visible = filtered.slice(0, limit);
  const selected = selectedId ? items.find((x) => x.id === selectedId) : visible[0];

  const counts = useMemo(() => {
    const c = { All: items.length };
    for (const t of NETWORK_TYPES.slice(1)) c[t] = items.filter((x) => x.type === t).length;
    return c;
  }, [items]);

  return (
    <ProductShell testid="network-product" title="The live event economy, connected." tagline="OKKAX NETWORK" lead="Cari talent, venue, vendor, workforce, dan tenant dari satu jaringan nasional. Availability, reputation, dan pengalaman event dibaca dalam konteks event." interactive>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SpotlightCard className="overflow-hidden">
          {/* Type filter */}
          <div className="border-b border-white/[0.08] p-5 sm:p-6 bg-[#09090f]/60">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                WHAT DO YOU NEED?
              </div>
              <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">
                {loading ? "Memuat catalog..." : `${filtered.length.toLocaleString("id-ID")} matching profiles`}
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {NETWORK_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setLimit(24); setSelectedId(null); }}
                  data-testid={`network-type-${t.toLowerCase()}`}
                  className={
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer " +
                    (type === t
                      ? "border-white/40 bg-white/[0.1] text-white shadow-sm"
                      : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white")
                  }
                >
                  <span>{t}</span>
                  <span className="text-[10px] text-zinc-400 font-gemini-mono">{counts[t] || 0}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setType("Sponsor")}
                data-testid="network-type-sponsor"
                className="ml-1 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:border-white/20 hover:text-white cursor-pointer"
              >
                <Lock size={11} aria-hidden="true" /> Sponsor
              </button>
            </div>
          </div>

          {/* Search + filter */}
          <div className="grid border-b border-white/[0.08] md:grid-cols-[1fr_220px_auto] bg-[#0c0c12]">
            <label className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 py-3 md:border-b-0 md:border-r">
              <Search size={15} aria-hidden="true" className="text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, category, or city"
                data-testid="network-search"
                className="w-full bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>
            <label className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 py-3 md:border-b-0 md:border-r">
              <MapPin size={15} aria-hidden="true" className="text-zinc-500" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                data-testid="network-city"
                className="w-full bg-transparent px-1 py-1 text-sm text-zinc-300 outline-none"
              >
                {cities.map((c) => <option key={c} value={c} className="bg-[#0c0c12] text-white">{c}</option>)}
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 px-5 py-3 text-xs text-zinc-400 font-gemini">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                data-testid="network-verified"
                className="accent-white"
              />
              Verified only
            </label>
          </div>

          {/* Sponsor gated state */}
          {type === "Sponsor" ? (
            <div className="p-8 sm:p-12" data-testid="network-sponsor-gated">
              <div className="mx-auto max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.04] text-white shadow-sm">
                  <Lock size={20} aria-hidden="true" />
                </div>
                <h3 className="editorial mt-5 text-2xl text-white">Sponsor discovery is a signed-in surface</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Sponsor opportunities dan brand fit terkunci sesuai kebijakan data. Masuk sebagai Sponsor untuk membuka opportunity feed penuh.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link to={user ? "/app/sponsor" : "/login"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-5 py-2.5 text-xs font-bold shadow-md transition-all active:scale-[0.98]">
                    {user ? "Buka Sponsor Portal" : "Sign In sebagai Sponsor"}
                  </Link>
                  <Link to="/for/sponsors" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.15] bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-zinc-100 hover:border-white/30 hover:bg-white/[0.08] transition-all">
                    Lihat For Sponsors
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_340px]">
              {/* Results grid */}
              <div className="min-w-0 border-b border-white/[0.08] lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-3.5 bg-[#09090f]/50">
                  <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">
                    {loading ? "..." : `Showing ${visible.length} of ${filtered.length}`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 font-gemini-mono">
                    <ShieldCheck size={12} aria-hidden="true" className="text-emerald-400" /> Public preview
                  </span>
                </div>
                {err ? (
                  <div className="p-10 text-center text-sm text-amber-300" data-testid="network-error">{err}</div>
                ) : loading ? (
                  <div className="p-10 text-center text-sm text-zinc-400" data-testid="network-loading">Memuat entitas dari catalog...</div>
                ) : visible.length === 0 ? (
                  <div className="p-10 text-center text-sm text-zinc-400">Tidak ada profil sesuai filter. Sesuaikan filter.</div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2" data-testid="network-results">
                      {visible.map((item) => {
                        const isSel = (selected && selected.id === item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            data-testid={`network-item-${item.id}`}
                            className={
                              "min-h-[142px] border-b border-r border-white/[0.06] p-5 text-left transition-all cursor-pointer " +
                              (isSel ? "bg-white/[0.08]" : "bg-transparent hover:bg-white/[0.03]")
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">
                                  {item.type}
                                </div>
                                <div className="mt-1.5 truncate text-sm font-bold text-white">
                                  {item.name}
                                </div>
                              </div>
                              {item.rating != null && (
                                <span className="shrink-0 text-xs font-semibold text-zinc-400 font-gemini-mono">{item.rating.toFixed(1)}</span>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400 font-gemini">
                              <span>{item.city || "-"}</span>
                              <span>{item.category}</span>
                              {item.portfolio ? <span className="font-gemini-mono">{item.portfolio} records</span> : null}
                            </div>
                            {item.verified && (
                              <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                                <CheckCircle2 size={9} aria-hidden="true" /> Verified
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {visible.length < filtered.length && (
                      <div className="border-t border-white/[0.08] p-5 text-center bg-[#09090f]/30">
                        <button
                          type="button"
                          onClick={() => setLimit((n) => n + 24)}
                          data-testid="network-load-more"
                          className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-zinc-200 hover:border-white/25 hover:text-white transition-all cursor-pointer"
                        >
                          Load more ({filtered.length - visible.length} remaining)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Match inspector */}
              <aside className="p-6 bg-[#09090f]/40">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                  MATCH INSPECTOR
                </div>
                {selected ? (
                  <>
                    <div className="mt-5">
                      <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Selected</div>
                      <h2 data-testid="network-inspector-name" className="mt-2 text-xl font-bold text-white">{selected.name}</h2>
                      <div className="mt-1 text-xs text-zinc-400">
                        {selected.type} · {selected.city || "-"} · {selected.category}
                      </div>
                      {selected.teaser && (
                        <p className="mt-3 text-xs leading-5 text-zinc-400">{selected.teaser}</p>
                      )}
                    </div>

                    <dl className="mt-6 space-y-5">
                      <div>
                        <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Availability</dt>
                        <dd className="mt-1 text-xs font-medium text-zinc-300">
                          {selected.availability == null
                            ? "Contact for schedule"
                            : selected.availability > 0
                              ? `${selected.availability} open dates published`
                              : "No published dates"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Reputation</dt>
                        <dd className="mt-1 text-xs font-medium text-zinc-300">
                          {selected.rating != null ? `${selected.rating.toFixed(1)} rating` : "No public rating"}
                          {selected.verified ? " · Verified" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Experience</dt>
                        <dd className="mt-1 text-xs font-medium text-zinc-300">
                          {selected.portfolio ? `${selected.portfolio} recorded event engagements` : "New to network"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Signal</dt>
                        <dd className="mt-1 text-xs font-medium text-zinc-300">{selected.accent}</dd>
                      </div>
                    </dl>

                    {/* Protected detail lock */}
                    <div className="mt-7 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4" data-testid="network-inspector-lock">
                      <div className="flex items-start gap-3">
                        <Lock size={14} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden="true" />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300 font-gemini-mono">
                            Protected detail
                          </div>
                          <p className="mt-1 text-[11.5px] leading-5 text-zinc-400">
                            Full pricing tier, contact, historical performance, and matching action tersedia setelah sign in dan tergantung role authorization backend.
                          </p>
                          <Link to={user ? "/app" : "/login"} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-white hover:underline">
                            {user ? "Buka workspace" : "Sign In untuk detail"}
                            <ArrowRight size={12} aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 text-xs text-zinc-400">Pilih satu profil di kiri untuk inspect.</div>
                )}
              </aside>
            </div>
          )}
        </SpotlightCard>

        <CtaRow primary={["Join the Network", "/register"]} secondary={["Explore Full Demo", "/demo"]} />
      </section>
    </ProductShell>
  );
}

// ============================================================================
// OKKAX INTELLIGENCE  (deterministic canonical event state)
// ============================================================================

const INTEL_TIERS = [
  {
    id: "observe",
    label: "Free",
    plan: "Observe",
    question: "What is happening?",
    render: (data) => (
      <dl className="space-y-1.5 font-mono text-[12.5px] text-zinc-300">
        {[
          ["Readiness", data.readiness + "%"],
          ["Venue", "Ready"],
          ["Vendor", "At risk"],
          ["Workforce", "Blocked"],
          ["Ticketing", "Pending"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-dashed border-zinc-900 py-1">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    id: "understand",
    label: "Pro",
    plan: "Understand",
    question: "Why is it happening?",
    render: () => (
      <div className="text-zinc-200">
        <p className="text-sm">Gate Operations is at risk.</p>
        <p className="mt-2 text-xs text-zinc-500">Root cause: 12 security positions remain unfilled.</p>
        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] text-zinc-400">
          {["Workforce", "Gate Operations", "Access Readiness", "Showtime"].map((s, i, a) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-zinc-600" aria-hidden="true">&rarr;</span>}
              <span className={i === a.length - 1 ? "text-white font-semibold" : ""}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  {
    id: "optimize",
    label: "Max",
    plan: "Optimize",
    question: "What is the best next action?",
    render: () => (
      <ol className="space-y-2 text-zinc-200">
        {[
          "Complete security assignment (18 hires)",
          "Finalize gate configuration",
          "Allocate validator teams",
          "Run access-readiness check",
        ].map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.15] bg-white/[0.04] text-[10px] font-bold font-gemini-mono text-zinc-300">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    ),
  },
];

function IntelligenceProduct() {
  const [event, setEvent] = useState(null);
  const [active, setActive] = useState("observe");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    api.get("/demo/summary")
      .then(({ data }) => !cancel && setEvent(data))
      .catch((e) => !cancel && setErr(apiError(e)));
    return () => { cancel = true; };
  }, []);

  const data = { readiness: 68, name: event?.event?.name || "Aruna Bold Live Experience 2026", city: event?.event?.city || "Makassar", eventCode: event?.event?.event_code || "EVT-DEMO" };
  const tier = INTEL_TIERS.find((t) => t.id === active) || INTEL_TIERS[0];

  return (
    <ProductShell testid="intelligence-product" title="Grounded on state. Not chat." tagline="OKKAX INTELLIGENCE" lead="Intelligence terikat pada state Event Graph yang berwenang. Rekomendasi memiliki evidence, dependency path, impact, dan action yang otorisasinya tetap melalui domain service." interactive>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SpotlightCard className="overflow-hidden">
          {/* Anchored event ID from canonical demo backend */}
          <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] p-6 sm:flex-row sm:items-end bg-[#09090f]/60">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                Anchored on canonical demo event
              </div>
              <h2 className="editorial mt-2 text-2xl text-white">{data.name}</h2>
              <div className="mt-1 font-mono text-xs text-zinc-400" data-testid="intel-event-code">EVENT ID · {data.eventCode}</div>
              {err && <div className="mt-2 text-xs text-amber-300">Backend unreachable: {err}</div>}
            </div>
            <div className="sm:text-right">
              <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-400 font-gemini-mono">Readiness</div>
              <div className="mt-1 font-mono text-2xl font-bold text-white">{data.readiness}%</div>
            </div>
          </div>

          {/* Tier selector */}
          <div className="grid border-b border-white/[0.08] sm:grid-cols-3">
            {INTEL_TIERS.map((t, i) => {
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  aria-pressed={isActive}
                  data-testid={`intel-tier-${t.id}`}
                  className={
                    "border-b border-white/[0.08] p-6 text-left transition-all cursor-pointer sm:border-b-0 " +
                    (i > 0 ? "sm:border-l sm:border-white/[0.08]" : "") + " " +
                    (isActive ? "bg-white/[0.08]" : "bg-transparent hover:bg-white/[0.03]")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-300 font-gemini-mono">{t.label}</span>
                    <span className="text-[10px] uppercase font-bold tracking-[0.16em] text-zinc-500 font-gemini-mono">{t.plan}</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">{t.question}</div>
                </button>
              );
            })}
          </div>

          {/* Active tier detail */}
          <div className="grid xl:grid-cols-[1fr_320px]">
            <div className="p-6 xl:border-r xl:border-white/[0.08]" data-testid={`intel-panel-${tier.id}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 font-gemini-mono">
                {tier.label} · {tier.plan}
              </div>
              <div className="mt-4">{tier.render(data)}</div>
            </div>
            <aside className="border-t border-white/[0.08] p-6 xl:border-t-0 bg-[#09090f]/40">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 font-gemini-mono">
                CONTRACT
              </div>
              <ul className="mt-4 space-y-3.5 text-sm">
                {[
                  "Grounded pada state event yang berwenang.",
                  "Setiap action melewati otorisasi domain service.",
                  "Provenance selalu dapat diperiksa.",
                  "Tidak menciptakan data fiktif.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-zinc-300">
                    <ShieldCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-400" />
                    <span className="text-xs leading-5">{line}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </SpotlightCard>

        <CtaRow primary={["Try on /demo", "/demo"]} secondary={["Compare tier on Pricing", "/pricing"]} />
      </section>
    </ProductShell>
  );
}

// ============================================================================
// TICKET STUDIO  (interactive inventory mode selector)
// ============================================================================

const TICKET_MODES = {
  ga: {
    label: "General Admission",
    short: "GA",
    lead: "Satu quota terbuka. Tanpa reserved seating.",
    tiers: [
      { name: "Early Bird", price: 350000, quota: 300, sold: 218 },
      { name: "Regular",   price: 500000, quota: 1200, sold: 640 },
      { name: "VIP",       price: 1250000, quota: 200, sold: 74 },
    ],
    gates: 4,
    seating: false,
  },
  reserved: {
    label: "Reserved Seating",
    short: "Reserved",
    lead: "Seat-per-ticket dengan seatmap dan gate assignment.",
    tiers: [
      { name: "Balcony",    price: 400000, quota: 300, sold: 210 },
      { name: "Lower Bowl", price: 750000, quota: 900, sold: 640 },
      { name: "Front Row",  price: 1800000, quota: 60, sold: 42 },
    ],
    gates: 6,
    seating: true,
  },
  zoned: {
    label: "Zoned GA",
    short: "Zoned GA",
    lead: "Multi-zone dengan capacity per zone dan gate mapping.",
    tiers: [
      { name: "Zone A", price: 450000, quota: 400, sold: 302 },
      { name: "Zone B", price: 650000, quota: 500, sold: 366 },
      { name: "Zone C", price: 950000, quota: 200, sold: 118 },
    ],
    gates: 5,
    seating: true,
  },
  table: {
    label: "Table Seating",
    short: "Table",
    lead: "Table-based dengan minimum spend dan seating chart.",
    tiers: [
      { name: "Standard Table (8 pax)", price: 6000000, quota: 40, sold: 28 },
      { name: "Premier Table (8 pax)",  price: 10000000, quota: 20, sold: 15 },
      { name: "VIP Table (10 pax)",     price: 22000000, quota: 8, sold: 6 },
    ],
    gates: 3,
    seating: true,
  },
  hybrid: {
    label: "Hybrid",
    short: "Hybrid",
    lead: "Kombinasi GA, Reserved, Zoned, dan Table dalam satu event.",
    tiers: [
      { name: "GA Regular",  price: 500000, quota: 800, sold: 512 },
      { name: "Reserved",    price: 900000, quota: 400, sold: 260 },
      { name: "VIP Table",   price: 15000000, quota: 12, sold: 9 },
    ],
    gates: 8,
    seating: true,
  },
};

function TicketStudioProduct() {
  const [mode, setMode] = useState("ga");
  const m = TICKET_MODES[mode];
  const totalQuota = m.tiers.reduce((a, t) => a + t.quota, 0);
  const totalSold  = m.tiers.reduce((a, t) => a + t.sold, 0);
  const totalGmv   = m.tiers.reduce((a, t) => a + t.price * t.sold, 0);
  const sellThrough = Math.round((totalSold / totalQuota) * 100);

  return (
    <ProductShell testid="ticket-studio-product" title="One ticketing authority per event." tagline="TICKET STUDIO" lead="Pilih inventory mode, lihat tier, kuota, dan gate configuration. Ticket Studio menjaga integrity inventory dan menyiapkan validator untuk gate operations." interactive>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SpotlightCard className="overflow-hidden">
          {/* Inventory mode selector */}
          <div className="border-b border-white/[0.08] p-5 sm:p-6 bg-[#09090f]/60">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
              01 · INVENTORY MODE
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {Object.entries(TICKET_MODES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  data-testid={`ticket-mode-${k}`}
                  aria-pressed={mode === k}
                  className={
                    "rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer " +
                    (mode === k
                      ? "border-white/40 bg-white/[0.1] text-white shadow-sm"
                      : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white")
                  }
                >
                  {v.short}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-300">{m.lead}</p>
          </div>

          {/* Tiers */}
          <div className="grid lg:grid-cols-[1fr_320px]">
            <div className="border-b border-white/[0.08] p-6 lg:border-b-0 lg:border-r">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                02 · TICKET PRODUCTS ({m.label})
              </div>
              <ul className="mt-4 divide-y divide-white/[0.08] border-y border-white/[0.08]" data-testid="ticket-tiers">
                {m.tiers.map((t) => {
                  const pct = Math.round((t.sold / t.quota) * 100);
                  return (
                    <li key={t.name} className="py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-white">{t.name}</div>
                          <div className="font-mono text-xs text-zinc-400">{idr(t.price)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-semibold text-zinc-200">{num(t.sold)} / {num(t.quota)}</div>
                          <div className="text-[10px] uppercase font-bold tracking-[0.16em] text-zinc-400 font-gemini-mono">{pct}% terjual</div>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 w-full rounded-full overflow-hidden bg-white/[0.08]">
                        <div className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-white transition-all duration-500" style={{ width: pct + "%" }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Aggregate + gates */}
            <aside className="p-6 bg-[#09090f]/40" data-testid="ticket-summary">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
                LIVE INVENTORY
              </div>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Total quota</dt>
                  <dd className="font-mono text-lg font-bold text-white">{num(totalQuota)}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Sold</dt>
                  <dd className="font-mono text-lg font-bold text-white">{num(totalSold)} <span className="text-xs text-zinc-400 font-normal">({sellThrough}%)</span></dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Projected GMV</dt>
                  <dd className="font-mono text-lg font-bold text-white">{compact(totalGmv)}</dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-white/[0.08] pt-4">
                <div className="text-[9px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Gates &amp; Validators</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: m.gates }).map((_, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold font-gemini-mono text-zinc-200">
                      <QrCode size={10} aria-hidden="true" /> G{i + 1}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-zinc-400">
                  {m.seating ? "Seatmap dan gate mapping aktif." : "Seatmap tidak diperlukan untuk GA."}
                </div>
              </div>
            </aside>
          </div>

          {/* Sales rule + validator strip */}
          <div className="grid border-t border-white/[0.08] p-6 sm:grid-cols-3 sm:gap-4 bg-[#07070b]">
            {[
              ["Refund policy", "Full refund H-30, partial H-14, non-refundable H-7."],
              ["Transfer", "Boleh transfer hingga H-3 dengan audit trail."],
              ["Validator", "Scan pertama valid, scan kedua replay-denied."],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-white/[0.08] py-4 sm:border-b-0 sm:pr-4">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono">{k}</div>
                <div className="mt-2 text-xs leading-5 text-zinc-300">{v}</div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <CtaRow primary={["Configure Ticket Studio", "/register"]} secondary={["Lihat pada Demo", "/demo"]} />
      </section>
    </ProductShell>
  );
}

// ============================================================================
// LIVEPASS  (interactive ticket credential simulation)
// ============================================================================

const LIVEPASS_STEPS = [
  { id: 1, label: "01 · Issued upon purchase", body: "Entitlement dibuat langsung di event graph. State: active." },
  { id: 2, label: "02 · Delivered via LivePass", body: "Live rotating credential disajikan via secure client interface." },
  { id: 3, label: "03 · Gate scan 1 (valid)", body: "Check-in sukses. State berubah jadi redeemed dalam <120ms." },
  { id: 4, label: "04 · Replay scan 2 (denied)", body: "Screenshot atau token lama ditolak secara deterministik." },
];

function LivePassProduct() {
  const [step, setStep] = useState(1);
  const [scan1, setScan1] = useState(null);
  const [scan2, setScan2] = useState(null);

  const doScan = () => {
    if (scan1 == null) { setScan1("ok"); setStep(3); return; }
    if (scan2 == null) { setScan2("denied"); setStep(4); return; }
  };

  const reset = () => { setStep(1); setScan1(null); setScan2(null); };

  return (
    <ProductShell testid="livepass-product" title="A ticket is not a file. It is a live access entitlement." tagline="LIVEPASS" lead="LivePass adalah entitlement akses. Copy visual tidak meng-copy hak masuk. Ikuti simulasi audience dari pembelian hingga gate." interactive>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Journey timeline */}
          <SpotlightCard className="p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
              AUDIENCE JOURNEY
            </div>
            <ol className="mt-4 divide-y divide-white/[0.08]">
              {LIVEPASS_STEPS.map((s) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <li key={s.id} className="py-4">
                    <div className="flex items-start gap-4">
                      <span className={
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-mono text-[11px] font-bold " +
                        (isDone ? "border-emerald-500/70 bg-emerald-950/40 text-emerald-300" : isActive ? "border-white/60 bg-white/[0.1] text-white shadow-sm" : "border-white/[0.08] bg-white/[0.02] text-zinc-500")
                      }>
                        {isDone ? <CheckCircle2 size={14} aria-hidden="true" /> : String(s.id).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className={"text-sm font-bold " + (isActive ? "text-white" : "text-zinc-300")}>{s.label}</div>
                        <div className="mt-1 text-xs leading-5 text-zinc-400">{s.body}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={doScan}
                data-testid="livepass-scan"
                disabled={scan2 !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-4 py-2.5 text-xs font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                <QrCode size={13} aria-hidden="true" /> {scan1 == null ? "Scan #1" : scan2 == null ? "Scan #2 (replay)" : "Selesai"}
              </button>
              <button
                type="button"
                onClick={reset}
                data-testid="livepass-reset"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:border-white/25 hover:text-white transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>
          </SpotlightCard>

          {/* Mobile mock */}
          <div className="mx-auto w-full max-w-[340px]" data-testid="livepass-mobile">
            <SpotlightCard className="p-5 border-white/[0.15]">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">LivePass</span>
                <span className="font-mono text-[10px] text-zinc-400">okkax://livepass</span>
              </div>
              <div className="mt-4">
                <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Event</div>
                <div className="text-sm font-bold text-white">Aruna Bold Live Experience 2026</div>
                <div className="mt-0.5 text-[11px] text-zinc-400">24 Aug 2026 · Makassar Convention Hall</div>
              </div>

              <div className="mt-5 flex aspect-square items-center justify-center rounded-xl border border-white/[0.08] bg-[#060609] p-4">
                <QrCode size={140} className="text-white" aria-hidden="true" />
              </div>

              <div className="mt-4">
                <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-zinc-500 font-gemini-mono">Status</div>
                <div className={
                  "mt-1 flex items-center gap-2 text-sm font-bold " +
                  (scan2 === "denied" ? "text-amber-300" : scan1 === "ok" ? "text-emerald-300" : "text-white")
                }>
                  {scan2 === "denied" ? "Denied · Already Redeemed" : scan1 === "ok" ? "Redeemed at Main Gate" : "Ready for gate"}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  Credential rotating. Screenshot tidak meng-copy hak.
                </div>
              </div>
            </SpotlightCard>
            <div className="mt-3.5 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
              <ShieldCheck size={13} aria-hidden="true" className="text-emerald-400" />
              Media adalah representasi. Otoritas ada pada entitlement server.
            </div>
          </div>
        </div>

        <CtaRow primary={["Get LivePass", "/register"]} secondary={["Lihat pada Demo", "/demo"]} />
      </section>
    </ProductShell>
  );
}

// ============================================================================
// PROTECTED PAYMENT  (funding state machine)
// ============================================================================

const PP_STAGES = [
  { id: "unfunded",   label: "Unfunded",          note: "Contract accepted. Belum ada dana." },
  { id: "funded",     label: "Funded (100%)",     note: "Dana 100% dijamin. Upfront release siap." },
  { id: "released",   label: "Upfront released",  note: "Upfront release ke provider, protected balance ditahan." },
  { id: "completion", label: "Completion review", note: "Provider submit, buyer review, atau auto-accept." },
  { id: "settled",    label: "Settled",           note: "Sisa protected balance rilis. Settlement final." },
];

const PP_STATE_BY_STAGE = {
  unfunded:   { funded: 0,           protected: 0,           released: 0,           status: "Awaiting funding" },
  funded:     { funded: 500000000,   protected: 500000000,   released: 0,           status: "Contract funded" },
  released:   { funded: 500000000,   protected: 350000000,   released: 150000000,   status: "Upfront paid" },
  completion: { funded: 500000000,   protected: 350000000,   released: 150000000,   status: "In review" },
  settled:    { funded: 500000000,   protected: 0,           released: 500000000,   status: "Settled" },
};

function ProtectedPaymentProduct() {
  const [stageIdx, setStageIdx] = useState(0);
  const stage = PP_STAGES[stageIdx];
  const s = PP_STATE_BY_STAGE[stage.id];

  return (
    <ProductShell testid="protected-payment-product" title="Funding aman. Settlement transparan." tagline="PROTECTED PAYMENT" lead="Protected Payment memisahkan protected funds dari revenue. Silence tidak menahan payment yang layak, dispute punya jalur, dan settlement mengikuti provider yang terverifikasi." interactive>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SpotlightCard className="overflow-hidden">
          {/* Stage stepper */}
          <div className="border-b border-white/[0.08] p-5 sm:p-6 bg-[#09090f]/60">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
              CONTRACT LIFECYCLE
            </div>
            <ol className="mt-4 flex flex-wrap gap-2" data-testid="pp-stepper">
              {PP_STAGES.map((st, i) => (
                <li key={st.id}>
                  <button
                    type="button"
                    onClick={() => setStageIdx(i)}
                    aria-pressed={stageIdx === i}
                    data-testid={`pp-stage-${st.id}`}
                    className={
                      "rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer " +
                      (stageIdx === i
                        ? "border-white/40 bg-white/[0.1] text-white shadow-sm"
                        : i < stageIdx
                          ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                          : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200")
                    }
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
                    {st.label}
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-zinc-300">{stage.note}</p>
          </div>

          {/* Ledger view */}
          <div className="grid xl:grid-cols-3">
            <div className="border-b border-white/[0.08] p-6 xl:border-b-0 xl:border-r" data-testid="pp-funded">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">Funded</div>
              <div className="mt-3 font-mono text-2xl font-bold text-white">{compact(s.funded)}</div>
              <div className="mt-1 text-[11px] text-zinc-400 font-mono">{idr(s.funded)}</div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: (s.funded > 0 ? 100 : 0) + "%" }} />
              </div>
            </div>
            <div className="border-b border-white/[0.08] p-6 xl:border-b-0 xl:border-r bg-[#09090f]/30" data-testid="pp-protected">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300 font-gemini-mono">Protected balance</div>
              <div className="mt-3 font-mono text-2xl font-bold text-white">{compact(s.protected)}</div>
              <div className="mt-1 text-[11px] text-zinc-400 font-mono">{idr(s.protected)}</div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: (s.funded > 0 ? (s.protected / s.funded) * 100 : 0) + "%" }} />
              </div>
              <div className="mt-2 text-[11px] text-zinc-400">Bukan revenue OKKAX. Ditahan hingga completion.</div>
            </div>
            <div className="p-6" data-testid="pp-released">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">Released</div>
              <div className="mt-3 font-mono text-2xl font-bold text-white">{compact(s.released)}</div>
              <div className="mt-1 text-[11px] text-zinc-400 font-mono">{idr(s.released)}</div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full rounded-full bg-zinc-400 transition-all duration-500" style={{ width: (s.funded > 0 ? (s.released / s.funded) * 100 : 0) + "%" }} />
              </div>
              <div className="mt-2 text-[11px] text-zinc-400">Ke provider setelah state release memenuhi policy.</div>
            </div>
          </div>

          {/* Guarantees strip */}
          <div className="grid border-t border-white/[0.08] p-6 sm:grid-cols-3 bg-[#07070b]">
            {[
              ["Not revenue", "Protected funds bukan pendapatan OKKAX."],
              ["No silent hold", "Buyer silence tidak menahan payment yang layak."],
              ["Dispute path", "Dispute punya jalur eksplisit, tidak menggantung."],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-white/[0.08] py-4 sm:border-b-0 sm:pr-4">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400 font-gemini-mono">{k}</div>
                <div className="mt-2 text-xs leading-5 text-zinc-300">{v}</div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <CtaRow primary={["Configure Protected Payment", "/register"]} secondary={["Lihat pada Demo", "/demo"]} />
      </section>
    </ProductShell>
  );
}

// ============================================================================
// SHARED SHELL + CTA
// ============================================================================

function ProductShell({ testid, title, tagline, lead, children }) {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <ScrollProgressBar />
      <PublicNav />
      <main data-testid={testid}>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
          <Reveal delay={0.05}>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400 font-gemini-mono">
              {tagline}
            </div>
          </Reveal>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
            <div>
              <MaskReveal delay={0.1}>
                <h1 className="editorial max-w-3xl text-[clamp(2.6rem,5.8vw,5rem)] leading-[0.94] text-white">
                  {title}
                </h1>
              </MaskReveal>
            </div>
            <Reveal delay={0.2} className="max-w-xl lg:pb-2">
              <p className="text-sm leading-6 text-zinc-400 sm:text-base">{lead}</p>
              <div className="mt-3 text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 font-gemini-mono">
                Interactive product demonstration
              </div>
            </Reveal>
          </div>
        </section>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function CtaRow({ primary, secondary }) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      {primary && (
        <Link
          to={primary[1]}
          data-testid="product-cta-primary"
          className="inline-flex items-center justify-between gap-3 rounded-xl bg-white hover:bg-zinc-200 text-black px-6 py-3.5 text-sm font-bold shadow-[0_4px_24px_rgba(255,255,255,0.15)] transition-all active:scale-[0.98]"
        >
          {primary[0]}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      )}
      {secondary && (
        <Link
          to={secondary[1]}
          data-testid="product-cta-secondary"
          className="inline-flex items-center justify-between gap-3 rounded-xl border border-white/[0.15] bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-zinc-100 hover:border-white/30 hover:bg-white/[0.08] transition-all"
        >
          {secondary[0]}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// ROUTE SWITCH
// ============================================================================
const PRODUCT_ROUTES = {
  "event-studio":      EventStudioProduct,
  okkax:               () => <Navigate to="/okkax" replace />,
  yoona:               () => <Navigate to="/okkax" replace />,
  okkaji:              () => <Navigate to="/okkax" replace />,
  network:             NetworkProduct,
  intelligence:        IntelligenceProduct,
  "ticket-studio":     TicketStudioProduct,
  livepass:            LivePassProduct,
  "protected-payment": ProtectedPaymentProduct,
};

export default function Products() {
  const { slug } = useParams();
  const Component = PRODUCT_ROUTES[slug] || EventStudioProduct;
  return <Component />;
}
