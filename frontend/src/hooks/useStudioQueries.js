import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const STALE_TIME_EVENT = 60 * 1000; // 1 minute
const STALE_TIME_CATALOG = 5 * 60 * 1000; // 5 minutes

const isValidEventId = (id) => Boolean(id && id !== "__NEW_EVENT__" && id !== "new");

/**
 * 1. Fetch Organizer Events List
 */
export function useStudioEventsList() {
  return useQuery({
    queryKey: ["events", "list"],
    queryFn: async () => {
      const { data } = await api.get("/events");
      return data.items || [];
    },
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 2. Fetch Active Event Context (Brief & Event Detail)
 */
export function useStudioBrief(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "brief"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/brief`);
      return {
        event: data.event,
        brief: data.brief?.payload || data.event,
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 3. Fetch Event Budget
 */
export function useStudioBudget(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "budget"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/budget`);
      return data;
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 4. Fetch Event Blueprint
 */
export function useStudioBlueprint(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "blueprint"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/blueprint`);
      return data.blueprint || null;
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 5. Fetch Structured Requirements
 */
export function useStudioRequirements(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "requirements"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/requirements`);
      return data.items || [];
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 6. Fetch Event Talents & Riders
 */
export function useStudioTalents(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "talents"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/talents`);
      return {
        items: data.items || [],
        riders: data.riders || [],
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 7. Fetch Global Talents Catalog (Long-lived cache)
 */
export function useStudioCatalogTalents() {
  return useQuery({
    queryKey: ["catalog", "talents"],
    queryFn: async () => {
      const { data } = await api.get("/catalog/talents");
      return data.items || [];
    },
    staleTime: STALE_TIME_CATALOG,
  });
}

/**
 * 8. Fetch Venue Matches & Selected Venue
 */
export function useStudioVenue(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "venue"],
    queryFn: async () => {
      const [{ data: m }, { data: s }] = await Promise.all([
        api.get(`/events/${eventId}/venue-matches`),
        api.get(`/events/${eventId}/venue`),
      ]);
      return {
        matches: m.items || [],
        selected: s.item || null,
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 9. Fetch Vendor Matches & Selected Vendors
 */
export function useStudioVendors(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "vendors"],
    queryFn: async () => {
      const [{ data: m }, { data: s }] = await Promise.all([
        api.get(`/events/${eventId}/vendor-matches`),
        api.get(`/events/${eventId}/vendors`),
      ]);
      return {
        matches: m.items || [],
        selected: s.items || [],
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 10. Fetch Workforce Jobs, Assigned Workers & Pool
 */
export function useStudioWorkforce(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "workforce"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/workforce`);
      return {
        jobs: data.jobs || [],
        assigned: data.assigned || [],
        pool: data.pool || [],
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 11. Fetch Sponsor Packages, Interests & Commitments
 */
export function useStudioSponsors(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "sponsors"],
    queryFn: async () => {
      const [{ data: p }, { data: i }] = await Promise.all([
        api.get(`/events/${eventId}/sponsor-packages`),
        api.get(`/events/${eventId}/sponsor-interests`),
      ]);
      return {
        packages: p.items || [],
        interests: i.items || [],
        commitments: i.commitments || [],
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 12. Fetch Tenant Zones & Applications
 */
export function useStudioTenants(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "tenants"],
    queryFn: async () => {
      const [{ data: z }, { data: b }, { data: a }] = await Promise.all([
        api.get(`/events/${eventId}/tenant-zones`),
        api.get(`/events/${eventId}/tenant-booths`).catch(() => ({ data: { items: [] } })),
        api.get(`/events/${eventId}/tenant-applications`),
      ]);
      return {
        zones: z.items || [],
        booths: b.items || [],
        apps: a.items || [],
      };
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 13. Fetch Operations & Milestones
 */
export function useStudioOperations(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "operations"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/operations`);
      return data;
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * 14. Fetch Event Dependency Graph
 */
export function useStudioGraph(eventId) {
  return useQuery({
    queryKey: ["studio", eventId, "graph"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/graph`);
      return data;
    },
    enabled: isValidEventId(eventId),
    staleTime: STALE_TIME_EVENT,
  });
}

export function prefetchStudioAdjacentQueries(queryClient, eventId) {
  if (!isValidEventId(eventId)) return;

  queryClient.prefetchQuery({
    queryKey: ["studio", eventId, "budget"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/budget`);
      return data;
    },
    staleTime: STALE_TIME_EVENT,
  });

  queryClient.prefetchQuery({
    queryKey: ["studio", eventId, "talents"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/talents`);
      return {
        items: data.items || [],
        riders: data.riders || [],
      };
    },
    staleTime: STALE_TIME_EVENT,
  });

  queryClient.prefetchQuery({
    queryKey: ["studio", eventId, "blueprint"],
    queryFn: async () => {
      const { data } = await api.get(`/events/${eventId}/blueprint`);
      return data.blueprint || null;
    },
    staleTime: STALE_TIME_EVENT,
  });
}

/**
 * Helper hook for invalidating Studio event caches
 */
export function useStudioCacheManager() {
  const queryClient = useQueryClient();

  const invalidateEvent = (eventId, subKey) => {
    if (!eventId) return;
    if (subKey) {
      queryClient.invalidateQueries({ queryKey: ["studio", eventId, subKey] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["studio", eventId] });
    }
  };

  const invalidateEventsList = () => {
    queryClient.invalidateQueries({ queryKey: ["events", "list"] });
  };

  return {
    invalidateEvent,
    invalidateEventsList,
    queryClient,
  };
}
