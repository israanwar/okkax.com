import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCached } from "@/lib/api";

// Peta event_type dari backend ke label kategori pendek (Opsi B: typographic
// small-caps, tanpa emoji). Fallback: kata pertama di-uppercase.
const CATEGORY_LABEL = {
  "Music Festival": "MUSIC",
  "Music Concert": "MUSIC",
  "Music": "MUSIC",
  "Sound & Music": "MUSIC",
  "Tech": "TECH",
  "Technology": "TECH",
  "Startup": "STARTUP",
  "Food & Culinary": "FOOD",
  "Culinary": "FOOD",
  "Food Festival": "FOOD",
  "Sport": "SPORT",
  "Sports": "SPORT",
  "Esports": "ESPORTS",
  "Fashion": "FASHION",
  "Wellness": "WELLNESS",
  "Art & Culture": "ART",
  "Art": "ART",
  "Business": "BUSINESS",
  "Conference": "CONFERENCE",
  "Trade Fair": "EXPO",
  "Exhibition": "EXPO",
};

function toLabel(eventType) {
  if (!eventType) return "EVENT";
  return CATEGORY_LABEL[eventType] || eventType.split(/\s+/)[0].toUpperCase();
}

function moment(item) {
  if (item.is_live) return "Live";
  const days = item.days_to_event;
  if (typeof days !== "number") return null;
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  if (days > 1 && days <= 30) return `H-${days}`;
  if (days > 30 && days <= 90) return `${Math.round(days / 7)} minggu lagi`;
  return null;
}

const DEFAULT_TICKER_ITEMS = [
  { id: "evt-aruna-2026", name: "Aruna Bold Live Makassar", event_type: "Music Festival", city: "Makassar", is_live: true, days_to_event: 0, this_week: true },
  { id: "evt-sound-fest-2026", name: "Nusantara Sound Fest", event_type: "Music Concert", city: "Jakarta", is_live: false, days_to_event: 3, this_week: true },
  { id: "evt-tech-summit-2026", name: "Indonesia Tech Summit 2026", event_type: "Tech", city: "Bandung", is_live: false, days_to_event: 5, this_week: true },
  { id: "evt-bali-culinary-2026", name: "Bali Epicurean Festival", event_type: "Food & Culinary", city: "Denpasar", is_live: false, days_to_event: 12, this_week: false },
  { id: "evt-surabaya-expo-2026", name: "Surabaya Creative Expo", event_type: "Art & Culture", city: "Surabaya", is_live: false, days_to_event: 18, this_week: false },
];

export default function LiveTicker() {
  // Initialize with fast default items so Ticker renders in < 50ms without waiting for network
  const [items, setItems] = useState(DEFAULT_TICKER_ITEMS);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    const fetchItems = async () => {
      try {
        // Fast lightweight ticker endpoint (< 2 KB vs 422 KB full discover)
        const data = await fetchCached("/discover/ticker", 30_000).catch(() =>
          fetchCached("/discover/events", 60_000)
        );
        if (cancelled) return;
        const rawItems = data?.items || [];
        if (rawItems.length > 0) {
          const sorted = [...rawItems].sort((a, b) => {
            if ((b.is_live ? 1 : 0) - (a.is_live ? 1 : 0)) return b.is_live ? 1 : -1;
            if ((b.this_week ? 1 : 0) - (a.this_week ? 1 : 0)) return b.this_week ? 1 : -1;
            return (b.economic_ripple || 0) - (a.economic_ripple || 0);
          });
          setItems(sorted.slice(0, 20));
          setReady(true);
        }
      } catch {
        // keep fallback items on failure
      }
    };

    // Parallel immediate fetch on mount
    fetchItems();

    const startTimer = () => {
      if (!timerId) {
        timerId = setInterval(fetchItems, 60_000);
      }
    };

    const stopTimer = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    startTimer();

    // Pause polling when browser tab is inactive
    const handleVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        fetchItems();
        startTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Duplikasi item supaya loop scroll mulus tanpa jump.
  const track = useMemo(() => (items.length ? [...items, ...items] : []), [items]);

  if (!ready || items.length === 0) return null;

  return (
    <div className="border-b border-white/[0.08] bg-[#080808] px-4 sm:px-6" data-testid="live-ticker">
      <div className="mx-auto flex max-w-7xl items-center gap-4 py-2.5">
        <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 animate-pulse bg-white" />
          Live Now
        </div>
        <div className="okx-ticker-mask relative min-w-0 flex-1 overflow-hidden">
          <div className="okx-ticker-track flex items-center gap-10 whitespace-nowrap will-change-transform">
            {track.map((item, idx) => {
              const when = moment(item);
              return (
                <Link
                  key={`${item.id}-${idx}`}
                  to={`/events/${item.id}`}
                  className="inline-flex items-center gap-2.5 text-xs text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  {item.is_live && (
                    <span aria-hidden="true" className="inline-block h-1.5 w-1.5 animate-pulse bg-white" />
                  )}
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {toLabel(item.event_type)}
                  </span>
                  <span className="font-medium">{item.name}</span>
                  {item.city && <span className="text-zinc-600">·</span>}
                  {item.city && <span className="text-zinc-500">{item.city}</span>}
                  {when && <span className="text-zinc-600">·</span>}
                  {when && <span className="text-zinc-300 font-gemini-mono">{when}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
