import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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
  const currentIndex = statusIndex[status] ?? 0;
  const isException = status === "EXCEPTION" || status === "RETURNED";

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
                  isException && isCurrent && "border-[#f59e0b]",
                  !isException && isCompleted && "border-primary bg-primary",
                  !isException && isCurrent && "border-primary bg-primary/10 dark:bg-primary/20",
                  !isException && !isCompleted && !isCurrent && "border-border bg-card"
                )}
              >
                {isCompleted && !isException ? (
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                ) : isCurrent && !isException ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </div>
              {!isLast && (
                <div className="flex-1 mx-0.5">
                  <div
                    className={cn(
                      "h-0.5 w-full rounded-full transition-colors",
                      isException && index < 2 ? "bg-[#fcd34d]" :
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
