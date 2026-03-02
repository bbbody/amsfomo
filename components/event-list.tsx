"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Event, VenueSlug } from "@/lib/events";
import { VENUE_COLORS, VENUE_NAMES, formatDate } from "@/lib/events";
import { cn } from "@/lib/utils";

function usePinnedEvents() {
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("amsfomo-pinned");
      if (stored) setPinned(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("amsfomo-pinned", JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { pinned, toggle };
}

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "transition-colors",
        pinned
          ? "text-gray-900 dark:text-gray-100"
          : "text-gray-300 dark:text-gray-600"
      )}
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

function formatShortDate(dateIso?: string): string {
  if (!dateIso || dateIso === "9999-12-31") return "—";
  const d = new Date(dateIso + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatScrapeDayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EventRow({
  event,
  pinned,
  onTogglePin,
}: {
  event: Event;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const colors = VENUE_COLORS[event.venueSlug as VenueSlug];
  const venueName =
    VENUE_NAMES[event.venueSlug as VenueSlug] || event.venueName;
  const subtitle = [event.type, event.genre].filter(Boolean).join(" · ");

  return (
    <tr className="group border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
      <td className="w-8 px-2 py-3 text-center">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin();
          }}
          className="inline-flex items-center justify-center"
          aria-label={pinned ? "Unpin event" : "Pin event"}
        >
          <PinIcon pinned={pinned} />
        </button>
      </td>
      <td className="py-3 pr-1 max-w-[200px]">
        <a
          href={event.url || event.venueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 min-w-0"
        >
          {event.thumbnailUrl ? (
            <img
              src={event.thumbnailUrl}
              alt=""
              className="w-[100px] h-[50px] rounded object-cover shrink-0"
            />
          ) : (
            <span
              className={cn(
                "w-[100px] h-[50px] rounded shrink-0",
                colors?.dot || "bg-gray-400"
              )}
            />
          )}
          <span className="min-w-0">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:underline block truncate">
            {event.title.length > 25 ? event.title.slice(0, 25) + "…" : event.title}
          </span>
          {subtitle && (
            <span className="block text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
              {subtitle}
            </span>
          )}
          <span className="sm:hidden block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {[formatShortDate(event.dateIso), venueName].filter(Boolean).join(" · ")}
          </span>
          </span>
        </a>
      </td>
      <td className="hidden sm:table-cell py-3 pl-1 pr-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {formatShortDate(event.dateIso)}
      </td>
      <td className="hidden sm:table-cell py-3 pr-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            colors?.text || "text-gray-600"
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", colors?.dot || "bg-gray-400")}
          />
          {venueName}
        </span>
      </td>
    </tr>
  );
}

function EventTable({
  events,
  pinned,
  toggle,
  emptyMessage,
  dateLabel = "Date",
}: {
  events: Event[];
  pinned: Set<string>;
  toggle: (id: string) => void;
  emptyMessage: string;
  dateLabel?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <th className="w-8 px-2 py-2" />
            <th className="py-2 pr-3 text-xs font-semibold uppercase text-gray-500">
              Title
            </th>
            <th className="hidden sm:table-cell py-2 pr-3 text-xs font-semibold uppercase text-gray-500">
              {dateLabel}
            </th>
            <th className="hidden sm:table-cell py-2 pr-3 text-xs font-semibold uppercase text-gray-500">
              Venue
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              pinned={pinned.has(event.id)}
              onTogglePin={() => toggle(event.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VENUE_SLUGS: VenueSlug[] = ["paradiso", "melkweg", "subbacultcha", "murmur"];

export function EventList({ events }: { events: Event[] }) {
  const [search, setSearch] = useState("");
  const [selectedVenues, setSelectedVenues] = useState<Set<VenueSlug>>(
    new Set()
  );
  const { pinned, toggle } = usePinnedEvents();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => {
      if (
        selectedVenues.size > 0 &&
        !selectedVenues.has(e.venueSlug as VenueSlug)
      )
        return false;
      if (q) {
        const haystack =
          `${e.title} ${e.type || ""} ${e.genre || ""} ${e.description || ""} ${e.venueName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, search, selectedVenues]);

  const pinnedEvents = useMemo(
    () => filtered.filter((e) => pinned.has(e.id)),
    [filtered, pinned]
  );

  const pinnedExistCount = useMemo(
    () => events.filter((e) => pinned.has(e.id)).length,
    [events, pinned]
  );

  // Group events by the actual day they were first scraped, most recent first
  const newByDay = useMemo(() => {
    const groups = new Map<string, Event[]>();
    for (const e of filtered) {
      const day = e.firstSeen.slice(0, 10); // "2026-02-21"
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      b.localeCompare(a)
    );
  }, [filtered]);

  const toggleVenue = (slug: VenueSlug) => {
    setSelectedVenues((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <Tabs defaultValue="new" className="w-full">
      {/* Header: tabs + filters */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2">
          <TabsList variant="line">
            <TabsTrigger value="new" className="text-sm">
              New
            </TabsTrigger>
            <TabsTrigger value="all" className="text-sm">
              All events
              <span className="ml-1 rounded-full bg-gray-800 dark:bg-gray-200 px-1.5 text-[11px] font-medium text-white dark:text-gray-900">
                {filtered.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-sm">
              My schedule
              {pinnedExistCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-medium text-background">
                  {pinnedExistCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full sm:w-52 text-sm"
          />

          <div className="flex flex-wrap gap-1.5">
            {VENUE_SLUGS.map((slug) => {
              const colors = VENUE_COLORS[slug];
              const active = selectedVenues.has(slug);
              return (
                <button
                  key={slug}
                  onClick={() => toggleVenue(slug)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    active
                      ? cn(colors.bg, colors.border, colors.text)
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", colors.dot)}
                  />
                  {VENUE_NAMES[slug]}
                </button>
              );
            })}
          </div>

          {(search || selectedVenues.size > 0) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedVenues(new Set());
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* All events — chronological by event date */}
      <TabsContent value="all">
        <EventTable
          events={filtered}
          pinned={pinned}
          toggle={toggle}
          emptyMessage="No events match your filters."
        />
      </TabsContent>

      {/* New — grouped by scrape day, most recent first */}
      <TabsContent value="new">
        {newByDay.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No events match your filters.
          </div>
        ) : (
          <div className="space-y-6">
            {newByDay.map(([day, dayEvents]) => (
              <section key={day}>
                <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Date announced: {formatScrapeDayLabel(day)}
                  <span className="ml-1.5 font-normal">
                    ({dayEvents.length})
                  </span>
                </h2>
                <EventTable
                  events={dayEvents}
                  pinned={pinned}
                  toggle={toggle}
                  emptyMessage="No events."
                  dateLabel="Event date"
                />
              </section>
            ))}
          </div>
        )}
      </TabsContent>

      {/* My schedule — pinned events only */}
      <TabsContent value="schedule">
        <EventTable
          events={pinnedEvents}
          pinned={pinned}
          toggle={toggle}
          emptyMessage={
            pinned.size === 0
              ? "Pin events to build your schedule."
              : "No pinned events match your filters."
          }
        />
      </TabsContent>
    </Tabs>
  );
}
