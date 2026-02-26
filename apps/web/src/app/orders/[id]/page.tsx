"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageProgressBar } from "@/components/packages/package-progress-bar";
import { TrackingTimeline } from "@/components/packages/tracking-timeline";
import { ArrowLeft, RefreshCw, MapPin, Clock, DollarSign, Store, Package, ShoppingBag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { getCarrierTrackingUrl } from "@/lib/carrier-urls";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.getOrder(id),
  });

  // Track which package is currently refreshing
  const [refreshingPkgId, setRefreshingPkgId] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: (pkgId: string) => {
      setRefreshingPkgId(pkgId);
      return api.refreshPackage(pkgId);
    },
    onSuccess: () => {
      toast.success("Tracking info refreshed");
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setRefreshingPkgId(null);
    },
    onError: () => {
      toast.error("Failed to refresh tracking");
      setRefreshingPkgId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const formattedDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString()
    : null;
  const formattedAmount =
    order.totalAmount != null
      ? `${order.currency === "EUR" ? "€" : order.currency === "GBP" ? "£" : "$"}${Number(order.totalAmount).toFixed(2)}`
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Order Details</h1>
          <p className="text-muted-foreground">{order.merchant}</p>
        </div>
      </div>

      {/* Order info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Order Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Merchant</p>
              <p className="text-sm font-medium">{order.merchant}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Platform</p>
              <p className="text-sm font-medium">{order.shopPlatform}</p>
            </div>
            {order.externalOrderId && (
              <div>
                <p className="text-xs text-muted-foreground">Order ID</p>
                <p className="text-sm font-medium font-mono">{order.externalOrderId}</p>
              </div>
            )}
            {formattedDate && (
              <div>
                <p className="text-xs text-muted-foreground">Order Date</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formattedDate}
                </p>
              </div>
            )}
            {formattedAmount && (
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formattedAmount}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Packages */}
      {order.packages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No packages yet — awaiting shipment</p>
          </CardContent>
        </Card>
      ) : (
        order.packages.map((pkg: any) => {
          const items = pkg.items ? JSON.parse(pkg.items) : [];
          const isRefreshing = refreshingPkgId === pkg.id && refreshMutation.isPending;
          const carrierUrl = getCarrierTrackingUrl(pkg.carrier, pkg.trackingNumber);

          return (
            <Card key={pkg.id}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {pkg.carrier} · {pkg.trackingNumber}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="status" status={pkg.status} />
                    {carrierUrl && (
                      <a href={carrierUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Track on {pkg.carrier}
                        </Button>
                      </a>
                    )}
                    {pkg.trackingNumber && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshMutation.mutate(pkg.id)}
                        disabled={refreshMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <PackageProgressBar status={pkg.status} />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
                </div>

                {/* Items — full text, no truncation */}
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

                {/* Tracking timeline */}
                {pkg.events.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Tracking History</p>
                    <TrackingTimeline events={pkg.events} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Related orders */}
      {order.relatedOrders && order.relatedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Orders (same tracking number)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.relatedOrders.map((ro: any) => (
                <Link key={ro.id} href={`/orders/${ro.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{ro.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {ro.shopPlatform}
                        {ro.externalOrderId ? ` · ${ro.externalOrderId}` : ""}
                      </p>
                    </div>
                    {ro.totalAmount != null && (
                      <span className="text-sm font-medium">
                        {ro.currency === "EUR" ? "€" : ro.currency === "GBP" ? "£" : "$"}
                        {Number(ro.totalAmount).toFixed(2)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
