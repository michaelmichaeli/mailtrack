"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  Unlink,
  Moon,
  Sun,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

function SettingsContent() {
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
    // Pass token as query param since browser navigation can't set auth headers
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
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure? This will permanently delete your account and all data. This cannot be undone.")) {
      return;
    }
    try {
      await api.deleteAccount();
      window.location.href = "/login";
    } catch {
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {successParam && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{successParam}</span>
        </div>
      )}

      {errorParam && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorParam}</span>
        </div>
      )}

      {/* Connected Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
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
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{email.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {email.provider} · Last synced:{" "}
                    {email.lastSyncAt
                      ? new Date(email.lastSyncAt).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnectEmail.mutate(email.id)}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={connectGmail}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Connect Gmail
          </Button>
        </CardContent>
      </Card>

      {/* Connected Shops */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
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
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-sm text-muted-foreground py-2">No shops connected yet</p>
          )}
          <Button variant="outline" className="w-full" disabled>
            <LinkIcon className="h-4 w-4 mr-2" />
            Connect Amazon (Coming soon)
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground">Get notified on status changes</p>
            </div>
            <button
              onClick={() =>
                updateNotifications.mutate({ pushEnabled: !notifPrefs?.pushEnabled })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifPrefs?.pushEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifPrefs?.pushEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">Receive email digests</p>
            </div>
            <button
              onClick={() =>
                updateNotifications.mutate({ emailEnabled: !notifPrefs?.emailEnabled })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifPrefs?.emailEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifPrefs?.emailEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark mode</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4 mr-1" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4 mr-1" />
                Dark
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
          <CardDescription>Export your data or delete your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export all data (JSON)
          </Button>
          <Button variant="destructive" className="w-full" onClick={handleDeleteAccount}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete account
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
