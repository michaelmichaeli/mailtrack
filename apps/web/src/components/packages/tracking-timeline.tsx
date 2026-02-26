import { cn } from "@/lib/utils";
import { MapPin, CheckCircle, Truck, Package, AlertCircle } from "lucide-react";

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
  DELIVERED: CheckCircle,
  OUT_FOR_DELIVERY: Truck,
  IN_TRANSIT: Truck,
  SHIPPED: Package,
  EXCEPTION: AlertCircle,
  RETURNED: AlertCircle,
};

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No tracking events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const Icon = statusIcons[event.status] ?? Package;
        const isFirst = index === 0;
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="flex gap-4">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0",
                  isFirst
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[2rem]" />}
            </div>

            {/* Content */}
            <div className={cn("pb-6", isLast && "pb-0")}>
              <p className={cn("text-sm font-medium", isFirst ? "text-foreground" : "text-muted-foreground")}>
                {event.description}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{new Date(event.timestamp).toLocaleString()}</span>
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
