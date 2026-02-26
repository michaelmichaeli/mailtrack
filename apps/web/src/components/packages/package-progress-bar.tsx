import { cn } from "@/lib/utils";

const steps = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

interface PackageProgressBarProps {
  status: string;
  className?: string;
}

export function PackageProgressBar({ status, className }: PackageProgressBarProps) {
  const currentIndex = steps.indexOf(status);
  const isException = status === "EXCEPTION" || status === "RETURNED";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {steps.map((step, index) => (
        <div key={step} className="flex-1 flex items-center gap-1">
          <div
            className={cn(
              "h-1.5 w-full rounded-full transition-colors",
              isException && index <= 3
                ? "bg-orange-400"
                : index <= currentIndex
                  ? "bg-primary"
                  : "bg-muted"
            )}
          />
        </div>
      ))}
    </div>
  );
}
