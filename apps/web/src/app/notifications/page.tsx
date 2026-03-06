"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      const fetched = allPages.reduce((acc: number, p: any) => acc + (p.notifications?.length ?? 0), 0);
      if (fetched < (lastPage.total ?? 0)) return allPages.length + 1;
      return undefined;
    },
    initialPageParam: 1,
  });

  const allNotifications: Notification[] =
    data?.pages?.flatMap((p: any) => p.notifications ?? []) ?? [];
  const total = data?.pages?.[0]?.total ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => api.clearAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications cleared");
    },
  });

  const handleClick = (n: Notification) => {
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    if (n.orderId) {
      router.push(`/orders/${n.orderId}`);
    }
  };

  const unreadCount = allNotifications.filter((n) => !n.read).length;

  return (
    <PageTransition>
      <div className="space-y-6 max-w-3xl">
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
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                >
                  <CheckCheck className="h-4 w-4 mr-1.5" />
                  Mark all read
                </Button>
              )}
              {allNotifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Filter */}
        <FadeIn delay={0.05}>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as "all" | "unread")}
          >
            <ToggleGroupItem value="all" size="sm" className="rounded-full px-4">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="unread" size="sm" className="rounded-full px-4">
              Unread
            </ToggleGroupItem>
          </ToggleGroup>
        </FadeIn>

        {/* Notification list */}
        <FadeIn delay={0.1}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  You&apos;ll see updates here when your packages change status
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {allNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "group flex items-start gap-3 px-4 py-3.5 transition-colors",
                      n.orderId && "cursor-pointer",
                      !n.read
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                      {n.icon || "📦"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-tight",
                            !n.read
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground/80"
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatTime(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(n.id);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(n.id);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load more */}
              {hasNextPage && (
                <div className="flex justify-center p-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : null}
                    Load more
                  </Button>
                </div>
              )}
            </Card>
          )}
        </FadeIn>
      </div>
    </PageTransition>
  );
}
