"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PackageCard } from "@/components/packages/package-card";
import { EmptyState } from "@/components/packages/empty-state";
import { PackageCardSkeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ORDERED", label: "Ordered" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "EXCEPTION", label: "Exception" },
  { value: "RETURNED", label: "Returned" },
];

export default function PackagesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), limit: "12" };
  if (query) params.query = query;
  if (status) params.status = status;

  const { data, isLoading } = useQuery({
    queryKey: ["packages", params],
    queryFn: () => api.getPackages(params),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Search and filter all your orders and packages</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by merchant, tracking number, or item..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={query || status ? "Try adjusting your search or filters" : "Connect your email to start tracking orders"}
          action={!query && !status ? { label: "Connect email", href: "/settings" } : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((order: any) => (
              <PackageCard key={order.id} order={order} />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} · {data.total} orders
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
