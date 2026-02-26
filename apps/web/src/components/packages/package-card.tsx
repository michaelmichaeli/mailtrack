"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PackageProgressBar } from "./package-progress-bar";
import { Package, MapPin, Clock, ExternalLink } from "lucide-react";

interface PackageCardProps {
  pkg: {
    id: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    estimatedDelivery: string | null;
    lastLocation: string | null;
    items: string | null;
    order: {
      merchant: string;
      shopPlatform: string;
      externalOrderId: string | null;
    };
    latestEvent?: {
      timestamp: string;
      description: string;
      location: string | null;
    } | null;
  };
}

export function PackageCard({ pkg }: PackageCardProps) {
  const items = pkg.items ? JSON.parse(pkg.items) : [];
  const itemText = items.length > 0 ? items[0] : `Package from ${pkg.order.merchant}`;

  return (
    <Link href={`/packages/${pkg.id}`}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{pkg.order.merchant}</p>
              <p className="text-xs text-muted-foreground">{pkg.carrier} · {pkg.trackingNumber}</p>
            </div>
          </div>
          <Badge variant="status" status={pkg.status} />
        </div>

        <p className="text-sm text-foreground mb-3 line-clamp-1">{itemText}</p>

        <PackageProgressBar status={pkg.status} />

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {pkg.lastLocation && (
              <>
                <MapPin className="h-3 w-3" />
                <span>{pkg.lastLocation}</span>
              </>
            )}
          </div>
          {pkg.estimatedDelivery && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>ETA: {new Date(pkg.estimatedDelivery).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
