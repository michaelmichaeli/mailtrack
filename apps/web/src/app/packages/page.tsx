"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PackageCard } from "@/components/packages/package-card";
import { EmptyState } from "@/components/packages/empty-state";
import { PackageCardSkeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Calendar } from "lucide-react";

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

const TIME_PERIODS = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "3 months", days: 90 },
  { value: "180d", label: "6 months", days: 180 },
  { value: "365d", label: "1 year", days: 365 },
  { value: "all", label: "All time", days: 0 },
];

function PackagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get("status") ?? "";
  const initialPeriod = searchParams.get("period") ?? "30d";
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState(initialPeriod);
  const observerRef = useRef<HTMLDivElement>(null);

  // Sync filters to URL search params so they survive refresh
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (period && period !== "30d") params.set("period", period);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/packages", { scroll: false });
  }, [query, status, period, router]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["packages", query, status, period],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, string> = { page: String(pageParam), limit: "12" };
      if (query) params.query = query;
      if (status) params.status = status;
      if (period !== "all") {
        const days = TIME_PERIODS.find((p) => p.value === period)?.days ?? 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        params.dateFrom = since;
      }
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

      {/* Time filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
        {TIME_PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p.label}
          </button>
        ))}
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

          {/* Infinite scroll trigger with loading skeletons */}
          <div ref={observerRef} className="py-2">
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog mt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <PackageCardSkeleton key={`loading-${i}`} />
                ))}
              </div>
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
