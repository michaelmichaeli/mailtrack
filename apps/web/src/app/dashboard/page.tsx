"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PackageCard } from "@/components/packages/package-card";
import { EmptyState } from "@/components/packages/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, Truck, Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard(),
    retry: false,
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await api.syncEmails();
      if (result.emailsParsed > 0) {
        toast.success(`Synced ${result.emailsParsed} emails — ${result.totalOrders} orders, ${result.totalTracking} with tracking`);
      } else {
        toast.success("Sync complete — no new shipping emails found");
      }
      refetch();
    } catch {
      toast.error("Failed to sync emails. Connect your email first.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = data?.stats;
  const hasPackages = stats && stats.total > 0;
  const busy = isSyncing || isRefetching;

  const statCards = [
    { label: "Arriving Today", value: stats?.arrivingToday ?? 0, icon: Clock, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/50" },
    { label: "In Transit", value: stats?.inTransit ?? 0, icon: Truck, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/50" },
    { label: "Processing", value: stats?.processing ?? 0, icon: Package, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Delivered", value: stats?.delivered ?? 0, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "Exceptions", value: stats?.exceptions ?? 0, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track all your orders and packages in one place</p>
        </div>
        <Button onClick={handleSync} variant="outline" size="sm" disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Sync emails"}
        </Button>
      </div>

      {!hasPackages ? (
        <EmptyState
          title="No packages yet"
          description="Connect your email to start tracking packages automatically. We'll parse your order and shipping confirmation emails."
          action={{ label: "Connect email", href: "/settings" }}
          icon="mail"
        />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} shrink-0`}>
                        <Icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{s.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Order sections */}
          {[
            { key: "arrivingToday", title: "Arriving Today", icon: Clock, color: "text-violet-500", items: data.arrivingToday, status: "IN_TRANSIT" },
            { key: "inTransit", title: "In Transit", icon: Truck, color: "text-indigo-500", items: data.inTransit, status: "IN_TRANSIT" },
            { key: "processing", title: "Processing", icon: Package, color: "text-slate-400", items: data.processing, status: "PROCESSING" },
            { key: "delivered", title: "Recently Delivered", icon: CheckCircle2, color: "text-emerald-500", items: data.delivered, status: "DELIVERED" },
            { key: "exceptions", title: "Exceptions", icon: AlertTriangle, color: "text-amber-500", items: data.exceptions, status: "EXCEPTION" },
          ].filter(s => s.items.length > 0).map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.key}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${section.color}`} />
                    {section.title}
                    <span className="text-xs font-normal text-muted-foreground">({section.items.length})</span>
                  </h2>
                  {section.items.length > 3 && (
                    <Link href={`/packages?status=${section.status}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                      View all <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
                  {section.items.map((order: any) => (
                    <PackageCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
