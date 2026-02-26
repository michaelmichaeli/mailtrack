import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "secondary" | "outline" | "status";
  status?: string;
  className?: string;
  children?: React.ReactNode;
}

const statusColors: Record<string, string> = {
  ORDERED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PROCESSING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SHIPPED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  IN_TRANSIT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  EXCEPTION: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  RETURNED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
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
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          statusColors[status] ?? statusColors.ORDERED,
          className
        )}
      >
        {children ?? statusLabels[status] ?? status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
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
