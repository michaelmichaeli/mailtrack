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
import { ArrowLeft, RefreshCw, MapPin, Clock, DollarSign, Store, Package, ShoppingBag, ExternalLink, ChevronRight, Navigation, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { getCarrierTrackingUrl, getCarrierDisplayName } from "@/lib/carrier-urls";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.getOrder(id),
  });

  const [refreshingPkgId, setRefreshingPkgId] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: (pkgId: string) => {
      setRefreshingPkgId(pkgId);
      return api.refreshPackage(pkgId);
    },
    onSuccess: (data: any) => {
      if (data?.updated) {
        toast.success("Tracking info updated from carrier");
      } else {
        toast.success("Tracking is up to date (based on email data)");
      }
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
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </div>
    );
  }

  const safeParse = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return []; }
  };

  const formattedDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const formattedAmount =
    order.totalAmount != null
      ? `${order.currency === "EUR" ? "€" : order.currency === "GBP" ? "£" : "$"}${Number(order.totalAmount).toFixed(2)}`
      : null;

  const orderItems = safeParse(order.items);
  const pkgItems: string[] = [];
  for (const pkg of order.packages) {
    for (const item of safeParse(pkg.items)) {
      if (!orderItems.includes(item) && !pkgItems.includes(item)) pkgItems.push(item);
    }
  }
  const allItems = [...orderItems, ...pkgItems];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{order.merchant}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="status" status={order.status ?? "ORDERED"} />
            {order.externalOrderId && !order.externalOrderId.startsWith("gmail-") && (
              <span className="text-xs text-muted-foreground font-mono">#{order.externalOrderId}</span>
            )}
          </div>
        </div>
      </div>

      {/* Order info grid */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Platform</p>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                {order.shopPlatform}
              </p>
            </div>
            {formattedDate && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Order Date</p>
                <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formattedDate}
                </p>
              </div>
            )}
            {formattedAmount && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</p>
                <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  {formattedAmount}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      {allItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Items ({allItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1.5">
              {allItems.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tracking & Shipment */}
      {order.packages.length > 0 ? (
        order.packages.map((pkg: any) => {
          const isRefreshing = refreshingPkgId === pkg.id && refreshMutation.isPending;
          const carrierUrl = getCarrierTrackingUrl(pkg.carrier, pkg.trackingNumber);

          let pickup: any = null;
          try {
            pickup = pkg.pickupLocation
              ? (typeof pkg.pickupLocation === 'string' ? JSON.parse(pkg.pickupLocation) : pkg.pickupLocation)
              : null;
          } catch {}

          return (
            <div key={pkg.id} className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Tracking & Shipment
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="status" status={pkg.status} />
                    {pkg.trackingNumber && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshMutation.mutate(pkg.id)}
                        disabled={refreshMutation.isPending}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-0">
                <PackageProgressBar status={pkg.status} />

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tracking</p>
                    <p className="text-sm font-medium font-mono text-foreground mt-0.5">{pkg.trackingNumber}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Carrier</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{getCarrierDisplayName(pkg.carrier)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 capitalize">{pkg.status.toLowerCase().replace(/_/g, " ")}</p>
                  </div>
                  {pkg.lastLocation && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Location</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {pkg.lastLocation}
                      </p>
                    </div>
                  )}
                  {pkg.estimatedDelivery && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Est. Delivery</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(pkg.estimatedDelivery).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  )}
                </div>

                {carrierUrl && (
                  <a href={carrierUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Track on {getCarrierDisplayName(pkg.carrier)}
                    </Button>
                  </a>
                )}

                {/* Tracking timeline */}
                {pkg.events.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Tracking History</p>
                    <TrackingTimeline events={pkg.events} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pickup Location — separate prominent card */}
            {pickup && (
              <Card className="overflow-hidden border-emerald-200 dark:border-emerald-800/50">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 border-b border-emerald-200 dark:border-emerald-800/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                      <Navigation className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">📦 Ready for Pickup</p>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">Your package is waiting at the location below</p>
                    </div>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Pickup code — large and prominent */}
                  {pickup.pickupCode && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                        <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Pickup Code</p>
                        <p className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-widest">{pickup.pickupCode}</p>
                      </div>
                    </div>
                  )}

                  {/* Address and hours */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pickup.address && (
                      <div className="flex items-start gap-2.5">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Address</p>
                          <p className="text-sm font-medium text-foreground mt-0.5 leading-relaxed" dir="auto">{pickup.address}</p>
                        </div>
                      </div>
                    )}
                    {pickup.hours && (
                      <div className="flex items-start gap-2.5">
                        <Clock className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Opening Hours</p>
                          <p className="text-sm font-medium text-foreground mt-0.5 leading-relaxed" dir="auto">{pickup.hours}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {pickup.verificationCode && (
                    <div className="flex items-center gap-2.5">
                      <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Verification Code</p>
                        <p className="text-sm font-mono font-bold text-foreground mt-0.5">{pickup.verificationCode}</p>
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Embedded map */}
                {pickup.address && (
                  <div className="border-t border-emerald-200 dark:border-emerald-800/50">
                    <iframe
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(pickup.address)}&output=embed&z=15`}
                      className="w-full h-56"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      title="Pickup location map"
                    />
                    <div className="p-3 bg-muted/30">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm" className="w-full text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                          <Navigation className="h-3.5 w-3.5" />
                          Get Directions
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </Card>
            )}
            </div>
          );
        })
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Tracking & Shipment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <PackageProgressBar status={order.status ?? "ORDERED"} />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="text-sm font-medium text-foreground mt-0.5 capitalize">
                  {(order.status ?? "ORDERED").toLowerCase().replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tracking</p>
                <p className="text-sm text-muted-foreground mt-0.5">Not found in emails</p>
              </div>
            </div>

            {order.externalOrderId && !order.externalOrderId.startsWith("gmail-") && order.shopPlatform === "ALIEXPRESS" && (
              <a
                href={`https://www.aliexpress.com/p/order/detail.html?orderId=${order.externalOrderId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View order on AliExpress
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Related orders */}
      {order.relatedOrders && order.relatedOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Related Orders</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {order.relatedOrders.map((ro: any) => (
                <Link key={ro.id} href={`/orders/${ro.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{ro.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {ro.shopPlatform}
                        {ro.externalOrderId ? ` · ${ro.externalOrderId}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ro.totalAmount != null && (
                        <span className="text-sm font-medium text-foreground">
                          {ro.currency === "EUR" ? "€" : ro.currency === "GBP" ? "£" : "$"}
                          {Number(ro.totalAmount).toFixed(2)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
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
