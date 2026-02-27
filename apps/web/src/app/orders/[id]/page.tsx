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
import { ArrowLeft, RefreshCw, MapPin, Clock, DollarSign, Store, Package, ShoppingBag, ExternalLink, ChevronRight, Navigation, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { getCarrierTrackingUrl, getCarrierDisplayName } from "@/lib/carrier-urls";
import { CopyButton } from "@/components/ui/copy-button";

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

  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const result = await api.deleteOrder(id);
      return result;
    },
    onSuccess: () => {
      toast.success("Order deleted");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push("/packages");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to delete order");
      setConfirmDelete(false);
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
  // Merge broken line continuations from truncated email parsing
  const rawItems = [...orderItems, ...pkgItems]
    .map(s => s.trim())
    .filter(s => s && !/^Scanned from/i.test(s));
  const allItems: string[] = [];
  for (const item of rawItems) {
    if (!allItems.length) { allItems.push(item); continue; }
    const prev = allItems[allItems.length - 1];
    const isContinuation =
      // starts lowercase → continuation
      /^[a-z]/.test(item) ||
      // pure size/dimension/qty spec (e.g. "900x400x2mm", "52cm, 50pcs", "EU39-45")
      /^\d+(\.\d+)?\s*(x\d|cm|mm|m|pcs|pairs?|pieces?|inch)/i.test(item) ||
      // color/size variant line (e.g. "Red Black, 5pcs", "6 pairs white, EU39-45")
      /^\d+\s*pairs?\b/i.test(item) ||
      // very short fragment
      item.length < 8 ||
      // previous line looks truncated (ends mid-word: last word ≤3 chars and not a normal ending)
      /\s\S{1,3}$/.test(prev) && !/\d$/.test(prev) && !/[.!),]$/.test(prev);
    if (isContinuation) {
      allItems[allItems.length - 1] = prev + " " + item;
    } else {
      allItems.push(item);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{order.merchant}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="status" status={order.status ?? "ORDERED"} />
            {order.externalOrderId && !order.externalOrderId.startsWith("gmail-") && (
              <span className="text-xs text-muted-foreground font-mono">#{order.externalOrderId}</span>
            )}
          </div>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-destructive font-medium">Delete?</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs cursor-pointer"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Yes"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs cursor-pointer"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              No
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
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
            <ul className="space-y-1">
              {allItems.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0 mt-[7px]" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tracking & Shipment — all packages merged */}
      {order.packages.length > 0 ? (
        <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Tracking & Shipment
                {order.packages.length > 1 && (
                  <span className="text-xs font-normal text-muted-foreground">({order.packages.length} shipments)</span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-0">
            {/* Progress bar — use most advanced status */}
            <PackageProgressBar status={(() => {
              const statusOrder = ["ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
              let best = order.status ?? "ORDERED";
              for (const pkg of order.packages) {
                const idx = statusOrder.indexOf(pkg.status);
                if (idx > statusOrder.indexOf(best)) best = pkg.status;
              }
              return best;
            })()} />

            {/* Per-shipment tracking info */}
            {order.packages.map((pkg: any, pkgIdx: number) => {
              const isRefreshing = refreshingPkgId === pkg.id && refreshMutation.isPending;
              const carrierUrl = getCarrierTrackingUrl(pkg.carrier, pkg.trackingNumber);

              return (
                <div key={pkg.id} className={pkgIdx > 0 ? "border-t border-border pt-5" : ""}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="status" status={pkg.status} />
                      {order.packages.length > 1 && (
                        <span className="text-xs text-muted-foreground">Shipment {pkgIdx + 1}</span>
                      )}
                    </div>
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

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tracking</p>
                      <p className="text-sm font-medium font-mono text-foreground mt-0.5 flex items-center gap-1">
                        {pkg.trackingNumber}
                        <CopyButton value={pkg.trackingNumber} />
                      </p>
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
                    <a href={carrierUrl} target="_blank" rel="noopener noreferrer" className="block mt-3">
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Track on {getCarrierDisplayName(pkg.carrier)}
                      </Button>
                    </a>
                  )}
                </div>
              );
            })}

            {/* Merged tracking timeline — all events from all packages */}
            {(() => {
              const allEvents = order.packages
                .flatMap((pkg: any) => pkg.events.map((e: any) => ({
                  ...e,
                  carrier: pkg.carrier,
                  trackingNumber: pkg.trackingNumber,
                })))
                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

              if (allEvents.length === 0) return null;

              return (
                <div className="border-t border-border pt-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-4">Tracking History</p>
                  <TrackingTimeline events={allEvents} />
                </div>
              );
            })()}

            {/* Location Journey — extracted from all packages' events */}
            {(() => {
              const locations = order.packages
                .flatMap((pkg: any) => pkg.events
                  .filter((e: any) => e.location)
                  .map((e: any) => ({
                    location: e.location,
                    timestamp: e.timestamp,
                    description: e.description,
                  }))
                )
                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

              const unique: typeof locations = [];
              const seen = new Set<string>();
              for (const loc of locations) {
                const key = loc.location.toLowerCase();
                if (!seen.has(key)) {
                  seen.add(key);
                  unique.push(loc);
                }
              }

              const fallbackLocation = order.packages.find((p: any) => p.lastLocation)?.lastLocation;
              if (unique.length === 0 && !fallbackLocation) return null;

              const allLocations = unique.length > 0 ? unique : (fallbackLocation ? [{ location: fallbackLocation, timestamp: order.updatedAt, description: "Last known location" }] : []);
              if (allLocations.length === 0) return null;

              return (
                <div className="border-t border-border pt-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Location Journey
                  </p>
                  <div className="space-y-0">
                    {allLocations.map((loc: any, idx: number) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-3 w-3 rounded-full border-2 shrink-0 ${idx === 0 ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"}`} />
                          {idx < allLocations.length - 1 && (
                            <div className="w-0.5 flex-1 bg-muted-foreground/20 min-h-[28px]" />
                          )}
                        </div>
                        <div className="pb-4 min-w-0">
                          <p className="text-sm font-medium text-foreground" dir="auto">{loc.location}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(loc.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            {" · "}
                            {new Date(loc.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg overflow-hidden border border-border">
                    <iframe
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(allLocations[0].location)}&output=embed&z=12`}
                      className="w-full h-44"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      title="Package location"
                    />
                    <div className="p-2 bg-muted/30">
                      <a
                        href={`https://www.google.com/maps/dir/${allLocations.map((l: any) => encodeURIComponent(l.location)).join("/")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                          <Navigation className="h-3 w-3" />
                          View Full Route on Maps
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Pickup Location — from any package that has one */}
        {(() => {
          const pkgWithPickup = order.packages.find((p: any) => p.pickupLocation);
          if (!pkgWithPickup) return null;
          let pickup: any = null;
          try {
            pickup = typeof pkgWithPickup.pickupLocation === 'string'
              ? JSON.parse(pkgWithPickup.pickupLocation)
              : pkgWithPickup.pickupLocation;
          } catch { return null; }
          if (!pickup) return null;

          return (
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
                {pickup.pickupCode && (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                      <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Pickup Code</p>
                      <p className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-widest flex items-center gap-2">
                        {pickup.pickupCode}
                        <CopyButton value={pickup.pickupCode} />
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {pickup.address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Address</p>
                        <p className="text-sm font-medium text-foreground mt-0.5 leading-relaxed flex items-start gap-1 break-words overflow-hidden" dir="auto">
                          <span className="flex-1 break-words">{pickup.address}</span>
                          <CopyButton value={pickup.address} className="mt-0.5" />
                        </p>
                      </div>
                    </div>
                  )}

                  {pickup.phone && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          <a href={`tel:${pickup.phone}`} className="hover:underline">{pickup.phone}</a>
                        </p>
                      </div>
                    </div>
                  )}

                  {(pickup.weekdayText || pickup.hours) && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Opening Hours</p>
                          {pickup.openNow != null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              pickup.openNow
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                            }`}>
                              {pickup.openNow ? "Open now" : "Closed"}
                            </span>
                          )}
                        </div>
                        {pickup.weekdayText ? (
                          <div className="mt-1 space-y-0.5">
                            {pickup.weekdayText.map((line: string, i: number) => {
                              const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                              const isToday = line.startsWith(today);
                              return (
                                <p key={i} className={`text-xs leading-relaxed ${
                                  isToday ? "font-bold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                                }`}>
                                  {line}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5 leading-relaxed whitespace-pre-line" dir="auto">{pickup.hours}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {pickup.verificationCode && (
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Verification Code</p>
                      <p className="text-sm font-mono font-bold text-foreground mt-0.5 flex items-center gap-1">
                        {pickup.verificationCode}
                        <CopyButton value={pickup.verificationCode} />
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>

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
          );
        })()}
        </div>
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
