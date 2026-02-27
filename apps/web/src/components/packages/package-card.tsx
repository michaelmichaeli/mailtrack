"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PackageProgressBar } from "./package-progress-bar";
import { Package, MapPin, Clock, ShoppingBag, ChevronRight, Hash, Navigation } from "lucide-react";
import { getCarrierDisplayName } from "@/lib/carrier-urls";

interface OrderCardProps {
  order: {
    id: string;
    merchant: string;
    shopPlatform: string;
    externalOrderId: string | null;
    orderDate: string | null;
    totalAmount: number | null;
    currency: string | null;
    items: string | null;
    status: string;
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
  };
}

export function PackageCard({ order }: OrderCardProps) {
  const pkg = order.package;

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

  const orderItems = safeParse(order.items);
  const pkgItems = safeParse(pkg?.items);
  const items: string[] = orderItems.length > 0 ? orderItems : pkgItems;
  const status = pkg?.status ?? order.status ?? "ORDERED";
  const pickup = safeParseObj(pkg?.pickupLocation);

  const formattedDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const formattedAmount =
    order.totalAmount != null
      ? `${order.currency === "EUR" ? "€" : order.currency === "GBP" ? "£" : "$"}${Number(order.totalAmount).toFixed(2)}`
      : null;

  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="flex flex-col h-full p-4 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
        {/* Row 1: Merchant + badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shrink-0">
              {pkg ? (
                <Package className="h-4 w-4 text-accent-foreground" />
              ) : (
                <ShoppingBag className="h-4 w-4 text-accent-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{order.merchant}</p>
              <p className="text-xs text-muted-foreground truncate">
                {pkg
                  ? `${getCarrierDisplayName(pkg.carrier)} · ${pkg.trackingNumber}`
                  : status === "DELIVERED"
                  ? "Delivered"
                  : status === "SHIPPED" || status === "IN_TRANSIT"
                  ? "Shipped — tracking pending"
                  : "Awaiting shipment"}
              </p>
            </div>
          </div>
          <Badge variant="status" status={status} className="shrink-0" />
        </div>

        {/* Row 2: Items list */}
        <div className="flex-1 mb-3 min-h-[40px]">
          {items.length > 0 ? (
            <ul className="space-y-1">
              {items.slice(0, 2).map((item: string, i: number) => (
                <li key={i} className="flex items-baseline gap-1.5 text-sm text-secondary-foreground leading-tight">
                  <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0 translate-y-[-1px]" />
                  <span className="line-clamp-1">{item}</span>
                </li>
              ))}
              {items.length > 2 && (
                <li className="text-xs text-muted-foreground pl-3">+{items.length - 2} more</li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No item details</p>
          )}
        </div>

        {/* Pickup location banner */}
        {pickup && (
          <div className="flex items-start gap-2 mb-3 px-2.5 py-2 rounded-lg border" style={{ backgroundColor: '#047857', borderColor: '#065f46' }}>
            <Navigation className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#ffffff' }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium" style={{ color: '#ffffff' }}>Ready for pickup</p>
              <p className="text-[11px] truncate" style={{ color: '#d1fae5' }}>{pickup.address}</p>
            </div>
          </div>
        )}

        {/* Row 3: Progress */}
        <div className="mb-3">
          <PackageProgressBar status={status} />
        </div>

        {/* Row 4: Footer meta */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formattedDate}
              </span>
            )}
            {order.externalOrderId && !order.externalOrderId.startsWith("gmail-") && (
              <span className="flex items-center gap-1 font-mono">
                <Hash className="h-3 w-3" />
                {order.externalOrderId.slice(-6)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {formattedAmount && (
              <span className="text-xs font-semibold text-foreground">{formattedAmount}</span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
