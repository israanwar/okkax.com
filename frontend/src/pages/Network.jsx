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
} from "lucide-react";
import { api, compact } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OkxDropdown from "@/components/OkxDropdown";

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
              : "Gagal memuat OKKAX Network."
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
    <div className="okx-workspace-page okx-network-page" data-testid="network-page">
      {/* ============================================================
          PERSISTENT PAGE COMMAND
          This entire area remains visible while results scroll.
          Uses the shared .okx-workspace-chrome flex contract so
          the surface never travels before locking.
         ============================================================ */}
      <section
        className="okx-workspace-chrome okx-network-command"
        data-testid="network-chrome"
      >
        <div className="okx-network-heading">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] accent-text">
              Live Event Supply Network
            </div>

            <h1 className="editorial text-2xl sm:text-4xl">
              OKKAX Network
            </h1>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
              Temukan talent, venue, vendor produksi, workforce, sponsor,
              dan tenant dalam satu jaringan ekonomi live event.
              {eventScoped &&
                " Konteks event aktif menampilkan kecocokan dan ketersediaan aktual."}
            </p>
          </div>

          {eventScoped && (
            <div className="okx-event-context-badge">
              Event context aktif
            </div>
          )}
        </div>

        {/* Primary network navigation */}
        <div className="okx-network-tabs" role="tablist" aria-label="Network category">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              data-testid={`network-tab-${key}`}
              onClick={() => setTab(key)}
              className={`okx-network-tab ${
                tab === key ? "is-active" : ""
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {!isGateway && (
          <div className="okx-network-filter-panel">
            <div className="okx-network-filter-grid">
              <label className="okx-filter-field okx-filter-search">
                <span className="okx-filter-label">Pencarian</span>

                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
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
                    className="okx-network-control pl-9"
                  />
                </div>
              </label>

              <div className="okx-filter-field">
                <span className="okx-filter-label">Kota</span>

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

              <div className="okx-filter-field">
                <span className="okx-filter-label">
                  {tab === "talent"
                    ? "Genre"
                    : tab === "worker"
                      ? "Peran"
                      : tab === "venue"
                        ? "Jenis venue"
                        : "Kategori"}
                </span>

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

            <div className="okx-network-filter-actions">
              <label className="okx-verified-filter">
                <input
                  type="checkbox"
                  data-testid="network-verified"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                />

                <ShieldCheck size={14} />

                <span>Terverifikasi</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {hasFilters && (
                  <button
                    type="button"
                    data-testid="network-reset"
                    onClick={resetFilters}
                    className="okx-filter-reset"
                  >
                    <X size={14} />
                    Reset
                  </button>
                )}

                {!eventScoped ? (
                  <button
                    type="button"
                    data-testid="network-apply"
                    onClick={applyFilters}
                    className="okx-filter-apply"
                  >
                    <SlidersHorizontal size={14} />
                    Terapkan filter
                  </button>
                ) : (
                  <span className="okx-event-filter-note">
                    Matching + availability
                  </span>
                )}
              </div>
            </div>

            <div className="okx-network-filter-meta">
              <span>
                {visible.length} hasil
              </span>

              <span>
                {cityOptions.length} kota
              </span>

              <span>
                {categoryOptions.length} kategori
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ============================================================
          SCROLLING CONTENT
          Only this result surface is normal page content.
         ============================================================ */}
      <section className="okx-workspace-content okx-network-results">
        {isGateway ? (
          <GatewayPanel kind={tab} />
        ) : (
          <>
            {loading && (
              <div className="okx-network-state">
                Memuat jaringan OKKAX…
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && visible.length === 0 && (
              <div
                data-testid="network-empty"
                className="okx-network-state"
              >
                <Search size={20} />

                <div>
                  <div className="font-medium text-zinc-300">
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
                    className="mt-3 text-xs accent-text hover:underline"
                  >
                    Reset semua filter
                  </button>
                )}
              </div>
            )}

            {!loading && !error && visible.length > 0 && (
              <div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
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
    <article
      data-testid={`network-card-${item.id}`}
      className="okx-network-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-white">
            {name}
          </h2>

          {category && (
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {category}
            </div>
          )}
        </div>

        {item.verified && (
          <span className="inline-flex shrink-0 items-center gap-1 border border-[var(--okx-border)] px-2 py-1 text-[10px] text-zinc-300">
            <ShieldCheck size={11} />
            Verified
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
        {cityOf(item) && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {cityOf(item)}
          </span>
        )}

        {price != null && (
          <span className="num text-zinc-200">
            {compact(price)}
          </span>
        )}
      </div>

      {eventScoped && (
        <div className="mt-auto border-t border-[var(--okx-border)] pt-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            {score != null && (
              <span
                data-testid="network-match-score"
                className="font-semibold accent-text"
              >
                Match {score}/100
              </span>
            )}

            {availability && (
              <span
                data-testid="network-availability"
                className={
                  availability.status === "Available"
                    ? "text-emerald-400"
                    : availability.status === "Booked" ||
                        availability.status === "Conflict"
                      ? "text-red-400"
                      : availability.status === "Tentative"
                        ? "text-amber-400"
                        : "text-zinc-500"
                }
              >
                {availability.status}
              </span>
            )}
          </div>

          {reasons.length > 0 && (
            <ul className="mt-2 space-y-1 text-zinc-500">
              {reasons.slice(0, 3).map((reason, index) => (
                <li key={index} className="line-clamp-1">
                  · {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function GatewayPanel({ kind }) {
  const sponsor = kind === "sponsor";

  const to = sponsor ? "/app/sponsor" : "/app/tenant";

  return (
    <div className="okx-network-gateway">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] accent-text">
        {sponsor ? "Sponsorship Network" : "Tenant Network"}
      </div>

      <h2 className="editorial mt-3 text-2xl">
        {sponsor ? "Peluang Sponsor" : "Peluang Tenant"}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
        {sponsor
          ? "Temukan inventaris sponsorship dari event aktif, evaluasi package, ajukan interest, dan kelola commitment melalui lifecycle sponsorship OKKAX."
          : "Temukan zona dan booth yang tersedia, evaluasi kebutuhan event, ajukan tenant application, dan kelola keputusan melalui lifecycle tenant OKKAX."}
      </p>

      <Link
        to={to}
        data-testid={`network-gateway-${kind}`}
        className="mt-5 inline-flex items-center gap-2 bg-[var(--okx-accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Buka {sponsor ? "Sponsor Opportunities" : "Tenant Opportunities"}
        <ExternalLink size={14} />
      </Link>
    </div>
  );
}
