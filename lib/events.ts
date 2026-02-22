import eventsData from "@/events.json";

export interface Event {
  id: string;
  title: string;
  date: string;
  dateIso?: string;
  type?: string;
  genre?: string;
  status?: string;
  description?: string;
  url: string;
  venueSlug: string;
  venueName: string;
  venueUrl: string;
  firstSeen: string;
  lastSeen: string;
  isNew: boolean;
}

export type VenueSlug = "paradiso" | "melkweg";

export const VENUE_COLORS: Record<
  VenueSlug,
  { bg: string; border: string; text: string; dot: string }
> = {
  paradiso: {
    bg: "bg-rose-100",
    border: "border-rose-400",
    text: "text-rose-900",
    dot: "bg-rose-400",
  },
  melkweg: {
    bg: "bg-blue-100",
    border: "border-blue-400",
    text: "text-blue-900",
    dot: "bg-blue-400",
  },
};

export const VENUE_NAMES: Record<VenueSlug, string> = {
  paradiso: "Paradiso",
  melkweg: "Melkweg",
};

// Dutch month abbreviations/full names → zero-indexed month number
const DUTCH_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mrt: 2, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, dec: 11,
  januari: 0, februari: 1, maart: 2, april: 3, juni: 5, juli: 6,
  augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
};

/** Try to parse a date string into a sortable ISO string (YYYY-MM-DD). */
export function parseDateToIso(dateIso?: string, dateStr?: string): string {
  // If we already have an ISO date, use it
  if (dateIso && /^\d{4}-\d{2}-\d{2}/.test(dateIso)) return dateIso.slice(0, 10);

  if (!dateStr) return "9999-12-31"; // no date → sort to end

  // ISO format in dateStr (e.g. "2026-04-15")
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // English: "Fr 27 Feb", "Sa 21 Feb", "We 4 Mar"
  const enMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)/);
  if (enMatch) {
    const day = enMatch[1].padStart(2, "0");
    const monthKey = enMatch[2].toLowerCase().slice(0, 3);
    const month = DUTCH_MONTHS[monthKey];
    if (month !== undefined) {
      // Assume current or next occurrence (2026)
      return `2026-${String(month + 1).padStart(2, "0")}-${day}`;
    }
  }

  // Dutch: "za 21 feb", "20 februari 13:00"
  const nlMatch = dateStr.match(/(\d{1,2})\s+([a-z]+)/i);
  if (nlMatch) {
    const day = nlMatch[1].padStart(2, "0");
    const monthKey = nlMatch[2].toLowerCase();
    const month = DUTCH_MONTHS[monthKey] ?? DUTCH_MONTHS[monthKey.slice(0, 3)];
    if (month !== undefined) {
      return `2026-${String(month + 1).padStart(2, "0")}-${day}`;
    }
  }

  return "9999-12-31";
}

/** Format a dateIso (YYYY-MM-DD) into "Monday 21 Feb 2026". Returns "" for unparseable dates. */
export function formatDate(dateIso?: string): string {
  if (!dateIso || dateIso === "9999-12-31") return "";
  const d = new Date(dateIso + "T12:00:00"); // noon to avoid timezone shifts
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Get the Monday of the week containing a given ISO date string. */
export function getWeekStart(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getLastUpdated(): string {
  return eventsData.last_updated;
}

export function getAllEvents(): Event[] {
  const events: Event[] = [];

  for (const [slug, venue] of Object.entries(eventsData.venues)) {
    const v = venue as {
      name: string;
      url: string;
      events: Array<Record<string, unknown>>;
    };

    for (const e of v.events) {
      const dateIso = (e.date_iso as string) || undefined;
      const date = (e.date as string) || "";
      events.push({
        id: e.id as string,
        title: e.title as string,
        date,
        dateIso: parseDateToIso(dateIso, date),
        type: (e.type as string) || undefined,
        genre: (e.genre as string) || undefined,
        status: (e.status as string) || undefined,
        description: (e.description as string) || undefined,
        url: (e.url as string) || "",
        venueSlug: slug as VenueSlug,
        venueName: v.name,
        venueUrl: v.url,
        firstSeen: e.first_seen as string,
        lastSeen: e.last_seen as string,
        isNew: e.is_new as boolean,
      });
    }
  }

  // Sort chronologically by event date
  events.sort((a, b) => (a.dateIso || "9999").localeCompare(b.dateIso || "9999"));

  return events;
}

export function getUniqueTypes(events: Event[]): string[] {
  const types = new Set<string>();
  for (const e of events) {
    if (e.type) types.add(e.type);
  }
  // Only include types that appear more than once (skip long Paradiso descriptions)
  const typeCounts = new Map<string, number>();
  for (const e of events) {
    if (e.type) typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
  }
  return Array.from(types)
    .filter((t) => t.length < 30 && (typeCounts.get(t) || 0) >= 2)
    .sort();
}
