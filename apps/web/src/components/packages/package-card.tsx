"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PackageProgressBar } from "./package-progress-bar";
import { Package, MapPin, Clock, ShoppingBag, Store, ExternalLink } from "lucide-react";
import { getCarrierTrackingUrl } from "@/lib/carrier-urls";

interface OrderCardProps {
  order: {
    id: string;
    merchant: string;
    shopPlatform: string;
    externalOrderId: string | null;
    orderDate: string | null;
    totalAmount: number | null;
    currency: string | null;
    package?: {
      id: string;
      trackingNumber: string;
      carrier: string;
      status: string;
      estimatedDelivery: string | null;
      lastLocation: string | null;
      items: string | null;
    } | null;
  };
}

export function PackageCard({ order }: OrderCardProps) {
  const pkg = order.package;
  const items = pkg?.items ? JSON.parse(pkg.items) : [];
  const itemText = items.length > 0 ? items[0] : null;
  const status = pkg?.status ?? "ORDERED";

  const formattedDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const formattedAmount =
    order.totalAmount != null
      ? `${order.currency === "EUR" ? "€" : order.currency === "GBP" ? "£" : "$"}${order.totalAmount.toFixed(2)}`
      : null;

  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              {pkg ? (
                <Package className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {order.merchant}
                {order.externalOrderId && !order.externalOrderId.startsWith("gmail-") && (
                  <span className="text-xs text-muted-foreground ml-1.5 font-normal">
                    #{order.externalOrderId.slice(-8)}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {pkg
                  ? `${pkg.carrier} · ${pkg.trackingNumber}`
                  : "Awaiting shipment"}
              </p>
            </div>
          </div>
          <Badge variant="status" status={status} />
        </div>

        {itemText && (
          <p className="text-sm text-foreground mb-2 line-clamp-2">{itemText}</p>
        )}

        {pkg && <PackageProgressBar status={pkg.status} />}

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {pkg?.lastLocation ? (
              <>
                <MapPin className="h-3 w-3" />
                <span>{pkg.lastLocation}</span>
              </>
            ) : formattedDate ? (
              <>
                <Clock className="h-3 w-3" />
                <span>Ordered {formattedDate}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {formattedAmount && (
              <span className="font-medium">{formattedAmount}</span>
            )}
            {pkg?.estimatedDelivery && (
              <>
                <Clock className="h-3 w-3 ml-2" />
                <span>ETA: {new Date(pkg.estimatedDelivery).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
