"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X, Share, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS && !("standalone" in navigator && (navigator as any).standalone);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as any).standalone === true);
}

/**
 * PushNotificationManager — handles service worker registration and push subscription.
 * 
 * Behavior:
 * - Registers SW on mount
 * - If permission already granted but not subscribed → auto-subscribe silently
 * - If permission is "default" → show soft prompt banner after delay
 * - If permission is "denied" → do nothing
 * - On iOS Safari (not PWA) → show "Add to Home Screen" instructions
 */
export function PushNotificationManager() {
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const { t } = useI18n();

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  };

  const subscribeToPush = useCallback(async (showToast = false) => {
    try {
      setSubscribing(true);

      if (!window.isSecureContext) return;

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) return; // Already subscribed

      const { publicKey } = await api.getVapidKey();
      if (!publicKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (showToast) toast.error(t("toast.notificationDenied"));
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await api.subscribePush(subscription);
      if (showToast) toast.success(t("toast.pushEnabled"));
    } catch (err) {
      console.error("[push-manager] Subscribe error:", err);
      if (showToast) toast.error(t("toast.failedEnablePush"));
    } finally {
      setSubscribing(false);
      setShowBanner(false);
    }
  }, [t]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // iOS Safari without PWA — show install banner
      if (isIOSSafari() && !isStandalone()) {
        const dismissed = sessionStorage.getItem("ios_install_dismissed");
        if (!dismissed) {
          setTimeout(() => setShowIOSBanner(true), 5000);
        }
      }
      return;
    }
    if (!window.isSecureContext) return;

    // Register SW
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    const checkPush = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const existingSub = await registration?.pushManager.getSubscription();

        if (existingSub) return; // Already subscribed, nothing to do

        const permission = Notification.permission;

        if (permission === "granted") {
          // Permission granted but no subscription — auto-subscribe
          await subscribeToPush(false);
        } else if (permission === "default") {
          // Never asked — show soft prompt after delay
          const dismissed = sessionStorage.getItem("push_banner_dismissed");
          if (!dismissed) {
            setTimeout(() => setShowBanner(true), 8000);
          }
        }
        // "denied" — do nothing
      } catch {
        // Non-fatal
      }
    };

    checkPush();
  }, [subscribeToPush]);

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("push_banner_dismissed", "1");
  };

  const handleDismissIOS = () => {
    setShowIOSBanner(false);
    sessionStorage.setItem("ios_install_dismissed", "1");
  };

  const handleEnable = () => {
    subscribeToPush(true);
  };

  // iOS "Add to Home Screen" banner
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-20 right-4 left-4 sm:left-auto z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
          <button
            onClick={handleDismissIOS}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted text-muted-foreground"
            aria-label={t("push.dismiss")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("push.iosInstallTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("push.iosInstallDesc")}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  1. <Share className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="flex items-center gap-1">
                  2. {t("push.iosAddToHome")} <Plus className="h-3.5 w-3.5 text-primary" />
                </span>
              </div>
              <button
                onClick={handleDismissIOS}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {t("push.notNow")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted text-muted-foreground"
          aria-label={t("push.dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t("push.enableTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("push.enableDesc")}
            </p>
            <div className="flex gap-2 pt-1.5">
              <button
                onClick={handleEnable}
                disabled={subscribing}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {subscribing ? t("push.enabling") : t("push.enable")}
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {t("push.notNow")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
