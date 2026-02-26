import { cn } from "@/lib/utils";
import { MapPin, CheckCircle2, Truck, Package, AlertCircle, CircleDot, Clock } from "lucide-react";

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

const statusIcons: Record<string, React.ComponentType<any>> = {
  DELIVERED: CheckCircle2,
  OUT_FOR_DELIVERY: Truck,
  IN_TRANSIT: Truck,
  SHIPPED: Package,
  PROCESSING: Clock,
  ORDERED: CircleDot,
  EXCEPTION: AlertCircle,
  RETURNED: AlertCircle,
};

const statusAccent: Record<string, string> = {
  DELIVERED: "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  OUT_FOR_DELIVERY: "border-violet-500 bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  IN_TRANSIT: "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  SHIPPED: "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  EXCEPTION: "border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  RETURNED: "border-red-500 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
};

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No tracking events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const Icon = statusIcons[event.status] ?? CircleDot;
        const isFirst = index === 0;
        const isLast = index === events.length - 1;
        const accent = isFirst
          ? (statusAccent[event.status] ?? "border-primary bg-accent text-primary")
          : "border-border bg-muted text-muted-foreground";

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0",
                  accent
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[1.5rem]" />}
            </div>

            {/* Content */}
            <div className={cn("pb-5 pt-0.5", isLast && "pb-0")}>
              <p className={cn(
                "text-sm font-medium leading-tight",
                isFirst ? "text-foreground" : "text-muted-foreground"
              )}>
                {event.description}
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span>{new Date(event.timestamp).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                })}</span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
