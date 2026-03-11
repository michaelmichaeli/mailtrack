"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SCROLL_KEY_PREFIX = "mailtrack_scroll_";

/**
 * Scroll to top on sidebar navigation.
 * Save scroll position so browser back/forward can restore it.
 */
export function useScrollRestore() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    if (!scrollContainer) return;

    const key = SCROLL_KEY_PREFIX + pathname;
    const navigationType = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
    const isBackForward = navigationType?.type === "back_forward" ||
      (window.history.state && window.history.state.__scrollRestored);

    if (isBackForward) {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const pos = parseInt(saved, 10);
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = pos;
        });
      }
    } else if (prevPathname.current !== pathname) {
      // New navigation (sidebar click) — scroll to top
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = 0;
      });
    }

    prevPathname.current = pathname;

    const handleScroll = () => {
      sessionStorage.setItem(key, String(scrollContainer.scrollTop));
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [pathname]);
}
