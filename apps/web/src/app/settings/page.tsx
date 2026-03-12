"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
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
  LogOut,
  RotateCcw,
  KeyRound,
  Globe,
  Play,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NotificationBell } from "@/components/notifications/notification-bell";
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

function SettingsContent() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const dateLocale = locale === "he" ? "he-IL" : locale === "ar" ? "ar" : locale === "ru" ? "ru-RU" : "en-US";
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get("error");
  const successParam = searchParams.get("success");
  const autoSync = searchParams.get("autoSync");
  const [didAutoSync, setDidAutoSync] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(errorParam);
  const [displaySuccess, setDisplaySuccess] = useState<string | null>(successParam);

  // Clear error/success from URL after capturing so they don't persist on navigation
  useEffect(() => {
    if (errorParam || successParam) {
      if (errorParam) setDisplayError(errorParam);
      if (successParam) setDisplaySuccess(successParam);
      const cleanUrl = autoSync ? "/settings" : "/settings";
      router.replace(cleanUrl, { scroll: false });
    }
  }, [errorParam, successParam, autoSync, router]);

  const { data: accounts } = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: () => api.getConnectedAccounts(),
  });

  const { data: notifPrefs } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => api.getNotificationPreferences(),
  });

  const { data: passkeys, refetch: refetchPasskeys } = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => api.listPasskeys(),
  });

  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  const connectGmail = () => {
    const token = localStorage.getItem("mailtrack_token");
    if (!token) {
      toast.error(t("toast.pleaseLogIn"));
      return;
    }
    window.location.href = `${API_URL}/api/email/connect/gmail?token=${encodeURIComponent(token)}`;
  };

  // Auto-sync after Gmail is connected
  useEffect(() => {
    if (autoSync && !didAutoSync) {
      setDidAutoSync(true);
      toast.info(t("settings.syncingEmails"));
      api.syncEmails().then((r) => {
        toast.success(`Synced ${r.emailsParsed} emails`);
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        return api.syncAllTracking().catch(() => null);
      }).then((r) => {
        if (r?.synced) toast.success(`Updated ${r.synced} packages`);
      }).catch(() => {
        toast.error(t("settings.syncFailed"));
      });
    }
  }, [autoSync, didAutoSync, queryClient]);

  const disconnectEmail = useMutation({
    mutationFn: (id: string) => api.disconnectEmail(id),
    onSuccess: () => {
      toast.success(t("toast.emailDisconnected"));
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? t("toast.failedDisconnectEmail"));
    },
  });

  const updateNotifications = useMutation({
    mutationFn: (data: any) => api.updateNotificationPreferences(data),
    onSuccess: () => {
      toast.success(t("toast.preferencesUpdated"));
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
      toast.success(t("toast.dataExported"));
    } catch {
      toast.error(t("toast.failedExportData"));
    } finally {
      setIsExporting(false);
    }
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePackagesOpen, setDeletePackagesOpen] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      window.location.href = "/login";
    } catch {
      toast.error(t("toast.failedDeleteAccount"));
      setIsDeleting(false);
    }
  };

  const handleDeleteAllOrders = async () => {
    setIsDeletingAll(true);
    try {
      const result = await api.deleteAllOrders();
      toast.success(`Removed ${result.deleted} order${result.deleted !== 1 ? "s" : ""} and all packages`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setDeletePackagesOpen(false);
    } catch (err) {
      console.error("Delete all orders failed:", err);
      toast.error(t("toast.failedRemovePackages"));
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleSignOut = async () => {
    try { await api.logout(); } catch {}
    api.setToken(null);
    window.location.href = "/login";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground/80 mt-0.5">{t("settings.subtitle")}</p>
        </div>
        <div className="hidden md:block">
          <NotificationBell />
        </div>
      </div>

      {displaySuccess && (
        <Alert className="border-green-600 bg-green-50 text-green-800 dark:border-green-500 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{displaySuccess}</AlertDescription>
        </Alert>
      )}

      {displayError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Connected Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            {t("settings.connectedEmails")}
          </CardTitle>
          <CardDescription>
            {t("settings.connectEmailDesc")}
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
                    {email.provider} · {t("settings.lastSynced")}{" "}
                    {email.lastSyncAt
                      ? new Date(email.lastSyncAt).toLocaleString(dateLocale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : t("settings.never")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => disconnectEmail.mutate(email.id)}
                disabled={disconnectEmail.isPending}
                className="p-1.5 rounded-lg text-muted-foreground active:text-red-500 active:bg-red-50 dark:active:bg-red-950/50 transition-colors shrink-0"
                title={t("settings.disconnectEmail")}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={connectGmail}>
            <LinkIcon className="h-4 w-4" />
            {t("settings.connectGmail")}
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
            {t("settings.appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t("settings.theme")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.themeDesc")}</p>
            </div>
            <ToggleGroup type="single" value={theme ?? "system"} onValueChange={(v) => v && setTheme(v)}>
              <ToggleGroupItem value="light" size="sm" aria-label="Light theme">
                <Sun className="h-4 w-4 mr-1" />
                {t("settings.light")}
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" size="sm" aria-label="Dark theme">
                <Moon className="h-4 w-4 mr-1" />
                {t("settings.dark")}
              </ToggleGroupItem>
              <ToggleGroupItem value="system" size="sm" aria-label="System theme">
                <Palette className="h-4 w-4 mr-1" />
                {t("settings.system")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {t("settings.language")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
            </div>
            <Select
              value={locale}
              onValueChange={(v) => {
                setLocale(v);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="he">עברית</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Passkeys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            {t("settings.passkeys")}
          </CardTitle>
          <CardDescription>{t("settings.biometricDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {passkeys && passkeys.length > 0 && (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{pk.friendlyName}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(pk.createdAt).toLocaleDateString(dateLocale)}
                        {pk.backedUp && ` · ${t("settings.synced")}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.deletePasskey(pk.id);
                        toast.success(t("toast.passkeyRemoved"));
                        refetchPasskeys();
                      } catch { toast.error(t("toast.failedRemovePasskey")); }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            className="w-full"
            disabled={registeringPasskey}
            onClick={async () => {
              setRegisteringPasskey(true);
              try {
                const { startRegistration } = await import("@simplewebauthn/browser");
                const options = await api.getPasskeyRegisterOptions();
                const credential = await startRegistration({ optionsJSON: options });
                await api.registerPasskey(credential, `${t("settings.passkey")} ${(passkeys?.length ?? 0) + 1}`);
                toast.success(t("toast.passkeyRegistered"));
                refetchPasskeys();
              } catch (err: any) {
                if (err?.name !== "NotAllowedError") {
                  console.error("Passkey registration error:", err);
                  toast.error(err?.message ?? t("toast.failedRegisterPasskey"));
                }
              } finally {
                setRegisteringPasskey(false);
              }
            }}
          >
            <Key className="h-4 w-4" />
            {registeringPasskey ? "Registering…" : t("settings.addPasskey")}
          </Button>
        </CardContent>
      </Card>

      {/* Sign Out & Onboarding */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => window.location.href = "/onboarding"}>
          <RotateCcw className="h-4 w-4" />
          {t("settings.replayOnboarding")}
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {t("settings.signOut")}
        </Button>
      </div>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            {t("settings.dataPrivacy")}
          </CardTitle>
          <CardDescription>{t("settings.dataPrivacyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={handleExport} disabled={isExporting}>
            <Download className={`h-4 w-4 ${isExporting ? "animate-spin" : ""}`} />
            {isExporting ? t("settings.exporting") : t("settings.exportData")}
          </Button>
        </CardContent>
      </Card>

      {/* App Tour */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4" />
            {t("settings.replayTour")}
          </CardTitle>
          <CardDescription>{t("settings.replayTourDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              localStorage.removeItem("mailtrack_walkthrough_done");
              window.location.href = "/packages";
            }}
          >
            <Play className="h-4 w-4" />
            {t("walkthrough.replay")}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertCircle className="h-4 w-4" />
            {t("settings.dangerZone")}
          </CardTitle>
          <CardDescription>{t("settings.dangerZoneDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dialog open={deletePackagesOpen} onOpenChange={setDeletePackagesOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/30 text-destructive active:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
                {t("settings.removeAllPackages")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("settings.removeAllPackages")}?</DialogTitle>
                <DialogDescription>
                  {t("settings.removeAllPackagesDesc")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletePackagesOpen(false)}>{t("common.cancel")}</Button>
                <Button variant="destructive" onClick={handleDeleteAllOrders} disabled={isDeletingAll}>
                  <Trash2 className={`h-4 w-4 ${isDeletingAll ? "animate-spin" : ""}`} />
                  {isDeletingAll ? "Removing…" : t("settings.removeAllPackages")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4" />
                {t("settings.deleteAccount")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("settings.deleteAccount")}?</DialogTitle>
                <DialogDescription>
                  {t("settings.deleteAccountDesc")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteAccountOpen(false)}>{t("common.cancel")}</Button>
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                  <Trash2 className={`h-4 w-4 ${isDeleting ? "animate-spin" : ""}`} />
                  {isDeleting ? t("detail.deleting") : t("settings.deleteAccountPermanently")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
  const { t } = useI18n();

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const webhookUrl = `${API_BASE}/api/ingest/sms`;

  useEffect(() => {
    api.getIngestKey().then((r) => { setIngestKey(r.key); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { key } = await api.generateIngestKey();
      setIngestKey(key);
      toast.success(t("toast.ingestKeyGenerated"));
    } catch (err: any) {
      toast.error(err?.message ?? t("toast.failedGenerateKey"));
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text.replace(/\s+/g, ' ').trim());
    setCopied(true);
    toast.success(t("toast.copiedToClipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" />
          {t("settings.autoForwardSMS")}
        </CardTitle>
        <CardDescription>
          {t("settings.smsForwardFullDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Generate key */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("settings.yourIngestKey")}</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : ingestKey ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-nowrap">
                {ingestKey}
              </code>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(ingestKey)} title={t("settings.copyApiKey")}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleGenerate} disabled={generating} title={t("settings.regenerateKey")}>
                <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              {t("settings.generateIngestKey")}
            </Button>
          )}
        </div>

        {/* Step 2: Webhook URL */}
        {ingestKey && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("settings.webhookUrl")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-nowrap">
                {webhookUrl}?key={ingestKey}
              </code>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(`${webhookUrl}?key=${ingestKey}`)} title={t("settings.copyWebhookUrl")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Setup guides */}
        {ingestKey && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("settings.installAutomation")}</p>

            {/* Quick install buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="w-full text-xs gap-1.5 h-12 flex-col cursor-pointer"
                onClick={() => {
                  const fullUrl = `${webhookUrl}?key=${ingestKey}`;
                  navigator.clipboard.writeText(fullUrl).then(() => {
                    toast.success(t("toast.webhookCopied"));
                  });
                }}
              >
                <Smartphone className="h-4 w-4" />
                <span>{t("settings.copyUrlIos")}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs gap-1.5 h-12 flex-col"
                onClick={() => {
                  // Download Tasker XML profile
                  const taskerXml = generateTaskerProfile(webhookUrl, ingestKey);
                  const blob = new Blob([taskerXml], { type: "text/xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "MailTrack_SMS_Forward.prf.xml";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(t("toast.taskerDownloaded"));
                }}
              >
                <Download className="h-4 w-4" />
                <span>{t("settings.downloadTaskerProfile")}</span>
              </Button>
            </div>

            {/* Expandable manual guides */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant={showGuide === "android" ? "secondary" : "ghost"} className="w-full text-xs gap-1.5" size="sm" onClick={() => setShowGuide(showGuide === "android" ? null : "android")}>
                {t("settings.manualAndroid")} {showGuide === "android" ? "▲" : "▼"}
              </Button>
              <Button variant={showGuide === "ios" ? "secondary" : "ghost"} className="w-full text-xs gap-1.5" size="sm" onClick={() => setShowGuide(showGuide === "ios" ? null : "ios")}>
                {t("settings.manualIos")} {showGuide === "ios" ? "▲" : "▼"}
              </Button>
            </div>

            {showGuide === "android" && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">{t("settings.androidTitle")}</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>{t("settings.androidInstall")}</li>
                  <li>{t("settings.taskerInstructions1")}</li>
                  <li>{t("settings.taskerInstructions2")}</li>
                  <li>Content filter: <code className="bg-muted px-1 rounded">shipped|tracking|delivery|parcel|חבילה|משלוח</code></li>
                  <li>{t("settings.taskerInstructions3")}</li>
                  <li>{t("settings.androidUrl")}</li>
                  <li>Body: <code className="bg-muted px-1 rounded">{`{"text": "%SMSRB", "source": "SMS from %SMSRF"}`}</code></li>
                </ol>
                <p className="text-xs mt-2">{t("settings.androidAlternatives")}</p>
              </div>
            )}

            {showGuide === "ios" && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">{t("settings.iosTitle")}</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>{t("settings.iosInstructions1")}</li>
                  <li>{t("settings.iosInstructions2")}</li>
                  <li>{t("settings.iosAddKeywords")} <code className="bg-muted px-1 rounded">tracking, shipped, delivered, package, parcel, חבילה, משלוח</code></li>
                  <li>{t("settings.iosInstructions3")}</li>
                  <li>{t("settings.iosNewBlank")}</li>
                  <li>{t("settings.iosAddAction")}</li>
                  <li>{t("settings.iosPasteUrl")}</li>
                  <li>{t("settings.iosShowMore")}</li>
                  <li>{t("settings.iosSetMethod")}</li>
                  <li>{t("settings.iosSetBody")}</li>
                  <li>{t("settings.iosAddKey")} <code className="bg-muted px-1 rounded">text</code></li>
                  <li>{t("settings.iosSetValue")}</li>
                  <li>{t("settings.iosInstructions4")}</li>
                </ol>
                <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ {t("settings.iosWarning")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Curl test */}
        {ingestKey && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("settings.testIt")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-[10px] font-mono overflow-x-auto whitespace-nowrap leading-relaxed">
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
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useI18n();

  // Check if browser supports push and if already subscribed (client-only)
  useEffect(() => {
    setMounted(true);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
      return;
    }
    setPushSupported(true);
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      }
    });
  }, []);

  const handleSubscribe = async () => {
    setPushState("subscribing");
    try {
      // Check secure context
      if (!window.isSecureContext) {
        toast.error(t("toast.pushRequireHttps"));
        setPushState("idle");
        return;
      }

      // Register service worker
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      } catch (swErr: any) {
        console.error("SW registration error:", swErr);
        toast.error(t("toast.swRegistrationFailed"));
        setPushState("idle");
        return;
      }

      // Get VAPID key
      const { publicKey } = await api.getVapidKey();
      if (!publicKey) {
        toast.error(t("toast.pushNotConfigured"));
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
        toast.error(t("toast.notificationDenied"));
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
      toast.success(t("toast.pushEnabled"));
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      const msg = err?.message ?? "";
      if (msg.includes("push service") || msg.includes("AbortError")) {
        toast.error(t("toast.pushUnavailable"));
      } else {
        toast.error(msg || t("toast.failedEnablePush"));
      }
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
      toast.success(t("toast.pushDisabled"));
    } catch (err: any) {
      toast.error(err?.message ?? t("toast.failedDisablePush"));
    } finally {
      setPushState("idle");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          {t("settings.notificationsTitle")}
        </CardTitle>
        <CardDescription>
          {t("settings.notificationsDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.pushNotificationsLabel")}</p>
            <p className="text-xs text-muted-foreground">
              {!mounted
                ? t("settings.checkingBrowser")
                : !pushSupported
                ? t("settings.notSupported")
                : isSubscribed
                ? t("settings.pushEnabled")
                : t("settings.pushDisabled")}
            </p>
          </div>
          {mounted && pushSupported && (
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
              {isSubscribed ? t("settings.disable") : t("settings.enable")}
            </Button>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="email-digest" className="text-sm font-medium">{t("settings.emailDigest")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.emailDigestDesc")}</p>
          </div>
          <Switch
            id="email-digest"
            checked={notifPrefs?.emailEnabled ?? false}
            onCheckedChange={() => updateNotifications.mutate({ emailEnabled: !notifPrefs?.emailEnabled })}
          />
        </div>

        {notifPrefs?.emailEnabled && (
          <>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.digestFrequency")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.digestFrequencyDesc")}</p>
              </div>
              <select
                value={notifPrefs?.digestFrequency ?? "weekly"}
                onChange={(e) => updateNotifications.mutate({ digestFrequency: e.target.value })}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="daily">{t("settings.frequencyDaily")}</option>
                <option value="weekly">{t("settings.frequencyWeekly")}</option>
                <option value="monthly">{t("settings.frequencyMonthly")}</option>
                <option value="yearly">{t("settings.frequencyYearly")}</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-dashed p-3">
              <p className="text-xs text-muted-foreground">{t("settings.testDigestPrompt")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await api.sendTestDigest();
                    toast.success(res.message || t("toast.testDigestSent"));
                  } catch (err: any) {
                    toast.error(err?.message || t("toast.failedTestDigest"));
                  }
                }}
              >
                {t("settings.sendTest")}
              </Button>
            </div>
          </>
        )}

        {isSubscribed && (
          <Alert className="border-green-600 bg-green-50 text-green-800 dark:border-green-500 dark:bg-green-950 dark:text-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">
              {t("settings.pushActiveAlert")}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StoreImportSection() {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const SUPPORTED_STORES = [
    { label: "Amazon", domain: "amazon.com" },
    { label: "eBay", domain: "ebay.com" },
    { label: "AliExpress", domain: "aliexpress.com" },
    { label: "iHerb", domain: "iherb.com" },
    { label: "Shein", domain: "shein.com" },
    { label: "Temu", domain: "temu.com" },
    { label: "Etsy", domain: "etsy.com" },
    { label: "Shopify", domain: "shopify.com" },
    { label: "Walmart", domain: "walmart.com" },
    { label: "Target", domain: "target.com" },
    { label: "ASOS", domain: "asos.com" },
    { label: "Zara", domain: "zara.com" },
    { label: "Nike", domain: "nike.com" },
    { label: "Apple", domain: "apple.com" },
    { label: "IKEA", domain: "ikea.com" },
    { label: "H&M", domain: "hm.com" },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error(t("settings.noValidCsvRows"));
        return;
      }
      const result = await api.importCsv(rows);
      toast.success(`Imported ${result.imported} packages (${result.skipped} skipped)`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    } catch (err: any) {
      toast.error(err?.message ?? t("settings.failedImportCsv"));
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
          {t("settings.storeOrders")}
        </CardTitle>
        <CardDescription>
          {t("settings.storeOrdersDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supported stores grid */}
        <div className="grid grid-cols-4 gap-2">
          {SUPPORTED_STORES.map((store) => (
            <div
              key={store.label}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-2.5 bg-muted/20"
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${store.domain}&sz=32`}
                alt={store.label}
                width={24}
                height={24}
                className="rounded-sm"
                loading="lazy"
              />
              <span className="text-[10px] font-medium text-muted-foreground">{store.label}</span>
            </div>
          ))}
        </div>

        <Alert className="border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <AlertTitle className="text-xs font-medium">{t("settings.howItWorks")}</AlertTitle>
          <AlertDescription className="text-xs">
            {t("settings.howItWorksDesc")}
          </AlertDescription>
        </Alert>

        <Alert className="border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertTitle className="text-xs font-medium">{t("settings.whyNotDirect")}</AlertTitle>
          <AlertDescription className="text-xs">
            {t("settings.whyNotDirectDesc")}
          </AlertDescription>
        </Alert>

        {/* CSV Import */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> {t("settings.importCsvTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings.importCsvDesc")}
          </p>
          <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border active:border-primary/50 p-4 transition-colors cursor-pointer">
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
                <span className="text-sm text-muted-foreground">{t("settings.importing")}</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t("settings.clickUploadCsv")}</span>
              </>
            )}
          </label>
          <p className="text-[10px] text-muted-foreground">
            {t("settings.csvExpectedColumns")}
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

/** Generate a Tasker profile XML for SMS forwarding */
function generateTaskerProfile(webhookUrl: string, ingestKey: string): string {
  const fullUrl = `${webhookUrl}?key=${ingestKey}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<TaskerData sr="" dvi="1" tv="6.3.13">
  <Profile sr="prof0" ve="2">
    <cdate>0</cdate>
    <edate>0</edate>
    <flags>0</flags>
    <id>100</id>
    <mid0>101</mid0>
    <nme>MailTrack SMS Forward</nme>
    <Event sr="con0" ve="2">
      <code>7</code>
      <pri>0</pri>
      <Str sr="arg0" ve="3">shipped|tracking|delivery|parcel|חבילה|משלוח|הזמנה|DHL|FedEx|UPS</Str>
      <Int sr="arg1" val="2"/>
    </Event>
  </Profile>
  <Task sr="task101">
    <cdate>0</cdate>
    <edate>0</edate>
    <id>101</id>
    <nme>Forward to MailTrack</nme>
    <Action sr="act0" ve="7">
      <code>339</code>
      <Str sr="arg0" ve="3">POST</Str>
      <Str sr="arg1" ve="3">${fullUrl}</Str>
      <Str sr="arg2" ve="3">Content-Type: application/json</Str>
      <Str sr="arg3" ve="3">{"text": "%SMSRB", "source": "SMS from %SMSRF"}</Str>
      <Int sr="arg4" val="30"/>
    </Action>
  </Task>
</TaskerData>`;
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
