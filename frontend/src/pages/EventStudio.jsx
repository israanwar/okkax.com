import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  MapPin,
  Network,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { api, apiError, compact, idr, num, downloadDoc } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import OkxDropdown from "@/components/OkxDropdown";
import { useAuth } from "@/context/AuthContext";
import { TalentRider, VenueTab, VendorTab, WorkforceTab } from "@/pages/workspace/Supply";
import { SponsorsTab, TenantsTab } from "@/pages/workspace/Commercial";
import { BudgetTab, OperationsTab, PaymentsTab, RippleTab } from "@/pages/workspace/Finance";
import { Blueprint, Graph } from "@/pages/workspace/BlueprintGraph";
import CalendarBoard from "@/components/CalendarBoard";
import {
  useStudioEventsList,
  useStudioBrief,
  useStudioRequirements,
  useStudioCacheManager,
  prefetchStudioAdjacentQueries,
} from "@/hooks/useStudioQueries";

const DOMAINS = [
  { key: "EVENT", label: "EVENT", Icon: Layers },
  { key: "NETWORK", label: "NETWORK", Icon: Network },
  { key: "CALENDAR", label: "CALENDAR", Icon: CalendarDays },
];

const EVENT_SUBVIEWS = [
  { key: "brief", label: "Brief" },
  { key: "identity", label: "Identity & Details" },
  { key: "audience", label: "Audience" },
  { key: "budget", label: "Budget" },
  { key: "requirements", label: "Requirements" },
  { key: "blueprint", label: "Blueprint" },
];

const NETWORK_SUBVIEWS = [
  { key: "talent", label: "Talent" },
  { key: "venue", label: "Venue" },
  { key: "vendors", label: "Vendor" },
  { key: "workforce", label: "Workforce" },
  { key: "sponsors", label: "Sponsor" },
  { key: "tenants", label: "Tenant" },
];

const CALENDAR_SUBVIEWS = [
  { key: "schedule", label: "Schedule" },
  { key: "timeline", label: "Timeline" },
  { key: "dependencies", label: "Dependencies" },
  { key: "deadlines", label: "Deadlines" },
  { key: "conflicts", label: "Conflicts" },
];

const EVENT_TYPES = [
  "Konser", "Festival", "Pameran & Expo", "Konferensi", "Turnamen Esports",
  "Pasar Kreatif", "Seminar Bisnis", "Gelar Wicara", "Aktivasi Brand", "Pertunjukan Teater"
];

const REQ_CATEGORIES = [
  "Semua Kategori", "Talent", "Rider", "Venue", "Vendor/Produksi", "Workforce",
  "Sponsor", "Tenant", "Perizinan & Legalitas", "Keamanan", "Medis", "Logistik"
];

const REQ_STATUSES = ["Semua Status", "Open", "In Progress", "Fulfilled", "Conflicted"];

const DEFAULT_BLANK_BRIEF = {
  name: "",
  event_type: "Konser",
  objective: "",
  description: "",
  city: "Jakarta",
  venue_preference: "Indoor",
  start_date: "2026-10-15",
  days: 1,
  setup_days: 1,
  capacity: 2000,
  budget: 800000000,
  currency: "IDR",
  target_age: "18-35",
  audience_profile: "",
  attendance_format: "Offline",
  talent_preference: "",
  production_standard: "Balanced",
};

export default function EventStudio() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramDomain = searchParams.get("domain") || "EVENT";
  const defaultSub = paramDomain === "EVENT" ? "brief" : paramDomain === "NETWORK" ? "talent" : "schedule";
  const paramSubview = searchParams.get("view") || defaultSub;

  // Single authoritative source for domain/subview: the URL itself.
  // Previously these were a separate useState pair kept in sync via a
  // useEffect that watched `searchParams`. On rapid tab switching, that
  // effect could fire with a searchParams snapshot that hadn't caught up
  // yet with the latest click, briefly forcing `domain`/`subview` back to a
  // stale value — the exact flicker/stale-render reported. Deriving them
  // directly from `searchParams` on every render removes the second state
  // copy entirely, so there is nothing left to race or fall out of sync.
  const domain = paramDomain;
  const subview = paramSubview;

  // URL & Storage Hydration for active Event ID
  const paramEventId = searchParams.get("event_id");
  const storedEventId = localStorage.getItem("okkax_active_studio_event_id");

  // TanStack React Query Hooks
  const { data: eventsList = [], isLoading: isEventsLoading } = useStudioEventsList();
  const { invalidateEvent, invalidateEventsList, queryClient } = useStudioCacheManager();

  // Resolved Active Event ID
  const selectedEventId = useMemo(() => {
    if (paramEventId === "new") return "__NEW_EVENT__";
    if (paramEventId) return paramEventId;
    if (storedEventId && eventsList.some((e) => e.id === storedEventId)) return storedEventId;
    if (eventsList.length > 0) return eventsList[0].id;
    return "__NEW_EVENT__";
  }, [paramEventId, storedEventId, eventsList]);

  const isNewEventMode = selectedEventId === "__NEW_EVENT__" || selectedEventId === "new";

  // Prefetch adjacent subview queries in background during idle time
  useEffect(() => {
    if (!isNewEventMode && selectedEventId) {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(() => prefetchStudioAdjacentQueries(queryClient, selectedEventId));
      } else {
        setTimeout(() => prefetchStudioAdjacentQueries(queryClient, selectedEventId), 200);
      }
    }
  }, [selectedEventId, isNewEventMode, queryClient]);

  // Keep localStorage and URL updated seamlessly
  useEffect(() => {
    if (selectedEventId && !isNewEventMode) {
      localStorage.setItem("okkax_active_studio_event_id", selectedEventId);
      if (!paramEventId) {
        setSearchParams(
          { event_id: selectedEventId, domain, view: subview },
          { replace: true }
        );
      }
    }
  }, [selectedEventId, isNewEventMode, paramEventId, domain, subview, setSearchParams]);

  // Core Data Queries
  const { data: briefContext, isLoading: isBriefLoading } = useStudioBrief(
    isNewEventMode ? null : selectedEventId
  );
  const { data: requirements = [], isLoading: isReqLoading } = useStudioRequirements(
    isNewEventMode ? null : selectedEventId
  );

  const event = briefContext?.event || null;

  // Local editable brief state
  const [brief, setBrief] = useState(DEFAULT_BLANK_BRIEF);
  const [saveStatus, setSaveStatus] = useState("Saved");

  // Sync brief from cache when event data arrives
  useEffect(() => {
    if (isNewEventMode) {
      setBrief({ ...DEFAULT_BLANK_BRIEF });
      setSaveStatus("Draft baru");
    } else if (briefContext?.brief) {
      setBrief(briefContext.brief);
      setSaveStatus("Saved");
    }
  }, [briefContext, isNewEventMode, selectedEventId]);

  // AI Studio Drawer / Panel State
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Requirement Modal State
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqForm, setReqForm] = useState({
    category: "Vendor/Produksi",
    title: "",
    description: "",
    quantity: 1,
    priority: "High",
    budget_estimate: 50000000,
    deadline: "",
    status: "Open",
  });

  // Requirement Filters
  const [reqCatFilter, setReqCatFilter] = useState("Semua Kategori");
  const [reqStatusFilter, setReqStatusFilter] = useState("Semua Status");
  const [reqSearch, setReqSearch] = useState("");

  // Navigation Switchers updating state and SearchParams with smooth replace
  const switchDomain = useCallback((newDomain) => {
    const targetSub = newDomain === "EVENT" ? "brief" : newDomain === "NETWORK" ? "talent" : "schedule";
    setSearchParams(
      {
        event_id: isNewEventMode ? "new" : selectedEventId,
        domain: newDomain,
        view: targetSub,
      },
      { replace: true }
    );
  }, [isNewEventMode, selectedEventId, setSearchParams]);

  const switchSubview = useCallback((newSubview) => {
    setSearchParams(
      {
        event_id: isNewEventMode ? "new" : selectedEventId,
        domain,
        view: newSubview,
      },
      { replace: true }
    );
  }, [isNewEventMode, selectedEventId, domain, setSearchParams]);

  // Event Context Switcher Handler
  const selectEvent = (eventId) => {
    if (eventId === "__NEW_EVENT__" || eventId === "new") {
      setBrief({ ...DEFAULT_BLANK_BRIEF });
      setSaveStatus("Draft baru");
      setSearchParams({ event_id: "new", domain: "EVENT", view: "brief" });
      return;
    }
    localStorage.setItem("okkax_active_studio_event_id", eventId);
    setSearchParams({ event_id: eventId, domain, view: subview });
  };

  // Brief Change & Autosave Handler
  const handleBriefChange = async (updatedFields) => {
    const nextBrief = { ...brief, ...updatedFields };
    setBrief(nextBrief);

    if (isNewEventMode) {
      setSaveStatus("Draft belum disimpan");
      return;
    }

    setSaveStatus("Saving...");
    try {
      await api.put(`/events/${selectedEventId}/brief`, nextBrief);
      setSaveStatus("Saved");
      invalidateEvent(selectedEventId, "brief");
    } catch (e) {
      setSaveStatus("Save failed · Retry");
    }
  };

  // Explicit Create / Save Event Flow
  const handleSaveOrUpdateEvent = async () => {
    if (!brief?.name || !brief.name.trim()) {
      toast.error("Nama event wajib diisi terlebih dahulu");
      return;
    }

    setAiBusy(true);
    try {
      if (isNewEventMode) {
        // Create new event via backend
        const { data } = await api.post("/events", brief);
        const createdEvent = data.event;
        const newId = createdEvent.id;

        // Auto-seed initial requirements
        await api.post(`/events/${newId}/requirements/auto-generate`).catch(() => {});

        toast.success(`Event baru berhasil dibuat: ${createdEvent.name}`);
        invalidateEventsList();
        invalidateEvent(newId);
        setSaveStatus("Saved");
        localStorage.setItem("okkax_active_studio_event_id", newId);
        nav(`/app/studio?event_id=${newId}&domain=EVENT&view=brief`);
      } else {
        await api.put(`/events/${selectedEventId}/brief`, brief);
        setSaveStatus("Saved");
        toast.success("Perubahan brief berhasil disimpan");
        invalidateEvent(selectedEventId);
      }
    } catch (e) {
      toast.error(apiError(e));
      setSaveStatus("Save failed · Retry");
    } finally {
      setAiBusy(false);
    }
  };

  // Compile Event Blueprint (AI Engine)
  const compileEventBlueprint = async () => {
    if (!brief?.name || !brief.name.trim()) {
      toast.error("Nama event wajib diisi terlebih dahulu");
      return;
    }
    setAiBusy(true);
    try {
      let targetId = selectedEventId;
      if (isNewEventMode) {
        const { data } = await api.post("/events", brief);
        targetId = data.event.id;
        invalidateEventsList();
        localStorage.setItem("okkax_active_studio_event_id", targetId);
      }
      await api.post(`/events/${targetId}/compile`);
      await api.post(`/events/${targetId}/requirements/auto-generate`);
      toast.success("Brief berhasil dikompilasi ke Event Blueprint & Requirements");
      invalidateEvent(targetId);
      nav(`/app/studio?event_id=${targetId}&domain=EVENT&view=blueprint`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setAiBusy(false);
    }
  };

  // Reset Draft to Blank
  const handleResetDraft = () => {
    setBrief({ ...DEFAULT_BLANK_BRIEF });
    setSaveStatus("Draft baru");
    toast.info("Form brief direset ke awal");
  };

  // Auto-generate Requirements
  const autoGenerateRequirements = async () => {
    if (isNewEventMode) {
      toast.error("Simpan event terlebih dahulu untuk menghasilkan requirements");
      return;
    }
    setAiBusy(true);
    try {
      const { data } = await api.post(`/events/${selectedEventId}/requirements/auto-generate`);
      invalidateEvent(selectedEventId, "requirements");
      toast.success(`Berhasil menghasilkan ${data.total} structured requirements`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setAiBusy(false);
    }
  };

  // Add Custom Requirement
  const handleAddRequirement = async (e) => {
    e.preventDefault();
    if (!reqForm.title) return toast.error("Judul requirement wajib diisi");
    if (isNewEventMode) return toast.error("Simpan event terlebih dahulu");

    try {
      await api.post(`/events/${selectedEventId}/requirements`, reqForm);
      invalidateEvent(selectedEventId, "requirements");
      setReqModalOpen(false);
      setReqForm({
        category: "Vendor/Produksi",
        title: "",
        description: "",
        quantity: 1,
        priority: "High",
        budget_estimate: 50000000,
        deadline: "",
        status: "Open",
      });
      toast.success("Requirement baru berhasil ditambahkan");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  // Patch Requirement Status
  const handleUpdateReqStatus = async (reqId, nextStatus) => {
    try {
      await api.patch(`/events/${selectedEventId}/requirements/${reqId}`, { status: nextStatus });
      invalidateEvent(selectedEventId, "requirements");
      toast.success(`Status requirement diubah menjadi ${nextStatus}`);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  // Delete Requirement
  const handleDeleteRequirement = async (reqId) => {
    try {
      await api.delete(`/events/${selectedEventId}/requirements/${reqId}`);
      invalidateEvent(selectedEventId, "requirements");
      toast.success("Requirement dihapus");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  // Execute AI Studio Action
  const runStudioAiAction = async (actionType) => {
    if (isNewEventMode) {
      toast.error("Simpan event terlebih dahulu untuk menggunakan AI Studio");
      return;
    }
    setAiBusy(true);
    try {
      const { data } = await api.post(`/events/${selectedEventId}/studio/ai-action`, { action: actionType });
      setAiResult(data);
      setAiDrawerOpen(true);
      if (actionType === "generate_requirements") {
        invalidateEvent(selectedEventId, "requirements");
      }
      toast.success(data.message);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setAiBusy(false);
    }
  };

  // Filtered Requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter((r) => {
      const matchCat = reqCatFilter === "Semua Kategori" || r.category === reqCatFilter;
      const matchStatus = reqStatusFilter === "Semua Status" || r.status === reqStatusFilter;
      const matchQ = !reqSearch || r.title.toLowerCase().includes(reqSearch.toLowerCase()) || r.description?.toLowerCase().includes(reqSearch.toLowerCase());
      return matchCat && matchStatus && matchQ;
    });
  }, [requirements, reqCatFilter, reqStatusFilter, reqSearch]);

  const reqStats = useMemo(() => {
    return {
      total: requirements.length,
      open: requirements.filter((r) => r.status === "Open").length,
      inProgress: requirements.filter((r) => r.status === "In Progress").length,
      fulfilled: requirements.filter((r) => r.status === "Fulfilled").length,
    };
  }, [requirements]);

  const sharedProps = { eventId: selectedEventId, event, onChange: () => invalidateEvent(selectedEventId) };

  // Dropdown event options with distinct + Buat Event Baru option
  const eventDropdownOptions = [
    { value: "__NEW_EVENT__", label: "+ Buat Event Baru" },
    ...eventsList.map((e) => ({
      value: e.id,
      label: `${e.name} (${e.event_code || e.city || "Draft"})`,
    })),
  ];

  return (
    <div className="okx-event-studio space-y-3 pb-16 font-gemini" data-testid="event-studio-workspace">
      {/* ============================================================
          STICKY COMMAND & DOMAIN ORCHESTRATION HEADER
          Matches Calendar & Network command grammar
         ============================================================ */}
      <section
        className="sticky -top-4 sm:-top-4.5 z-30 -mt-4 sm:-mt-4.5 -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 pt-3 sm:pt-3.5 pb-2.5 bg-[#07070a] border-b border-white/[0.08] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.9)] space-y-2"
        data-testid="studio-command-header"
      >
        {/* ROW 1: [ OKKAX Event Studio ] [ Event Selector ▼ ] [ Autosave ] <-----> [ Status ] [ Unduh Quotation ] [ AI Studio ] */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-300 font-gemini-mono shrink-0">
              <Sparkles size={11} className="text-zinc-400" />
              Event Studio
            </div>

            {/* Event Context Selector */}
            <div className="w-[210px] sm:w-[250px] md:w-[270px]">
              <OkxDropdown
                value={isNewEventMode ? "__NEW_EVENT__" : selectedEventId}
                onChange={selectEvent}
                options={eventDropdownOptions}
                searchable={eventsList.length > 3}
                placeholder="Pilih Event Aktif"
                className="w-full"
                testId="studio-event-selector"
                ariaLabel="Pilih Event Aktif"
              />
            </div>

            {/* Live Autosave Indicator */}
            <span
              data-testid="studio-autosave-indicator"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-gemini-mono ${
                saveStatus === "Saved"
                  ? "text-zinc-400 border border-white/[0.06] bg-white/[0.02]"
                  : saveStatus === "Saving..."
                  ? "text-white font-bold animate-pulse border border-white/20 bg-white/10"
                  : "text-zinc-300 border border-white/20 bg-white/[0.04]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${saveStatus === "Saved" ? "bg-white/50" : "bg-white"}`} />
              {saveStatus}
            </span>
          </div>

          {/* Quick Actions & Meta */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end md:self-center">
            {event ? (
              <>
                <span className="num hidden lg:inline-block text-[11px] text-zinc-400 font-gemini-mono mr-1">
                  {event.event_code}
                </span>
                <StatusBadge status={event.status === "published" ? "Confirmed" : "Draft"} testId="studio-event-status" />
                <button
                  type="button"
                  data-testid="studio-download-quotation"
                  onClick={async () => {
                    try {
                      await downloadDoc(`/documents/quotation/${event.id}`, `OKKAX-Quotation-${event.event_code}.pdf`);
                      toast.success("Quotation diunduh");
                    } catch (e) {
                      toast.error(apiError(e));
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                >
                  <Download size={11} />
                  <span>Quotation</span>
                </button>
                {event.status === "published" && (
                  <Link
                    to={`/events/${event.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition-all whitespace-nowrap"
                  >
                    <ExternalLink size={11} />
                    <span>Publik</span>
                  </Link>
                )}
              </>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono border border-white/[0.1] px-2 py-0.5 rounded-full">
                Mode Event Baru
              </span>
            )}

            {/* AI Studio Action Button */}
            <button
              type="button"
              data-testid="studio-ai-trigger-btn"
              onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Bot size={13} />
              <span>AI Studio</span>
            </button>
          </div>
        </div>

        {/* ROW 2: [ EVENT | NETWORK | CALENDAR ] <----------------> [ Sub-view Navigation Pills ] */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between pt-1.5 border-t border-white/[0.06]">
          {/* Top-Level 3 Domain Tabs */}
          <div className="flex items-center gap-1 shrink-0" role="tablist" aria-label="Event Studio Domain">
            {DOMAINS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={domain === key}
                data-testid={`studio-domain-${key.toLowerCase()}`}
                onClick={() => switchDomain(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  domain === key
                    ? "border-white/40 bg-white/15 text-white shadow-sm"
                    : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.05]"
                }`}
              >
                <Icon size={13} className={domain === key ? "text-white" : "text-zinc-400"} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Sub-view switcher for Active Domain */}
          <div
            className="flex items-center gap-1 overflow-x-auto okx-scroll no-scrollbar py-0.5"
            role="tablist"
            aria-label="Sub-view navigation"
          >
            {(domain === "EVENT" ? EVENT_SUBVIEWS : domain === "NETWORK" ? NETWORK_SUBVIEWS : CALENDAR_SUBVIEWS).map(
              ({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={subview === key}
                  data-testid={`studio-subview-${key}`}
                  onClick={() => switchSubview(key)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    subview === key
                      ? "border-white/30 bg-white/10 text-white font-bold"
                      : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                  }`}
                >
                  <span>{label}</span>
                </button>
              )
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          AI STUDIO REASONING DRAWER / ACTION CAPSULE
         ============================================================ */}
      {aiDrawerOpen && (
        <section
          className="rounded-2xl border border-white/20 bg-[#0d0d14] p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
          data-testid="studio-ai-drawer"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white font-gemini-mono">
                <Bot size={11} /> AI Studio Engine
              </span>
              <span className="text-xs text-zinc-300 font-semibold">
                Reasoning & Intelligence Action Layer
              </span>
            </div>
            <button
              onClick={() => setAiDrawerOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              data-testid="ai-action-compile-blueprint"
              onClick={compileEventBlueprint}
              disabled={aiBusy}
              className="flex flex-col items-start gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left hover:border-white/30 hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Zap size={13} className="text-zinc-300" />
                <span>Kompilasi Blueprint</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-4">
                Sintesis brief menjadi alur fase, workstreams, dan estimasi biaya operasional.
              </p>
            </button>

            <button
              type="button"
              data-testid="ai-action-generate-requirements"
              onClick={() => runStudioAiAction("generate_requirements")}
              disabled={aiBusy || isNewEventMode}
              className="flex flex-col items-start gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left hover:border-white/30 hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Layers size={13} className="text-zinc-300" />
                <span>Auto-Gen Requirements</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-4">
                Hasilkan daftar kebutuhan terstruktur (talent, venue, sound, panggung, perizinan).
              </p>
            </button>

            <button
              type="button"
              data-testid="ai-action-audit-conflicts"
              onClick={() => runStudioAiAction("audit_conflicts")}
              disabled={aiBusy || isNewEventMode}
              className="flex flex-col items-start gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left hover:border-white/30 hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <AlertTriangle size={13} className="text-zinc-300" />
                <span>Audit Risiko & Konflik</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-4">
                Audit jadwal, rider belum terpenuhi, perizinan, dan funding gap event.
              </p>
            </button>

            <button
              type="button"
              data-testid="ai-action-next-steps"
              onClick={() => runStudioAiAction("next_actions")}
              disabled={aiBusy || isNewEventMode}
              className="flex flex-col items-start gap-1 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left hover:border-white/30 hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <ArrowRight size={13} className="text-zinc-300" />
                <span>Next Best Actions</span>
              </div>
              <p className="text-[10.5px] text-zinc-400 leading-4">
                Dapatkan rekomendasi tindakan operasional prioritas berikutnya.
              </p>
            </button>
          </div>

          {/* AI Result Card Display */}
          {aiResult && (
            <div className="rounded-xl border border-white/[0.12] bg-black/50 p-3 text-xs space-y-2">
              <div className="font-bold text-white flex items-center justify-between">
                <span>Hasil Analisis AI:</span>
                <span className="font-gemini-mono text-[10.5px] text-zinc-400">{aiResult.message}</span>
              </div>
              {aiResult.conflicts && (
                <div className="space-y-1.5">
                  {aiResult.conflicts.map((c) => (
                    <div key={c.id} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-zinc-200">{c.title}</div>
                        <div className="text-[10.5px] text-zinc-400 mt-0.5">{c.description}</div>
                      </div>
                      <span className="text-[9.5px] font-bold font-gemini-mono text-white border border-white/30 rounded px-1.5 py-0.5 shrink-0">
                        {c.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {aiResult.actions && (
                <div className="space-y-1">
                  {aiResult.actions.map((a) => (
                    <div
                      key={a.step}
                      onClick={() => {
                        setAiDrawerOpen(false);
                        setSearchParams({ event_id: selectedEventId, domain: a.domain, view: a.target_tab });
                      }}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-white/[0.06] cursor-pointer text-zinc-300 hover:text-white"
                    >
                      <span>{a.step}. {a.title}</span>
                      <span className="text-[10px] font-gemini-mono text-zinc-400 underline">Buka {a.domain} &rarr;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ============================================================
          DOMAIN 1: EVENT
         ============================================================ */}
      {domain === "EVENT" && (
        <section className="space-y-3.5" data-testid="studio-domain-event-content">
          {/* Sub-view 1: Brief */}
          {subview === "brief" && (
            <div className="space-y-3.5" data-testid="studio-brief-view">
              {isBriefLoading && !isNewEventMode ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 p-8 text-center text-xs text-zinc-400 animate-pulse space-y-2" data-testid="studio-brief-loading">
                  <div>Memuat parameter event brief…</div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm">
                    <div>
                      <h2 className="text-sm font-bold text-white md:text-base tracking-tight">
                        {isNewEventMode ? "Buat Event Baru — Parameter Brief" : `Parameter Event Brief: ${event?.name || ""}`}
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Definisikan visi, skala, anggaran, dan target produksi untuk disintesis oleh Blueprint Engine.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isNewEventMode && (
                        <button
                          type="button"
                          onClick={handleResetDraft}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/[0.1] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                        >
                          <RotateCcw size={12} />
                          <span>Reset</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="studio-save-btn"
                        onClick={handleSaveOrUpdateEvent}
                        disabled={aiBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Save size={13} />
                        <span>{isNewEventMode ? "Buat & Simpan Event" : "Simpan Brief"}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="studio-compile-btn"
                        onClick={compileEventBlueprint}
                        disabled={aiBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Zap size={13} />
                        <span>{aiBusy ? "Memproses…" : "Kompilasi ke Blueprint"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Brief Form Grid */}
                  <div className="grid gap-3.5 sm:grid-cols-2 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 shadow-sm">
                    <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Nama Event *
                  </span>
                  <input
                    type="text"
                    data-testid="brief-name-input"
                    value={brief?.name || ""}
                    onChange={(e) => handleBriefChange({ name: e.target.value })}
                    placeholder="Contoh: Nusantara Sound Fest 2026"
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white placeholder:text-zinc-500 outline-none transition-all focus:border-white/40 focus:ring-1 focus:ring-white/20"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Jenis Event
                  </span>
                  <select
                    data-testid="brief-type-input"
                    value={brief?.event_type || "Konser"}
                    onChange={(e) => handleBriefChange({ event_type: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white outline-none transition-all focus:border-white/40 cursor-pointer"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-[#09090e] text-white">{t}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Kota / Wilayah
                  </span>
                  <input
                    type="text"
                    data-testid="brief-city-input"
                    value={brief?.city || "Jakarta"}
                    onChange={(e) => handleBriefChange({ city: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white placeholder:text-zinc-500 outline-none transition-all focus:border-white/40"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Tanggal Mulai
                  </span>
                  <input
                    type="date"
                    data-testid="brief-date-input"
                    value={brief?.start_date?.slice(0, 10) || "2026-10-15"}
                    onChange={(e) => handleBriefChange({ start_date: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white outline-none transition-all focus:border-white/40"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                      Durasi (Hari)
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={brief?.days || 1}
                      onChange={(e) => handleBriefChange({ days: Number(e.target.value) })}
                      className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs sm:text-[13px] text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                      Setup Days
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={brief?.setup_days || 1}
                      onChange={(e) => handleBriefChange({ setup_days: Number(e.target.value) })}
                      className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-xs sm:text-[13px] text-white outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Target Kapasitas (Pax)
                  </span>
                  <input
                    type="number"
                    step={100}
                    value={brief?.capacity || 2000}
                    onChange={(e) => handleBriefChange({ capacity: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white outline-none font-gemini-mono"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Alokasi Anggaran (IDR)
                  </span>
                  <input
                    type="number"
                    step={10000000}
                    value={brief?.budget || 800000000}
                    onChange={(e) => handleBriefChange({ budget: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white outline-none font-gemini-mono"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Deskripsi & Tujuan Event
                  </span>
                  <textarea
                    rows={3}
                    value={brief?.description || ""}
                    onChange={(e) => handleBriefChange({ description: e.target.value })}
                    placeholder="Jelaskan konsep, target experience, dan objektif kesuksesan event..."
                    className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3.5 py-2 text-xs sm:text-[13px] text-white placeholder:text-zinc-500 outline-none"
                  />
                </label>
              </div>
            </>
          )}
        </div>
      )}

          {/* Sub-view 2: Identity & Details */}
          {subview === "identity" && (
            <div className="space-y-3.5" data-testid="studio-identity-view">
              {isNewEventMode ? (
                <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center space-y-3">
                  <p className="text-xs text-zinc-400">
                    Event belum dibuat. Simpan brief terlebih dahulu untuk mengaktifkan Identity & Details.
                  </p>
                  <button
                    onClick={() => switchSubview("brief")}
                    className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
                  >
                    Buka Form Brief &rarr;
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Event ID", event?.id || "-"],
                      ["Event Code", event?.event_code || "-"],
                      ["Status Publikasi", event?.status === "published" ? "Published" : "Draft"],
                      ["Penyelenggara", event?.organizer_name || user?.name],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{lbl}</div>
                        <div className="mt-1 text-sm font-bold text-white truncate font-gemini-mono">{val}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white">Ringkasan Konfigurasi Operasional</h3>
                    <div className="grid gap-2 sm:grid-cols-2 text-xs">
                      <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                        <span className="text-zinc-400">Kategori:</span>
                        <span className="font-semibold text-white">{event?.event_type}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                        <span className="text-zinc-400">Lokasi / Venue:</span>
                        <span className="font-semibold text-white">{event?.venue_name || `${event?.city} (Venue belum dikunci)`}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                        <span className="text-zinc-400">Tanggal:</span>
                        <span className="font-semibold text-white font-gemini-mono">{event?.start_date} ({event?.days} hari)</span>
                      </div>
                      <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                        <span className="text-zinc-400">Target Kapasitas:</span>
                        <span className="font-semibold text-white font-gemini-mono">{num(event?.capacity)} pax</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sub-view 3: Audience */}
          {subview === "audience" && (
            <div className="space-y-3.5" data-testid="studio-audience-view">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Total Kapasitas Venue</div>
                  <div className="num mt-1 text-2xl font-bold text-white font-gemini-mono">{num(brief?.capacity || event?.capacity || 2000)}</div>
                  <div className="text-[10.5px] text-zinc-400 mt-1">Pax maksimum</div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Target Fill Rate</div>
                  <div className="num mt-1 text-2xl font-bold text-white font-gemini-mono">85%</div>
                  <div className="text-[10.5px] text-zinc-400 mt-1 font-gemini-mono">Estimasi: {num((brief?.capacity || event?.capacity || 2000) * 0.85)} pengunjung</div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">Segmentasi Usia</div>
                  <div className="num mt-1 text-lg font-bold text-white font-gemini-mono">{brief?.target_age || event?.age_limit || "18-35 Tahun"}</div>
                  <div className="text-[10.5px] text-zinc-400 mt-1">Gen-Z & Millennial Focus</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                  <h3 className="text-sm font-bold text-white">Simulasi Penjualan Tiket & Akses Audiens</h3>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono border border-white/20 px-2 py-0.5 rounded-full">
                    Estimasi / Simulasi AI
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="font-semibold text-white">Early Bird</div>
                    <div className="num text-sm font-bold text-white mt-1 font-gemini-mono">Rp250.000</div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">Kuota: {num(Math.max(200, Math.floor((brief?.capacity || event?.capacity || 2000) * 0.2)))} tiket</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="font-semibold text-white">Regular Presale</div>
                    <div className="num text-sm font-bold text-white mt-1 font-gemini-mono">Rp375.000</div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">Kuota: {num(Math.max(500, Math.floor((brief?.capacity || event?.capacity || 2000) * 0.6)))} tiket</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="font-semibold text-white">VIP Access</div>
                    <div className="num text-sm font-bold text-white mt-1 font-gemini-mono">Rp950.000</div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">Kuota: {num(Math.max(100, Math.floor((brief?.capacity || event?.capacity || 2000) * 0.1)))} tiket</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-view 4: Budget */}
          {subview === "budget" && (
            <div className="space-y-4" data-testid="studio-budget-view">
              {isNewEventMode ? (
                <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center space-y-3">
                  <p className="text-xs text-zinc-400">
                    Event belum dibuat. Simpan brief terlebih dahulu untuk mengakses simulator anggaran dan ledger finansial.
                  </p>
                  <button
                    onClick={() => switchSubview("brief")}
                    className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
                  >
                    Buka Form Brief &rarr;
                  </button>
                </div>
              ) : (
                <BudgetTab {...sharedProps} />
              )}
            </div>
          )}

          {/* Sub-view 5: Structured Requirements Engine */}
          {subview === "requirements" && (
            <div className="space-y-3" data-testid="studio-requirements-view">
              {isNewEventMode ? (
                <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center space-y-3">
                  <p className="text-xs text-zinc-400">
                    Event belum dibuat. Simpan brief terlebih dahulu untuk mengelola structured requirements.
                  </p>
                  <button
                    onClick={() => switchSubview("brief")}
                    className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
                  >
                    Buka Form Brief &rarr;
                  </button>
                </div>
              ) : (
                <>
                  {/* Requirements Control & Stat Strip */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          Structured Requirements Engine ({reqStats.total} Total)
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Daftar spesifikasi kebutuhan operasional yang siap dicocokkan dengan supply Network OKKAX.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="studio-auto-req-btn"
                          onClick={autoGenerateRequirements}
                          disabled={aiBusy}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/30 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Bot size={13} />
                          <span>Auto-Generate (AI)</span>
                        </button>
                        <button
                          type="button"
                          data-testid="studio-add-req-btn"
                          onClick={() => setReqModalOpen(true)}
                          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-sm cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Tambah</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter & Search Strip */}
                    <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-white/[0.06]">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        <input
                          type="text"
                          value={reqSearch}
                          onChange={(e) => setReqSearch(e.target.value)}
                          placeholder="Cari kebutuhan..."
                          className="w-full h-8 rounded-lg border border-white/[0.1] bg-white/[0.03] pl-8 pr-2 text-xs text-white placeholder:text-zinc-500 outline-none"
                        />
                      </div>
                      <select
                        value={reqCatFilter}
                        onChange={(e) => setReqCatFilter(e.target.value)}
                        className="h-8 rounded-lg border border-white/[0.1] bg-[#0c0c14] px-2 text-xs text-white outline-none cursor-pointer"
                      >
                        {REQ_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={reqStatusFilter}
                        onChange={(e) => setReqStatusFilter(e.target.value)}
                        className="h-8 rounded-lg border border-white/[0.1] bg-[#0c0c14] px-2 text-xs text-white outline-none cursor-pointer"
                      >
                        {REQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Requirements Cards Table/Grid with Skeleton during loading */}
                  <div className="space-y-2" data-testid="requirements-list">
                    {isReqLoading ? (
                      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 p-8 text-center text-xs text-zinc-400 animate-pulse">
                        Memuat structured requirements…
                      </div>
                    ) : filteredRequirements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.1] p-10 text-center text-xs text-zinc-400">
                        Tidak ada requirement yang cocok dengan filter aktif.
                      </div>
                    ) : (
                      filteredRequirements.map((r) => (
                        <div
                          key={r.id}
                          data-testid={`req-card-${r.id}`}
                          className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/[0.08] bg-[#0c0c12]/90 p-3 hover:border-white/20 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold font-gemini-mono uppercase tracking-wider text-zinc-400 border border-white/20 px-1.5 py-0.5 rounded">
                                {r.category}
                              </span>
                              <span className="text-xs sm:text-[13px] font-bold text-white tracking-tight truncate">
                                {r.title}
                              </span>
                              <span className={`text-[8.5px] font-bold font-gemini-mono uppercase px-1.5 py-0.2 rounded border ${
                                r.priority === "High" ? "border-white text-white bg-white/10" : "border-white/20 text-zinc-400"
                              }`}>
                                {r.priority}
                              </span>
                            </div>
                            {r.description && (
                              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                                {r.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[10.5px] text-zinc-400 font-gemini-mono">
                              {r.quantity > 1 && <span>Qty: {r.quantity}</span>}
                              {r.budget_estimate > 0 && <span>Est: {compact(r.budget_estimate)}</span>}
                              {r.deadline && <span>Deadline: {r.deadline.slice(0, 10)}</span>}
                              {r.assigned_resource_name ? (
                                <span className="text-white font-semibold flex items-center gap-1">
                                  <Check size={11} /> {r.assigned_resource_name}
                                </span>
                              ) : (
                                <span className="text-zinc-500 italic">Belum ditugaskan</span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {!r.assigned_resource_name && (
                              <button
                                type="button"
                                onClick={() => {
                                  const targetTab = r.category.toLowerCase().includes("talent")
                                    ? "talent"
                                    : r.category.toLowerCase().includes("venue")
                                    ? "venue"
                                    : r.category.toLowerCase().includes("workforce")
                                    ? "workforce"
                                    : r.category.toLowerCase().includes("sponsor")
                                    ? "sponsors"
                                    : r.category.toLowerCase().includes("tenant")
                                    ? "tenants"
                                    : "vendors";
                                  setSearchParams({ event_id: selectedEventId, domain: "NETWORK", view: targetTab });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-semibold text-zinc-300 hover:border-white/30 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                              >
                                <span>Cari di Network &rarr;</span>
                              </button>
                            )}

                            <select
                              value={r.status}
                              onChange={(e) => handleUpdateReqStatus(r.id, e.target.value)}
                              className="h-7 rounded-lg border border-white/[0.12] bg-[#0c0c14] px-2 text-[10.5px] font-gemini-mono text-white outline-none cursor-pointer"
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Fulfilled">Fulfilled</option>
                              <option value="Conflicted">Conflicted</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDeleteRequirement(r.id)}
                              className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                              title="Hapus requirement"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sub-view 6: Blueprint */}
          {subview === "blueprint" && (
            <div className="space-y-4" data-testid="studio-blueprint-view">
              {isNewEventMode ? (
                <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center space-y-3">
                  <p className="text-xs text-zinc-400">
                    Event belum dibuat. Simpan brief terlebih dahulu untuk mengompilasi Blueprint dan Graph.
                  </p>
                  <button
                    onClick={() => switchSubview("brief")}
                    className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
                  >
                    Buka Form Brief &rarr;
                  </button>
                </div>
              ) : (
                <>
                  <Blueprint {...sharedProps} />
                  <div className="border-t border-white/[0.08] pt-4">
                    <h3 className="text-sm font-bold text-white mb-2">Event Dependency & Interaction Graph</h3>
                    <Graph {...sharedProps} />
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ============================================================
          DOMAIN 2: NETWORK (Event-Scoped Supply & Commercial)
         ============================================================ */}
      {domain === "NETWORK" && (
        <section className="space-y-4" data-testid="studio-domain-network-content">
          {isNewEventMode ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center space-y-3">
              <p className="text-xs text-zinc-400">
                Modul Network memerlukan event aktif. Simpan brief terlebih dahulu untuk mengaktifkan kurasi supply dan pencocokan kandidat.
              </p>
              <button
                onClick={() => switchDomain("EVENT")}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
              >
                Isi & Simpan Brief &rarr;
              </button>
            </div>
          ) : (
            <>
              {subview === "talent" && <TalentRider {...sharedProps} />}
              {subview === "venue" && <VenueTab {...sharedProps} />}
              {subview === "vendors" && <VendorTab {...sharedProps} />}
              {subview === "workforce" && <WorkforceTab {...sharedProps} />}
              {subview === "sponsors" && <SponsorsTab {...sharedProps} />}
              {subview === "tenants" && <TenantsTab {...sharedProps} />}
            </>
          )}
        </section>
      )}

      {/* ============================================================
          DOMAIN 3: CALENDAR (Event-Scoped Scheduling & Conflicts)
         ============================================================ */}
      {domain === "CALENDAR" && (
        <section className="space-y-4" data-testid="studio-domain-calendar-content">
          {isNewEventMode ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center space-y-3">
              <p className="text-xs text-zinc-400">
                Modul Calendar memerlukan event aktif. Simpan brief terlebih dahulu untuk menjadwalkan timeline, load-in, dan mendeteksi konflik.
              </p>
              <button
                onClick={() => switchDomain("EVENT")}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
              >
                Isi & Simpan Brief &rarr;
              </button>
            </div>
          ) : (
            <>
              {subview === "schedule" && (
                <div data-testid="studio-calendar-schedule">
                  <CalendarBoard eventId={selectedEventId} internal={true} />
                </div>
              )}

              {subview === "timeline" && (
                <div className="space-y-4" data-testid="studio-calendar-timeline">
                  <OperationsTab {...sharedProps} />
                </div>
              )}

              {subview === "dependencies" && (
                <div className="space-y-4" data-testid="studio-calendar-dependencies">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white">Rantai Dependensi & Jalur Kritis Event</h3>
                    <p className="text-xs text-zinc-400">
                      Pemetaan urutan ketergantungan antara booking venue, konfirmasi tech rider talent, loading vendor, soundcheck, hingga showtime.
                    </p>
                    <div className="space-y-2 text-xs">
                      {[
                        ["1. Kunci Sewa Venue", "Prasyarat untuk izin keramaian & desain tata panggung", "Confirmed"],
                        ["2. Finalisasi Tech Rider Talent", "Prasyarat spesifikasi line array & lighting FOH", "In Progress"],
                        ["3. Load-in & Instalasi Panggung", "Prasyarat soundcheck & simulasi tata cahaya", "Pending"],
                        ["4. Soundcheck & Rehearsal", "Prasyarat gerbang dibuka (Gates Open)", "Pending"],
                        ["5. Showtime & Live Concert", "Prasyarat pembongkaran (Dismantling) & settlement", "Pending"],
                      ].map(([title, desc, status]) => (
                        <div key={title} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                          <div>
                            <div className="font-semibold text-white">{title}</div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">{desc}</div>
                          </div>
                          <StatusBadge status={status} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {subview === "deadlines" && (
                <div className="space-y-3" data-testid="studio-calendar-deadlines">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white">Target Tenggat Waktu (Deadlines) Operasional</h3>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["H-45", "DP Pembayaran Sewa Venue", "Wajib diselesaikan untuk memvalidasi tanggal"],
                        ["H-30", "Pelunasan Kontrak Artis Utama", "Penyerahan flight ticket & hospitality booking"],
                        ["H-21", "Penerbitan Izin Keramaian", "Rekomendasi Polsek, Polres, dan Dishub"],
                        ["H-14", "Finalisasi Kurasi Tenant UMKM", "Pembagian nomor booth & alokasi daya listrik"],
                        ["H-7", "Technical Meeting Seluruh Vendor", "Penyelarasan rundown & jam masuk loading dock"],
                        ["H-1", "Stagehand & Usher Briefing", "Simulasi alur gate, tiket scan, dan evakuasi"],
                      ].map(([tag, title, desc]) => (
                        <div key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-gemini-mono font-bold text-xs text-white border border-white/25 px-1.5 py-0.5 rounded">{tag}</span>
                            <span className="text-[10px] text-zinc-400 font-gemini-mono">Tenggat Kritis</span>
                          </div>
                          <div className="font-semibold text-white mt-2 text-xs">{title}</div>
                          <div className="text-[10.5px] text-zinc-400 mt-0.5">{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {subview === "conflicts" && (
                <div className="space-y-3" data-testid="studio-calendar-conflicts">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                      <div>
                        <h3 className="text-sm font-bold text-white">Conflict & Risk Detection Engine</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Deteksi otomatis ketidaksesuaian jadwal, kekurangan pendanaan, atau requirement tanpa penugasan.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => runStudioAiAction("audit_conflicts")}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/30 hover:text-white transition-all cursor-pointer"
                      >
                        <Bot size={13} />
                        <span>Jalankan Audit AI</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] p-3.5 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold font-gemini-mono uppercase px-1.5 py-0.5 rounded border border-white text-white bg-white/10">
                              High Severity
                            </span>
                            <span className="text-xs font-bold text-white">
                              Rider Teknis Sound System Belum Terkunci
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1">
                            Artis headliner memerlukan minimal 48-channel digital mixer, sedangkan penawaran vendor panggung saat ini baru mencakup 32-channel.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchParams({ event_id: selectedEventId, domain: "NETWORK", view: "vendors" });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/20 transition-all cursor-pointer shrink-0"
                        >
                          <span>Selesaikan &rarr;</span>
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] p-3.5 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold font-gemini-mono uppercase px-1.5 py-0.5 rounded border border-white/20 text-zinc-300">
                              Medium Severity
                            </span>
                            <span className="text-xs font-bold text-white">
                              Penyelarasan Jam Loading Dock & Curfew Venue
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1">
                            Izin loading dock berakhir pukul 02:00 pagi, perkiraan waktu pembongkaran panggung membutuhkan 5 jam.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchParams({ event_id: selectedEventId, domain: "CALENDAR", view: "schedule" });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/20 transition-all cursor-pointer shrink-0"
                        >
                          <span>Atur Jadwal &rarr;</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ============================================================
          MODAL: TAMBAH STRUCTURED REQUIREMENT
         ============================================================ */}
      {reqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.15] bg-[#0c0c14] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white">Tambah Structured Requirement</h3>
              <button onClick={() => setReqModalOpen(false)} className="rounded p-1 text-zinc-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddRequirement} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                  Kategori
                </label>
                <select
                  value={reqForm.category}
                  onChange={(e) => setReqForm({ ...reqForm, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-white outline-none cursor-pointer"
                >
                  {REQ_CATEGORIES.filter((c) => c !== "Semua Kategori").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                  Judul Requirement *
                </label>
                <input
                  type="text"
                  required
                  value={reqForm.title}
                  onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
                  placeholder="Contoh: Sound System FOH Line Array"
                  className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-white placeholder:text-zinc-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                  Deskripsi & Spesifikasi
                </label>
                <textarea
                  rows={2}
                  value={reqForm.description}
                  onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })}
                  placeholder="Rincian teknis, kapasitas, atau persyaratan..."
                  className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-white placeholder:text-zinc-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Prioritas
                  </label>
                  <select
                    value={reqForm.priority}
                    onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-white outline-none cursor-pointer"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-gemini-mono">
                    Estimasi Anggaran (IDR)
                  </label>
                  <input
                    type="number"
                    step={1000000}
                    value={reqForm.budget_estimate}
                    onChange={(e) => setReqForm({ ...reqForm, budget_estimate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-white/[0.12] bg-[#09090e] px-3 py-2 text-white outline-none font-gemini-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setReqModalOpen(false)}
                  className="rounded-xl border border-white/[0.12] px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 cursor-pointer"
                >
                  Simpan Requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
