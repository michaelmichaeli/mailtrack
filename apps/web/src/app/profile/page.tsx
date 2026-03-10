"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, Shield, Save, Pencil, Package, Truck, CheckCircle2, Bell, Store, BarChart3, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { ProfileSkeleton } from "@/components/ui/skeleton";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  givenName: string | null;
  familyName: string | null;
  locale: string | null;
  googleId: string | null;
  emailVerified: boolean;
  authProvider: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  connectedEmails: { id: string; provider: string; email: string; lastSyncAt: string | null }[];
  connectedShops: { id: string; platform: string; createdAt: string }[];
}

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<{
    totalOrders: number;
    totalPackages: number;
    deliveredPackages: number;
    inTransitPackages: number;
    totalEvents: number;
    totalNotifications: number;
    connectedEmailCount: number;
    uniqueCarriers: number;
    uniqueStores: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProfile = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getMe(),
      api.getUserStats().catch(() => null),
    ]).then(([userData, statsData]) => {
      setUser(userData as UserProfile);
      setEditName(userData.name || "");
      setStats(statsData);
      setLoading(false);
    }).catch((err) => {
      setError(err?.message || "Could not load profile");
      setLoading(false);
    });
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.updateProfile({ name: editName.trim() });
      setUser((prev) => prev ? { ...prev, name: editName.trim() } : prev);
      setEditing(false);
      toast.success(t("toast.nameUpdated"));
    } catch {
      toast.error(t("toast.failedUpdateName"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-sm w-full border-destructive/30">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <WifiOff className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t("profile.couldntLoad")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {error || t("profile.somethingWentWrong")}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={loadProfile}>
                <RefreshCw className="h-4 w-4" />
                {t("profile.tryAgain")}
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/packages"}>
                {t("profile.goToOrders")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const joinDate = new Date(user.createdAt);
  const dateLocale = locale === "he" ? "he-IL" : locale === "ar" ? "ar" : locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("profile.title")}</h1>
          <p className="text-sm text-muted-foreground/80 mt-0.5">{t("profile.subtitle")}</p>
        </div>
        <div className="hidden md:block">
          <NotificationBell />
        </div>
      </div>

      {/* Avatar + Name */}
      <Card>
        <div className="relative">
          {/* Gradient banner */}
          <div className="h-24 rounded-t-xl bg-gradient-to-r from-primary/20 via-violet-500/15 to-indigo-400/10">
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent_70%)] rounded-t-xl" />
          </div>
          {/* Avatar — positioned to overlap the banner */}
          <div className="absolute left-5 bottom-0 translate-y-1/2 z-10">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                width={80}
                height={80}
                className="h-20 w-20 rounded-full border-4 border-card shadow-lg object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center border-4 border-card shadow-lg">
                <User className="h-9 w-9 text-primary" />
              </div>
            )}
          </div>
        </div>
        <CardContent className="pt-14 pb-5">
          <div className="flex items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <Button size="sm" onClick={handleSaveName} disabled={saving}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditName(user.name); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold truncate">{user.name}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={t("profile.editName")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{user.email}</p>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            {t("profile.accountDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">{t("profile.email")}</Label>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{user.email}</p>
                {user.emailVerified && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {t("profile.verified")}
                  </span>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("profile.signInMethod")}</Label>
              <p className="text-sm font-medium capitalize">{user.authProvider.toLowerCase().replace("_", " ")}</p>
            </div>
            {user.givenName && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.firstName")}</Label>
                <p className="text-sm font-medium">{user.givenName}</p>
              </div>
            )}
            {user.familyName && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.lastName")}</Label>
                <p className="text-sm font-medium">{user.familyName}</p>
              </div>
            )}
            {user.locale && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.locale")}</Label>
                <p className="text-sm font-medium uppercase">{user.locale}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">{t("profile.memberSince")}</Label>
              <p className="text-sm font-medium">
                {joinDate.toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {user.googleId && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.googleId")}</Label>
                <p className="text-sm font-mono text-muted-foreground truncate">{user.googleId}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">{t("profile.accountId")}</Label>
              <p className="text-sm font-mono text-muted-foreground truncate">{user.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t("profile.usageStats")}
            </CardTitle>
            <CardDescription>{t("profile.activityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border/60 p-3 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.orders")}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{stats.totalPackages}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.packages")}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{stats.deliveredPackages}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.delivered")}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Store className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold">{stats.uniqueStores}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.stores")}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-violet-500" />
                </div>
                <p className="text-2xl font-bold">{stats.uniqueCarriers}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.carriers")}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center hover:shadow-sm transition-shadow">
                <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold">{stats.totalNotifications}</p>
                <p className="text-[11px] text-muted-foreground">{t("profile.notifications")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("profile.inTransit")}</span>
                <span className="font-medium">{stats.inTransitPackages}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("profile.trackingEvents")}</span>
                <span className="font-medium">{stats.totalEvents}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("profile.connectedEmails")}</span>
                <span className="font-medium">{stats.connectedEmailCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("profile.memberSince")}</span>
                <span className="font-medium">{joinDate.toLocaleDateString(dateLocale, { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
