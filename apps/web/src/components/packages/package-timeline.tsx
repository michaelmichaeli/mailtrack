"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getCarrierDisplayName } from "@/lib/carrier-urls";
import { Package, Navigation, ChevronRight, MapPin } from "lucide-react";

interface Order {
  id: string;
  merchant: string;
  shopPlatform: string;
  externalOrderId: string | null;
  orderDate: string | null;
  totalAmount: number | null;
  currency: string | null;
  items: string | null;
  status: string;
  effectiveDate?: string | null;
  package?: {
    id: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    estimatedDelivery: string | null;
    lastLocation: string | null;
    items: string | null;
    pickupLocation: string | null;
  } | null;
}

export function PackageTimeline({ orders }: { orders: Order[] }) {
  const safeParse = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return []; }
  };

  const safeParseObj = (v: any): any => {
    if (!v) return null;
    if (typeof v === "object") return v;
    try { return JSON.parse(v); } catch { return null; }
  };

  // Group by date
  const getDateKey = (order: Order) => {
    const d = order.effectiveDate || order.orderDate;
    if (!d) return "Unknown date";
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const grouped: Record<string, Order[]> = {};
  const dateOrder: string[] = [];

  // Sort orders by date descending
  const sorted = [...orders].sort((a, b) => {
    const da = a.effectiveDate || a.orderDate || "";
    const db = b.effectiveDate || b.orderDate || "";
    return db.localeCompare(da);
  });

  for (const order of sorted) {
    const key = getDateKey(order);
    if (!grouped[key]) {
      grouped[key] = [];
      dateOrder.push(key);
    }
    grouped[key].push(order);
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

      <div className="space-y-8">
        {dateOrder.map((dateKey) => (
          <div key={dateKey} className="relative">
            {/* Date marker */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm shrink-0">
                <span className="text-xs font-bold text-primary-foreground">
                  {grouped[dateKey].length}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">{dateKey}</h3>
            </div>

            {/* Orders for this date */}
            <div className="ml-[19px] pl-8 space-y-3 border-l border-transparent">
              {grouped[dateKey].map((order) => {
                const pkg = order.package;
                const status = pkg?.status ?? order.status ?? "ORDERED";
                const items = safeParse(order.items).length > 0 ? safeParse(order.items) : safeParse(pkg?.items);
                const pickup = safeParseObj(pkg?.pickupLocation);

                return (
                  <Link key={order.id} href={`/orders/${order.id}`} className="block">
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all group">
                      {/* Icon */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shrink-0">
                        <Package className="h-5 w-5 text-accent-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{order.merchant}</p>
                          <Badge variant="status" status={status} />
                        </div>

                        {items.length > 0 && (
                          <p className="text-xs text-secondary-foreground line-clamp-1 mb-1">
                            {items.slice(0, 2).join(", ")}{items.length > 2 && ` +${items.length - 2} more`}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {pkg && (
                            <span className="font-mono">{getCarrierDisplayName(pkg.carrier)} · {pkg.trackingNumber}</span>
                          )}
                          {pkg?.lastLocation && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {pkg.lastLocation}
                            </span>
                          )}
                        </div>

                        {pickup && (
                          <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: '#047857', color: '#ffffff' }}>
                            <Navigation className="h-3 w-3" />
                            Ready for pickup
                          </div>
                        )}
                      </div>

                      {/* Amount + Arrow */}
                      <div className="flex items-center gap-3 shrink-0">
                        {order.totalAmount != null && (
                          <span className="text-sm font-semibold text-foreground">
                            {order.currency === "EUR" ? "€" : order.currency === "GBP" ? "£" : "$"}
                            {Number(order.totalAmount).toFixed(2)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No packages to display
        </div>
      )}
    </div>
  );
}
