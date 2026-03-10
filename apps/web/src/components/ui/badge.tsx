"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        status: "", // handled dynamically
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

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

function Badge({
  className,
  variant = "default",
  status,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; status?: string }) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  if (variant === "status" && status) {
    const config = statusConfig[status] ?? statusConfig.ORDERED;
    return (
      <span
        data-slot="badge"
        data-variant="status"
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
          className
        )}
        style={{
          backgroundColor: isDark ? config.darkBg : config.bg,
          color: isDark ? config.darkText : config.text,
        }}
        {...props}
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: config.dot }} />
        {children ?? t(`status.${status}` as TranslationKey) ?? status}
      </span>
    );
  }

  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
