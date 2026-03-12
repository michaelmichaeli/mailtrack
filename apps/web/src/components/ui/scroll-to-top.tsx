"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();

  const getScrollContainer = useCallback(() => {
    return document.querySelector("main") || window;
  }, []);

  useEffect(() => {
    const container = getScrollContainer();
    const onScroll = () => {
      const scrollTop = container instanceof Window
        ? window.scrollY
        : (container as HTMLElement).scrollTop;
      setVisible(scrollTop > 300);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [getScrollContainer]);

  const scrollToTop = () => {
    const container = getScrollContainer();
    if (container instanceof Window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      (container as HTMLElement).scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center",
        "rounded-full bg-primary text-primary-foreground shadow-lg",
        "active:bg-primary/90 transition-all duration-200",
        "animate-in fade-in zoom-in-75"
      )}
      aria-label={t("a11y.scrollToTop")}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
