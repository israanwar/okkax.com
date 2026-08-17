// Canonical Indonesian city list for OKKAX forms (registration, filters).
//
// Data rule: no invented cities. Every value here is a real `city` field
// already present in the OKKAX Network catalog collections (talent, venue,
// vendor, workforce, tenant) — the same canonical dataset used throughout
// /products/network and /for/:audience. This module just unions and caches
// it so any form can offer a real, backend-sourced city dropdown.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const CATALOG_ENDPOINTS = [
  "/catalog/talents",
  "/catalog/venues",
  "/catalog/vendors",
  "/catalog/workers",
  "/catalog/tenants",
];

let cachedCities = null;
let inflightPromise = null;

async function fetchCatalogCities() {
  const responses = await Promise.all(
    CATALOG_ENDPOINTS.map((url) => api.get(url).catch(() => ({ data: { items: [] } })))
  );
  const set = new Set();
  for (const { data } of responses) {
    const items = data?.items || data || [];
    for (const item of items) {
      if (item?.city) set.add(item.city);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
}

// Hook: returns { cities, loading }. Fetches once per session (module-level
// cache) so switching between Login/Register or revisiting the form does
// not re-hit the network every time.
export function useCatalogCities() {
  const [cities, setCities] = useState(cachedCities || []);
  const [loading, setLoading] = useState(!cachedCities);

  useEffect(() => {
    if (cachedCities) {
      setCities(cachedCities);
      setLoading(false);
      return undefined;
    }
    if (!inflightPromise) {
      inflightPromise = fetchCatalogCities().then((list) => {
        cachedCities = list;
        return list;
      });
    }
    let cancelled = false;
    inflightPromise
      .then((list) => {
        if (!cancelled) {
          setCities(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cities, loading };
}
