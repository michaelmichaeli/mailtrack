"use client";

import { useEffect, useCallback, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useI18n } from "@/lib/i18n";

const WALKTHROUGH_KEY = "mailtrack_walkthrough_done";

function playStepSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600;
    osc.type = "sine";
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch { /* Audio not available */ }
}

function playCompleteSound() {
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = 0.06;
      const start = ctx.currentTime + i * 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch { /* Audio not available */ }
}

export function useWalkthrough() {
  const { t } = useI18n();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const startTour = useCallback(() => {
    const steps: DriveStep[] = [
      {
        popover: {
          title: t("walkthrough.welcome.title"),
          description: t("walkthrough.welcome.desc"),
          side: "over",
          align: "center",
        },
      },
      {
        element: "nav",
        popover: {
          title: t("walkthrough.sidebar.title"),
          description: t("walkthrough.sidebar.desc"),
          side: "right",
          align: "center",
        },
      },
      {
        element: ".grid-catalog",
        popover: {
          title: t("walkthrough.packages.title"),
          description: t("walkthrough.packages.desc"),
          side: "top",
          align: "center",
        },
      },
      {
        element: "[data-walkthrough='filters']",
        popover: {
          title: t("walkthrough.filters.title"),
          description: t("walkthrough.filters.desc"),
          side: "bottom",
          align: "start",
        },
      },
      {
        element: "[data-walkthrough='sync']",
        popover: {
          title: t("walkthrough.sync.title"),
          description: t("walkthrough.sync.desc"),
          side: "bottom",
          align: "end",
        },
      },
      {
        element: "[data-walkthrough='notifications']",
        popover: {
          title: t("walkthrough.notifications.title"),
          description: t("walkthrough.notifications.desc"),
          side: "bottom",
          align: "end",
        },
      },
      {
        popover: {
          title: t("walkthrough.done.title"),
          description: t("walkthrough.done.desc"),
          side: "over",
          align: "center",
        },
      },
    ];

    const d = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 12,
      allowClose: true,
      overlayColor: "rgba(0,0,0,0.6)",
      nextBtnText: t("walkthrough.next"),
      prevBtnText: t("walkthrough.prev"),
      doneBtnText: t("walkthrough.finish"),
      onHighlightStarted: () => {
        playStepSound();
      },
      onDestroyed: () => {
        playCompleteSound();
        localStorage.setItem(WALKTHROUGH_KEY, "true");
      },
      steps,
    });

    driverRef.current = d;
    d.drive();
  }, [t]);

  return { startTour };
}

/**
 * Auto-starts walkthrough on first visit to /packages after onboarding.
 */
export function WalkthroughTrigger() {
  const { startTour } = useWalkthrough();

  useEffect(() => {
    const done = localStorage.getItem(WALKTHROUGH_KEY);
    if (done) return;

    const timer = setTimeout(() => {
      startTour();
    }, 1500);

    return () => clearTimeout(timer);
  }, [startTour]);

  return null;
}
