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
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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

      {/* Connected Shops */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Connected Shops
          </CardTitle>
          <CardDescription>
            Link your shop accounts for more accurate tracking data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts?.shops?.map((shop: any) => (
            <div
              key={shop.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/50 shrink-0">
                  <ShoppingBag className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{shop.platform}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {new Date(shop.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {(!accounts?.shops || accounts.shops.length === 0) && (
            <div className="text-center py-3 text-sm text-muted-foreground">No shops connected yet</div>
          )}
          <Button variant="outline" className="w-full" disabled>
            <LinkIcon className="h-4 w-4" />
            Connect Amazon (Coming soon)
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Push notifications</p>
              <p className="text-xs text-muted-foreground">Get notified on status changes</p>
            </div>
            <ToggleSwitch
              enabled={notifPrefs?.pushEnabled ?? false}
              onToggle={() => updateNotifications.mutate({ pushEnabled: !notifPrefs?.pushEnabled })}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Email notifications</p>
              <p className="text-xs text-muted-foreground">Receive email digests</p>
            </div>
            <ToggleSwitch
              enabled={notifPrefs?.emailEnabled ?? false}
              onToggle={() => updateNotifications.mutate({ emailEnabled: !notifPrefs?.emailEnabled })}
            />
          </div>
        </CardContent>
      </Card>

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
              <p className="text-xs text-muted-foreground">Toggle between light and dark mode</p>
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

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
