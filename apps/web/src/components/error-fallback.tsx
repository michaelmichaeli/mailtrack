"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const QUIPS = [
  "Well, that wasn't supposed to happen.",
  "Something tripped over a cable somewhere.",
  "Our hamsters stopped running. Rebooting…",
  "This package of code arrived damaged.",
  "Error in transit. Please try again.",
];

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const { t } = useI18n();
  const quip = QUIPS[Math.abs(hashCode(error.message)) % QUIPS.length];

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full border-destructive/30 shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-1">{quip}</p>
          </div>

          {process.env.NODE_ENV === "development" && (
            <pre className="text-xs text-left bg-muted/50 rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
              {error.message}
            </pre>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={reset}>
              <RefreshCw className="h-4 w-4" />
              {t("error.tryAgain")}
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t("error.backHome")}
            </Button>
          </div>

          {error.digest && (
            <p className="text-[10px] text-muted-foreground/60">Error ID: {error.digest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
