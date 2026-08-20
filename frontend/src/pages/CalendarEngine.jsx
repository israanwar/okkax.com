import { useSearchParams } from "react-router-dom";
import PublicNav, { Footer } from "@/components/PublicNav";
import CalendarBoard from "@/components/CalendarBoard";

export function PublicCalendar() {
  const [params] = useSearchParams();
  return (
    <div className="min-h-screen bg-[var(--okx-bg)]">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <CalendarBoard mode="public" initialCity={params.get("city") || ""} />
      </main>
      <Footer />
    </div>
  );
}

export function WorkspaceCalendar({ eventId = "" }) {
  return <CalendarBoard mode="internal" eventId={eventId} />;
}

export default PublicCalendar;
