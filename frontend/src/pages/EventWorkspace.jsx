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
    <div className="space-y-6">
      <div>
        <button onClick={() => nav("/app/events")} className="mb-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white" data-testid="workspace-back-btn">
          <ArrowLeft size={14} /> Semua event
        </button>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="num text-xs text-zinc-500">{event.event_code}</div>
            <h1 className="editorial text-2xl sm:text-3xl">{event.name}</h1>
            <div className="mt-1 text-xs text-zinc-500">
              {event.event_type} · {event.city} · {event.start_date} · kapasitas {event.capacity}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={event.status === "published" ? "Confirmed" : "Draft"} testId="workspace-status" />
            <button
              data-testid="download-quotation-btn"
              onClick={async () => {
                try {
                  await downloadDoc(`/documents/quotation/${event.id}`, `OKKAX-Quotation-${event.event_code}.pdf`);
                  toast.success("Quotation OKKAX diunduh");
                } catch (e) {
                  toast.error(apiError(e));
                }
              }}
              className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]"
            >
              Unduh quotation
            </button>
            <button
              data-testid="download-schedule-btn"
              onClick={async () => {
                try {
                  await downloadDoc(`/documents/payment-schedule/${event.id}`, `OKKAX-Payment-Schedule-${event.event_code}.pdf`);
                  toast.success("Payment schedule OKKAX diunduh");
                } catch (e) {
                  toast.error(apiError(e));
                }
              }}
              className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]"
            >
              Unduh payment schedule
            </button>
            {event.status === "published" && (
              <Link to={`/events/${event.id}`} className="border border-[var(--okx-border)] px-3 py-1.5 text-xs hover:border-[var(--okx-accent)]" data-testid="view-public-page-btn">
                Halaman publik
              </Link>
            )}
          </div>
        </div>
      </div>

      {budget && (
        <div className="grid gap-px border border-[var(--okx-border)] bg-[var(--okx-border)] sm:grid-cols-3" data-testid="workspace-budget-strip">
          {[
            ["Total Event Cost", compact(budget.total_cost)],
            ["Confirmed Funding", compact(budget.confirmed_funding)],
            ["Funding Gap", compact(budget.funding_gap)],
          ].map(([l, v]) => (
            <div key={l} className="bg-[var(--okx-surface)] p-4">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{l}</div>
              <div className="num mt-1 text-lg font-bold transition-all">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 okx-scroll sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-[var(--okx-border)]">
          {EVENT_TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              data-testid={`tab-${key}`}
              onClick={() => nav(`/app/events/${eventId}/${key}`)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${
                tab === key ? "border-b-2 border-[var(--okx-accent)] accent-text" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="fade-up">{TAB_MAP[tab] || TAB_MAP.blueprint}</div>
    </div>
  );
}
