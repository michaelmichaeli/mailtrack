"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCarrierDisplayName } from "@/lib/carrier-urls";
import { Package, ChevronRight, Navigation } from "lucide-react";

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

const KANBAN_COLUMNS = [
  { status: "ORDERED", label: "Ordered", color: "bg-slate-500" },
  { status: "PROCESSING", label: "Processing", color: "bg-slate-500" },
  { status: "SHIPPED", label: "Shipped", color: "bg-blue-500" },
  { status: "IN_TRANSIT", label: "In Transit", color: "bg-indigo-500" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery", color: "bg-purple-500" },
  { status: "DELIVERED", label: "Delivered", color: "bg-emerald-500" },
  { status: "EXCEPTION", label: "Exception", color: "bg-amber-500" },
  { status: "RETURNED", label: "Returned", color: "bg-red-500" },
];

export function PackageKanban({ orders }: { orders: Order[] }) {
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

  const getEffectiveStatus = (order: Order) => order.package?.status ?? order.status ?? "ORDERED";

  // Group by status
  const grouped: Record<string, Order[]> = {};
  for (const col of KANBAN_COLUMNS) grouped[col.status] = [];
  for (const order of orders) {
    const status = getEffectiveStatus(order);
    if (grouped[status]) grouped[status].push(order);
    else grouped["ORDERED"].push(order);
  }

  // Only show columns that have items or are key milestones
  const activeColumns = KANBAN_COLUMNS.filter(
    (col) => grouped[col.status].length > 0
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
      {activeColumns.map((col) => (
        <div key={col.status} className="flex-shrink-0 w-72">
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
            <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {grouped[col.status].length}
            </span>
          </div>

          {/* Column cards */}
          <div className="space-y-2">
            {grouped[col.status].map((order) => {
              const pkg = order.package;
              const items = safeParse(order.items).length > 0 ? safeParse(order.items) : safeParse(pkg?.items);
              const pickup = safeParseObj(pkg?.pickupLocation);

              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="p-3 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent shrink-0">
                          <Package className="h-3.5 w-3.5 text-accent-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{order.merchant}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>

                    {items.length > 0 && (
                      <p className="text-xs text-secondary-foreground line-clamp-1 mb-2">
                        {items[0]}{items.length > 1 && ` +${items.length - 1}`}
                      </p>
                    )}

                    {pkg && (
                      <p className="text-[11px] font-mono text-muted-foreground truncate mb-1">
                        {getCarrierDisplayName(pkg.carrier)} · {pkg.trackingNumber}
                      </p>
                    )}

                    {pickup && (
                      <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md text-xs" style={{ backgroundColor: '#047857', color: '#ffffff' }}>
                        <Navigation className="h-3 w-3 shrink-0" />
                        <span className="truncate">Pickup ready</span>
                      </div>
                    )}

                    {order.orderDate && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {new Date(order.orderDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {activeColumns.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
          No packages to display
        </div>
      )}
    </div>
  );
}
