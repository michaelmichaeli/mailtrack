"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, User, Mail, Calendar, Shield, Save, Pencil, RotateCcw } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMe().then((data) => {
      setUser(data as UserProfile);
      setEditName(data.name || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
    return <p className="text-center text-muted-foreground py-20">Unable to load profile</p>;
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
              <Image
                src={user.avatar}
                alt={user.name}
                width={64}
                height={64}
                className="rounded-full border-2 border-border shadow-sm"
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

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Last Updated</Label>
              <p className="text-sm font-medium">
                {new Date(user.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Onboarding</Label>
              <p className="text-sm font-medium">{user.onboardingCompleted ? "Completed ✓" : "Not completed"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
