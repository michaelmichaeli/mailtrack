import { cn } from "@/lib/utils";
import { Check, AlertTriangle, RotateCcw } from "lucide-react";

const steps = [
  { key: "ORDERED", label: "Ordered" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "OUT_FOR_DELIVERY", label: "Ready" },
  { key: "DELIVERED", label: "Delivered" },
];

const statusIndex: Record<string, number> = {
  ORDERED: 0,
  PROCESSING: 0,
  SHIPPED: 1,
  IN_TRANSIT: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

interface PackageProgressBarProps {
  status: string;
  className?: string;
}

export function PackageProgressBar({ status, className }: PackageProgressBarProps) {
  const isException = status === "EXCEPTION";
  const isReturned = status === "RETURNED";
  const isSpecial = isException || isReturned;
  const currentIndex = isSpecial ? -1 : (statusIndex[status] ?? 0);

  // For exception/returned, show a special bar
  if (isSpecial) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-center gap-3 py-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
            style={{ backgroundColor: isReturned ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)" }}
          >
            {isReturned ? (
              <RotateCcw className="h-4 w-4" style={{ color: "#ef4444" }} />
            ) : (
              <AlertTriangle className="h-4 w-4" style={{ color: "#f59e0b" }} />
            )}
          </div>
          <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: isReturned ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: "100%",
                backgroundColor: isReturned ? "#ef4444" : "#f59e0b",
                opacity: 0.6,
              }}
            />
          </div>
          <span className="text-xs font-semibold" style={{ color: isReturned ? "#ef4444" : "#f59e0b" }}>
            {isReturned ? "Returned" : "Exception"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Dots + lines row */}
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className={cn("flex items-center", !isLast && "flex-1")}>
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors shrink-0",
                  isCompleted && "border-primary bg-primary",
                  isCurrent && "border-primary bg-primary/10 dark:bg-primary/20",
                  !isCompleted && !isCurrent && "border-border bg-card"
                )}
              >
                {isCompleted ? (
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                ) : isCurrent ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </div>
              {!isLast && (
                <div className="flex-1 mx-0.5">
                  <div
                    className={cn(
                      "h-0.5 w-full rounded-full transition-colors",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Labels row */}
      <div className="hidden sm:flex mt-1.5">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          return (
            <span key={step.key} className={cn(
              "text-[10px] font-medium",
              !isLast ? "flex-1" : "",
              index === 0 ? "text-left" : isLast ? "text-right" : "text-center",
              isCurrent ? "text-primary font-semibold" : isCompleted ? "text-foreground" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
