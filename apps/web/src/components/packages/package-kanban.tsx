"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getCarrierDisplayName } from "@/lib/carrier-urls";
import { Package, ChevronRight, Navigation } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

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
  { status: "ORDERED", color: "bg-slate-500" },
  { status: "PROCESSING", color: "bg-slate-500" },
  { status: "SHIPPED", color: "bg-blue-500" },
  { status: "IN_TRANSIT", color: "bg-indigo-500" },
  { status: "OUT_FOR_DELIVERY", color: "bg-purple-500" },
  { status: "PICKED_UP", color: "bg-teal-500" },
  { status: "DELIVERED", color: "bg-emerald-500" },
  { status: "EXCEPTION", color: "bg-amber-500" },
  { status: "RETURNED", color: "bg-red-500" },
];

export function PackageKanban({ orders }: { orders: Order[] }) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "he" ? "he-IL" : locale === "ar" ? "ar" : locale === "ru" ? "ru-RU" : "en-US";
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

  const grouped: Record<string, Order[]> = {};
  for (const col of KANBAN_COLUMNS) grouped[col.status] = [];
  for (const order of orders) {
    const status = getEffectiveStatus(order);
    if (grouped[status]) grouped[status].push(order);
    else grouped["ORDERED"].push(order);
  }

  const activeColumns = KANBAN_COLUMNS.filter(
    (col) => grouped[col.status].length > 0
  );

  if (activeColumns.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("kanban.noPackages")}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto -mx-6 px-6 lg:-mx-8 lg:px-8 pb-4">
      {activeColumns.map((col) => (
        <div
          key={col.status}
          className="flex-shrink-0 w-72 rounded-xl bg-muted/40 border border-border/50"
        >
          {/* Column header */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border/50">
            <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
            <h3 className="text-sm font-semibold text-foreground">{t(`status.${col.status}` as TranslationKey)}</h3>
            <span className="ml-auto text-xs font-medium text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 border border-border/50">
              {grouped[col.status].length}
            </span>
          </div>

          {/* Card list */}
          <div className="p-2 space-y-2">
            {grouped[col.status].map((order) => {
              const pkg = order.package;
              const items = safeParse(order.items).length > 0 ? safeParse(order.items) : safeParse(pkg?.items);
              const pickup = safeParseObj(pkg?.pickupLocation);

              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="p-3 active:bg-muted/30 transition-all cursor-pointer group bg-card">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent shrink-0">
                          <Package className="h-3.5 w-3.5 text-accent-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{order.merchant}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 rtl:rotate-180" />
                    </div>

                    {items.length > 0 && (
                      <p className="text-xs text-secondary-foreground line-clamp-1 mb-1.5 pl-9">
                        {items[0]}{items.length > 1 && ` +${items.length - 1}`}
                      </p>
                    )}

                    {pkg && (
                      <p className="text-[11px] font-mono text-muted-foreground truncate pl-9">
                        {getCarrierDisplayName(pkg.carrier)} · {pkg.trackingNumber}
                      </p>
                    )}

                    {pickup && ((!pickup.carrierOnly && pickup.address) || pkg?.status === "DELIVERED") && (
                      <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md text-xs bg-emerald-600 text-white">
                        <Navigation className="h-3 w-3 shrink-0" />
                        <span className="truncate">{pkg?.status === "DELIVERED" ? t("card.pickedUp") : t("card.pickupReady")}</span>
                      </div>
                    )}

                    {order.orderDate && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-9">
                        {new Date(order.orderDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
