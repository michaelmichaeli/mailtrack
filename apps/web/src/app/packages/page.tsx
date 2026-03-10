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
import { PackageCardSkeleton, TableSkeleton, KanbanSkeleton, TimelineSkeleton, Skeleton } from "@/components/ui/skeleton";
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
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useI18n } from "@/lib/i18n";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const STATUS_OPTIONS = [
  { value: "", labelKey: "orders.allStatuses" },
  { value: "ORDERED", labelKey: "status.ORDERED" },
  { value: "PROCESSING", labelKey: "status.PROCESSING" },
  { value: "SHIPPED", labelKey: "status.SHIPPED" },
  { value: "IN_TRANSIT", labelKey: "status.IN_TRANSIT" },
  { value: "OUT_FOR_DELIVERY", labelKey: "status.OUT_FOR_DELIVERY" },
  { value: "DELIVERED", labelKey: "status.DELIVERED" },
  { value: "EXCEPTION", labelKey: "status.EXCEPTION" },
  { value: "RETURNED", labelKey: "status.RETURNED" },
];

const TIME_PERIODS = [
  { value: "7d", labelKey: "filter.7d", days: 7 },
  { value: "30d", labelKey: "filter.30d", days: 30 },
  { value: "6m", labelKey: "filter.6m", days: 180 },
  { value: "1y", labelKey: "filter.1y", days: 365 },
  { value: "all", labelKey: "filter.all", days: 0 },
];

const SORT_OPTIONS = [
  { value: "updatedAt:desc", label: "sort.recentlyUpdated" },
  { value: "createdAt:desc", label: "sort.newestFirst" },
  { value: "createdAt:asc", label: "sort.oldestFirst" },
  { value: "orderDate:desc", label: "sort.orderDateNewest" },
  { value: "orderDate:asc", label: "sort.orderDateOldest" },
  { value: "merchant:asc", label: "sort.merchantAZ" },
  { value: "merchant:desc", label: "sort.merchantZA" },
  { value: "status:asc", label: "sort.statusAZ" },
] as const;

const VIEW_MODES = [
  { value: "grid", label: "orders.grid", icon: LayoutGrid },
  { value: "table", label: "orders.table", icon: Table2 },
  { value: "kanban", label: "orders.board", icon: Columns3 },
  { value: "timeline", label: "orders.timeline", icon: Clock },
] as const;

type ViewMode = typeof VIEW_MODES[number]["value"];

const STAT_PILLS = [
  { status: "OUT_FOR_DELIVERY", label: "stat.today", dotColor: "#7c3aed" },
  { status: "IN_TRANSIT", label: "stat.inTransit", dotColor: "#6366f1" },
  { status: "PROCESSING", label: "stat.processing", dotColor: "#94a3b8" },
  { status: "DELIVERED", label: "stat.delivered", dotColor: "#10b981" },
  { status: "EXCEPTION", label: "stat.issues", dotColor: "#f59e0b" },
] as const;

function PackagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
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
  const [didAutoSync, setDidAutoSync] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: connectedAccounts } = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: () => api.getConnectedAccounts(),
    staleTime: 60_000,
  });
  const hasConnectedEmail = (connectedAccounts?.emails?.length ?? 0) > 0;

  // Fetch stats for the stats bar
  const { data: dashData, refetch: refetchStats, isPending: statsLoading } = useQuery({
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
    isFetching,
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
    placeholderData: (prev) => prev,
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

  const finishSync = () => {
    localStorage.removeItem("mailtrack_syncing");
    setSyncProgress(null);
    setIsSyncing(false);
  };

  const startSyncPolling = (emailCount?: number) => {
    const poll = setInterval(async () => {
      try {
        const s = await api.getSyncStatus();
        if (s.status === "running") {
          const pct = s.total > 0 ? Math.round((s.synced / s.total) * 100) : 0;
          setSyncProgress(`Tracking… ${pct}%`);
        } else {
          clearInterval(poll);
          finishSync();
          if (s.status === "done") {
            const msg = emailCount != null
              ? `Synced ${emailCount} email${emailCount !== 1 ? "s" : ""}, updated ${s.synced} package${s.synced !== 1 ? "s" : ""}`
              : `Updated ${s.synced} package${s.synced !== 1 ? "s" : ""}`;
            toast.success(msg);
          } else {
            toast.error(t("toast.syncFailed"));
          }
          refetchStats();
        }
      } catch { clearInterval(poll); finishSync(); }
    }, 3000);
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    localStorage.setItem("mailtrack_syncing", "true");
    try {
      setSyncProgress(t("sync.scanning"));
      const emailResult = await api.syncEmails();
      const emailCount = emailResult.emailsParsed ?? 0;
      setSyncProgress(emailCount > 0 ? t("sync.foundEmails").replace("{count}", String(emailCount)) : t("sync.tracking"));
      await api.syncAllTracking();
      startSyncPolling(emailCount);
    } catch {
      toast.error(t("toast.failedSync"));
      finishSync();
      setTimeout(() => router.push("/settings"), 1500);
    }
  };

  const busy = isSyncing;

  // Resume sync polling if a sync was running before page refresh
  useEffect(() => {
    const wasSyncing = localStorage.getItem("mailtrack_syncing");
    if (!wasSyncing) return;
    let cancelled = false;
    api.getSyncStatus().then((s) => {
      if (cancelled) return;
      if (s.status === "running") {
        // Server is still tracking — resume the polling UI
        setIsSyncing(true);
        const pct = s.total > 0 ? Math.round((s.synced / s.total) * 100) : 0;
        setSyncProgress(`Tracking… ${pct}%`);
        startSyncPolling();
      } else if (s.status === "idle") {
        // Refresh interrupted the sync before tracking started — restart it
        handleFullSync();
      } else {
        // Sync finished while we were refreshing
        localStorage.removeItem("mailtrack_syncing");
      }
    }).catch(() => { localStorage.removeItem("mailtrack_syncing"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync when user has connected emails but zero packages
  useEffect(() => {
    if (didAutoSync || isSyncing || isLoading || totalCount > 0 || !hasConnectedEmail) return;
    setDidAutoSync(true);
    toast.info(t("toast.autoSyncing"));
    handleFullSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCount, isLoading, didAutoSync, isSyncing, hasConnectedEmail]);

  // Toggle status filter — click same pill again to clear
  const toggleStatus = (s: string) => setStatus((prev) => (prev === s ? "" : s));

  return (
    <PageTransition className="space-y-5">
      {/* Header with actions */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("orders.title")}</h1>
            <p className="text-sm text-muted-foreground/80 mt-0.5">{t("orders.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <AddPackageDialog />
            <Button onClick={() => setScanOpen(true)} variant="outline" size="sm" className="cursor-pointer" title={t("settings.scanPasteText")}>
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">{t("orders.scanMessages")}</span>
            </Button>
            <Button onClick={handleFullSync} variant="outline" size="sm" disabled={busy} className="cursor-pointer" title={t("orders.syncTooltip")}>
              <RefreshCw className={`h-4 w-4 transition-transform ${busy ? "animate-spin" : ""}`} />
              {syncProgress || (isSyncing ? t("orders.syncing") : t("orders.syncAll"))}
            </Button>
            <div className="hidden md:block">
              <NotificationBell />
            </div>
            <ScanSmsDialog open={scanOpen} onOpenChange={setScanOpen} />
          </div>
        </div>
      </FadeIn>

      {/* Stats bar — clickable pills act as status filters */}
      {statsLoading ? (
        <FadeIn delay={0.05}>
          <Card className="overflow-hidden border-border/60">
            <div className="flex flex-col sm:flex-row">
              <div className="flex items-center gap-4 px-5 py-4 sm:border-r border-b sm:border-b-0 border-border/60 sm:min-w-[160px]">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div>
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="h-3 w-12 mt-1" />
                </div>
              </div>
              <div className="flex-1 flex items-center px-4 py-3 sm:px-5">
                <div className="flex flex-wrap gap-1.5 w-full">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-8 w-28 rounded-full" />
                  ))}
                </div>
              </div>
              <div className="hidden sm:flex items-center px-5 border-l border-border/60">
                <div className="text-center">
                  <Skeleton className="h-6 w-8 mx-auto" />
                  <Skeleton className="h-3 w-10 mt-1" />
                </div>
              </div>
            </div>
          </Card>
        </FadeIn>
      ) : stats && stats.total > 0 && (
        <FadeIn delay={0.05}>
          <Card className="overflow-hidden border-border/60 bg-gradient-to-r from-card via-card to-accent/20">
            <div className="flex flex-col sm:flex-row">
              <div className="flex items-center gap-4 px-5 py-4 sm:border-r border-b sm:border-b-0 border-border/60 sm:min-w-[160px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0 ring-1 ring-primary/20">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground leading-none">
                    <AnimatedNumber value={activeCount} />
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t("stat.active")}</p>
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
                        title={isActive ? `Clear ${t(p.label)} filter` : `Show only ${t(p.label).toLowerCase()} packages`}
                        aria-pressed={isActive}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "border-primary bg-primary/10 text-foreground shadow-sm scale-105"
                            : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/50 hover:scale-105"
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.dotColor }} />
                        {t(p.label)}
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
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{t("orders.total")}</p>
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
              placeholder={t("common.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
              aria-label={t("orders.searchPackages")}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={t("orders.clearSearch")}
                title={t("orders.clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={status || "_all"} onValueChange={(v) => setStatus(v === "_all" ? "" : v)}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by status">
                <SelectValue placeholder={t("orders.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || "_all"} value={opt.value || "_all"}>
                    {opt.value ? t(`status.${opt.value}` as any) : t("orders.allStatuses")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-10 w-full sm:w-52" aria-label="Sort packages">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder={t("orders.sortBy")} />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.label)}
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
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v)} className="gap-0.5 bg-muted rounded-lg p-1">
              {TIME_PERIODS.map((p) => (
                <ToggleGroupItem
                  key={p.value}
                  value={p.value}
                  size="sm"
                  className="rounded-md px-2.5 py-1 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
                >
                  {t(p.labelKey as any)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && totalCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {isFetching && !isFetchingNextPage ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : null}
                {allItems.length} {t("orders.of")} {totalCount}
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
                    aria-label={`${t(mode.label)} view`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t(mode.label)}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </div>
      </FadeIn>

      {/* Results */}
      {isLoading ? (
        view === "table" ? <TableSkeleton /> :
        view === "kanban" ? <KanbanSkeleton /> :
        view === "timeline" ? <TimelineSkeleton /> :
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
          {Array.from({ length: 6 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <FadeIn>
          <EmptyState
            title={query || status ? t("orders.noOrdersFound") : t("orders.noPackages")}
            description={
              query || status
                ? t("orders.adjustFilters")
                : hasConnectedEmail
                ? t("orders.emptyConnected")
                : t("orders.emptyNotConnected")
            }
            action={!query && !status && !hasConnectedEmail ? { label: t("orders.connectEmail"), href: "/settings" } : undefined}
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

          {/* Infinite scroll trigger */}
          <div ref={observerRef}>
            {isFetchingNextPage && (
              <div className="space-y-4 pt-2">
                {view === "table" ? <TableSkeleton rows={3} /> :
                 view === "kanban" ? null :
                 view === "timeline" ? <TimelineSkeleton items={3} /> :
                 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 grid-catalog">
                   {Array.from({ length: 3 }).map((_, i) => (
                     <PackageCardSkeleton key={`loading-${i}`} />
                   ))}
                 </div>
                }
                <div className="flex items-center justify-center gap-2 py-2">
                  <LogoSpinner size={24} text={t("orders.loadingMore")} />
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
