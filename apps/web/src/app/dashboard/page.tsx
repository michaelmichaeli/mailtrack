"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageCard } from "@/components/packages/package-card";
import { EmptyState } from "@/components/packages/empty-state";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, Truck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard(),
    retry: false,
  });

  const handleSync = async () => {
    try {
      const result = await api.syncEmails();
      if (result.ordersCreated > 0) {
        toast.success(`Found ${result.ordersCreated} new orders from ${result.emailsParsed} emails`);
      } else if (result.emailsParsed > 0) {
        toast.success(`Scanned ${result.emailsParsed} emails — no new orders found`);
      } else {
        toast.success("Sync complete — no new shipping emails found");
      }
      refetch();
    } catch {
      toast.error("Failed to sync emails. Connect your email first.");
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = data?.stats;
  const hasPackages = stats && stats.total > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Track all your orders and packages in one place</p>
        </div>
        <Button onClick={handleSync} variant="outline" disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Sync emails
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
          {/* Stats cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900">
                    <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.arrivingToday}</p>
                    <p className="text-xs text-muted-foreground">Arriving today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.inTransit}</p>
                    <p className="text-xs text-muted-foreground">In transit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Package className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.processing}</p>
                    <p className="text-xs text-muted-foreground">Processing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.delivered}</p>
                    <p className="text-xs text-muted-foreground">Delivered</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.exceptions}</p>
                    <p className="text-xs text-muted-foreground">Exceptions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order sections */}
          {data.arrivingToday.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                Arriving Today
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.arrivingToday.map((order: any) => (
                  <PackageCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}

          {data.inTransit.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-500" />
                In Transit
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.inTransit.map((order: any) => (
                  <PackageCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}

          {data.processing.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-500" />
                Processing / Awaiting Shipment
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.processing.map((order: any) => (
                  <PackageCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}

          {data.delivered.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Recently Delivered
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.delivered.map((order: any) => (
                  <PackageCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}

          {data.exceptions.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Exceptions
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.exceptions.map((order: any) => (
                  <PackageCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
