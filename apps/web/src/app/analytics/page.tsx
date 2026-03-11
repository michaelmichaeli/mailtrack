"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Package, Truck, CheckCircle, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const STATUS_COLORS: Record<string, string> = {
  ORDERED: "#94a3b8",
  PROCESSING: "#f59e0b",
  SHIPPED: "#3b82f6",
  IN_TRANSIT: "#6366f1",
  OUT_FOR_DELIVERY: "#f97316",
  PICKED_UP: "#14b8a6",
  DELIVERED: "#22c55e",
  EXCEPTION: "#ef4444",
  RETURNED: "#a855f7",
};

const CARRIER_COLORS = [
  "#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#a855f7", "#14b8a6", "#f97316", "#ec4899", "#64748b",
];

interface DashboardData {
  stats: {
    total: number;
    arrivingToday: number;
    inTransit: number;
    processing: number;
    delivered: number;
    exceptions: number;
  };
  arrivingToday: any[];
  inTransit: any[];
  processing: any[];
  delivered: any[];
  exceptions: any[];
}

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard("year").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{t("analytics.noData")}</p>
      </div>
    );
  }

  const allOrders = [
    ...data.arrivingToday,
    ...data.inTransit,
    ...data.processing,
    ...data.delivered,
    ...data.exceptions,
  ];

  // Status distribution for pie chart
  const statusCounts: Record<string, number> = {};
  allOrders.forEach((o) => {
    const status = o.package?.status || o.status || "ORDERED";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: t(`status.${name}` as any) || name,
    value,
    color: STATUS_COLORS[name] || "#94a3b8",
  }));

  // Carrier distribution for bar chart
  const carrierCounts: Record<string, number> = {};
  allOrders.forEach((o) => {
    const carrier = o.package?.carrier || "Unknown";
    carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1;
  });
  const carrierData = Object.entries(carrierCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Monthly delivery timeline
  const monthlyData: Record<string, { month: string; delivered: number; ordered: number }> = {};
  allOrders.forEach((o) => {
    const date = new Date(o.orderDate || o.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    if (!monthlyData[key]) monthlyData[key] = { month: label, delivered: 0, ordered: 0 };
    monthlyData[key].ordered += 1;
    const status = o.package?.status || o.status;
    if (status === "DELIVERED" || status === "PICKED_UP") monthlyData[key].delivered += 1;
  });
  const timelineData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  // Avg delivery time (for delivered orders with orderDate)
  const deliveryTimes: number[] = [];
  allOrders.forEach((o) => {
    if ((o.package?.status === "DELIVERED" || o.package?.status === "PICKED_UP") && o.orderDate && o.updatedAt) {
      const days = (new Date(o.updatedAt).getTime() - new Date(o.orderDate).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 0 && days < 365) deliveryTimes.push(days);
    }
  });
  const avgDeliveryDays = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : null;

  const activeCount = data.stats.inTransit + data.stats.arrivingToday + data.stats.processing + data.stats.exceptions;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("analytics.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("analytics.totalPackages"), value: data.stats.total, icon: Package, color: "text-blue-500" },
          { label: t("analytics.deliveredPackages"), value: data.stats.delivered, icon: CheckCircle, color: "text-green-500" },
          { label: t("analytics.activePackages"), value: activeCount, icon: Truck, color: "text-indigo-500" },
          { label: t("analytics.avgDeliveryTime"), value: avgDeliveryDays ? `${avgDeliveryDays} ${t("analytics.days")}` : "—", icon: BarChart3, color: "text-amber-500" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status pie chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("analytics.packagesByStatus")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Carrier bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("analytics.packagesByCarrier")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={carrierData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {carrierData.map((_, i) => (
                  <Cell key={i} fill={CARRIER_COLORS[i % CARRIER_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Delivery timeline */}
      {timelineData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("analytics.deliveryTimeline")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Legend />
              <Bar dataKey="ordered" name={t("status.ORDERED")} fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" name={t("status.DELIVERED")} fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
