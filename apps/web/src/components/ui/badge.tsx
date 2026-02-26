import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "secondary" | "outline" | "status";
  status?: string;
  className?: string;
  children?: React.ReactNode;
}

const statusConfig: Record<string, { color: string; dot: string }> = {
  ORDERED: { color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  PROCESSING: { color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  SHIPPED: { color: "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", dot: "bg-blue-500" },
  IN_TRANSIT: { color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300", dot: "bg-indigo-500" },
  OUT_FOR_DELIVERY: { color: "bg-violet-50 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300", dot: "bg-violet-500" },
  DELIVERED: { color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", dot: "bg-emerald-500" },
  EXCEPTION: { color: "bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", dot: "bg-amber-500" },
  RETURNED: { color: "bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300", dot: "bg-red-500" },
};

const statusLabels: Record<string, string> = {
  ORDERED: "Ordered",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
  RETURNED: "Returned",
};

export function Badge({ variant = "default", status, className, children }: BadgeProps) {
  if (variant === "status" && status) {
    const config = statusConfig[status] ?? statusConfig.ORDERED;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
          config.color,
          className
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
        {children ?? statusLabels[status] ?? status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "outline" && "border border-border text-foreground",
        variant === "default" && "bg-primary text-primary-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
