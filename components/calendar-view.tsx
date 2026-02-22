"use client";

import { useMemo, useState } from "react";
import type { Event, VenueSlug } from "@/lib/events";
import { VENUE_COLORS, VENUE_NAMES, formatDate } from "@/lib/events";
import { PinButton } from "@/components/pin-button";
import { cn } from "@/lib/utils";

function getMonthDays(year: number, month: number) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  // Shift to Monday-start: Mon=0, Tue=1, ..., Sun=6
  const startOffset = startDow === 0 ? 6 : startDow - 1;
  const totalDays = lastDay.getDate();
  return { startOffset, totalDays, year, month };
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  events,
  pinned,
  toggle,
}: {
  events: Event[];
  pinned: Set<string>;
  toggle: (id: string) => void;
}) {
  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Build a map of dateIso → events for fast lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      if (!e.dateIso || e.dateIso === "9999-12-31") continue;
      const key = e.dateIso.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const { startOffset, totalDays } = getMonthDays(viewYear, viewMonth);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" }
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Build a filtered map when showing pinned only
  const visibleEventsByDate = useMemo(() => {
    if (!showPinnedOnly) return eventsByDate;
    const map = new Map<string, Event[]>();
    for (const [date, evts] of eventsByDate) {
      const filtered = evts.filter((e) => pinned.has(e.id));
      if (filtered.length > 0) map.set(date, filtered);
    }
    return map;
  }, [eventsByDate, pinned, showPinnedOnly]);

  // Selected day for detail view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedEvents = selectedDate ? visibleEventsByDate.get(selectedDate) || [] : [];

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent transition-colors"
        >
          &larr;
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">{monthLabel}</h2>
          <button
            onClick={goToday}
            className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setShowPinnedOnly((v) => !v)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs transition-colors",
              showPinnedOnly
                ? "border-foreground/30 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            Pinned
          </button>
        </div>
        <button
          onClick={nextMonth}
          className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent transition-colors"
        >
          &rarr;
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border overflow-hidden">
        {/* Weekday headers */}
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-muted px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`empty-${i}`} className="bg-background min-h-[100px] sm:min-h-[120px]" />
        ))}

        {/* Day cells */}
        {Array.from({ length: totalDays }, (_, i) => {
          const day = i + 1;
          const iso = toIso(viewYear, viewMonth, day);
          const dayEvents = visibleEventsByDate.get(iso) || [];
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          const maxVisible = 3;
          const overflow = dayEvents.length - maxVisible;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : iso)}
              className={cn(
                "bg-background min-h-[100px] sm:min-h-[120px] p-1 text-left transition-colors hover:bg-accent/50 flex flex-col gap-0.5",
                isSelected && "ring-2 ring-foreground/20 ring-inset"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium shrink-0",
                  isToday && "bg-foreground text-background",
                  !isToday && "text-foreground"
                )}
              >
                {day}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex flex-col gap-px mt-0.5 overflow-hidden flex-1 min-w-0">
                  {dayEvents.slice(0, maxVisible).map((e) => {
                    const colors = VENUE_COLORS[e.venueSlug as VenueSlug];
                    const isPinned = pinned.has(e.id);
                    return (
                      <span
                        key={e.id}
                        className={cn(
                          "flex items-center gap-0.5 rounded-sm px-1 py-px text-[9px] sm:text-[10px] leading-tight border-l-2",
                          colors?.border || "border-muted-foreground",
                          colors?.bg || "bg-muted",
                          colors?.text || "text-foreground",
                          isPinned && "font-bold"
                        )}
                      >
                        {isPinned && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="size-2.5 shrink-0"
                          >
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                          </svg>
                        )}
                        <span className="truncate">{e.title}</span>
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="text-[9px] text-muted-foreground px-1">
                      +{overflow} more
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {formatDate(selectedDate)}
            <span className="ml-1.5 font-normal">
              ({selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""})
            </span>
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events on this day.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map((event) => {
                const colors = VENUE_COLORS[event.venueSlug as VenueSlug];
                const venueName = VENUE_NAMES[event.venueSlug as VenueSlug] || event.venueName;
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-card p-2 border-l-[3px]",
                      colors.border,
                      pinned.has(event.id) && "ring-1 ring-foreground/10"
                    )}
                  >
                    <a
                      href={event.url || event.venueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 hover:underline"
                    >
                      <span className="text-sm font-medium line-clamp-1">
                        {event.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {venueName}
                        {event.type ? ` · ${event.type}` : ""}
                      </span>
                    </a>
                    <PinButton
                      pinned={pinned.has(event.id)}
                      onToggle={() => toggle(event.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
