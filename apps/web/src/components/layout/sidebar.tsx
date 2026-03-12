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
  Globe,
  BarChart3,
  MapPin,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useScrollRestore } from "@/lib/use-scroll-restore";
import { useI18n } from "@/lib/i18n";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { PushNotificationManager } from "@/components/notifications/push-manager";

export function Sidebar() {
  const { t, locale, setLocale } = useI18n();

  const LOCALES = [
    { code: "en", label: "English" },
    { code: "he", label: "עברית" },
    { code: "ar", label: "العربية" },
    { code: "ru", label: "Русский" },
  ] as const;

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

  const navItems = [
    { href: "/packages", label: t("nav.orders"), icon: Package },
    { href: "/analytics", label: t("nav.analytics"), icon: BarChart3 },
    { href: "/map", label: t("nav.map"), icon: MapPin },
    { href: "/notifications", label: t("nav.notifications"), icon: Bell },
    { href: "/profile", label: t("nav.profile"), icon: User },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const handleSignOut = async () => {
    try { await api.logout(); } catch {}
    api.setToken(null);
    window.location.href = "/login";
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <Link href="/packages" className="flex items-center gap-3 min-w-0">
          <Image src="/logo.png" alt="MailTrack" width={36} height={36} className="drop-shadow-sm" />
          <div>
            <span className="text-base font-bold text-foreground tracking-tight">MailTrack</span>
            <p className="text-[10px] text-muted-foreground leading-none">{t("nav.tagline")}</p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="ms-auto md:hidden p-1 rounded-lg active:bg-accent"
          aria-label={t("nav.closeMenu")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{t("nav.menu")}</p>
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
                  : "text-muted-foreground active:bg-muted/80 active:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 bottom-0 w-[3px] rounded-l-xl bg-primary ltr:left-0 rtl:right-0" />
              )}
              <Icon className={cn("h-[18px] w-[18px] transition-colors", isActive ? "text-primary" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border/60 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1.5">
        {/* Language select */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-1.5">
          <Globe className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-muted-foreground active:text-foreground cursor-pointer outline-none appearance-none"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Theme select */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-1.5">
          {mounted && (theme === "dark" ? <Moon className="h-[18px] w-[18px] text-muted-foreground shrink-0" /> : theme === "system" ? <Monitor className="h-[18px] w-[18px] text-muted-foreground shrink-0" /> : <Sun className="h-[18px] w-[18px] text-muted-foreground shrink-0" />)}
          {!mounted && <Sun className="h-[18px] w-[18px] text-muted-foreground shrink-0" />}
          <select
            value={mounted ? theme ?? "system" : "system"}
            onChange={(e) => setTheme(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-muted-foreground active:text-foreground cursor-pointer outline-none appearance-none"
          >
            <option value="light">{t("settings.light")}</option>
            <option value="dark">{t("settings.dark")}</option>
            <option value="system">{t("settings.system")}</option>
          </select>
        </div>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground active:bg-destructive/10 active:text-destructive transition-all duration-200"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {t("nav.signOut")}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 z-40 md:hidden p-2 rounded-lg bg-card border border-border shadow-md ltr:left-4 rtl:right-4"
        aria-label={t("nav.openMenu")}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Floating notification bell — mobile only */}
      <div className="fixed top-4 z-40 md:hidden ltr:right-4 rtl:left-4">
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
          "fixed inset-y-0 z-50 flex h-[100dvh] w-64 flex-col border-border bg-card transition-transform duration-200 md:hidden",
          "ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l",
          mobileOpen ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
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
