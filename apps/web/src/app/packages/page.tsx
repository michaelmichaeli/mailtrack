"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PackageCard } from "@/components/packages/package-card";
import { PackageTable } from "@/components/packages/package-table";
import { PackageKanban } from "@/components/packages/package-kanban";
import { PackageTimeline } from "@/components/packages/package-timeline";
import { EmptyState } from "@/components/packages/empty-state";
import { PackageCardSkeleton } from "@/components/ui/skeleton";
import { PageTransition, StaggerContainer, StaggerItem, FadeIn, AnimatedNumber } from "@/components/ui/motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, Calendar, LayoutGrid, Table2, Columns3, Clock, X, RefreshCw, MessageSquare, TrendingUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { AddPackageDialog } from "@/components/packages/add-package-dialog";
import { ScanSmsDialog } from "@/components/packages/scan-sms-dialog";

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

const SORT_OPTIONS = [
  { value: "updatedAt:desc", label: "Recently Updated" },
  { value: "createdAt:desc", label: "Newest First" },
  { value: "createdAt:asc", label: "Oldest First" },
  { value: "orderDate:desc", label: "Order Date (Newest)" },
  { value: "orderDate:asc", label: "Order Date (Oldest)" },
  { value: "merchant:asc", label: "Merchant (A–Z)" },
  { value: "merchant:desc", label: "Merchant (Z–A)" },
  { value: "status:asc", label: "Status (A–Z)" },
];

const VIEW_MODES = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "table", label: "Table", icon: Table2 },
  { value: "kanban", label: "Board", icon: Columns3 },
  { value: "timeline", label: "Timeline", icon: Clock },
] as const;

type ViewMode = typeof VIEW_MODES[number]["value"];

const STAT_PILLS = [
  { status: "OUT_FOR_DELIVERY", label: "Today", dotColor: "#7c3aed" },
  { status: "IN_TRANSIT", label: "In Transit", dotColor: "#6366f1" },
  { status: "PROCESSING", label: "Processing", dotColor: "#94a3b8" },
  { status: "DELIVERED", label: "Delivered", dotColor: "#10b981" },
  { status: "EXCEPTION", label: "Issues", dotColor: "#f59e0b" },
];

function PackagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get("status") ?? "";
  const initialPeriod = searchParams.get("period") ?? "30d";
  const initialQuery = searchParams.get("q") ?? "";
  const initialView = (searchParams.get("view") as ViewMode) || "grid";
  const initialSort = searchParams.get("sort") ?? "updatedAt:desc";
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState(initialPeriod);
  const [view, setView] = useState<ViewMode>(initialView);
  const [sort, setSort] = useState(initialSort);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Fetch stats for the stats bar
  const { data: dashData, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => api.getDashboard(period),
    retry: false,
  });

  const stats = dashData?.stats;
  const activeCount = (stats?.arrivingToday ?? 0) + (stats?.inTransit ?? 0) + (stats?.processing ?? 0);

  // Sync filters to URL search params so they survive refresh
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (status) params.set("status", status);
    if (period && period !== "30d") params.set("period", period);
    if (view && view !== "grid") params.set("view", view);
    if (sort && sort !== "updatedAt:desc") params.set("sort", sort);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/packages", { scroll: false });
  }, [debouncedQuery, status, period, view, sort, router]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["packages", debouncedQuery, status, period, view, sort],
    queryFn: ({ pageParam = 1 }) => {
      const params: Record<string, string> = { page: String(pageParam), limit: view === "kanban" || view === "timeline" ? "50" : "12" };
      if (debouncedQuery) params.query = debouncedQuery;
      if (status) params.status = status;
      const [sortBy, sortOrder] = sort.split(":");
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;
      // Skip time filter when searching — user wants to find across all dates
      if (period !== "all" && !debouncedQuery) {
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

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      setSyncProgress("Scanning emails…");
      const emailResult = await api.syncEmails();
      const emailCount = emailResult.emailsParsed ?? 0;
      await api.syncAllTracking();
      setSyncProgress("Updating tracking…");
      const poll = setInterval(async () => {
        try {
          const s = await api.getSyncStatus();
          if (s.status === "running") {
            setSyncProgress(`Tracking ${s.synced} of ${s.total} packages…`);
          } else {
            clearInterval(poll);
            setSyncProgress(null);
            setIsSyncing(false);
            if (s.status === "done") {
              toast.success(`Synced ${emailCount} email${emailCount !== 1 ? "s" : ""}, updated ${s.synced} of ${s.total} packages`);
            } else {
              toast.error("Tracking sync failed");
            }
            refetchStats();
          }
        } catch { clearInterval(poll); setSyncProgress(null); setIsSyncing(false); }
      }, 3000);
    } catch {
      toast.error("Failed to sync. Connect your email first.");
      setIsSyncing(false);
    }
  };

  const busy = isSyncing;

  // Toggle status filter — click same pill again to clear
  const toggleStatus = (s: string) => setStatus((prev) => (prev === s ? "" : s));

  return (
    <PageTransition className="space-y-5">
      {/* Header with actions */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Every package, one dashboard.</p>
          </div>
          <div className="flex items-center gap-2">
            <AddPackageDialog />
            <Button onClick={() => setScanOpen(true)} variant="outline" size="sm" className="cursor-pointer" title="Paste an SMS or tracking notification to extract tracking numbers">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Scan Messages</span>
            </Button>
            <Button onClick={handleFullSync} variant="outline" size="sm" disabled={busy} className="cursor-pointer" title="Sync emails from Gmail and update all tracking statuses">
              <RefreshCw className={`h-4 w-4 transition-transform ${busy ? "animate-spin" : ""}`} />
              {syncProgress || (isSyncing ? "Syncing…" : "Sync All")}
            </Button>
            <ScanSmsDialog open={scanOpen} onOpenChange={setScanOpen} />
          </div>
        </div>
      </FadeIn>

      {/* Stats bar — clickable pills act as status filters */}
      {stats && stats.total > 0 && (
        <FadeIn delay={0.05}>
          <Card className="overflow-hidden border-border/60">
            <div className="flex flex-col sm:flex-row">
              <div className="flex items-center gap-4 px-5 py-4 sm:border-r border-b sm:border-b-0 border-border/60 sm:min-w-[160px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground leading-none">
                    <AnimatedNumber value={activeCount} />
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Active</p>
                </div>
              </div>
              <div className="flex-1 flex items-center px-4 py-3 sm:px-5">
                <div className="flex flex-wrap gap-1.5 w-full">
                  {STAT_PILLS.map((p) => {
                    const count = p.status === "OUT_FOR_DELIVERY" ? stats.arrivingToday
                      : p.status === "IN_TRANSIT" ? stats.inTransit
                      : p.status === "PROCESSING" ? stats.processing
                      : p.status === "DELIVERED" ? stats.delivered
                      : stats.exceptions;
                    const isActive = status === p.status;
                    return (
                      <button
                        key={p.status}
                        onClick={() => toggleStatus(p.status)}
                        title={isActive ? `Clear ${p.label} filter` : `Show only ${p.label.toLowerCase()} packages`}
                        aria-pressed={isActive}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "border-primary bg-primary/10 text-foreground shadow-sm scale-105"
                            : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/50 hover:scale-105"
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.dotColor }} />
                        {p.label}
                        <span className="font-bold text-foreground min-w-[1rem] text-center">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hidden sm:flex items-center px-5 border-l border-border/60">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground leading-none">
                    <AnimatedNumber value={stats.total} />
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Total</p>
                </div>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Search & Filter */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, tracking number, or item…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Search packages"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={status || "_all"} onValueChange={(v) => setStatus(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "_all"} value={opt.value || "_all"}>
                    {opt.value ? opt.label : "All Statuses"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-10 w-full sm:w-52" aria-label="Sort packages">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FadeIn>

      {/* Time filter + View switcher */}
      <FadeIn delay={0.15}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v)} className="gap-1 flex-wrap">
              {TIME_PERIODS.map((p) => (
                <ToggleGroupItem
                  key={p.value}
                  value={p.value}
                  size="sm"
                  className="rounded-full px-3 py-1 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && totalCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {allItems.length} of {totalCount}
              </p>
            )}
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)} className="bg-muted rounded-lg p-1 gap-0 shrink-0">
              {VIEW_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <ToggleGroupItem
                    key={mode.value}
                    value={mode.value}
                    size="sm"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                    aria-label={`${mode.label} view`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
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
