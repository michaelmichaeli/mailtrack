"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getCarrierDisplayName } from "@/lib/carrier-urls";
import { MapPin, ExternalLink } from "lucide-react";

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

export function PackageTable({ orders }: { orders: Order[] }) {
  const safeParse = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return []; }
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount == null) return "—";
    const sym = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
    return `${sym}${Number(amount).toFixed(2)}`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Merchant</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Items</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Tracking</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Carrier</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Location</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const pkg = order.package;
              const status = pkg?.status ?? order.status ?? "ORDERED";
              const orderItems = safeParse(order.items);
              const pkgItems = safeParse(pkg?.items);
              const items = orderItems.length > 0 ? orderItems : pkgItems;

              return (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {order.merchant}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {items.length > 0 ? (
                      <span className="text-secondary-foreground truncate block" title={items.join(", ")}>
                        {items[0]}{items.length > 1 && ` +${items.length - 1}`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {pkg ? (
                      <span className="font-mono text-xs text-foreground">{pkg.trackingNumber}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary-foreground whitespace-nowrap">
                    {pkg ? getCarrierDisplayName(pkg.carrier) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="status" status={status} />
                  </td>
                  <td className="px-4 py-3">
                    {pkg?.lastLocation ? (
                      <span className="flex items-center gap-1 text-secondary-foreground text-xs">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[120px]">{pkg.lastLocation}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary-foreground whitespace-nowrap">
                    {formatDate(order.orderDate)}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
