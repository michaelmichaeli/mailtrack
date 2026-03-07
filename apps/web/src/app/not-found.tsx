"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Package } from "lucide-react";

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
    <div className="flex h-screen">
      <Sidebar />
      <div className="fixed top-4 right-4 z-40">
        <NotificationBell />
      </div>
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
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

        <div className="flex flex-col items-center justify-center min-h-full p-6 pt-16 md:pt-6">
          <div className={`text-center z-20 ${shaking ? "animate-bounce" : ""}`}>
            <h1 className="text-[8rem] sm:text-[10rem] font-black leading-none tracking-tighter text-foreground/10 select-none">
              404
            </h1>

            <div className="text-6xl mb-4 animate-bounce">📦❓</div>

            <Card className="max-w-md mx-auto border-border/50 shadow-lg">
              <CardContent className="pt-6 pb-6 text-center space-y-4">
                <button
                  onClick={cycleMessage}
                  className="text-base sm:text-lg font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                >
                  {message}
                </button>
                <p className="text-xs text-muted-foreground">(click for another excuse)</p>

                {score > 0 && (
                  <div className="text-sm font-medium text-primary animate-in fade-in">
                    📦 Packages rescued: {score}
                    {score >= 5 && " — You're a delivery hero!"}
                    {score >= 10 && " 🏆"}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button onClick={() => (window.location.href = "/packages")}>
                    <Package className="h-4 w-4" />
                    Track My Packages
                  </Button>
                  <Button variant="outline" onClick={() => window.history.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground mt-6">
              💡 Tip: Catch the floating packages for bonus points!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
