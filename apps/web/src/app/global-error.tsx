"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">Something went very wrong</h1>
            <p className="text-muted-foreground">
              The application encountered a critical error. This has been logged automatically.
            </p>
            {process.env.NODE_ENV === "development" && (
              <pre className="text-xs text-left bg-muted rounded-lg p-3 overflow-auto max-h-32">
                {error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={reset}>
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/packages")}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
