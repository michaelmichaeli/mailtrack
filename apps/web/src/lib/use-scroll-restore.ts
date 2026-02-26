"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SCROLL_KEY_PREFIX = "mailtrack_scroll_";

/**
 * Save and restore scroll position for the current page.
 * Works with the main content area (scrollable element).
 */
export function useScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    if (!scrollContainer) return;

    const key = SCROLL_KEY_PREFIX + pathname;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const pos = parseInt(saved, 10);
      // Delay to let content render before restoring scroll
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = pos;
      });
    }

    const handleScroll = () => {
      sessionStorage.setItem(key, String(scrollContainer.scrollTop));
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [pathname]);
}
