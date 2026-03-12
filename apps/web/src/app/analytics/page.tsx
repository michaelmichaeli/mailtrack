"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from "recharts";
import { Package, Truck, CheckCircle, BarChart3, Clock, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Skeleton } from "@/components/ui/skeleton";

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

function AnalyticsSkeleton() {
  return (
    <PageTransition className="space-y-5">
      <div>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-9 w-9 rounded-lg mb-3" />
            <Skeleton className="h-7 w-14 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-5 w-44 mb-4" />
        <Skeleton className="h-[240px] w-full rounded-lg" />
      </div>
    </PageTransition>
  );
}

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard("year").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <AnalyticsSkeleton />;

  if (!data || data.stats.total === 0) {
    return (
      <PageTransition className="space-y-5">
        <FadeIn>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("analytics.title")}</h1>
              <p className="text-sm text-muted-foreground/80 mt-0.5">{t("analytics.subtitle")}</p>
            </div>
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 mb-4">
              <BarChart3 className="h-7 w-7 text-primary/40" />
            </div>
            <p className="text-sm font-semibold text-foreground/70">{t("analytics.noData")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1.5 text-center max-w-[240px]">
              {t("analytics.subtitle")}
            </p>
          </div>
        </FadeIn>
      </PageTransition>
    );
  }

  const allOrders = [
    ...data.arrivingToday,
    ...data.inTransit,
    ...data.processing,
    ...data.delivered,
    ...data.exceptions,
  ];

  // Status distribution
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

  // Carrier distribution
  const carrierCounts: Record<string, number> = {};
  allOrders.forEach((o) => {
    const carrier = o.package?.carrier || "Unknown";
    carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1;
  });
  const carrierData = Object.entries(carrierCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Monthly timeline
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

  // Avg delivery time
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

  const statCards = [
    { label: t("analytics.totalPackages"), value: data.stats.total, icon: Package, bg: "bg-primary/10", fg: "text-primary" },
    { label: t("analytics.deliveredPackages"), value: data.stats.delivered, icon: CheckCircle, bg: "bg-green-500/10", fg: "text-green-500" },
    { label: t("analytics.activePackages"), value: activeCount, icon: Truck, bg: "bg-violet-500/10", fg: "text-violet-500" },
    { label: t("analytics.avgDeliveryTime"), value: avgDeliveryDays ? `${avgDeliveryDays} ${t("analytics.days")}` : "—", icon: Clock, bg: "bg-amber-500/10", fg: "text-amber-500" },
  ];

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    fontSize: "12px",
    padding: "8px 12px",
  };

  return (
    <PageTransition className="space-y-5">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("analytics.title")}</h1>
            <p className="text-sm text-muted-foreground/80 mt-0.5">{t("analytics.subtitle")}</p>
          </div>
          <div className="hidden md:block">
            <NotificationBell />
          </div>
        </div>
      </FadeIn>

      {/* Stat cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((stat, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4">
                <div className={`mb-3 h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.fg}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status donut */}
        <FadeIn delay={0.1}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t("analytics.packagesByStatus")}
              </CardTitle>
              <CardDescription>{t("analytics.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                    activeShape={undefined}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend as pills */}
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {statusData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Carrier breakdown */}
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-primary" />
                {t("analytics.packagesByCarrier")}
              </CardTitle>
              <CardDescription>{t("analytics.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {carrierData.map((carrier, i) => {
                  const pct = Math.round((carrier.value / data.stats.total) * 100);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground truncate mr-2">{carrier.name}</span>
                        <span className="text-muted-foreground shrink-0">{carrier.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CARRIER_COLORS[i % CARRIER_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Delivery timeline */}
      {timelineData.length > 1 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t("analytics.deliveryTimeline")}
              </CardTitle>
              <CardDescription>{t("analytics.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={timelineData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradOrdered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="ordered"
                    name={t("status.ORDERED")}
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gradOrdered)"
                    activeDot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="delivered"
                    name={t("status.DELIVERED")}
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gradDelivered)"
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {/* Inline legend */}
              <div className="flex gap-4 justify-center mt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  {t("status.ORDERED")}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  {t("status.DELIVERED")}
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </PageTransition>
  );
}
