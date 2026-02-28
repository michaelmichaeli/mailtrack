"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface BadgeProps {
  variant?: "default" | "secondary" | "outline" | "status";
  status?: string;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; darkBg: string; darkText: string }> = {
  ORDERED:          { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", darkBg: "rgba(30,41,59,0.8)", darkText: "#cbd5e1" },
  PROCESSING:       { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", darkBg: "rgba(30,41,59,0.8)", darkText: "#cbd5e1" },
  SHIPPED:          { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6", darkBg: "rgba(30,58,138,0.6)", darkText: "#93c5fd" },
  IN_TRANSIT:       { bg: "#e0e7ff", text: "#4338ca", dot: "#6366f1", darkBg: "rgba(49,46,129,0.6)", darkText: "#a5b4fc" },
  OUT_FOR_DELIVERY: { bg: "#ede9fe", text: "#6d28d9", dot: "#8b5cf6", darkBg: "rgba(76,29,149,0.6)", darkText: "#c4b5fd" },
  DELIVERED:        { bg: "#d1fae5", text: "#047857", dot: "#10b981", darkBg: "rgba(6,78,59,0.6)",   darkText: "#6ee7b7" },
  EXCEPTION:        { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b", darkBg: "rgba(120,53,15,0.6)", darkText: "#fcd34d" },
  RETURNED:         { bg: "#fee2e2", text: "#b91c1c", dot: "#ef4444", darkBg: "rgba(127,29,29,0.6)", darkText: "#fca5a5" },
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

export function Badge({ variant = "default", status, className, children, style }: BadgeProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  if (variant === "status" && status) {
    const config = statusConfig[status] ?? statusConfig.ORDERED;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
          className
        )}
        style={{
          backgroundColor: isDark ? config.darkBg : config.bg,
          color: isDark ? config.darkText : config.text,
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: config.dot }} />
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
      style={style}
    >
      {children}
    </span>
  );
}
