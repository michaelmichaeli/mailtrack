"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * PushNotificationManager — handles service worker registration and push subscription.
 * 
 * Behavior:
 * - Registers SW on mount
 * - If permission already granted but not subscribed → auto-subscribe silently
 * - If permission is "default" → show soft prompt banner after delay
 * - If permission is "denied" → do nothing
 */
export function PushNotificationManager() {
  const [showBanner, setShowBanner] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

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
        if (showToast) toast.error("Notification permission denied");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await api.subscribePush(subscription);
      if (showToast) toast.success("Push notifications enabled!");
    } catch (err) {
      console.error("[push-manager] Subscribe error:", err);
      if (showToast) toast.error("Failed to enable push notifications");
    } finally {
      setSubscribing(false);
      setShowBanner(false);
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
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

  const handleEnable = () => {
    subscribeToPush(true);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Enable push notifications?</p>
            <p className="text-xs text-muted-foreground">
              Get notified when your packages are shipped, out for delivery, or arrive.
            </p>
            <div className="flex gap-2 pt-1.5">
              <button
                onClick={handleEnable}
                disabled={subscribing}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {subscribing ? "Enabling..." : "Enable"}
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
