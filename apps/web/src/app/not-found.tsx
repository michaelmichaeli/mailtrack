"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const MESSAGES = [
  "This package got lost in transit… just like this page.",
  "Tracking number not found. Neither is this page.",
  "Delivered to the wrong address. Way wrong.",
  "Our delivery driver took a wrong turn at /nowhere.",
  "This page is stuck in customs. Indefinitely.",
  "Expected delivery: Never. This page doesn't exist.",
  "Status: Lost. Last seen: absolutely nowhere.",
  "Return to sender — this URL doesn't live here.",
];

const EMOJIS = ["📦", "🚚", "✈️", "🛳️", "🏃", "🔍", "🗺️", "💨"];

interface Box {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
}

export default function NotFound() {
  const [message, setMessage] = useState(MESSAGES[0]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [score, setScore] = useState(0);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  }, []);

  // Spawn floating boxes
  useEffect(() => {
    const interval = setInterval(() => {
      setBoxes((prev) => {
        if (prev.length >= 12) return prev;
        return [
          ...prev,
          {
            id: Date.now(),
            x: Math.random() * 80 + 10,
            y: -10,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 1.5 + 0.5,
            emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          },
        ];
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Animate boxes
  useEffect(() => {
    const frame = setInterval(() => {
      setBoxes((prev) =>
        prev
          .map((b) => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
          .filter((b) => b.y < 110 && b.x > -10 && b.x < 110)
      );
    }, 50);
    return () => clearInterval(frame);
  }, []);

  const catchBox = useCallback((id: number) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setScore((s) => s + 1);
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  }, []);

  const cycleMessage = () => {
    setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-background to-violet-50 dark:from-indigo-950/20 dark:via-background dark:to-violet-950/20"
    >
      {/* Floating boxes */}
      {boxes.map((box) => (
        <button
          key={box.id}
          onClick={() => catchBox(box.id)}
          className="absolute text-3xl cursor-pointer hover:scale-150 transition-transform duration-150 select-none z-10"
          style={{ left: `${box.x}%`, top: `${box.y}%` }}
          aria-label="Catch the package"
        >
          {box.emoji}
        </button>
      ))}

      <div className={`text-center z-20 px-4 ${shaking ? "animate-bounce" : ""}`}>
        {/* Big 404 */}
        <h1 className="text-[8rem] sm:text-[10rem] font-black leading-none tracking-tighter text-foreground/10 select-none">
          404
        </h1>

        {/* Lost package icon */}
        <div className="text-6xl mb-4 animate-bounce">📦❓</div>

        {/* Funny message */}
        <button
          onClick={cycleMessage}
          className="text-lg sm:text-xl font-medium text-foreground max-w-md mx-auto cursor-pointer hover:text-primary transition-colors"
        >
          {message}
        </button>
        <p className="text-xs text-muted-foreground mt-1">(click for another excuse)</p>

        {/* Score */}
        {score > 0 && (
          <div className="mt-4 text-sm font-medium text-primary animate-in fade-in">
            📦 Packages rescued: {score}
            {score >= 5 && " — You're a delivery hero!"}
            {score >= 10 && " 🏆"}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link
            href="/packages"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            📋 Track My Packages
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 font-medium shadow-sm hover:bg-accent transition-all active:scale-[0.98]"
          >
            ← Go Back
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          💡 Tip: Catch the floating packages for bonus points!
        </p>
      </div>
    </div>
  );
}
