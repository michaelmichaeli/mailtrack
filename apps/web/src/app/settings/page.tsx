"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  ShoppingBag,
  Bell,
  Trash2,
  Download,
  Link as LinkIcon,
  XCircle,
  Moon,
  Sun,
  AlertCircle,
  CheckCircle2,
  Palette,
  Shield,
  Package,
  Loader2,
  MessageSquare,
  Key,
  Copy,
  RefreshCw,
  Upload,
  Smartphone,
  FileText,
  Check,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const ToggleSwitch = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
      enabled ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"
    }`}
  >
    <span
      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform ${
        enabled ? "translate-x-[22px]" : "translate-x-[3px]"
      }`}
    />
  </button>
);

function SettingsContent() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const successParam = searchParams.get("success");

  const { data: accounts } = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: () => api.getConnectedAccounts(),
  });

  const { data: notifPrefs } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => api.getNotificationPreferences(),
  });

  const connectGmail = () => {
    const token = localStorage.getItem("mailtrack_token");
    if (!token) {
      toast.error("Please log in first");
      return;
    }
    window.location.href = `${API_URL}/api/email/connect/gmail?token=${encodeURIComponent(token)}`;
  };

  const disconnectEmail = useMutation({
    mutationFn: (id: string) => api.disconnectEmail(id),
    onSuccess: () => {
      toast.success("Email disconnected");
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
    },
  });

  const updateNotifications = useMutation({
    mutationFn: (data: any) => api.updateNotificationPreferences(data),
    onSuccess: () => {
      toast.success("Preferences updated");
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mailtrack-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure? This will permanently delete your account and all data. This cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      window.location.href = "/login";
    } catch {
      toast.error("Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences</p>
      </div>

      {successParam && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{successParam}</span>
        </div>
      )}

      {errorParam && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorParam}</span>
        </div>
      )}

      {/* Connected Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Connected Emails
          </CardTitle>
          <CardDescription>
            Connect your email to automatically track packages from order confirmations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts?.emails?.map((email: any) => (
            <div
              key={email.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/50 shrink-0">
                  <Mail className="h-4 w-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{email.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {email.provider} · Last synced:{" "}
                    {email.lastSyncAt
                      ? new Date(email.lastSyncAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "Never"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => disconnectEmail.mutate(email.id)}
                disabled={disconnectEmail.isPending}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shrink-0"
                title="Disconnect email"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={connectGmail}>
            <LinkIcon className="h-4 w-4" />
            Connect Gmail
          </Button>
        </CardContent>
      </Card>

      {/* Scan Messages */}
      <ScanMessagesSection />

      {/* Import from Stores */}
      <StoreImportSection />

      {/* Notifications */}
      <NotificationsSection
        notifPrefs={notifPrefs}
        updateNotifications={updateNotifications}
      />

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">Choose your preferred appearance</p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
              >
                <Palette className="h-4 w-4" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Data & Privacy
          </CardTitle>
          <CardDescription>Export your data or delete your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={handleExport} disabled={isExporting}>
            <Download className={`h-4 w-4 ${isExporting ? "animate-spin" : ""}`} />
            {isExporting ? "Exporting…" : "Export all data (JSON)"}
          </Button>
          <Button variant="destructive" className="w-full" onClick={handleDeleteAccount} disabled={isDeleting}>
            <Trash2 className={`h-4 w-4 ${isDeleting ? "animate-spin" : ""}`} />
            {isDeleting ? "Deleting…" : "Delete account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ScanMessagesSection() {
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState<"android" | "ios" | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const webhookUrl = `${API_BASE}/api/ingest/sms`;

  useState(() => {
    api.getIngestKey().then((r) => { setIngestKey(r.key); setLoading(false); }).catch(() => setLoading(false));
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { key } = await api.generateIngestKey();
      setIngestKey(key);
      toast.success("Ingest key generated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" />
          Auto-Forward SMS
        </CardTitle>
        <CardDescription>
          Automatically forward shipping SMS from your phone to track packages without any manual work
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Generate key */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">1. Your Ingest Key</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : ingestKey ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                {ingestKey}
              </code>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(ingestKey)}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleGenerate} disabled={generating}>
                <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Generate Ingest Key
            </Button>
          )}
        </div>

        {/* Step 2: Webhook URL */}
        {ingestKey && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">2. Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                {webhookUrl}?key={ingestKey}
              </code>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(`${webhookUrl}?key=${ingestKey}`)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Setup guides */}
        {ingestKey && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">3. Set up auto-forwarding on your phone</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={showGuide === "android" ? "default" : "outline"} className="w-full text-xs gap-1.5" onClick={() => setShowGuide(showGuide === "android" ? null : "android")}>
                <Smartphone className="h-3.5 w-3.5" /> Android Setup
              </Button>
              <Button variant={showGuide === "ios" ? "default" : "outline"} className="w-full text-xs gap-1.5" onClick={() => setShowGuide(showGuide === "ios" ? null : "ios")}>
                <Smartphone className="h-3.5 w-3.5" /> iOS Setup
              </Button>
            </div>

            {showGuide === "android" && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">Android — Using Tasker (recommended)</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Install <strong>Tasker</strong> from the Play Store</li>
                  <li>Create a new <strong>Profile</strong> → Event → Phone → Received Text</li>
                  <li>In Content, add keywords: <code className="bg-muted px-1 rounded">shipped|tracking|delivery|parcel|חבילה|משלוח</code></li>
                  <li>Add a <strong>Task</strong> → Net → HTTP Request</li>
                  <li>Method: <strong>POST</strong></li>
                  <li>URL: <code className="bg-muted px-1 rounded break-all">{webhookUrl}?key={ingestKey}</code></li>
                  <li>Headers: <code className="bg-muted px-1 rounded">Content-Type: application/json</code></li>
                  <li>Body: <code className="bg-muted px-1 rounded">{`{"text": "%SMSRB", "source": "SMS from %SMSRF"}`}</code></li>
                </ol>
                <p className="text-xs mt-2">Alternative: Use <strong>Automate</strong> or <strong>MacroDroid</strong> with similar HTTP POST setup.</p>
              </div>
            )}

            {showGuide === "ios" && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">iOS — Using Shortcuts + Automation</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Open <strong>Shortcuts</strong> app → Automation tab</li>
                  <li>Tap <strong>+</strong> → Personal Automation → <strong>Message</strong></li>
                  <li>Set &quot;Message contains&quot; keywords: <code className="bg-muted px-1 rounded">tracking, shipped, delivered, חבילה</code></li>
                  <li>Add action: <strong>Get Contents of URL</strong></li>
                  <li>URL: <code className="bg-muted px-1 rounded break-all">{webhookUrl}?key={ingestKey}</code></li>
                  <li>Method: <strong>POST</strong>, Request Body: JSON</li>
                  <li>Add key <code className="bg-muted px-1 rounded">text</code> with value: <strong>Shortcut Input</strong></li>
                  <li>Turn off &quot;Ask Before Running&quot;</li>
                </ol>
                <p className="text-xs mt-2">Note: iOS may require confirmation for automations. IFTTT is an alternative.</p>
              </div>
            )}
          </div>
        )}

        {/* Curl test */}
        {ingestKey && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Test it</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-[10px] font-mono break-all select-all leading-relaxed">
                curl -X POST &quot;{webhookUrl}?key={ingestKey}&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{`{"text":"Your package LP00123456789012 has shipped"}`}&apos;
              </code>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(`curl -X POST "${webhookUrl}?key=${ingestKey}" -H "Content-Type: application/json" -d '{"text":"Your package LP00123456789012 has shipped"}'`)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsSection({ notifPrefs, updateNotifications }: { notifPrefs: any; updateNotifications: any }) {
  const [pushState, setPushState] = useState<"idle" | "subscribing" | "unsubscribing">("idle");
  const [pushSupported, setPushSupported] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check if browser supports push and if already subscribed
  useState(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      }
    });
  });

  const handleSubscribe = async () => {
    setPushState("subscribing");
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get VAPID key
      const { publicKey } = await api.getVapidKey();
      if (!publicKey) {
        toast.error("Push notifications not configured on server");
        setPushState("idle");
        return;
      }

      // Convert VAPID key
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
      };

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        setPushState("idle");
        return;
      }

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      await api.subscribePush(subscription);
      setIsSubscribed(true);
      toast.success("Push notifications enabled!");
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      toast.error(err?.message ?? "Failed to enable push notifications");
    } finally {
      setPushState("idle");
    }
  };

  const handleUnsubscribe = async () => {
    setPushState("unsubscribing");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      await api.unsubscribePush();
      setIsSubscribed(false);
      toast.success("Push notifications disabled");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to disable push notifications");
    } finally {
      setPushState("idle");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Notifications
        </CardTitle>
        <CardDescription>
          Get notified when your packages have status updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              {!pushSupported
                ? "Not supported in this browser"
                : isSubscribed
                ? "Enabled — you'll get notified on status changes"
                : "Get browser notifications when packages update"}
            </p>
          </div>
          {pushSupported && (
            <Button
              variant={isSubscribed ? "outline" : "default"}
              size="sm"
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={pushState !== "idle"}
              className="gap-1.5 shrink-0"
            >
              {pushState !== "idle" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isSubscribed ? (
                <Bell className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              {isSubscribed ? "Disable" : "Enable"}
            </Button>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Email digest</p>
            <p className="text-xs text-muted-foreground">Weekly summary of your deliveries</p>
          </div>
          <ToggleSwitch
            enabled={notifPrefs?.emailEnabled ?? false}
            onToggle={() => updateNotifications.mutate({ emailEnabled: !notifPrefs?.emailEnabled })}
          />
        </div>

        {isSubscribed && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-3 text-xs text-green-700 dark:text-green-300">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Push notifications are active. You&apos;ll be notified when any tracked package changes status (shipped, in transit, delivered, etc.)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StoreImportSection() {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const SUPPORTED_STORES = [
    { label: "Amazon", icon: "🛒" },
    { label: "eBay", icon: "🏷️" },
    { label: "AliExpress", icon: "📦" },
    { label: "iHerb", icon: "🌿" },
    { label: "Shein", icon: "👗" },
    { label: "Temu", icon: "🛍️" },
    { label: "Etsy", icon: "🎨" },
    { label: "Shopify", icon: "🏪" },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("No valid rows found in CSV");
        return;
      }
      const result = await api.importCsv(rows);
      toast.success(`Imported ${result.imported} packages (${result.skipped} skipped)`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to import CSV");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-4 w-4 text-primary" />
          Store Orders
        </CardTitle>
        <CardDescription>
          Orders from these stores are automatically detected when you connect your email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supported stores grid */}
        <div className="grid grid-cols-4 gap-2">
          {SUPPORTED_STORES.map((store) => (
            <div
              key={store.label}
              className="flex flex-col items-center gap-1 rounded-lg border border-border p-2.5 bg-muted/20"
            >
              <span className="text-lg">{store.icon}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{store.label}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> How it works
          </p>
          <p>Connect your Gmail above → we scan for order confirmations and shipping notifications → tracking starts automatically. No store login needed.</p>
        </div>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <p className="font-medium flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Why not connect stores directly?
          </p>
          <p>Unlike Google, stores like Amazon and eBay don&apos;t provide consumer APIs to read your orders. Gmail is the most reliable automatic source — it captures confirmations from all stores at once.</p>
        </div>

        {/* CSV Import */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import order history (CSV)
          </p>
          <p className="text-xs text-muted-foreground">
            For older orders not in your email, export from each store and upload here:
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-xs">How to export your order history:</p>
            <ul className="space-y-1">
              <li>🛒 <strong>Amazon</strong> → <a href="https://www.amazon.com/gp/b2b/reports" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Order Reports</a> → Request Report → Download CSV</li>
              <li>🏷️ <strong>eBay</strong> → <a href="https://www.ebay.com/mye/myebay/purchase" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Purchase History</a> → use eBay CSV export extension</li>
              <li>📦 <strong>AliExpress</strong> → My Orders → no official export (use email sync instead)</li>
              <li>🌿 <strong>iHerb</strong> → <a href="https://www.iherb.com/account/orders" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Order History</a> → copy tracking numbers</li>
            </ul>
          </div>
          <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border hover:border-primary/50 p-4 transition-colors cursor-pointer">
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Importing…</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload CSV file</span>
              </>
            )}
          </label>
          <p className="text-[10px] text-muted-foreground">
            Expected columns: tracking number, order ID, store name, items, date (headers auto-detected)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Parse CSV text into rows with auto-detected columns */
function parseCsv(text: string): Array<{ orderId?: string; trackingNumber?: string; store?: string; items?: string; date?: string }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,\t]/).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Auto-detect column mapping
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (/track|tracking|shipment/i.test(h)) colMap.trackingNumber = i;
    else if (/order.*id|order.*number|order.*#/i.test(h)) colMap.orderId = i;
    else if (/store|shop|merchant|seller|platform/i.test(h)) colMap.store = i;
    else if (/item|product|description|title/i.test(h)) colMap.items = i;
    else if (/date|ordered|created|purchase/i.test(h)) colMap.date = i;
  });

  // If no tracking column found, try to find one with tracking-number-like data
  if (colMap.trackingNumber === undefined) {
    // Check each column for tracking-number-like values
    for (let c = 0; c < headers.length; c++) {
      const sample = lines.slice(1, 4).map((l) => l.split(/[,\t]/)[c]?.trim().replace(/['"]/g, ""));
      if (sample.some((v) => v && /^[A-Z0-9]{8,30}$/i.test(v))) {
        colMap.trackingNumber = c;
        break;
      }
    }
  }

  if (colMap.trackingNumber === undefined) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t]/).map((c) => c.trim().replace(/^['"]|['"]$/g, ""));
    const tn = cols[colMap.trackingNumber]?.trim();
    if (!tn || tn.length < 6) continue;

    rows.push({
      trackingNumber: tn,
      orderId: colMap.orderId !== undefined ? cols[colMap.orderId] : undefined,
      store: colMap.store !== undefined ? cols[colMap.store] : undefined,
      items: colMap.items !== undefined ? cols[colMap.items] : undefined,
      date: colMap.date !== undefined ? cols[colMap.date] : undefined,
    });
  }

  return rows;
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
