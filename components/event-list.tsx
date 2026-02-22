"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCard } from "@/components/event-card";
import { CalendarView } from "@/components/calendar-view";
import { SwipeView } from "@/components/swipe-view";
import type { Event, VenueSlug } from "@/lib/events";
import { VENUE_COLORS, VENUE_NAMES, getUniqueTypes, getWeekStart } from "@/lib/events";
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

const VENUE_SLUGS: VenueSlug[] = ["paradiso", "melkweg"];

function formatWeekLabel(mondayIso: string): string {
  const d = new Date(mondayIso + "T00:00:00");
  return `Week of ${d.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}`;
}

function EventGrid({
  events,
  pinned,
  toggle,
}: {
  events: Event[];
  pinned: Set<string>;
  toggle: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No events match your filters.
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          pinned={pinned.has(event.id)}
          onTogglePin={() => toggle(event.id)}
        />
      ))}
    </div>
  );
}

export function EventList({ events }: { events: Event[] }) {
  const [search, setSearch] = useState("");
  const [selectedVenues, setSelectedVenues] = useState<Set<VenueSlug>>(
    new Set()
  );
  const [selectedType, setSelectedType] = useState<string>("");
  const { pinned, toggle } = usePinnedEvents();

  const types = useMemo(() => getUniqueTypes(events), [events]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => {
      if (selectedVenues.size > 0 && !selectedVenues.has(e.venueSlug as VenueSlug))
        return false;
      if (selectedType && e.type !== selectedType) return false;
      if (q) {
        const haystack =
          `${e.title} ${e.type || ""} ${e.genre || ""} ${e.description || ""} ${e.venueName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, search, selectedVenues, selectedType]);

  const pinnedEvents = useMemo(
    () => filtered.filter((e) => pinned.has(e.id)),
    [filtered, pinned]
  );

  // Count pinned events that actually exist (regardless of filters)
  const pinnedExistCount = useMemo(
    () => events.filter((e) => pinned.has(e.id)).length,
    [events, pinned]
  );

  // Group events by the week they were first announced (firstSeen), most recent first
  const newByWeek = useMemo(() => {
    const groups = new Map<string, Event[]>();
    for (const e of filtered) {
      const weekStart = getWeekStart(e.firstSeen.slice(0, 10));
      if (!groups.has(weekStart)) groups.set(weekStart, []);
      groups.get(weekStart)!.push(e);
    }
    // Sort weeks descending (most recent first)
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
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
    <Tabs defaultValue="all" className="w-full">
      {/* Filter bar */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2">
          <TabsList variant="line">
            <TabsTrigger value="all" className="text-sm">
              All events
              <span className="ml-1 text-xs text-muted-foreground">
                {filtered.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="new" className="text-sm">
              New
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-sm">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="swipe" className="text-sm">
              Swipe
            </TabsTrigger>
            <TabsTrigger value="pinned" className="text-sm">
              Pinned
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
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full sm:w-64 text-sm"
          />

          {/* Venue filter chips */}
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

          {/* Type filter */}
          {types.length > 0 && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {(search || selectedVenues.size > 0 || selectedType) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedVenues(new Set());
                setSelectedType("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* All events tab — chronological */}
      <TabsContent value="all">
        <EventGrid events={filtered} pinned={pinned} toggle={toggle} />
      </TabsContent>

      {/* New tab — grouped by announcement week */}
      <TabsContent value="new">
        {newByWeek.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No events match your filters.
          </div>
        ) : (
          <div className="space-y-6">
            {newByWeek.map(([weekStart, weekEvents]) => (
              <section key={weekStart}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {formatWeekLabel(weekStart)}
                  <span className="ml-1.5 font-normal">
                    ({weekEvents.length})
                  </span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {weekEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      pinned={pinned.has(event.id)}
                      onTogglePin={() => toggle(event.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Calendar tab */}
      <TabsContent value="calendar">
        <CalendarView events={filtered} pinned={pinned} toggle={toggle} />
      </TabsContent>

      {/* Swipe tab */}
      <TabsContent value="swipe">
        <SwipeView events={filtered} pinned={pinned} toggle={toggle} />
      </TabsContent>

      {/* Pinned tab */}
      <TabsContent value="pinned">
        {pinnedEvents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {pinned.size === 0
              ? "Pin events to save them here."
              : "No pinned events match your filters."}
          </div>
        ) : (
          <EventGrid events={pinnedEvents} pinned={pinned} toggle={toggle} />
        )}
      </TabsContent>
    </Tabs>
  );
}
