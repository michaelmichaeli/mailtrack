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
import { RefreshCw, Package, Truck, Clock, CheckCircle2, AlertTriangle, ArrowRight, MessageSquare, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { AddPackageDialog } from "@/components/packages/add-package-dialog";
import { ScanSmsDialog } from "@/components/packages/scan-sms-dialog";

const TIME_PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "3 months" },
  { value: "180d", label: "6 months" },
  { value: "365d", label: "1 year" },
  { value: "all", label: "All time" },
];

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [period, setPeriod] = useState("30d");
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => api.getDashboard(period),
    retry: false,
  });

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const emailResult = await api.syncEmails();
      try {
        const trackResult = await api.syncAllTracking();
        toast.success(`Synced ${emailResult.emailsParsed} emails, updated ${trackResult.synced} packages`);
      } catch {
        if (emailResult.emailsParsed > 0) {
          toast.success(`Synced ${emailResult.emailsParsed} emails (tracking sync failed)`);
        } else {
          toast.success("No new emails. Tracking sync failed.");
        }
      }
      refetch();
    } catch {
      toast.error("Failed to sync. Connect your email first.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = data?.stats;
  const hasPackages = stats && stats.total > 0;
  const busy = isSyncing || isRefetching;

  const activeCount = (stats?.arrivingToday ?? 0) + (stats?.inTransit ?? 0) + (stats?.processing ?? 0);

  const pills = [
    { label: "Today", value: stats?.arrivingToday ?? 0, color: "bg-violet-500", href: "/packages?status=OUT_FOR_DELIVERY" },
    { label: "In Transit", value: stats?.inTransit ?? 0, color: "bg-indigo-500", href: "/packages?status=IN_TRANSIT" },
    { label: "Processing", value: stats?.processing ?? 0, color: "bg-slate-400", href: "/packages?status=PROCESSING" },
    { label: "Delivered", value: stats?.delivered ?? 0, color: "bg-emerald-500", href: "/packages?status=DELIVERED" },
    { label: "Issues", value: stats?.exceptions ?? 0, color: "bg-amber-500", href: "/packages?status=EXCEPTION" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track all your orders and packages in one place</p>
        </div>
        <div className="flex items-center gap-2">
          <AddPackageDialog />
          <Button onClick={() => setScanOpen(true)} variant="outline" size="sm" className="cursor-pointer">
            <MessageSquare className="h-4 w-4" />
            Scan Messages
          </Button>
          <Button onClick={handleFullSync} variant="outline" size="sm" disabled={busy} className="cursor-pointer">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync All"}
          </Button>
          <ScanSmsDialog open={scanOpen} onOpenChange={setScanOpen} />
        </div>
      </div>

      {/* Time filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
        {TIME_PERIODS
          .filter((p) => p.value === "30d" || p.value === "all" || p.value === period || data?.hasOlderData)
          .map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.label}
            </button>
          ))}
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
          {/* Stats overview bar */}
          <Card className="overflow-hidden border-border/60">
            <div className="flex flex-col sm:flex-row">
              {/* Hero metric */}
              <div className="flex items-center gap-4 px-6 py-5 sm:border-r border-b sm:border-b-0 border-border/60 sm:min-w-[180px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-extrabold text-foreground leading-none">{activeCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Active shipments</p>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="flex-1 flex items-center px-4 py-4 sm:px-6">
                <div className="flex flex-wrap gap-2 w-full">
                  {pills.map((p) => (
                    <Link key={p.label} href={p.href}>
                      <button className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-sm transition-all hover:shadow-sm hover:border-primary/30 hover:bg-accent/50 cursor-pointer group">
                        <span className={`h-2 w-2 rounded-full ${p.color} shrink-0`} />
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{p.label}</span>
                        <span className="font-bold text-foreground min-w-[1.25rem] text-center">{p.value}</span>
                      </button>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Total badge */}
              <div className="hidden sm:flex items-center px-6 border-l border-border/60">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground leading-none">{stats?.total ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Total</p>
                </div>
              </div>
            </div>
          </Card>

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
                    <Link href={`/packages?status=${section.status}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer">
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
