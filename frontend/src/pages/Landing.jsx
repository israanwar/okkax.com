import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CircleDot,
  CircleOff,
  Clock3,
  Info,
  LineChart,
  ListChecks,
  MousePointerClick,
  Network,
  QrCode,
  Route,
  Store,
  Ticket,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-react";
import PublicNav, { Footer } from "@/components/PublicNav";
import { api, compact, num, DEMO_EVENT_ID } from "@/lib/api";
import { NodeIcon, colorOf as PREVIEW_COLOR } from "@/pages/workspace/BlueprintGraph";

const HERO = "/assets/okkax-concert-hero-v2.png";

const PREVIEW_TONE = { get: (k) => PREVIEW_COLOR(k) };

const STATUS_META = {
  Confirmed: { color: "#f4f4f5", Icon: CheckCircle2, tooltip: "Sudah siap dan telah dikonfirmasi." },
  Pending: { color: "#ff7ab0", Icon: Clock3, tooltip: "Sedang menunggu keputusan atau penyelesaian." },
  "At Risk": { color: "#ff2e7e", Icon: TriangleAlert, tooltip: "Memerlukan perhatian karena dapat menghambat event." },
  Missing: { color: "#a1a1aa", Icon: CircleOff, tooltip: "Komponen wajib belum tersedia." },
  Completed: { color: "#ffd1e2", Icon: BadgeCheck, tooltip: "Target komponen telah selesai dipenuhi." },
};
const STATUS_ORDER = ["Confirmed", "Pending", "At Risk", "Missing", "Completed"];

const GRAPH_COMPONENT_LABELS = {
  event: "Event ID",
  organizer: "Organizer",
  talent: "Talent",
  rider: "Rider",
  venue: "Venue",
  vendor: "Vendor",
  sponsor: "Sponsor",
  tenant: "Tenant",
  workforce: "Workforce",
  ticket: "Ticketing",
  funding: "Pendanaan",
};

const PREVIEW_EDGES = [
  { id: "event-organizer", source: "event", target: "organizer", label: "diselenggarakan oleh" },
  { id: "event-talent", source: "event", target: "talent", label: "program talent" },
  { id: "talent-rider", source: "talent", target: "rider", label: "mengaktifkan rider" },
  { id: "rider-vendor", source: "rider", target: "vendor", label: "membutuhkan vendor" },
  { id: "event-venue", source: "event", target: "venue", label: "menggunakan venue" },
  { id: "venue-vendor", source: "venue", target: "vendor", label: "menentukan kebutuhan produksi" },
  { id: "venue-ticket", source: "venue", target: "ticket", label: "menentukan kapasitas tiket" },
  { id: "venue-workforce", source: "venue", target: "workforce", label: "menentukan crew & keamanan" },
  { id: "venue-tenant", source: "venue", target: "tenant", label: "menentukan kapasitas tenant" },
  { id: "event-sponsor", source: "event", target: "sponsor", label: "membuka inventory sponsor" },
  { id: "sponsor-funding", source: "sponsor", target: "funding", label: "menambah pendanaan" },
  { id: "funding-vendor", source: "funding", target: "vendor", label: "membuka aktivasi produksi" },
  { id: "event-tenant", source: "event", target: "tenant", label: "membuka zona tenant" },
  { id: "tenant-funding", source: "tenant", target: "funding", label: "menambah pendapatan" },
  { id: "event-workforce", source: "event", target: "workforce", label: "membutuhkan workforce" },
  { id: "vendor-workforce", source: "vendor", target: "workforce", label: "memicu crew & keamanan" },
  { id: "workforce-funding", source: "workforce", target: "funding", label: "menambah biaya operasi" },
  { id: "event-ticket", source: "event", target: "ticket", label: "membuka ticketing" },
  { id: "ticket-funding", source: "ticket", target: "funding", label: "menghasilkan pendapatan" },
  { id: "event-funding", source: "event", target: "funding", label: "mengendalikan anggaran" },
];

const SCENARIOS = [
  {
    id: "talent",
    title: "Talent dipilih",
    description: "Talent dipilih → rider aktif → vendor dibutuhkan → perjalanan dan akomodasi dihitung → keamanan diperbarui → anggaran berubah.",
    steps: [
      { label: "Talent dipilih", focus: "talent", nodes: ["event", "talent"], edges: ["event-talent"] },
      { label: "Rider aktif", focus: "rider", nodes: ["rider"], edges: ["talent-rider"] },
      { label: "Vendor dibutuhkan", focus: "vendor", nodes: ["vendor"], edges: ["rider-vendor"] },
      { label: "Perjalanan & akomodasi dihitung", focus: "vendor", nodes: ["vendor"], edges: ["rider-vendor"] },
      { label: "Keamanan diperbarui", focus: "workforce", nodes: ["workforce"], edges: ["vendor-workforce"] },
      { label: "Anggaran berubah", focus: "funding", nodes: ["funding"], edges: ["workforce-funding"] },
    ],
  },
  {
    id: "venue",
    title: "Venue berubah",
    description: "Venue berubah → kapasitas berubah → tiket dihitung ulang → workforce dan keamanan berubah → tenant dan pendapatan diperbarui.",
    steps: [
      { label: "Venue berubah", focus: "venue", nodes: ["event", "venue"], edges: ["event-venue"] },
      { label: "Kapasitas berubah", focus: "venue", nodes: ["venue"], edges: ["event-venue"] },
      { label: "Tiket dihitung ulang", focus: "ticket", nodes: ["ticket"], edges: ["venue-ticket"] },
      { label: "Workforce & keamanan berubah", focus: "workforce", nodes: ["workforce"], edges: ["venue-workforce"] },
      { label: "Tenant diperbarui", focus: "tenant", nodes: ["tenant"], edges: ["venue-tenant"] },
      { label: "Pendapatan diperbarui", focus: "funding", nodes: ["funding"], edges: ["tenant-funding"] },
    ],
  },
  {
    id: "sponsor",
    title: "Sponsor dikonfirmasi",
    description: "Sponsor dikonfirmasi → pendanaan bertambah → funding gap berkurang → hak aktivasi dibuat → kebutuhan produksi bertambah.",
    steps: [
      { label: "Sponsor dikonfirmasi", focus: "sponsor", nodes: ["event", "sponsor"], edges: ["event-sponsor"] },
      { label: "Pendanaan bertambah", focus: "funding", nodes: ["funding"], edges: ["sponsor-funding"] },
      { label: "Funding gap berkurang", focus: "funding", nodes: ["funding"], edges: ["sponsor-funding"] },
      { label: "Hak aktivasi dibuat", focus: "sponsor", nodes: ["sponsor"], edges: ["event-sponsor"] },
      { label: "Kebutuhan produksi bertambah", focus: "vendor", nodes: ["vendor"], edges: ["funding-vendor"] },
    ],
  },
];

const PW = 900, PH = 620, PCX = 450, PCY = 310;
const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const progressOf = (done, total) => total > 0 ? clampPercent((done / total) * 100) : 0;
const firstOpen = (items, fallback = "Tidak ada kebutuhan terbuka.") => items.length ? items : [fallback];

function buildPreviewNodes(summary, catalogEvent) {
  if (!summary) return [];
  const demoEvent = summary.event || {};
  const event = catalogEvent || demoEvent;
  const isDemoEvent = !catalogEvent?.id || catalogEvent.id === demoEvent.id;
  const key = summary.key_numbers || {};
  const networkData = summary.network || {};
  const operations = summary.operations || {};
  const brief = summary.brief || {};
  const rippleData = summary.ripple || {};

  const totalCost = Number(isDemoEvent ? key.total_event_cost : event.budget || 0);
  const confirmedFunding = Number(isDemoEvent ? key.confirmed_funding : 0);
  const fundingGap = isDemoEvent ? Number(key.funding_gap || 0) : null;
  const fundingProgress = isDemoEvent && totalCost > 0 ? progressOf(confirmedFunding, totalCost) : 0;
  const headline = isDemoEvent ? brief.headliner : event.headline_talent;
  const talentCount = Number(isDemoEvent ? networkData.talents : event.talent_count || 0);
  const riderMatched = Number(isDemoEvent ? operations.rider_matched : 0);
  const riderTotal = Number(isDemoEvent ? operations.rider_total : 0);
  const vendorConfirmed = Number(isDemoEvent ? operations.vendors_confirmed : event.vendor_count || 0);
  const vendorTotal = Number(isDemoEvent ? operations.vendors_total : event.vendor_count || 0);
  const workforceFilled = Number(isDemoEvent ? operations.workforce_filled : 0);
  const workforceNeeded = Number(isDemoEvent ? operations.workforce_needed : 0);
  const boothsOccupied = Number(isDemoEvent ? networkData.booths_occupied : event.tenant_count || 0);
  const boothsTotal = Number(isDemoEvent ? networkData.booths_total : event.tenant_count || 0);
  const ticketsSold = Number(isDemoEvent ? networkData.tickets_sold : event.sold || 0);
  const ticketCapacity = Number(isDemoEvent ? networkData.ticket_capacity : ticketsSold + Number(event.tickets_remaining || 0));
  const sponsorCommitments = Number(isDemoEvent ? networkData.sponsor_commitments : event.sponsor_sold || 0);
  const sponsorTiers = Number(isDemoEvent ? brief.sponsor_tiers : event.sponsor_slots || 0);
  const catalogSignals = [event.organizer_name, headline || talentCount, event.venue_name, ticketCapacity, vendorConfirmed, sponsorTiers];
  const readiness = isDemoEvent
    ? clampPercent(operations.readiness)
    : progressOf(catalogSignals.filter(Boolean).length, catalogSignals.length);
  const eventStatus = event.status === "completed" ? "Completed" : ["published", "live"].includes(event.status) ? "Confirmed" : "Pending";
  const riderStatus = !isDemoEvent ? (headline ? "Pending" : "Missing") : riderTotal === 0 ? "Missing" : riderMatched >= riderTotal ? "Completed" : riderMatched > 0 ? "Pending" : "At Risk";
  const vendorStatus = vendorTotal === 0 ? "Missing" : vendorConfirmed >= vendorTotal ? "Completed" : vendorConfirmed > 0 ? "Pending" : "At Risk";
  const workforceStatus = workforceNeeded === 0 ? "Missing" : workforceFilled >= workforceNeeded ? "Completed" : progressOf(workforceFilled, workforceNeeded) < 60 ? "At Risk" : "Pending";
  const tenantStatus = boothsTotal === 0 ? "Missing" : boothsOccupied >= boothsTotal ? "Completed" : boothsOccupied > 0 ? "Pending" : "Missing";
  const ticketStatus = ticketCapacity === 0 ? "Missing" : ticketsSold >= ticketCapacity ? "Completed" : "Pending";
  const sponsorStatus = sponsorTiers === 0 ? "Missing" : sponsorCommitments >= sponsorTiers ? "Completed" : sponsorCommitments > 0 ? "Confirmed" : "Pending";

  return [
    {
      id: "event", label: event.name || "Event OKKAX", kind: "Event", status: eventStatus,
      description: "Pusat kendali yang menghubungkan semua komponen pada satu Event ID.",
      owner: event.organizer_name || "Event Organizer",
      value: `${event.event_code || DEMO_EVENT_ID} · ${compact(totalCost)}`,
      progress: readiness,
      unmet: readiness < 100 ? [`${100 - readiness}% komponen katalog masih perlu dilengkapi.`] : [],
      risks: fundingGap !== null && fundingGap > 0 ? [`Funding gap ${compact(fundingGap)} masih terbuka.`] : [],
      nextAction: readiness < 100 ? "Buka komponen berstatus Pending, At Risk, atau Missing dan selesaikan prioritasnya." : "Pertahankan kesiapan dan pantau perubahan komponen.",
    },
    {
      id: "organizer", label: event.organizer_name || "Organizer", kind: "Organizer",
      status: event.organizer_name ? "Confirmed" : "Missing",
      description: "Pemilik keputusan utama yang mengarahkan brief, approval, dan kesiapan event.",
      owner: event.organizer_name || "Belum tersedia",
      value: event.event_code || "Event ID belum tersedia",
      progress: event.organizer_name ? 100 : 0,
      unmet: event.organizer_name ? [] : ["Penanggung jawab event belum tersedia."],
      risks: event.organizer_name ? [] : ["Keputusan lintas komponen tidak memiliki pemilik."],
      nextAction: event.organizer_name ? "Tinjau status komponen dan konfirmasi keputusan lintas tim." : "Tetapkan organizer penanggung jawab.",
    },
    {
      id: "talent", label: headline || `${num(talentCount)} talent`, kind: "Talent",
      status: headline || talentCount > 0 ? "Confirmed" : "Missing",
      description: "Program utama yang mengaktifkan rider, jadwal, perjalanan, keamanan, dan biaya terkait talent.",
      owner: "Talent Management",
      value: isDemoEvent && Number(brief.headliner_landed_cost || 0) > 0 ? compact(brief.headliner_landed_cost) : `${num(talentCount)} talent terhubung`,
      progress: headline || talentCount > 0 ? 100 : 0,
      unmet: headline || talentCount > 0 ? [] : ["Talent utama belum dipilih."],
      risks: riderTotal > riderMatched ? [`${num(riderTotal - riderMatched)} item rider belum matched.`] : [],
      nextAction: riderTotal > riderMatched ? "Selesaikan rider yang belum matched dan konfirmasi kebutuhan talent." : "Pertahankan konfirmasi talent dan pantau perubahan rider.",
    },
    {
      id: "rider", label: isDemoEvent ? `Rider (${num(riderMatched)}/${num(riderTotal)})` : "Rider talent", kind: "Rider", status: riderStatus,
      description: "Daftar kebutuhan teknis, hospitality, perjalanan, akomodasi, dan keamanan talent.",
      owner: "Talent Management & Production",
      value: isDemoEvent ? `${num(riderMatched)} dari ${num(riderTotal)} item matched` : headline ? `Mengikuti ${headline}` : "Belum tersedia",
      progress: isDemoEvent ? progressOf(riderMatched, riderTotal) : 0,
      unmet: isDemoEvent && riderTotal > riderMatched ? [`${num(riderTotal - riderMatched)} item rider belum terpenuhi.`] : !isDemoEvent ? ["Detail rider dikelola di workspace event."] : [],
      risks: riderStatus === "At Risk" ? ["Belum ada item rider yang dikonfirmasi matched."] : [],
      nextAction: riderTotal > riderMatched ? "Cocokkan item rider dengan vendor, perjalanan, dan akomodasi." : "Kunci rider dan monitor perubahan talent.",
    },
    {
      id: "venue", label: event.venue_name || "Venue belum dipilih", kind: "Venue",
      status: event.venue_name ? "Confirmed" : "Missing",
      description: "Lokasi event yang menentukan kapasitas, layout, ticketing, tenant, workforce, dan keamanan.",
      owner: "Venue Management",
      value: isDemoEvent && Number(rippleData.venue_income || 0) > 0 ? compact(rippleData.venue_income) : event.city || "Biaya belum tersedia",
      progress: event.venue_name ? 100 : 0,
      unmet: event.venue_name ? [] : ["Venue belum dipilih."],
      risks: event.venue_name ? [] : ["Kapasitas dan kebutuhan operasi belum dapat dikunci."],
      nextAction: event.venue_name ? "Konfirmasi kapasitas, akses, layout, dan kebutuhan produksi venue." : "Pilih dan konfirmasi venue.",
    },
    {
      id: "vendor", label: isDemoEvent ? `Vendor (${num(vendorConfirmed)}/${num(vendorTotal)})` : `Vendor (${num(vendorConfirmed)})`, kind: "Vendor", status: vendorStatus,
      description: "Mitra produksi yang memenuhi kebutuhan teknis, logistik, perjalanan, akomodasi, dan layanan event.",
      owner: "Production Lead",
      value: isDemoEvent ? compact(rippleData.vendor_payout || 0) : `${num(vendorConfirmed)} vendor terhubung`,
      progress: progressOf(vendorConfirmed, vendorTotal),
      unmet: vendorTotal > vendorConfirmed ? [`${num(vendorTotal - vendorConfirmed)} vendor belum dikonfirmasi.`] : [],
      risks: vendorStatus === "At Risk" ? ["Belum ada vendor yang terkonfirmasi."] : [],
      nextAction: vendorTotal > vendorConfirmed ? "Konfirmasi vendor prioritas dan cocokkan kebutuhan produksi." : "Pantau delivery dan perubahan scope vendor.",
    },
    {
      id: "sponsor", label: `Sponsor (${num(sponsorCommitments)})`, kind: "Sponsor", status: sponsorStatus,
      description: "Partner komersial yang menambah pendanaan dan mengaktifkan hak brand serta kebutuhan produksi.",
      owner: "Commercial & Partnership",
      value: isDemoEvent ? compact(networkData.sponsor_value || 0) : `${num(sponsorCommitments)} dari ${num(sponsorTiers)} slot terisi`,
      progress: progressOf(sponsorCommitments, sponsorTiers),
      unmet: sponsorTiers > sponsorCommitments ? [`${num(sponsorTiers - sponsorCommitments)} inventory sponsor belum terisi.`] : [],
      risks: sponsorCommitments === 0 ? ["Pendanaan sponsor belum terkonfirmasi."] : [],
      nextAction: sponsorTiers > sponsorCommitments ? "Tutup inventory sponsor dan detailkan hak aktivasi." : "Kunci hak aktivasi dan kebutuhan produksi sponsor.",
    },
    {
      id: "tenant", label: isDemoEvent ? `Tenant (${num(boothsOccupied)}/${num(boothsTotal)})` : `Tenant (${num(boothsOccupied)})`, kind: "Tenant", status: tenantStatus,
      description: "Peserta area komersial yang memakai booth dan menambah pendapatan serta kebutuhan operasi lokasi.",
      owner: "Tenant Operations",
      value: isDemoEvent ? compact(networkData.tenant_revenue || 0) : `${num(boothsOccupied)} tenant aktif`,
      progress: progressOf(boothsOccupied, boothsTotal),
      unmet: boothsTotal > boothsOccupied ? [`${num(boothsTotal - boothsOccupied)} booth belum terisi.`] : [],
      risks: tenantStatus === "Missing" ? ["Zona tenant belum menghasilkan okupansi."] : [],
      nextAction: boothsTotal > boothsOccupied ? "Isi booth yang tersedia dan konfirmasi kebutuhan tiap tenant." : "Finalisasi layout, akses, dan operasional tenant.",
    },
    {
      id: "workforce", label: isDemoEvent ? `Workforce (${num(workforceFilled)}/${num(workforceNeeded)})` : "Workforce", kind: "Worker", status: workforceStatus,
      description: "Crew lapangan dan keamanan yang menjalankan kebutuhan operasional sesuai kapasitas serta venue.",
      owner: "Operations & Security Lead",
      value: isDemoEvent ? compact(rippleData.workforce_payout || 0) : "Detail internal Event ID",
      progress: progressOf(workforceFilled, workforceNeeded),
      unmet: workforceNeeded > workforceFilled ? [`${num(workforceNeeded - workforceFilled)} posisi belum terisi.`] : !isDemoEvent ? ["Rincian workforce tidak dipublikasikan di katalog."] : [],
      risks: workforceStatus === "At Risk" ? ["Kekurangan crew dapat mengganggu keamanan dan operasional show day."] : [],
      nextAction: workforceNeeded > workforceFilled ? "Isi posisi prioritas dan konfirmasi shift serta briefing keamanan." : "Kunci roster dan jadwal briefing.",
    },
    {
      id: "ticket", label: `Ticketing (${num(ticketsSold)}/${num(ticketCapacity)})`, kind: "Ticket tier", status: ticketStatus,
      description: "Kapasitas dan penjualan tiket yang mengikuti venue serta menjadi sumber pendapatan event.",
      owner: "Ticketing & Guest Experience",
      value: isDemoEvent ? compact(networkData.ticket_gmv || 0) : `${num(ticketsSold)} tiket terjual`,
      progress: progressOf(ticketsSold, ticketCapacity),
      unmet: ticketCapacity > ticketsSold ? [`${num(ticketCapacity - ticketsSold)} tiket masih tersedia.`] : [],
      risks: ticketCapacity === 0 ? ["Ticket tier belum tersedia."] : [],
      nextAction: ticketCapacity === 0 ? "Buat dan aktifkan ticket tier." : "Pantau penjualan, kapasitas, dan kebutuhan akses masuk.",
    },
    {
      id: "funding", label: isDemoEvent ? `Funding Gap ${compact(fundingGap)}` : `Anggaran ${compact(totalCost)}`, kind: "Funding",
      status: totalCost === 0 ? "Missing" : isDemoEvent ? (fundingGap <= 0 ? "Completed" : "At Risk") : "Pending",
      description: "Ringkasan biaya, pendanaan terkonfirmasi, pendapatan, dan selisih kebutuhan event.",
      owner: "Finance Approver",
      value: isDemoEvent ? `${compact(confirmedFunding)} dari ${compact(totalCost)}` : compact(totalCost),
      progress: fundingProgress,
      unmet: fundingGap !== null && fundingGap > 0 ? [`Funding gap ${compact(fundingGap)} belum tertutup.`] : !isDemoEvent ? ["Rincian sumber pendanaan tersedia di workspace event."] : [],
      risks: fundingGap !== null && fundingGap > 0 ? ["Event masih memiliki kebutuhan pendanaan terbuka."] : [],
      nextAction: fundingGap !== null && fundingGap > 0 ? "Konfirmasi sponsor, tenant, ticketing, atau sesuaikan biaya prioritas." : "Tinjau anggaran dan sumber pendanaan pada Event ID.",
    },
  ];
}

function StatusPill({ status, testId, tooltipAlign = "center" }) {
  const meta = STATUS_META[status] || STATUS_META.Pending;
  const Icon = meta.Icon;
  const tooltipPosition = tooltipAlign === "left"
    ? "left-0"
    : tooltipAlign === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";
  return (
    <span
      data-testid={testId}
      tabIndex={0}
      aria-label={`${status}: ${meta.tooltip}`}
      className="group/status relative inline-flex items-center gap-1.5 border border-white/10 bg-[#0b0b0d] px-2.5 py-1 text-[11px] font-semibold text-zinc-200 outline-none focus:border-[var(--okx-accent)]"
    >
      <Icon size={13} strokeWidth={2} style={{ color: meta.color }} aria-hidden="true" />
      <span>{status}</span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-30 w-48 max-w-[calc(100vw-2.5rem)] border border-zinc-700 bg-[#111114] px-3 py-2 text-center text-[10px] font-normal leading-4 text-zinc-300 opacity-0 shadow-2xl transition-opacity group-hover/status:opacity-100 group-focus/status:opacity-100 ${tooltipPosition}`}
      >
        {meta.tooltip}
      </span>
    </span>
  );
}

function GraphPreview() {
  const graphScrollRef = useRef(null);
  const [summary, setSummary] = useState(null);
  const [catalogEvents, setCatalogEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(DEMO_EVENT_ID);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState("event");
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [focusedEdge, setFocusedEdge] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [scenarioStep, setScenarioStep] = useState(-1);
  const [scenarioRun, setScenarioRun] = useState(0);

  useEffect(() => {
    let mounted = true;
    api.get("/demo/summary")
      .then(({ data }) => {
        if (mounted) setSummary(data);
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      });
    api.get("/discover/events")
      .then(({ data }) => {
        if (mounted) setCatalogEvents(data.items || []);
      })
      .catch(() => {
        if (mounted) setCatalogEvents([]);
      });
    return () => { mounted = false; };
  }, []);

  const selectedCatalogEvent = useMemo(
    () => catalogEvents.find((event) => event.id === selectedEventId) || null,
    [catalogEvents, selectedEventId]
  );
  const catalogStats = useMemo(() => ({
    events: catalogEvents.length,
    promoters: new Set(catalogEvents.map((event) => event.organizer_name).filter(Boolean)).size,
    bands: new Set(catalogEvents.map((event) => event.headline_talent).filter(Boolean)).size,
  }), [catalogEvents]);
  const graphNodes = useMemo(() => buildPreviewNodes(summary, selectedCatalogEvent), [summary, selectedCatalogEvent]);
  const nodeMap = useMemo(() => Object.fromEntries(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const positions = useMemo(() => {
    const outer = graphNodes.filter((node) => node.id !== "event");
    const output = {};
    const core = graphNodes.find((node) => node.id === "event");
    if (core) output.event = { x: PCX, y: PCY, a: 0, r: 34, node: core };
    outer.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, outer.length)) * Math.PI * 2;
      output[node.id] = {
        x: PCX + Math.cos(angle) * 315,
        y: PCY + Math.sin(angle) * 226,
        a: angle,
        r: 20,
        node,
      };
    });
    return output;
  }, [graphNodes]);

  const scenario = SCENARIOS.find((item) => item.id === activeScenario);
  const scenarioState = useMemo(() => {
    const nodes = new Set();
    const edges = new Set();
    if (scenario && scenarioStep >= 0) {
      scenario.steps.slice(0, scenarioStep + 1).forEach((step) => {
        step.nodes.forEach((id) => nodes.add(id));
        step.edges.forEach((id) => edges.add(id));
      });
    }
    return { nodes, edges };
  }, [scenario, scenarioStep]);
  const scenarioEdgeId = scenario && scenarioStep >= 0 ? scenario.steps[scenarioStep]?.edges?.[0] : null;
  const inspectedEdgeId = hoveredEdge || focusedEdge || scenarioEdgeId || null;
  const inspectedEdge = PREVIEW_EDGES.find((edge) => edge.id === inspectedEdgeId) || null;

  useEffect(() => {
    const scroller = graphScrollRef.current;
    if (!scroller || graphNodes.length === 0) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (scroller.scrollWidth > scroller.clientWidth) {
        scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [graphNodes.length]);

  useEffect(() => {
    if (!scenario) return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reducedMotion) {
      const last = scenario.steps.length - 1;
      setScenarioStep(last);
      setActive(scenario.steps[last].focus);
      return undefined;
    }
    let step = 0;
    setScenarioStep(0);
    setActive(scenario.steps[0].focus);
    const timer = window.setInterval(() => {
      step += 1;
      if (step >= scenario.steps.length) {
        window.clearInterval(timer);
        return;
      }
      setScenarioStep(step);
      setActive(scenario.steps[step].focus);
    }, 720);
    return () => window.clearInterval(timer);
  }, [scenario, scenarioRun]);

  const selected = nodeMap[active] || graphNodes[0];
  const inspectNode = hovered || focused || (active === "event" ? null : active);
  const linkedNodes = new Set(
    PREVIEW_EDGES
      .filter((edge) => inspectNode && (edge.source === inspectNode || edge.target === inspectNode))
      .flatMap((edge) => [edge.source, edge.target])
  );
  const relationships = selected
    ? PREVIEW_EDGES
        .filter((edge) => edge.source === selected.id || edge.target === selected.id)
        .map((edge) => ({
          ...edge,
          direction: edge.source === selected.id ? "Mendorong" : "Menerima dari",
          counterpart: GRAPH_COMPONENT_LABELS[edge.source === selected.id ? edge.target : edge.source] || "Komponen terkait",
        }))
    : [];

  const chooseNode = (id) => {
    setActiveScenario(null);
    setScenarioStep(-1);
    setActive(id);
  };
  const playScenario = (id) => {
    setActiveScenario(id);
    setScenarioStep(-1);
    setScenarioRun((run) => run + 1);
  };
  const chooseEvent = (eventId) => {
    setSelectedEventId(eventId);
    setActiveScenario(null);
    setScenarioStep(-1);
    setActive("event");
  };
  const graphEvent = selectedCatalogEvent || summary?.event || {};

  if (!summary && !loadError) {
    return (
      <div data-testid="graph-preview-loading" className="grid gap-4 lg:grid-cols-[1.55fr_0.85fr]">
        <div className="h-[540px] animate-pulse border border-[var(--okx-border)] bg-[#0b0b0d]" />
        <div className="h-[540px] animate-pulse border border-[var(--okx-border)] bg-[var(--okx-surface)]" />
      </div>
    );
  }

  if (loadError || !selected) {
    return (
      <div data-testid="graph-preview-error" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-8 text-sm text-zinc-400">
        Data Event Graph belum dapat dimuat. Muat ulang halaman untuk mencoba kembali.
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="graph-preview">
      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]" data-testid="graph-event-switcher">
        <div className="bg-[#0b0b0d] p-4 sm:p-5">
          <label htmlFor="graph-event-select" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--okx-accent-soft)]">
            Event aktif
          </label>
          <select
            id="graph-event-select"
            data-testid="graph-event-select"
            value={selectedEventId}
            onChange={(event) => chooseEvent(event.target.value)}
            className="mt-2 h-11 w-full border border-zinc-700 bg-[#111114] px-3 text-sm font-semibold text-white outline-none transition-colors focus:border-[var(--okx-accent)]"
          >
            {catalogEvents.length === 0 && <option value={DEMO_EVENT_ID} label={graphEvent.name || "Event OKKAX"} />}
            {catalogEvents.map((event) => (
              <option
                key={event.id}
                value={event.id}
                label={`${event.name} — ${event.organizer_name || "Organizer belum tersedia"}`}
              />
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            <span data-testid="graph-active-organizer">{graphEvent.organizer_name || "Organizer belum tersedia"}</span>
            <span>{graphEvent.city || "Kota belum tersedia"}</span>
            <span data-testid="graph-active-talent">{nodeMap.talent?.progress > 0 ? "Talent terhubung" : "Talent belum tersedia"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 bg-[#0b0b0d]" data-testid="graph-catalog-stats">
          {[
            [catalogStats.events, "event"],
            [catalogStats.bands, "talent"],
            [catalogStats.promoters, "promotor"],
          ].map(([value, label]) => (
            <div key={label} className="flex min-w-0 flex-col justify-center border-l border-[var(--okx-border)] px-3 py-4 first:border-l-0 sm:px-5">
              <span className="num text-xl font-semibold text-white sm:text-2xl">{num(value)}</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600 sm:text-[10px]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 border border-[var(--okx-border)] bg-[#0b0b0d] p-4 lg:flex-row lg:items-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Status komponen</div>
          <p className="mt-1 text-xs text-zinc-500">Warna, ikon, dan label selalu tampil bersama. Arahkan atau fokuskan untuk membaca artinya.</p>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="graph-status-legend">
          {STATUS_ORDER.map((status, index) => (
            <StatusPill
              key={status}
              status={status}
              testId={`graph-status-${status.toLowerCase().replace(/\s/g, "-")}`}
              tooltipAlign={index < 2 ? "left" : index > 2 ? "right" : "center"}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)]">
        <div className="overflow-hidden border border-[var(--okx-border)] bg-[#080808]">
          <div
            className="flex min-h-[62px] flex-col justify-center gap-1 border-b border-[var(--okx-border)] bg-[#0c0c0e] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            data-testid="graph-relationship-readout"
            aria-live="polite"
          >
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Hubungan aktif</span>
            {inspectedEdge ? (
              <span className="text-xs font-medium leading-5 text-zinc-200" data-testid={`graph-preview-edge-label-${inspectedEdge.id}`}>
                <span className="text-[var(--okx-accent-soft)]">{GRAPH_COMPONENT_LABELS[inspectedEdge.source]}</span>
                <span className="mx-2 text-zinc-600" aria-hidden="true">→</span>
                <span className="text-[var(--okx-accent-soft)]">{GRAPH_COMPONENT_LABELS[inspectedEdge.target]}</span>
                <span className="mx-2 text-zinc-700" aria-hidden="true">·</span>
                {inspectedEdge.label}
              </span>
            ) : (
              <span className="text-[11px] leading-5 text-zinc-500">Arahkan atau fokuskan satu garis untuk membaca ketergantungannya.</span>
            )}
          </div>
          <div ref={graphScrollRef} className="okx-scroll overflow-x-auto">
            <svg
              viewBox={`0 0 ${PW} ${PH}`}
              className="block min-w-[760px] w-full"
              role="img"
              aria-label={`Event Graph interaktif untuk ${graphEvent.name || "event OKKAX"}`}
              data-testid="graph-preview-canvas"
            >
              <defs>
                <radialGradient id="previewCore">
                  <stop offset="0%" stopColor="#ff2e7e" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#ff2e7e" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#ff2e7e" stopOpacity="0" />
                </radialGradient>
                <marker id="graphArrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,9 L9,4.5 z" fill="#71717a" />
                </marker>
                <marker id="graphArrowActive" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,9 L9,4.5 z" fill="#ff2e7e" />
                </marker>
              </defs>
              <rect width={PW} height={PH} fill="#080808" />
              <g opacity="0.14">
                {Array.from({ length: 27 }, (_, i) => <circle key={i} cx={(i * 109) % PW} cy={(i * 67) % PH} r="1" fill="#ffffff" />)}
              </g>
              <circle cx={PCX} cy={PCY} r={330} fill="url(#previewCore)" pointerEvents="none" />
              <ellipse cx={PCX} cy={PCY} rx="315" ry="226" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeDasharray="3 10" pointerEvents="none" />

              {PREVIEW_EDGES.map((edge) => {
                const source = positions[edge.source];
                const target = positions[edge.target];
                if (!source || !target) return null;
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const length = Math.max(1, Math.hypot(dx, dy));
                const sx = source.x + (dx / length) * (source.r + 4);
                const sy = source.y + (dy / length) * (source.r + 4);
                const tx = target.x - (dx / length) * (target.r + 10);
                const ty = target.y - (dy / length) * (target.r + 10);
                const radial = edge.source === "event" || edge.target === "event";
                const cx = (sx + tx) / 2 + (PCX - (sx + tx) / 2) * (radial ? 0 : 0.34);
                const cy = (sy + ty) / 2 + (PCY - (sy + ty) / 2) * (radial ? 0 : 0.34);
                const path = radial ? `M${sx},${sy} L${tx},${ty}` : `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
                const scenarioOn = scenarioState.edges.has(edge.id);
                const related = edge.source === inspectNode || edge.target === inspectNode;
                const edgeInspected = hoveredEdge === edge.id || focusedEdge === edge.id;
                const highlighted = scenario ? scenarioOn || edgeInspected : related || edgeInspected;
                return (
                  <g
                    key={edge.id}
                    data-testid={`graph-preview-edge-${edge.id}`}
                    data-active={edgeInspected || scenarioOn ? "true" : "false"}
                    tabIndex={0}
                    aria-label={`${GRAPH_COMPONENT_LABELS[edge.source]} menuju ${GRAPH_COMPONENT_LABELS[edge.target]}: ${edge.label}`}
                    onMouseEnter={() => setHoveredEdge(edge.id)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onFocus={() => setFocusedEdge(edge.id)}
                    onBlur={() => setFocusedEdge(null)}
                    style={{ cursor: "help", outline: "none" }}
                  >
                    <path d={path} fill="none" stroke="transparent" strokeWidth="14" pointerEvents="stroke" />
                    <path
                      d={path}
                      fill="none"
                      stroke={highlighted ? "#ff2e7e" : "#71717a"}
                      strokeWidth={highlighted ? 1.8 : 0.85}
                      strokeOpacity={scenario && !scenarioOn ? 0.07 : highlighted ? 0.9 : 0.24}
                      markerEnd={highlighted ? "url(#graphArrowActive)" : "url(#graphArrow)"}
                      style={{ transition: "stroke .25s ease, stroke-opacity .25s ease, stroke-width .25s ease" }}
                    />
                  </g>
                );
              })}

              {Object.entries(positions).map(([id, position]) => {
                const node = position.node;
                const isCore = id === "event";
                const isActive = active === id;
                const isScenarioOn = scenarioState.nodes.has(id);
                const faded = scenario
                  ? scenarioStep >= 0 && !isScenarioOn
                  : inspectNode && !isActive && !linkedNodes.has(id);
                const radius = position.r;
                const status = STATUS_META[node.status] || STATUS_META.Pending;
                const StatusIcon = status.Icon;
                const componentLabel = GRAPH_COMPONENT_LABELS[id] || node.kind;
                return (
                  <g
                    key={id}
                    data-testid={`graph-preview-node-${id}`}
                    data-active={isActive ? "true" : "false"}
                    data-status={node.status}
                    transform={`translate(${position.x},${position.y})`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    aria-label={`${componentLabel}. Status ${node.status}. Klik untuk membuka Detail Komponen.`}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setFocused(id)}
                    onBlur={() => setFocused(null)}
                    onClick={() => chooseNode(id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        chooseNode(id);
                      }
                    }}
                    style={{ cursor: "pointer", opacity: faded ? 0.2 : 1, transition: "opacity .25s ease", outline: "none" }}
                  >
                    {(isCore || isActive || isScenarioOn || focused === id) && (
                      <circle r={radius + 7} fill="none" stroke={isScenarioOn ? "#ff2e7e" : status.color} strokeOpacity="0.72" strokeWidth="1.5" />
                    )}
                    <circle
                      r={radius}
                      fill={isCore ? "#ff2e7e" : "#0f0f11"}
                      stroke={isActive || isScenarioOn ? "#ffffff" : status.color}
                      strokeWidth={isCore || isActive || isScenarioOn ? 2.4 : 1.5}
                    />
                    <NodeIcon kind={node.kind} size={isCore ? 17 : 13} color={isCore ? "#0a0a0a" : PREVIEW_TONE.get(node.kind)} />
                    {!isCore && (
                      <g>
                        <circle cx={radius * 0.72} cy={-radius * 0.72} r="7.5" fill={status.color} stroke="#080808" strokeWidth="2" />
                        <StatusIcon x={radius * 0.72 - 4.75} y={-radius * 0.72 - 4.75} width="9.5" height="9.5" color="#080808" strokeWidth={2.6} aria-hidden="true" />
                      </g>
                    )}
                    {!isCore && (
                      <g pointerEvents="none">
                        <rect
                          x="-43"
                          y={radius + 7}
                          width="86"
                          height="31"
                          fill="#0c0c0e"
                          stroke={isActive || isScenarioOn ? "#ff2e7e" : "#27272a"}
                          strokeWidth="0.8"
                        />
                        <text x="0" y={radius + 19} textAnchor="middle" fontSize="8.6" fontWeight="700" fill={isActive || isScenarioOn ? "#ffffff" : "#d4d4d8"}>
                          {componentLabel}
                        </text>
                        <text x="0" y={radius + 30} textAnchor="middle" fontSize="6.7" fontWeight="700" letterSpacing="0.06em" fill={status.color}>
                          {node.status.toUpperCase()}
                        </text>
                      </g>
                    )}
                    {isCore && (
                      <g pointerEvents="none">
                        <text x="0" y="-16" textAnchor="middle" fontSize="5.8" fontWeight="800" letterSpacing="0.16em" fill="#0a0a0a">SATU</text>
                        <text x="0" y="21" textAnchor="middle" fontSize="6.4" fontWeight="800" letterSpacing="0.12em" fill="#0a0a0a">EVENT ID</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-col gap-2 border-t border-[var(--okx-border)] px-4 py-3 text-[11px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Klik node untuk detail · arah panah menunjukkan komponen yang terdampak.</span>
            <span className="num">Event ID: {graphEvent.event_code || DEMO_EVENT_ID}</span>
          </div>
        </div>

        <aside data-testid="graph-preview-detail" className="border border-[var(--okx-border)] bg-[var(--okx-surface)] p-5 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--okx-accent-soft)]">Detail Komponen</div>
              <h3 data-testid="graph-detail-name" className="mt-2 text-lg font-semibold text-white">{selected.label}</h3>
              <p className="mt-1 text-xs text-zinc-500">{selected.kind}</p>
            </div>
            <StatusPill status={selected.status} testId="graph-detail-status" tooltipAlign="right" />
          </div>

          <p data-testid="graph-detail-description" className="mt-4 border-l-2 border-[var(--okx-accent)] pl-3 text-sm leading-6 text-zinc-300">{selected.description}</p>

          <dl className="mt-5 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {[
              ["Penanggung jawab", selected.owner, "owner"],
              ["Nilai / biaya", selected.value, "value"],
            ].map(([label, value, key]) => (
              <div key={key} className="bg-[#0c0c0d] p-3">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</dt>
                <dd data-testid={`graph-detail-${key}`} className="mt-1 text-xs font-medium leading-5 text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5" data-testid="graph-detail-progress">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <span>Progres</span><span className="num text-zinc-300">{selected.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden bg-zinc-800">
              <div className="h-full transition-[width] duration-500" style={{ width: `${selected.progress}%`, background: (STATUS_META[selected.status] || STATUS_META.Pending).color }} />
            </div>
          </div>

          <DetailList title="Kebutuhan belum terpenuhi" testId="graph-detail-unmet" items={firstOpen(selected.unmet)} />
          <DetailList title="Dependensi" testId="graph-detail-dependencies" items={relationships.map((edge) => `${edge.direction}: ${edge.counterpart} — ${edge.label}`)} />
          <DetailList title="Risiko" testId="graph-detail-risks" items={firstOpen(selected.risks, "Tidak ada risiko aktif pada data saat ini.")} />

          <div className="mt-5 border border-[var(--okx-accent)]/35 bg-[var(--okx-accent)]/10 p-3" data-testid="graph-detail-next-action">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--okx-accent-soft)]">
              <ListChecks size={13} aria-hidden="true" /> Tindakan berikutnya
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-200">{selected.nextAction}</p>
          </div>
        </aside>
      </div>

      <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 xl:grid-cols-4" data-testid="graph-reading-guide">
        {[
          [CircleDot, "Pusat grafik", "Event di tengah adalah satu Event ID yang menjadi pusat kendali."],
          [MousePointerClick, "Node", "Setiap node adalah komponen operasional. Klik untuk membuka detailnya."],
          [Route, "Garis & panah", "Garis adalah ketergantungan; panah menunjukkan arah dampaknya."],
          [Info, "Status", "Ikon, warna, dan label menjelaskan kondisi setiap komponen."],
        ].map(([Icon, title, description]) => (
          <div key={title} className="bg-[#0c0c0d] p-4">
            <Icon size={16} className="text-[var(--okx-accent)]" aria-hidden="true" />
            <h4 className="mt-3 text-xs font-semibold text-zinc-100">{title}</h4>
            <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{description}</p>
          </div>
        ))}
      </div>

      <div className="border border-[var(--okx-border)] bg-[#0b0b0d] p-5 sm:p-6" data-testid="graph-scenarios">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--okx-accent-soft)]">Simulasi hubungan</div>
            <h3 className="editorial mt-2 text-2xl text-white sm:text-3xl">Lihat bagaimana satu keputusan bekerja</h3>
          </div>
          <p className="max-w-sm text-xs leading-5 text-zinc-500">Pilih skenario untuk melihat node dan jalur terdampak disorot secara berurutan.</p>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {SCENARIOS.map((item, index) => {
            const isSelected = activeScenario === item.id;
            const currentLabel = isSelected && scenarioStep >= 0 ? item.steps[scenarioStep]?.label : null;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`graph-scenario-${item.id}`}
                aria-pressed={isSelected}
                onClick={() => playScenario(item.id)}
                className={`group min-h-44 border p-4 text-left transition-colors ${isSelected ? "border-[var(--okx-accent)] bg-[var(--okx-accent)]/10" : "border-zinc-800 bg-[#0e0e10] hover:border-zinc-600"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="num text-[10px] font-semibold text-[var(--okx-accent)]">0{index + 1}</span>
                  <ArrowRight size={15} className={`transition-transform ${isSelected ? "translate-x-1 text-[var(--okx-accent)]" : "text-zinc-600 group-hover:translate-x-1"}`} aria-hidden="true" />
                </div>
                <div className="mt-5 text-sm font-semibold text-zinc-100">{item.title}</div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{item.description}</p>
                <div className="mt-4 flex items-center gap-1.5" aria-label={isSelected ? `Tahap aktif: ${currentLabel}` : `${item.steps.length} tahap`}>
                  {item.steps.map((step, stepIndex) => (
                    <span
                      key={step.label}
                      className="h-1 flex-1"
                      style={{ background: isSelected && stepIndex <= scenarioStep ? "#ff2e7e" : "#27272a" }}
                    />
                  ))}
                </div>
                <div className="mt-2 min-h-4 text-[10px] text-[var(--okx-accent-soft)]">{currentLabel || "Pilih untuk menjalankan skenario"}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailList({ title, items = [], testId }) {
  return (
    <div className="mt-5" data-testid={testId}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-zinc-300">
            <ArrowRight size={11} className="mt-1 shrink-0 text-[var(--okx-accent)]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PARTICIPANT_GROUPS = [
  ["01", "Event Direction", "Organizer · Promoter · Event Producer"],
  ["02", "Talent & Programming", "Artist · Speaker · Talent Management"],
  ["03", "Venue & Show Production", "Venue · Production Partner · Technical Crew"],
  ["04", "Brand & Commercial", "Sponsor · Media Partner · Exhibitor · Tenant"],
  ["05", "Ticketing & Guest Experience", "Ticketing · Access Control · Attendee Services"],
  ["06", "Operations & Settlement", "Workforce · Logistics · Finance · Settlement"],
];

const PROCESS_STEPS = [
  [Workflow, "Brief", "Guided Event Brief menangkap tujuan, kapasitas, anggaran, dan kebutuhan."],
  [Boxes, "Blueprint", "Blueprint Engine menyusun fase, workstream, requirement, dan risiko. Semua dapat diedit."],
  [Building2, "Network", "Talent, rider, venue, vendor, dan workforce dicocokkan dengan penjelasan skor."],
  [CircleDollarSign, "Live Operations", "Sponsor, tenant, tiket, pembayaran, settlement, dan dampak event diperbarui otomatis."],
];

function ParticipantNetwork() {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-testid="network-participants"
      data-visible={visible ? "true" : "false"}
      className="participant-network border-b border-[var(--okx-border)] bg-[#0b0b0d] px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="participant-intro flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="num text-[10px] font-semibold tracking-[0.14em] text-[var(--okx-accent)]">06 CORE FUNCTIONS</span>
              <span className="h-px w-12 bg-[var(--okx-accent)]" aria-hidden="true" />
            </div>
            <h2 className="editorial mt-5 max-w-3xl text-3xl leading-[1.02] text-[#e6ded9] sm:text-5xl">
              Satu produksi. <span className="text-[var(--okx-accent)]">Semua fungsi terhubung.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#989196] sm:text-base">
              OKKAX menyatukan fungsi inti di balik live event dalam satu alur kerja, satu sumber data,
              dan satu standar operasional.
            </p>
          </div>
          <Link
            to="/register"
            className="participant-cta group inline-flex min-h-11 w-fit items-center gap-3 border-b border-[var(--okx-accent)] pb-2 font-semibold text-[#e6ded9]"
          >
            Join the operating network
            <ArrowRight size={16} className="text-[var(--okx-accent)] transition-transform group-hover:translate-x-1.5" />
          </Link>
        </div>

        <div className="mt-11 grid gap-px border border-[#2a292d] bg-[#2a292d] sm:grid-cols-2 lg:grid-cols-3">
          {PARTICIPANT_GROUPS.map(([index, title, detail], i) => (
            <article
              key={title}
              data-testid={`participant-group-${i + 1}`}
              className="participant-card group relative min-h-[148px] overflow-hidden bg-[#101014] p-5 sm:p-6"
              style={{ "--participant-delay": `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between gap-5">
                <span className="num text-[11px] font-semibold text-[var(--okx-accent)]">{index}</span>
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="text-[#504c51] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--okx-accent)]"
                />
              </div>
              <h3 className="participant-title mt-7 text-base font-semibold text-[#e6ded9] sm:text-lg">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#888188] sm:text-sm">{detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [ripple, setRipple] = useState(null);
  useEffect(() => {
    api.get(`/events/${DEMO_EVENT_ID}/ripple`).then(({ data }) => setRipple(data.metrics)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />

      <section className="relative min-h-[640px] overflow-hidden border-b border-[var(--okx-border)] lg:min-h-[670px]">
        <img
          src={HERO}
          alt="Panggung konser OKKAX dengan penonton"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.86]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808e8] via-[46%] to-[#08080822]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#08080866]" />
        <div className="relative mx-auto flex min-h-[640px] max-w-[1440px] items-center px-4 py-16 sm:px-8 lg:min-h-[670px] lg:px-16">
          <div className="fade-up relative z-10 max-w-[760px] lg:w-[58%]">
            <span className="inline-block border border-[var(--okx-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] accent-text">
              Live Event Operating Network
            </span>
            <h1 className="editorial mt-7 text-[clamp(3.35rem,6.15vw,5.8rem)] leading-[0.96] tracking-[-0.055em]">
              One event.
              <br />
              <span className="accent-text xl:whitespace-nowrap">Every moving part.</span>
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base lg:text-lg">
              OKKAX menghubungkan setiap pihak, mitra, proses, dan pembayaran di balik live event
              dalam satu jaringan operasional.
            </p>
            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                to="/register"
                data-testid="hero-compile-btn"
                className="group inline-flex min-h-12 items-center justify-center gap-3 bg-[var(--okx-accent)] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--okx-accent-hover)]"
              >
                Build an Event
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/discover"
                data-testid="hero-explore-btn"
                className="inline-flex min-h-12 items-center justify-center border-b-2 border-[var(--okx-accent)] px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:text-white"
              >
                Explore Events <ArrowRight size={15} className="ml-2" />
              </Link>
              <Link
                to={`/juri`}
                data-testid="hero-juri-btn"
                className="inline-flex min-h-12 items-center justify-center border-b-2 border-[var(--okx-accent)] px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:text-white"
              >
                Platform Demo — 3 menit <ArrowRight size={15} className="ml-2" />
              </Link>
            </div>
            <p className="mt-6 max-w-lg text-xs leading-relaxed text-zinc-500">
              From one idea to a live experience. Mode demo kompetisi — pembayaran sandbox, tanpa uang nyata.
            </p>
            <div className="mt-9 flex items-center gap-2 text-xs text-zinc-400">
              <CalendarDays size={15} className="accent-text" aria-hidden="true" />
              <span>13 August 2026</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] bg-[#0d0d0d] px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] accent-text">Cara OKKAX bekerja</p>
          <h2 className="editorial mt-4 text-3xl sm:text-4xl">Dari ide menjadi panggung yang hidup.</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            {PROCESS_STEPS.map(([Icon, title, body], i) => (
              <div key={title} className="relative border-t border-zinc-700 pt-7 lg:border-t-0 lg:pt-0">
                <div className="flex items-center justify-between">
                  <span className="num text-xs font-semibold accent-text">0{i + 1}</span>
                  <Icon size={25} strokeWidth={1.6} className="accent-text" aria-hidden="true" />
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--okx-accent)] bg-[#0d0d0d]" />
                  <span className="h-px flex-1 bg-[var(--okx-accent)]" />
                  {i < PROCESS_STEPS.length - 1 && <ArrowRight size={16} className="-ml-2 hidden accent-text lg:block" />}
                </div>
                <h3 className="mt-5 text-base font-semibold md:text-lg">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        data-testid="home-event-graph"
        className="border-b border-[var(--okx-border)] bg-[#09090a] px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--okx-accent)]">EVENT GRAPH</span>
                <span className="h-px w-14 bg-[var(--okx-accent)]" aria-hidden="true" />
              </div>
              <h2 className="editorial mt-5 max-w-2xl text-3xl leading-[1.02] text-white sm:text-5xl">
                Satu pusat kendali untuk seluruh komponen event.
              </h2>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
                Event Graph adalah peta operasional interaktif yang menyatukan seluruh pihak, kebutuhan, status,
                biaya, dan ketergantungan sebuah event dalam satu Event ID.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base">
                Organizer dapat melihat komponen yang sudah siap, masih menunggu, berisiko, atau belum tersedia.
                Ketika satu keputusan berubah, OKKAX menunjukkan komponen lain yang terdampak dan tindakan yang
                harus diselesaikan berikutnya.
              </p>
            </div>

            <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)]">
              {[
                [Network, "Lihat seluruh komponen", "Talent, rider, venue, vendor, sponsor, tenant, workforce, ticketing, dan pendanaan."],
                [Workflow, "Pahami setiap ketergantungan", "Ketahui siapa membutuhkan apa, komponen yang terdampak, dan alasan di balik setiap hubungan."],
                [ListChecks, "Tentukan tindakan berikutnya", "Temukan kebutuhan yang belum terpenuhi, risiko, dan keputusan yang perlu dikonfirmasi."],
              ].map(([Icon, title, description], index) => (
                <article key={title} data-testid={`graph-benefit-${index + 1}`} className="group bg-[#101012] p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--okx-accent)]/40 bg-[var(--okx-accent)]/10">
                      <Icon size={18} className="text-[var(--okx-accent)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="num mb-2 text-[10px] font-semibold text-[var(--okx-accent)]">0{index + 1}</div>
                      <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">{title}</h3>
                      <p className="mt-2 text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">{description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-12 sm:mt-16">
            <GraphPreview />
          </div>

          <div className="mt-6 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] md:grid-cols-2" data-testid="graph-before-after">
            <div className="bg-[#0c0c0d] p-5 sm:p-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Sebelum OKKAX</div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Data event tersebar di WhatsApp, spreadsheet, PDF rider, invoice, email, dan dokumen vendor.
              </p>
            </div>
            <div className="bg-[#120a0e] p-5 sm:p-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--okx-accent-soft)]">Dengan Event Graph</div>
              <p className="mt-3 text-sm leading-6 text-zinc-200">
                Seluruh komponen, status, ketergantungan, biaya, risiko, dan tindakan berikutnya berada dalam satu Event ID.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ParticipantNetwork />

      <section className="border-b border-[var(--okx-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] md:grid-cols-3">
          {[
            [Users, "Sponsor Exchange", "Sponsor menemukan event, melihat inventory, mengajukan minat, dan komitmen yang disetujui langsung mengurangi funding gap."],
            [Store, "Tenant Exchange", "Zona tenant, booth dengan kode dan harga, aplikasi, approval, dan pendapatan booth masuk ke funding event."],
            [Ticket, "Ticketing & Payment", "Ticket tier, checkout sandbox dengan VA, QRIS, e-wallet, kartu, dan retail. QR ticket unik dengan validator."],
          ].map(([Icon, title, body]) => (
            <div key={title} className="bg-[var(--okx-surface)] p-6 sm:p-8">
              <Icon size={20} className="accent-text" />
              <h3 className="mt-4 text-base font-semibold md:text-lg">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--okx-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <LineChart size={18} className="accent-text" />
            <h2 className="text-base font-semibold uppercase tracking-widest text-zinc-500 md:text-lg">
              Live Event Impact — dihitung dari data event
            </h2>
          </div>
          <div className="mt-8 grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Event Activity", ripple ? compact(ripple.total_economic_activity) : "—"],
              ["Businesses Activated", ripple ? num(ripple.businesses_activated) : "—"],
              ["Workers Engaged", ripple ? num(ripple.workers) : "—"],
              ["Hotel Room Nights", ripple ? num(ripple.hotel_room_nights) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--okx-surface)] p-6">
                <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
                <div className="num mt-2 text-2xl font-bold sm:text-3xl">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Data fiktif untuk demonstrasi kompetisi, dihitung dari event demo Aruna Bold Live Experience 2026.
          </p>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 border border-[var(--okx-accent)] bg-[#140700] p-8 sm:p-14">
          <QrCode size={22} className="accent-text" />
          <h2 className="editorial text-3xl sm:text-5xl">Everything behind a live event, working as one.</h2>
          <p className="max-w-2xl text-sm text-zinc-300 sm:text-base">
            Jalankan demo terpandu 16 langkah: brief, blueprint, event graph, talent & rider, venue, vendor,
            budget, sponsor, tenant, tiket, publish, sandbox payment, QR ticket, validasi, hingga Live Event Impact.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/juri" data-testid="cta-juri-btn" className="bg-[var(--okx-accent)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[var(--okx-accent-hover)]">
              Platform Demo
            </Link>
            <Link to="/demo" data-testid="cta-demo-btn" className="border border-[var(--okx-border)] px-6 py-3.5 text-sm font-semibold hover:border-zinc-500">
              Mulai Demo Terpandu
            </Link>
            <Link to="/discover" data-testid="cta-discover-btn" className="border border-[var(--okx-border)] px-6 py-3.5 text-sm font-semibold hover:border-zinc-500">
              Explore Events
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
