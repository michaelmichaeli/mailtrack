"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageProgressBar } from "@/components/packages/package-progress-bar";
import { TrackingTimeline } from "@/components/packages/tracking-timeline";
import { ArrowLeft, RefreshCw, ExternalLink, MapPin, Clock, DollarSign, Store } from "lucide-react";
import { toast } from "sonner";

export default function PackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: pkg, isLoading } = useQuery({
    queryKey: ["package", id],
    queryFn: () => api.getPackage(id),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshPackage(id),
    onSuccess: () => {
      toast.success("Tracking info refreshed");
      queryClient.invalidateQueries({ queryKey: ["package", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Failed to refresh tracking"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Package not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const items = pkg.items ? JSON.parse(pkg.items) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Package Details</h1>
            <p className="text-muted-foreground">{pkg.trackingNumber}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh tracking
        </Button>
      </div>

      {/* Status overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{pkg.order.merchant}</span>
            </div>
            <Badge variant="status" status={pkg.status} />
          </div>

          <PackageProgressBar status={pkg.status} className="mb-6" />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Carrier</p>
              <p className="text-sm font-medium">{pkg.carrier}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last location</p>
              <p className="text-sm font-medium flex items-center gap-1">
                {pkg.lastLocation ? (
                  <>
                    <MapPin className="h-3 w-3" />
                    {pkg.lastLocation}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated delivery</p>
              <p className="text-sm font-medium flex items-center gap-1">
                {pkg.estimatedDelivery ? (
                  <>
                    <Clock className="h-3 w-3" />
                    {new Date(pkg.estimatedDelivery).toLocaleDateString()}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Order total</p>
              <p className="text-sm font-medium flex items-center gap-1">
                {pkg.order.totalAmount ? (
                  <>
                    <DollarSign className="h-3 w-3" />
                    {pkg.order.totalAmount} {pkg.order.currency}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tracking timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tracking History</CardTitle>
          </CardHeader>
          <CardContent>
            <TrackingTimeline events={pkg.events} />
          </CardContent>
        </Card>

        {/* Order details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Platform</p>
              <p className="text-sm font-medium">{pkg.order.shopPlatform}</p>
            </div>
            {pkg.order.externalOrderId && (
              <div>
                <p className="text-xs text-muted-foreground">Order ID</p>
                <p className="text-sm font-medium font-mono">{pkg.order.externalOrderId}</p>
              </div>
            )}
            {pkg.order.orderDate && (
              <div>
                <p className="text-xs text-muted-foreground">Order date</p>
                <p className="text-sm font-medium">{new Date(pkg.order.orderDate).toLocaleDateString()}</p>
              </div>
            )}
            {items.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Items</p>
                <ul className="space-y-1">
                  {items.map((item: string, i: number) => (
                    <li key={i} className="text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
