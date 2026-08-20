import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  MapPin,
  ShieldCheck,
  Mic2,
  Building2,
  Wrench,
  HardHat,
  Handshake,
  Store,
  ExternalLink,
  AlertTriangle,
  SlidersHorizontal,
  X,
  Star,
  Megaphone,
} from "lucide-react";
import { api, compact } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OkxDropdown from "@/components/OkxDropdown";
import { SpotlightCard } from "@/components/MotionPrimitives";

const TABS = [
  { key: "talent", label: "Talent", Icon: Mic2 },
  { key: "venue", label: "Venue", Icon: Building2 },
  { key: "vendor", label: "Vendor", Icon: Wrench },
  { key: "worker", label: "Workforce", Icon: HardHat },
  { key: "sponsor", label: "Sponsor Opportunities", Icon: Handshake },
  { key: "tenant", label: "Tenant Opportunities", Icon: Store },
];

const CATALOG = {
  talent: "/catalog/talents",
  venue: "/catalog/venues",
  vendor: "/catalog/vendors",
  worker: "/catalog/workers",
};

const MATCH = {
  talent: (id) => `/events/${id}/talent-matches`,
  venue: (id) => `/events/${id}/venue-matches`,
  vendor: (id) => `/events/${id}/vendor-matches`,
  worker: (id) => `/events/${id}/worker-matches`,
};

function nameOf(item, tab) {
  if (tab === "talent") return item.stage_name || item.name;
  return item.name || item.stage_name;
}

function categoryOf(item, tab) {
  if (tab === "talent") return item.genre || item.category || "";
  if (tab === "venue") {
    return (
      item.venue_type ||
      item.type ||
      item.category ||
      (typeof item.indoor === "boolean"
        ? item.indoor
          ? "Indoor"
          : "Outdoor"
        : "")
    );
  }
  return item.category || item.role || "";
}

function cityOf(item) {
  return item.city || item.base_city || item.location?.city || "";
}

function priceOf(item, tab) {
  if (tab === "talent") return item.base_fee;
  if (tab === "venue") return item.event_day_price;
  if (tab === "vendor") return item.price_min;
  if (tab === "worker") return item.rate_per_day;
  return null;
}

function matchScoreOf(item) {
  return item?.match?.score ?? item?.compatibility?.score ?? null;
}

function matchReasonsOf(item) {
  return item?.match?.reasons ?? item?.compatibility?.reasons ?? [];
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "id"));
}

export default function Network() {
  const { workspaceVersion } = useAuth();
  const [params, setParams] = useSearchParams();

  const tabParam = params.get("tab") || "talent";
  const tab = TABS.some((item) => item.key === tabParam) ? tabParam : "talent";
  const eventId = params.get("event") || "";

  const [q, setQ] = useState(params.get("q") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [verifiedOnly, setVerifiedOnly] = useState(
    params.get("verified") === "true"
  );

  const [items, setItems] = useState([]);
  const [facetItems, setFacetItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facetLoading, setFacetLoading] = useState(false);
  const [error, setError] = useState("");

  const eventScoped =
    Boolean(eventId) &&
    ["talent", "venue", "vendor", "worker"].includes(tab);

  const isGateway = ["sponsor", "tenant"].includes(tab);

  /*
   * Load unfiltered catalog once per canonical tab.
   * This becomes the source for CITY and CATEGORY options.
   * It intentionally does not contain event assignment/private data.
   */
  useEffect(() => {
    if (isGateway) {
      setFacetItems([]);
      return;
    }

    if (eventScoped) {
      return;
    }

    setFacetLoading(true);

    api
      .get(CATALOG[tab], {
        params: {
          limit: 300,
          sort: "name_asc",
        },
      })
      .then(({ data }) => setFacetItems(data.items || []))
      .catch(() => setFacetItems([]))
      .finally(() => setFacetLoading(false));
  }, [tab, eventScoped, isGateway, workspaceVersion]);

  /*
   * Main result load.
   * Generic catalog mode uses server-side filtering.
   * Event-context mode uses protected matching endpoints.
   */
  const appliedQ = params.get("q") || "";
  const appliedCity = params.get("city") || "";
  const appliedCategory = params.get("category") || "";
  const appliedVerified = params.get("verified") === "true";

  useEffect(() => {
    if (isGateway) {
      setItems([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const url = eventScoped ? MATCH[tab](eventId) : CATALOG[tab];

    // Venue seed data does not carry a `category` string. The visible
    // "Jenis venue" facet is derived from `indoor`. Translate the client
    // selection back to the backend's `indoor` boolean so the filter
    // actually narrows results.
    const catParam =
      tab === "venue"
        ? {}
        : appliedCategory
          ? { category: appliedCategory }
          : {};

    const venueIndoorParam =
      tab === "venue" && (appliedCategory === "Indoor" || appliedCategory === "Outdoor")
        ? { indoor: appliedCategory === "Indoor" ? "true" : "false" }
        : {};

    const config = eventScoped
      ? {}
      : {
          params: {
            ...(appliedQ ? { q: appliedQ } : {}),
            ...(appliedCity ? { city: appliedCity } : {}),
            ...catParam,
            ...venueIndoorParam,
            ...(appliedVerified ? { verified: "true" } : {}),
            limit: 300,
            sort: "rating_desc",
          },
        };

    api
      .get(url, config)
      .then(({ data }) => setItems(data.items || []))
      .catch((err) => {
        const detail = err?.response?.data?.detail;

        setError(
          err?.response?.status === 403
            ? "Anda tidak memiliki akses ke matching untuk event ini."
            : typeof detail === "string"
              ? detail
              : "Gagal memuat Okkax Network."
        );

        setItems([]);
      })
      .finally(() => setLoading(false));

    // Generic mode is intentionally refreshed from URL-backed filters.
    // Event mode loads the protected match result once and filters locally.
  }, [
    tab,
    eventId,
    eventScoped,
    isGateway,
    workspaceVersion,
    appliedQ,
    appliedCity,
    appliedCategory,
    appliedVerified,
  ]);

  /*
   * In event context, matching endpoints return the complete authorised
   * match set. Filtering remains client-side and never affects authority.
   */
  const visible = useMemo(() => {
    if (!eventScoped) return items;

    let output = [...items];

    if (q.trim()) {
      const needle = q.trim().toLowerCase();

      output = output.filter((item) => {
        const name = nameOf(item, tab) || "";
        const categoryValue = categoryOf(item, tab) || "";

        return (
          name.toLowerCase().includes(needle) ||
          categoryValue.toLowerCase().includes(needle)
        );
      });
    }

    if (city) {
      output = output.filter((item) => cityOf(item) === city);
    }

    if (category) {
      output = output.filter(
        (item) =>
          categoryOf(item, tab).toLowerCase() === category.toLowerCase()
      );
    }

    if (verifiedOnly) {
      output = output.filter((item) => Boolean(item.verified));
    }

    return output;
  }, [items, eventScoped, tab, q, city, category, verifiedOnly]);

  /*
   * Facets:
   * generic catalog -> unfiltered catalog
   * event matching  -> authorised matching result
   */
  const optionSource = eventScoped ? items : facetItems;

  const cityOptions = useMemo(
    () => uniqueSorted(optionSource.map(cityOf)),
    [optionSource]
  );

  const categoryOptions = useMemo(
    () => uniqueSorted(optionSource.map((item) => categoryOf(item, tab))),
    [optionSource, tab]
  );

  const setTab = (nextTab) => {
    const next = new URLSearchParams(params);

    next.set("tab", nextTab);
    next.delete("q");
    next.delete("city");
    next.delete("category");
    next.delete("verified");

    setQ("");
    setCity("");
    setCategory("");
    setVerifiedOnly(false);

    setParams(next, { replace: true });
  };

  const applyFilters = () => {
    if (eventScoped) return;

    const next = new URLSearchParams(params);

    q.trim() ? next.set("q", q.trim()) : next.delete("q");
    city ? next.set("city", city) : next.delete("city");
    category ? next.set("category", category) : next.delete("category");

    verifiedOnly
      ? next.set("verified", "true")
      : next.delete("verified");

    setParams(next, { replace: true });
  };

  const resetFilters = () => {
    const next = new URLSearchParams(params);

    next.delete("q");
    next.delete("city");
    next.delete("category");
    next.delete("verified");

    setQ("");
    setCity("");
    setCategory("");
    setVerifiedOnly(false);

    setParams(next, { replace: true });
  };

  const hasFilters = Boolean(q || city || category || verifiedOnly);

  return (
    <div className="okx-workspace-page okx-network-page space-y-3 pb-12" data-testid="network-page">
      {/* ============================================================
          PERSISTENT COMPACT NETWORK COMMAND AREA
          Matches Calendar command interface design grammar.
         ============================================================ */}
      <section
        className="sticky -top-4 sm:-top-4.5 z-30 -mt-4 sm:-mt-4.5 -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 pt-3 sm:pt-3.5 pb-2 bg-[#07070a] border-b border-white/[0.08] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.9)] space-y-1.5"
        data-testid="network-chrome"
      >
        {/* ROW 1: [ LIVE EVENT SUPPLY NETWORK / Okkax Network ] + [Talent] [Venue] [Vendor] [Workforce] [Sponsor Opportunities] [Tenant Opportunities] */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-300 font-gemini-mono shrink-0">
              Live Event Supply Network
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-white font-gemini tracking-tight truncate">
              Okkax Network
            </h1>
            {eventScoped && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold text-white font-gemini-mono shrink-0">
                Event Context Aktif
              </span>
            )}
          </div>

          {/* Primary Network Category Navigation */}
          <div
            className="flex items-center gap-1 overflow-x-auto okx-scroll no-scrollbar py-0.5"
            role="tablist"
            aria-label="Network category"
          >
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                data-testid={`network-tab-${key}`}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  tab === key
                    ? "border-white/40 bg-white/15 text-white font-bold shadow-sm"
                    : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.05]"
                }`}
              >
                <Icon size={12} className={tab === key ? "text-white" : "text-zinc-400"} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {!isGateway && (
          <>
            {/* ROW 2: [ Search........................ ] [Semua kota ▼] [Semua genre ▼] [Reset] [Terapkan filter] */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between pt-1.5 border-t border-white/[0.06]">
              <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center min-w-0">
                {/* Search input */}
                <div className="relative flex-1 min-w-[160px]">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    data-testid="network-q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyFilters();
                    }}
                    placeholder={
                      tab === "talent"
                        ? "Cari nama talent atau genre"
                        : tab === "worker"
                          ? "Cari workforce atau keahlian"
                          : "Cari nama"
                    }
                    className="w-full h-8 rounded-lg border border-white/[0.1] bg-white/[0.03] pl-8 pr-2.5 text-xs text-white placeholder-zinc-500 transition-all focus:border-white/30 focus:bg-white/[0.06] focus:outline-none"
                  />
                </div>

                {/* City dropdown */}
                <div className="w-full sm:w-[150px] md:w-[170px] shrink-0">
                  <OkxDropdown
                    value={city}
                    onChange={setCity}
                    options={[
                      {
                        value: "",
                        label:
                          facetLoading && !eventScoped
                            ? "Memuat kota..."
                            : "Semua kota",
                      },
                      ...cityOptions.map((option) => ({
                        value: option,
                        label: option,
                      })),
                    ]}
                    placeholder="Semua kota"
                    searchable={cityOptions.length >= 8}
                    disabled={facetLoading && !eventScoped}
                    className="w-full"
                    testId="network-city"
                    ariaLabel="Filter kota"
                  />
                </div>

                {/* Category/Genre dropdown */}
                <div className="w-full sm:w-[150px] md:w-[170px] shrink-0">
                  <OkxDropdown
                    value={category}
                    onChange={setCategory}
                    options={[
                      {
                        value: "",
                        label:
                          facetLoading && !eventScoped
                            ? "Memuat kategori..."
                            : tab === "talent"
                              ? "Semua genre"
                              : tab === "worker"
                                ? "Semua peran"
                                : tab === "venue"
                                  ? "Semua jenis venue"
                                  : "Semua kategori",
                      },
                      ...categoryOptions.map((option) => ({
                        value: option,
                        label: option,
                      })),
                    ]}
                    placeholder={
                      tab === "talent"
                        ? "Semua genre"
                        : tab === "worker"
                          ? "Semua peran"
                          : tab === "venue"
                            ? "Semua jenis venue"
                            : "Semua kategori"
                    }
                    searchable={categoryOptions.length >= 8}
                    disabled={facetLoading && !eventScoped}
                    className="w-full"
                    testId="network-category"
                    ariaLabel="Filter kategori"
                  />
                </div>
              </div>

              {/* Filter Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {hasFilters && (
                  <button
                    type="button"
                    data-testid="network-reset"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:border-white/20 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                  >
                    <X size={13} />
                    <span>Reset</span>
                  </button>
                )}

                {!eventScoped ? (
                  <button
                    type="button"
                    data-testid="network-apply"
                    onClick={applyFilters}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <SlidersHorizontal size={12} />
                    <span>Terapkan filter</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-white/20 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-zinc-200 font-gemini-mono">
                    Matching + availability
                  </span>
                )}
              </div>
            </div>

            {/* ROW 3: [Terverifikasi checkbox] [300 hasil · 49 kota · 34 kategori] */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06] text-xs">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="network-verified"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-white accent-white focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
                />
                <ShieldCheck size={13} className="text-zinc-300" />
                <span>Terverifikasi</span>
              </label>

              <div className="flex items-center gap-2 text-[10.5px] text-zinc-500 font-gemini-mono">
                <span>{visible.length} hasil</span>
                <span>·</span>
                <span>{cityOptions.length} kota</span>
                <span>·</span>
                <span>{categoryOptions.length} kategori</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ============================================================
          SCROLLING INVENTORY CONTENT
         ============================================================ */}
      <section className="okx-workspace-content okx-network-results">
        {isGateway ? (
          <GatewayPanel kind={tab} />
        ) : (
          <>
            {loading && (
              <div className="rounded-xl border border-white/[0.08] bg-[#0c0c14]/60 p-8 text-center text-xs text-zinc-400 font-gemini">
                Memuat jaringan Okkax…
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/[0.04] p-3.5 text-xs text-zinc-300 font-gemini">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && visible.length === 0 && (
              <div
                data-testid="network-empty"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.1] bg-[#0c0c14]/40 p-10 text-center font-gemini"
              >
                <Search size={22} className="text-zinc-500" />

                <div>
                  <div className="text-sm font-semibold text-zinc-300">
                    Tidak ada hasil
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    Ubah kota, kategori, status verifikasi, atau kata pencarian.
                  </div>
                </div>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-2 text-xs text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer"
                  >
                    Reset semua filter
                  </button>
                )}
              </div>
            )}

            {!loading && !error && visible.length > 0 && (
              <div
                className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
                data-testid="network-list"
              >
                {visible.map((item) => (
                  <SupplyCard
                    key={item.id}
                    item={item}
                    tab={tab}
                    eventScoped={eventScoped}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function SupplyCard({ item, tab, eventScoped }) {
  const name = nameOf(item, tab);
  const category = categoryOf(item, tab);
  const price = priceOf(item, tab);
  const score = matchScoreOf(item);
  const reasons = matchReasonsOf(item);
  const availability = item.availability;

  return (
    <SpotlightCard className="h-full">
      <article
        data-testid={`network-card-${item.id}`}
        className="flex flex-col h-full p-3 sm:p-3.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-xs sm:text-sm font-bold text-white tracking-tight">
              {name}
            </h2>

            {category && (
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400 font-gemini-mono truncate">
                {category}
              </div>
            )}
          </div>

          {item.verified && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white font-gemini-mono">
              <ShieldCheck size={9} />
              Verified
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-400 font-gemini">
          {cityOf(item) && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} className="text-zinc-500" />
              {cityOf(item)}
            </span>
          )}

          {typeof item.rating === "number" && (
            <span
              className="inline-flex items-center gap-1 text-zinc-200"
              data-testid="network-card-rating"
              title={`${item.review_count || 0} ulasan`}
            >
              <Star size={10} strokeWidth={2} className="text-zinc-400 fill-zinc-400" />
              <span className="font-mono font-bold text-white">{item.rating.toFixed(1)}</span>
              {typeof item.review_count === "number" && (
                <span className="text-zinc-500 text-[10px]">({item.review_count})</span>
              )}
            </span>
          )}

          {typeof item.completed_events === "number" && item.completed_events > 0 && (
            <span className="font-mono text-zinc-400 text-[10.5px]">
              {item.completed_events} event
            </span>
          )}

          {price != null && (
            <span className="font-mono font-semibold text-white ml-auto">
              {compact(price)}
            </span>
          )}
        </div>

        {eventScoped && (
          <div className="mt-auto border-t border-white/[0.08] pt-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              {score != null && (
                <span
                  data-testid="network-match-score"
                  className="font-bold text-white font-gemini-mono text-[10.5px]"
                >
                  Match {score}/100
                </span>
              )}

              {availability && (
                <span
                  data-testid="network-availability"
                  className={`text-[10.5px] font-gemini-mono ${
                    availability.status === "Available"
                      ? "text-white font-semibold"
                      : availability.status === "Booked" ||
                          availability.status === "Conflict"
                        ? "text-zinc-400 line-through"
                        : availability.status === "Tentative"
                          ? "text-zinc-300 italic"
                          : "text-zinc-500"
                  }`}
                >
                  {availability.status}
                </span>
              )}
            </div>

            {reasons.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-zinc-400 font-gemini text-[10px]">
                {reasons.slice(0, 2).map((reason, index) => (
                  <li key={index} className="line-clamp-1">
                    · {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </article>
    </SpotlightCard>
  );
}

function GatewayPanel({ kind }) {
  const sponsor = kind === "sponsor";
  const to = sponsor ? "/app/sponsor" : "/app/tenant";

  return (
    <div className="okx-network-gateway rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-4 sm:p-5 font-gemini shadow-sm">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 font-gemini-mono">
        {sponsor ? "Sponsorship Network" : "Tenant Network"}
      </div>

      <h2 className="editorial mt-2 text-xl sm:text-2xl text-white">
        {sponsor ? "Peluang Sponsor" : "Peluang Tenant"}
      </h2>

      <p className="mt-2 max-w-2xl text-xs sm:text-[13px] leading-relaxed text-zinc-400">
        {sponsor
          ? "Temukan inventaris sponsorship dari event aktif, evaluasi package, ajukan interest, dan kelola commitment melalui lifecycle sponsorship Okkax."
          : "Temukan zona dan booth yang tersedia, evaluasi kebutuhan event, ajukan tenant application, dan kelola keputusan melalui lifecycle tenant Okkax."}
      </p>

      <div className="mt-4">
        <Link
          to={to}
          data-testid={`network-gateway-${kind}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-sm transition-all hover:bg-zinc-200 active:scale-[0.98]"
        >
          Buka {sponsor ? "Sponsor Opportunities" : "Tenant Opportunities"}
          <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  );
}

