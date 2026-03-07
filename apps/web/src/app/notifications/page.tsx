"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2, Loader2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { NotificationsSkeleton } from "@/components/ui/skeleton";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string | null;
  orderId: string | null;
  read: boolean;
  createdAt: string;
}

const LIMIT = 20;

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["notifications", filter],
    queryFn: ({ pageParam = 1 }) =>
      api.getNotifications({
        page: pageParam,
        limit: LIMIT,
        unreadOnly: filter === "unread",
      }),
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const fetched = allPages.reduce((acc: number, p: any) => acc + (p.items?.length ?? 0), 0);
      if (fetched < (lastPage.total ?? 0)) return allPages.length + 1;
      return undefined;
    },
    initialPageParam: 1,
  });

  const allNotifications: Notification[] =
    data?.pages?.flatMap((p: any) => p.items ?? []) ?? [];
  const total = data?.pages?.[0]?.total ?? 0;
  const unreadCount = allNotifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => api.clearAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications cleared");
    },
  });

  const handleClick = (n: Notification) => {
    if (!n.read) markReadMutation.mutate(n.id);
    if (n.orderId) router.push(`/orders/${n.orderId}`);
  };

  return (
    <PageTransition className="space-y-5">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Stay updated on your package deliveries
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            {allNotifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer text-destructive hover:text-destructive"
                onClick={() => clearAllMutation.mutate()}
                disabled={clearAllMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear all</span>
              </Button>
            )}
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Notifications card */}
      <FadeIn delay={0.05}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4 text-primary" />
                  Activity
                </CardTitle>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs font-bold">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(v) => v && setFilter(v as "all" | "unread")}
                className="gap-0"
              >
                <ToggleGroupItem
                  value="all"
                  size="sm"
                  className="rounded-full px-3 py-1 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  All
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="unread"
                  size="sm"
                  className="rounded-full px-3 py-1 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  Unread
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <CardDescription>
              Package status updates and delivery alerts
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <div className="h-9 w-9 rounded-lg bg-muted/70 animate-pulse shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 w-48 rounded bg-muted/70 animate-pulse mb-2" />
                      <div className="h-3 w-64 rounded bg-muted/70 animate-pulse" />
                    </div>
                    <div className="h-3 w-12 rounded bg-muted/70 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : allNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1 text-center">
                  You&apos;ll see updates here when your packages change status
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {allNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "group flex items-start gap-3 px-5 py-4 transition-colors",
                        n.orderId && "cursor-pointer",
                        !n.read
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg shrink-0 text-base",
                        !n.read ? "bg-primary/10" : "bg-muted"
                      )}>
                        {n.icon || "📦"}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm leading-snug",
                            !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap shrink-0 mt-0.5">
                            {formatTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        {n.orderId && (
                          <p className="text-xs text-primary mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3 w-3" />
                            View order
                          </p>
                        )}
                      </div>

                      {/* Unread dot + actions */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(n.id); }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Mark as read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load more */}
                {hasNextPage && (
                  <div className="flex justify-center p-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage && <div className="animate-logo-spin inline-block mr-1.5"><img src="/logo.png" alt="" width={16} height={16} /></div>}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </PageTransition>
  );
}
