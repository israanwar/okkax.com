// Canonical Indonesian city list for Okkax forms (registration, filters).
//
// Data rule: no invented cities. Every value here is a real `city` field
// already present in the Okkax Network catalog collections (talent, venue,
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

const CANONICAL_DEFAULT_CITIES = [
  "Jakarta",
  "Surabaya",
  "Bandung",
  "Medan",
  "Bali",
  "Semarang",
  "Yogyakarta",
  "Makassar",
  "Balikpapan",
  "Palembang",
  "Malang",
  "Batam",
  "Padang",
  "Pontianak",
  "Manado",
];

let cachedCities = CANONICAL_DEFAULT_CITIES;
let inflightPromise = null;

async function fetchCatalogCities() {
  const responses = await Promise.all(
    CATALOG_ENDPOINTS.map((url) => api.get(url).catch(() => ({ data: { items: [] } })))
  );
  const set = new Set(CANONICAL_DEFAULT_CITIES);
  for (const { data } of responses) {
    const items = data?.items || data || [];
    for (const item of items) {
      if (item?.city) set.add(item.city);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
}

export function useCatalogCities() {
  const [cities, setCities] = useState(cachedCities || CANONICAL_DEFAULT_CITIES);
  const [loading, setLoading] = useState(false);

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
