"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  Settings,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
  Bell,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useScrollRestore } from "@/lib/use-scroll-restore";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { PushNotificationManager } from "@/components/notifications/push-manager";

const navItems = [
  { href: "/packages", label: "Orders", icon: Package },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useScrollRestore();

  const handleSignOut = async () => {
    try { await api.logout(); } catch {}
    api.setToken(null);
    window.location.href = "/login";
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const themeLabel = !mounted ? "" : theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";
  const ThemeIcon = !mounted ? Sun : theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <Link href="/packages" className="flex items-center gap-3 min-w-0">
          <Image src="/logo.png" alt="MailTrack" width={36} height={36} className="drop-shadow-sm" />
          <div>
            <span className="text-base font-bold text-foreground tracking-tight">MailTrack</span>
            <p className="text-[10px] text-muted-foreground leading-none">Every package. One dashboard.</p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto md:hidden p-1 rounded-lg hover:bg-accent"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 overflow-hidden",
                isActive
                  ? "bg-gradient-to-r from-primary/15 to-violet-500/10 text-foreground shadow-sm border border-primary/20"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-primary" />
              )}
              <Icon className={cn("h-[18px] w-[18px] transition-colors", isActive ? "text-primary" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border/60 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-0.5">
        <button
          onClick={cycleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all duration-200"
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
          Theme: {themeLabel}
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden p-2 rounded-lg bg-card border border-border shadow-md"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Floating notification bell — mobile only */}
      <div className="fixed top-4 right-4 z-40 md:hidden">
        <NotificationBell />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 flex-col border-r border-border bg-card transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-60 flex-col border-r border-border/40 bg-gradient-to-b from-card via-card to-accent/30 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Floating scroll-to-top button */}
      <ScrollToTop />

      {/* Push notification permission manager */}
      <PushNotificationManager />
    </>
  );
}
