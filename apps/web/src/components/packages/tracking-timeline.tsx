import { cn } from "@/lib/utils";
import { MapPin, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface TrackingEvent {
  id: string;
  timestamp: string;
  location: string | null;
  status: string;
  description: string;
}

interface TrackingTimelineProps {
  events: TrackingEvent[];
}

const statusColors: Record<string, { dot: string; ring: string; badge: string }> = {
  DELIVERED:        { dot: "bg-emerald-500", ring: "ring-emerald-500/20", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  OUT_FOR_DELIVERY: { dot: "bg-violet-500",  ring: "ring-violet-500/20",  badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  IN_TRANSIT:       { dot: "bg-indigo-500",  ring: "ring-indigo-500/20",  badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  SHIPPED:          { dot: "bg-blue-500",    ring: "ring-blue-500/20",    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  PROCESSING:       { dot: "bg-slate-400",   ring: "ring-slate-400/20",   badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
  EXCEPTION:        { dot: "bg-amber-500",   ring: "ring-amber-500/20",   badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  RETURNED:         { dot: "bg-red-500",     ring: "ring-red-500/20",     badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const defaultColors = { dot: "bg-muted-foreground", ring: "ring-muted-foreground/20", badge: "bg-muted text-muted-foreground" };

function formatStatus(s: string): string {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function TimelineRow({ event, isFirst, isLast, colors }: {
  event: TrackingEvent; isFirst: boolean; isLast: boolean;
  colors: { dot: string; ring: string; badge: string };
}) {
  const dt = new Date(event.timestamp);
  return (
    <div className="flex gap-0 group">
      <div className="w-16 sm:w-20 shrink-0 pt-[3px] pr-3 text-right">
        <div className="text-[11px] tabular-nums leading-tight text-muted-foreground">
          <span className={cn(isFirst && "font-medium text-foreground")}>
            {dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="text-[10px] tabular-nums text-muted-foreground/50">
          {dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <div className="relative flex flex-col items-center shrink-0 w-5">
        <div className={cn(
          "rounded-full shrink-0 mt-[5px] relative z-10",
          isFirst ? "h-3 w-3 ring-4" : "h-2.5 w-2.5",
          colors.dot, isFirst && colors.ring,
        )} />
        {!isLast && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-border/60" />}
      </div>
      <div className={cn("flex-1 min-w-0 pl-2.5", isFirst ? "pb-6" : "pb-4")}>
        <p className={cn("text-sm leading-snug", isFirst ? "font-medium text-foreground" : "text-muted-foreground")}>
          {event.description}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className={cn("inline-block rounded-full px-2 py-px text-[10px] font-medium", colors.badge)}>
            {formatStatus(event.status)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[180px]">{event.location}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No tracking events yet</p>
      </div>
    );
  }

  const COLLAPSE_THRESHOLD = 6;
  const showToggle = events.length > COLLAPSE_THRESHOLD;
  const alwaysVisible = showToggle ? events.slice(0, COLLAPSE_THRESHOLD) : events;
  const collapsible = showToggle ? events.slice(COLLAPSE_THRESHOLD) : [];

  return (
    <div className="relative">
      {alwaysVisible.map((event, index) => {
        const isFirst = index === 0;
        const isLast = index === alwaysVisible.length - 1 && !showToggle;
        const colors = statusColors[event.status] ?? defaultColors;
        return <TimelineRow key={event.id} event={event} isFirst={isFirst} isLast={isLast} colors={colors} />;
      })}

      {showToggle && (
        <>
          {/* Collapsible section with CSS grid transition */}
          <div
            className="grid transition-[grid-template-rows] duration-400 ease-in-out"
            style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              {collapsible.map((event, index) => {
                const isLast = index === collapsible.length - 1;
                const colors = statusColors[event.status] ?? defaultColors;
                return <TimelineRow key={event.id} event={event} isFirst={false} isLast={isLast} colors={colors} />;
              })}
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 ml-[calc(4rem+0.75rem+10px)] sm:ml-[calc(5rem+0.75rem+10px)] mt-1 px-3 py-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer rounded-full hover:bg-accent/50"
          >
            <span className={cn("transition-transform duration-300", expanded && "rotate-180")}>
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
            {expanded ? "Show less" : `Show all ${events.length} events`}
          </button>
        </>
      )}
    </div>
  );
}
