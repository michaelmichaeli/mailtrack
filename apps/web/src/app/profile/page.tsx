"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, User, Mail, Calendar, Shield, Save, Pencil, RotateCcw, Package, Truck, CheckCircle2, Bell, Store, BarChart3, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { LogoSpinner } from "@/components/ui/logo-spinner";

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
      toast.success("Name updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try { await api.logout(); } catch {}
    api.setToken(null);
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LogoSpinner size={48} />
      </div>
    );
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
              <h2 className="text-lg font-semibold">Couldn&apos;t load your profile</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {error || "Something went wrong. The server might be taking a nap."}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={loadProfile}>
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/packages"}>
                Go to Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const joinDate = new Date(user.createdAt);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your account information</p>
      </div>

      {/* Avatar + Name */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full border-2 border-border shadow-sm object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <User className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold truncate">{user.name}</h2>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{user.email}</p>
                {user.emailVerified && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Verified
                  </span>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sign-in Method</Label>
              <p className="text-sm font-medium capitalize">{user.authProvider.toLowerCase().replace("_", " ")}</p>
            </div>
            {user.givenName && (
              <div>
                <Label className="text-xs text-muted-foreground">First Name</Label>
                <p className="text-sm font-medium">{user.givenName}</p>
              </div>
            )}
            {user.familyName && (
              <div>
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                <p className="text-sm font-medium">{user.familyName}</p>
              </div>
            )}
            {user.locale && (
              <div>
                <Label className="text-xs text-muted-foreground">Locale</Label>
                <p className="text-sm font-medium uppercase">{user.locale}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Member Since</Label>
              <p className="text-sm font-medium">
                {joinDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {user.googleId && (
              <div>
                <Label className="text-xs text-muted-foreground">Google ID</Label>
                <p className="text-sm font-mono text-muted-foreground truncate">{user.googleId}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Account ID</Label>
              <p className="text-sm font-mono text-muted-foreground truncate">{user.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Emails */}
      {user.connectedEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" />
              Connected Emails
            </CardTitle>
            <CardDescription>Emails linked for package tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.connectedEmails.map((ce) => (
                <div key={ce.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ce.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{ce.provider.toLowerCase()}</p>
                    </div>
                  </div>
                  {ce.lastSyncAt && (
                    <p className="text-xs text-muted-foreground shrink-0">
                      Last synced {new Date(ce.lastSyncAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Usage Stats
            </CardTitle>
            <CardDescription>Your activity on MailTrack</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                <p className="text-[11px] text-muted-foreground">Orders</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Truck className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{stats.totalPackages}</p>
                <p className="text-[11px] text-muted-foreground">Packages</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold">{stats.deliveredPackages}</p>
                <p className="text-[11px] text-muted-foreground">Delivered</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Store className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                <p className="text-2xl font-bold">{stats.uniqueStores}</p>
                <p className="text-[11px] text-muted-foreground">Stores</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Truck className="h-5 w-5 mx-auto mb-1 text-violet-500" />
                <p className="text-2xl font-bold">{stats.uniqueCarriers}</p>
                <p className="text-[11px] text-muted-foreground">Carriers</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Bell className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-2xl font-bold">{stats.totalNotifications}</p>
                <p className="text-[11px] text-muted-foreground">Notifications</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">In transit</span>
                <span className="font-medium">{stats.inTransitPackages}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tracking events</span>
                <span className="font-medium">{stats.totalEvents}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Connected emails</span>
                <span className="font-medium">{stats.connectedEmailCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium">{joinDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sign Out */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => window.location.href = "/onboarding"}>
          <RotateCcw className="h-4 w-4" />
          Replay onboarding
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
