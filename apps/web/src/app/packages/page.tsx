"use client";

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PackageCard } from "@/components/packages/package-card";
import { PackageTable } from "@/components/packages/package-table";
import { PackageKanban } from "@/components/packages/package-kanban";
import { PackageTimeline } from "@/components/packages/package-timeline";
import { EmptyState } from "@/components/packages/empty-state";
import { PackageCardSkeleton } from "@/components/ui/skeleton";
import { PageTransition, StaggerContainer, StaggerItem, FadeIn } from "@/components/ui/motion";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Calendar, LayoutGrid, Table2, Columns3, Clock, X } from "lucide-react";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

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

const VIEW_MODES = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "table", label: "Table", icon: Table2 },
  { value: "kanban", label: "Board", icon: Columns3 },
  { value: "timeline", label: "Timeline", icon: Clock },
] as const;

type ViewMode = typeof VIEW_MODES[number]["value"];

function PackagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get("status") ?? "";
  const initialPeriod = searchParams.get("period") ?? "30d";
  const initialQuery = searchParams.get("q") ?? "";
  const initialView = (searchParams.get("view") as ViewMode) || "grid";
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useState<ViewMode>(initialView);
  const observerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Sync filters to URL search params so they survive refresh
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (status) params.set("status", status);
    if (period && period !== "30d") params.set("period", period);
    if (view && view !== "grid") params.set("view", view);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/packages", { scroll: false });
  }, [debouncedQuery, status, period, view, router]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["packages", debouncedQuery, status, period, view],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, string> = { page: String(pageParam), limit: view === "kanban" || view === "timeline" ? "50" : "12" };
      if (debouncedQuery) params.query = debouncedQuery;
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
    <PageTransition className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Search and filter all your orders and packages</p>
        </div>
      </FadeIn>

      {/* Search & Filter */}
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, tracking number, or item…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </FadeIn>

      {/* Time filter */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
          {TIME_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer ${
                period === p.value
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-105"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* View switcher + Results count */}
      <FadeIn delay={0.15}>
        <div className="flex items-center justify-between">
          {!isLoading && totalCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {allItems.length} of {totalCount} orders
            </p>
          )}
          {isLoading && <div />}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.value}
                  onClick={() => setView(mode.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 cursor-pointer ${
                    view === mode.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={mode.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
          {Array.from({ length: 6 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <FadeIn>
          <EmptyState
            title="No orders found"
            description={query || status ? "Try adjusting your search or filters" : "Connect your email to start tracking orders"}
            action={!query && !status ? { label: "Connect email", href: "/settings" } : undefined}
          />
        </FadeIn>
      ) : (
        <>
          {view === "grid" && (
            <StaggerContainer className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
              {allItems.map((order: any) => (
                <StaggerItem key={order.id}>
                  <PackageCard order={order} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}

          {view === "table" && (
            <FadeIn>
              <PackageTable orders={allItems} />
            </FadeIn>
          )}

          {view === "kanban" && (
            <FadeIn>
              <PackageKanban orders={allItems} />
            </FadeIn>
          )}

          {view === "timeline" && (
            <FadeIn>
              <PackageTimeline orders={allItems} />
            </FadeIn>
          )}

          {/* Infinite scroll trigger with skeletons */}
          <div ref={observerRef} className="py-2">
            {isFetchingNextPage && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <PackageCardSkeleton key={`loading-${i}`} />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more…
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </PageTransition>
  );
}

export default function PackagesPage() {
  return (
    <Suspense>
      <PackagesContent />
    </Suspense>
  );
}
