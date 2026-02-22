"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Event, VenueSlug } from "@/lib/events";
import { VENUE_COLORS, VENUE_NAMES, formatDate } from "@/lib/events";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 80;
const STORAGE_KEY = "amsfomo-swiped";

function useSwipedEvents() {
  const [swiped, setSwiped] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSwiped(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const markSwiped = useCallback((id: string) => {
    setSwiped((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const resetSwiped = useCallback(() => {
    setSwiped(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { swiped, markSwiped, resetSwiped };
}

export function SwipeView({
  events,
  pinned,
  toggle,
}: {
  events: Event[];
  pinned: Set<string>;
  toggle: (id: string) => void;
}) {
  const { swiped, markSwiped, resetSwiped } = useSwipedEvents();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [animatingOut, setAnimatingOut] = useState<"left" | "right" | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean; isHorizontal: boolean | null } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Filter out already-swiped events
  const deck = events.filter((e) => !swiped.has(e.id));
  const currentEvent = deck[currentIndex] || null;
  const remaining = deck.length - currentIndex;

  // Reset index when filters change and current index is out of bounds
  useEffect(() => {
    if (currentIndex >= deck.length) {
      setCurrentIndex(Math.max(0, deck.length - 1));
    }
  }, [deck.length, currentIndex]);

  const dismissCard = useCallback(
    (direction: "left" | "right") => {
      if (!currentEvent || animatingOut) return;
      setAnimatingOut(direction);

      if (direction === "right") {
        if (!pinned.has(currentEvent.id)) {
          toggle(currentEvent.id);
        }
      }
      markSwiped(currentEvent.id);

      // Wait for animation, then advance
      setTimeout(() => {
        setAnimatingOut(null);
        setOffsetX(0);
        // Don't increment index since the card is removed from deck via swiped filter
      }, 300);
    },
    [currentEvent, animatingOut, pinned, toggle, markSwiped]
  );

  // Touch handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, dragging: true, isHorizontal: null };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current?.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    // Determine scroll direction on first significant move
    if (dragRef.current.isHorizontal === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!dragRef.current.isHorizontal) return;
    e.preventDefault();
    setOffsetX(dx);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current?.dragging) return;
      const wasHorizontal = dragRef.current.isHorizontal;
      dragRef.current = null;

      if (!wasHorizontal) {
        setOffsetX(0);
        return;
      }

      if (Math.abs(offsetX) >= SWIPE_THRESHOLD) {
        dismissCard(offsetX > 0 ? "right" : "left");
      } else {
        setOffsetX(0);
      }
    },
    [offsetX, dismissCard]
  );

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") dismissCard("left");
      if (e.key === "ArrowRight") dismissCard("right");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dismissCard]);

  if (deck.length === 0 || currentIndex >= deck.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">
          {events.length === 0
            ? "No events match your filters."
            : "You've reviewed all events!"}
        </p>
        {swiped.size > 0 && (
          <button
            onClick={() => {
              resetSwiped();
              setCurrentIndex(0);
            }}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            Reset &amp; start over
          </button>
        )}
      </div>
    );
  }

  const event = currentEvent!;
  const colors = VENUE_COLORS[event.venueSlug as VenueSlug];
  const venueName = VENUE_NAMES[event.venueSlug as VenueSlug] || event.venueName;
  const subtitle = [event.type, event.genre].filter(Boolean).join(" · ");

  // Compute card transform
  const isAnimating = animatingOut !== null;
  const translateX = isAnimating
    ? animatingOut === "right"
      ? 400
      : -400
    : offsetX;
  const rotate = translateX * 0.05;
  const opacity = isAnimating ? 0 : 1;

  // Swipe direction hint color
  const hintOpacity = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1) * 0.15;
  const hintColor =
    offsetX > 0
      ? `rgba(34, 197, 94, ${hintOpacity})`
      : offsetX < 0
        ? `rgba(156, 163, 175, ${hintOpacity})`
        : "transparent";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress */}
      <p className="text-xs text-muted-foreground">
        {remaining} event{remaining !== 1 ? "s" : ""} remaining
      </p>

      {/* Card */}
      <div className="relative w-full max-w-md mx-auto" style={{ minHeight: 280 }}>
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cn(
            "absolute inset-0 rounded-xl border bg-card shadow-sm select-none cursor-grab active:cursor-grabbing overflow-hidden",
            "border-l-4",
            colors?.border
          )}
          style={{
            transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
            transition: isAnimating
              ? "transform 300ms ease-out, opacity 300ms ease-out"
              : offsetX === 0
                ? "transform 200ms ease-out"
                : "none",
            opacity,
            backgroundColor: hintColor,
            touchAction: "pan-y",
          }}
        >
          <div className="p-5 space-y-3">
            {/* Venue + date row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium px-2 py-0.5",
                  colors?.bg,
                  colors?.text,
                  colors?.border
                )}
              >
                {venueName}
              </Badge>
              {event.dateIso && formatDate(event.dateIso) && (
                <span className="text-sm text-muted-foreground">
                  {formatDate(event.dateIso)}
                </span>
              )}
              {event.status && event.status !== "ongoing" && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 bg-amber-100 text-amber-900 border-amber-400"
                >
                  {event.status}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-foreground leading-snug">
              {event.title}
            </h3>

            {/* Type / genre */}
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}

            {/* Description */}
            {event.description && (
              <p className="text-sm text-muted-foreground line-clamp-4">
                {event.description}
              </p>
            )}

            {/* Link */}
            <a
              href={event.url || event.venueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-muted-foreground underline hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              View on venue site
            </a>
          </div>

          {/* Swipe direction indicators */}
          {offsetX !== 0 && !isAnimating && (
            <div className="absolute top-4 right-4 left-4 flex justify-between pointer-events-none">
              <span
                className="text-2xl font-bold text-gray-400 transition-opacity"
                style={{ opacity: offsetX < -20 ? Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1) : 0 }}
              >
                SKIP
              </span>
              <span
                className="text-2xl font-bold text-green-500 transition-opacity"
                style={{ opacity: offsetX > 20 ? Math.min(offsetX / SWIPE_THRESHOLD, 1) : 0 }}
              >
                PIN
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop buttons */}
      <div className="flex items-center gap-6 mt-2">
        <button
          onClick={() => dismissCard("left")}
          className="flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Skip"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Skip
        </button>
        <button
          onClick={() => dismissCard("right")}
          className="flex items-center gap-1.5 rounded-full border border-green-400 bg-green-50 px-5 py-2.5 text-sm text-green-700 hover:bg-green-100 transition-colors dark:bg-green-950 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900"
          aria-label="Pin"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
          Pin
        </button>
      </div>
    </div>
  );
}
