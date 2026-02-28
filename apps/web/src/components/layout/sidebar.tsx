"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  LayoutDashboard,
  Settings,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Mail,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useScrollRestore } from "@/lib/use-scroll-restore";
import { NotificationBell } from "@/components/notifications/notification-bell";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/packages", label: "Orders", icon: Package },
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
    router.push("/login");
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
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Mail className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <span className="text-base font-bold text-foreground tracking-tight">MailTrack</span>
          <p className="text-[10px] text-muted-foreground leading-none">Every package. One dashboard.</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto md:hidden p-1 rounded-lg hover:bg-accent"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", isActive && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border px-3 py-3 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-2">
          <NotificationBell />
          <span className="text-sm font-medium text-muted-foreground">Notifications</span>
        </div>
        <button
          onClick={cycleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
          Theme: {themeLabel}
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-60 flex-col border-r border-border bg-card flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
