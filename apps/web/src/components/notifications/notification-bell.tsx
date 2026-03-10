"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

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

const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

const NOTIF_TITLE_MAP: Record<string, string> = {
  "New Order Detected": "notifTitle.newOrder",
  "🛍️ New Order Detected": "notifTitle.newOrder",
  "Package Delivered! 🎉": "notifTitle.packageDelivered",
  "Tracking Update": "notifTitle.trackingUpdate",
  "📦 Tracking Update": "notifTitle.trackingUpdate",
  "📦 Ready for Pickup": "notifTitle.readyForPickup",
  "📦 New Package Detected": "notifTitle.newPackage",
};

function translateNotifTitle(title: string, t: (key: any) => string) {
  const key = NOTIF_TITLE_MAP[title];
  return key ? t(key) : title;
}

export function NotificationBell() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prevUnread, setPrevUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const initialLoad = useRef(true);

  // Poll for unread count every 30s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { unreadCount: count } = await api.getUnreadCount();
      setUnreadCount((prev) => {
        // Show toast when new notifications arrive (not on first load)
        if (!initialLoad.current && count > prev) {
          const newCount = count - prev;
          toast.info(newCount > 1 ? t("notificationBell.newCountPlural").replace("{count}", String(newCount)) : t("notificationBell.newCount").replace("{count}", String(newCount)), {
            description: t("notificationBell.tapToView"),
            duration: 4000,
            id: "new-notifications",
            action: {
              label: t("common.view"),
              onClick: () => router.push("/notifications"),
            },
          });
        }
        initialLoad.current = false;
        return count;
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Background auto-sync every 15 minutes
  useEffect(() => {
    const doBackgroundSync = async () => {
      try {
        await api.syncEmails(false); // incremental sync
        // After sync, check for new notifications
        fetchUnreadCount();
      } catch {}
    };
    const interval = setInterval(doBackgroundSync, AUTO_SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications({ limit: 20 });
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Refresh when other parts of the app signal a change (e.g. order deleted)
  useEffect(() => {
    const handler = () => {
      fetchUnreadCount();
      if (open) fetchNotifications();
    };
    window.addEventListener("notifications-updated", handler);
    return () => window.removeEventListener("notifications-updated", handler);
  }, [open, fetchUnreadCount, fetchNotifications]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const n = notifications.find((x) => x.id === id);
    await api.deleteNotification(id);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClearAll = async () => {
    await api.clearAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleClick = (n: Notification) => {
    if (!n.read) {
      api.markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.orderId) {
      setOpen(false);
      router.push(`/orders/${n.orderId}`);
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("time.justNow");
    if (mins < 60) return t("time.mAgo").replace("{count}", String(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("time.hAgo").replace("{count}", String(hrs));
    const days = Math.floor(hrs / 24);
    if (days < 7) return t("time.dAgo").replace("{count}", String(days));
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-border shadow-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full"
              style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bg-card border border-border rounded-xl shadow-xl flex flex-col"
            style={{
              right: 0,
              top: "calc(100% + 8px)",
              width: "360px",
              maxHeight: "min(480px, calc(100vh - 120px))",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{t("notificationBell.title")}</h3>
                {unreadCount > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={t("notificationBell.markAllRead")}
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                    title={t("notificationBell.clearAll")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={t("notificationBell.close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <LogoSpinner size={24} text={t("common.loading")} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("notificationBell.noNotifications")}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {t("notificationBell.emptyHint")}
                  </p>
                </div>
              ) : (
                <div>
                  {notifications.map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleClick(n)}
                      className={cn(
                        "group flex items-start gap-3 px-4 py-3 border-b border-border/50 transition-colors",
                        n.orderId && "cursor-pointer",
                        !n.read
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Icon */}
                      <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                        {n.icon || "📦"}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm leading-tight",
                              !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                            )}
                          >
                            {translateNotifTitle(n.title, t)}
                          </p>
                          {!n.read && (
                            <span
                              className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                              style={{ backgroundColor: "#6366f1" }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatTime(n.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button
                            onClick={(e) => handleMarkRead(n.id, e)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title={t("notificationBell.markAsRead")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(n.id, e)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* See all link */}
            <div className="border-t border-border px-4 py-2.5 shrink-0">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="w-full text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                {t("notificationBell.seeAll")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
