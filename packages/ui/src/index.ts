// Shared UI utilities and helpers
// Component implementations are in the web and mobile apps
// This package exports shared UI constants and helpers

export { PACKAGE_STATUS_COLORS, PACKAGE_STATUS_LABELS, PACKAGE_STATUS_ORDER } from "@mailtrack/shared";

export function getStatusStep(status: string): number {
  const steps = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
  const index = steps.indexOf(status);
  return index === -1 ? 0 : index;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ORDERED: "#9CA3AF",
    PROCESSING: "#9CA3AF",
    SHIPPED: "#3B82F6",
    IN_TRANSIT: "#3B82F6",
    OUT_FOR_DELIVERY: "#6366F1",
    DELIVERED: "#10B981",
    EXCEPTION: "#F97316",
    RETURNED: "#EF4444",
  };
  return colors[status] ?? "#9CA3AF";
}

export function formatRelativeDate(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}
