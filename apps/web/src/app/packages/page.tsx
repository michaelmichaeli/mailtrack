"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PackageCard } from "@/components/packages/package-card";
import { EmptyState } from "@/components/packages/empty-state";
import { PackageCardSkeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

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

function PackagesContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const observerRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["packages", query, status],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, string> = { page: String(pageParam), limit: "12" };
      if (query) params.query = query;
      if (status) params.status = status;
      return api.getPackages(params);
    },
    getNextPageParam: (lastPage: any) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const allItems = data?.pages.flatMap((p: any) => p.items) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Search and filter all your orders and packages</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by merchant, tracking number, or item…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {!isLoading && totalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {allItems.length} of {totalCount} orders
        </p>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
          {Array.from({ length: 6 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={query || status ? "Try adjusting your search or filters" : "Connect your email to start tracking orders"}
          action={!query && !status ? { label: "Connect email", href: "/settings" } : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
            {allItems.map((order: any) => (
              <PackageCard key={order.id} order={order} />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={observerRef} className="flex justify-center py-4">
            {isFetchingNextPage && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense>
      <PackagesContent />
    </Suspense>
  );
}
