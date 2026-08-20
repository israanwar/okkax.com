import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, idr, compact, downloadDoc, apiError } from "@/lib/api";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import { EVENT_TABS } from "@/components/AppShell";
import { Blueprint, Graph } from "@/pages/workspace/BlueprintGraph";
import { TalentRider, VenueTab, VendorTab, WorkforceTab } from "@/pages/workspace/Supply";
import { SponsorsTab, TenantsTab, TicketsTab } from "@/pages/workspace/Commercial";
import { BudgetTab, PaymentsTab, RippleTab, OperationsTab } from "@/pages/workspace/Finance";
import { WorkspaceCalendar } from "@/pages/CalendarEngine";

export default function EventWorkspace() {
  const { eventId, tab = "blueprint" } = useParams();
  const nav = useNavigate();
  const [event, setEvent] = useState(null);
  const [budget, setBudget] = useState(null);
  const [version, setVersion] = useState(0);

  const load = async () => {
    const [{ data: e }, { data: b }] = await Promise.all([
      api.get(`/events/${eventId}/brief`),
      api.get(`/events/${eventId}/budget`),
    ]);
    setEvent(e.event);
    setBudget(b);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [eventId, version]);

  const onChange = () => setVersion((v) => v + 1);
  if (!event) return <div className="text-sm text-zinc-500">Memuat event…</div>;

  const props = { eventId, event, onChange };
  const TAB_MAP = {
    blueprint: <Blueprint {...props} />,
    graph: <Graph key={version} {...props} />,
    talent: <TalentRider {...props} />,
    venue: <VenueTab {...props} />,
    vendors: <VendorTab {...props} />,
    workforce: <WorkforceTab {...props} />,
    sponsors: <SponsorsTab {...props} />,
    tenants: <TenantsTab {...props} />,
    tickets: <TicketsTab {...props} />,
    budget: <BudgetTab key={version} {...props} />,
    payments: <PaymentsTab key={version} {...props} />,
    operations: <OperationsTab key={version} {...props} />,
    calendar: <WorkspaceCalendar eventId={eventId} />,
    ripple: <RippleTab key={version} {...props} />,
  };

  return (
    <div className="okx-event-workspace space-y-4 font-gemini" data-testid="event-workspace">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/90 backdrop-blur-xl p-4 sm:p-4.5 shadow-sm">
        <button onClick={() => nav("/app/events")} className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors" data-testid="workspace-back-btn">
          <ArrowLeft size={13} /> Semua event
        </button>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="num text-[11px] text-zinc-400 font-gemini-mono">{event.event_code}</div>
            <h1 className="editorial text-xl sm:text-2xl md:text-3xl text-white mt-0.5">{event.name}</h1>
            <div className="mt-1 text-[11px] text-zinc-400 font-gemini-mono">
              {event.event_type} · {event.city} · {event.start_date} · kapasitas {event.capacity}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status === "published" ? "Confirmed" : "Draft"} testId="workspace-status" />
            <button
              data-testid="download-quotation-btn"
              onClick={async () => {
                try {
                  await downloadDoc(`/documents/quotation/${event.id}`, `OKKAX-Quotation-${event.event_code}.pdf`);
                  toast.success("Quotation Okkax diunduh");
                } catch (e) {
                  toast.error(apiError(e));
                }
              }}
              className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
            >
              Unduh quotation
            </button>
            <button
              data-testid="download-schedule-btn"
              onClick={async () => {
                try {
                  await downloadDoc(`/documents/payment-schedule/${event.id}`, `OKKAX-Payment-Schedule-${event.event_code}.pdf`);
                  toast.success("Payment schedule Okkax diunduh");
                } catch (e) {
                  toast.error(apiError(e));
                }
              }}
              className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
            >
              Unduh payment schedule
            </button>
            {event.status === "published" && (
              <Link to={`/events/${event.id}`} className="rounded-xl bg-white px-3 py-1 text-[11px] font-bold text-black shadow-sm transition-all hover:bg-zinc-200" data-testid="view-public-page-btn">
                Halaman publik
              </Link>
            )}
          </div>
        </div>
      </div>

      {budget && (
        <div className="grid gap-2.5 sm:grid-cols-3" data-testid="workspace-budget-strip">
          {[
            ["Total Event Cost", compact(budget.total_cost)],
            ["Confirmed Funding", compact(budget.confirmed_funding)],
            ["Funding Gap", compact(budget.funding_gap)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-white/[0.08] bg-[#0c0c12]/80 backdrop-blur-xl p-3">
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 font-gemini-mono">{l}</div>
              <div className="num mt-0.5 text-base sm:text-lg font-bold text-white font-gemini-mono transition-all">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="okx-event-module-nav" data-testid="event-module-nav">
        <div className="okx-event-module-nav-inner">
          {EVENT_TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              data-testid={`tab-${key}`}
              onClick={() => nav(`/app/events/${eventId}/${key}`)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === key ? "border-b-2 border-white text-white font-bold" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Icon size={13.5} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="okx-event-workspace-content fade-up" data-testid="event-module-content">{TAB_MAP[tab] || TAB_MAP.blueprint}</div>
    </div>
  );
}
