"use client";

import { Badge } from "@/components/ui/badge";
import { PinButton } from "@/components/pin-button";
import type { Event, VenueSlug } from "@/lib/events";
import { VENUE_COLORS, VENUE_NAMES, formatDate } from "@/lib/events";
import { cn } from "@/lib/utils";

export function EventCard({
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
    <a
      href={event.url || event.venueUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50",
        "border-l-[3px]",
        colors.border
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-medium px-1.5 py-0 shrink-0",
              colors.bg,
              colors.text,
              colors.border
            )}
          >
            {venueName}
          </Badge>
          {event.dateIso && formatDate(event.dateIso) && (
            <span className="text-xs text-muted-foreground truncate">
              {formatDate(event.dateIso)}
            </span>
          )}
          {event.status && event.status !== "ongoing" && (
            <Badge
              variant="outline"
              className="text-[11px] px-1.5 py-0 bg-amber-100 text-amber-900 border-amber-400"
            >
              {event.status}
            </Badge>
          )}
        </div>

        <h3 className="text-sm font-semibold text-foreground leading-tight mb-0.5 line-clamp-1 group-hover:underline">
          {event.title}
        </h3>

        {subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {subtitle}
          </p>
        )}

        {event.description && !subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {event.description}
          </p>
        )}
      </div>

      <PinButton pinned={pinned} onToggle={onTogglePin} />
    </a>
  );
}
