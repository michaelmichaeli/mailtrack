"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Mail, Package, ShoppingBag, Check, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Step = "connect-email" | "syncing" | "connect-shops" | "complete";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("connect-email");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ emailsParsed: number; ordersCreated: number } | null>(null);
  const router = useRouter();

  const handleConnectGmail = async () => {
    try {
      const { url } = await api.getGmailAuthUrl();
      window.location.href = url;
    } catch {
      toast.error("Failed to connect Gmail");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setStep("syncing");
    try {
      const result = await api.syncEmails();
      setSyncResult(result);
      setStep("connect-shops");
    } catch {
      toast.error("Sync failed");
      setStep("connect-email");
    } finally {
      setSyncing(false);
    }
  };

  const handleFinish = () => {
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Package className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Set up MailTrack</CardTitle>
          <CardDescription>
            {step === "connect-email" && "Connect your email to start tracking — every package, every store, one dashboard."}
            {step === "syncing" && "Scanning your emails for orders and tracking info..."}
            {step === "connect-shops" && "Optionally connect your shop accounts for better accuracy"}
            {step === "complete" && "You're all set!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {["connect-email", "syncing", "connect-shops"].map((s, i) => (
              <div
                key={s}
                className={`h-2 w-12 rounded-full ${
                  ["connect-email", "syncing", "connect-shops"].indexOf(step) >= i
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === "connect-email" && (
            <>
              <Button className="w-full" size="lg" onClick={handleConnectGmail}>
                <Mail className="h-5 w-5 mr-2" />
                Connect Gmail
              </Button>
              <Button className="w-full" size="lg" variant="outline" disabled>
                <Mail className="h-5 w-5 mr-2" />
                Connect Outlook (Coming soon)
              </Button>
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm" onClick={handleSync}>
                  Skip for now
                </Button>
              </div>
            </>
          )}

          {step === "syncing" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">
                Scanning your inbox for order confirmations and shipping notifications...
              </p>
            </div>
          )}

          {step === "connect-shops" && (
            <>
              {syncResult && (
                <div className="rounded-lg p-4 text-center mb-4" style={{ backgroundColor: '#f0fdf4' }}>
                  <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">
                    Found {syncResult.ordersCreated} orders from {syncResult.emailsParsed} emails
                  </p>
                </div>
              )}
              <Button className="w-full" size="lg" variant="outline" disabled>
                <ShoppingBag className="h-5 w-5 mr-2" />
                Connect Amazon (Coming soon)
              </Button>
              <Button className="w-full" size="lg" variant="outline" disabled>
                <ShoppingBag className="h-5 w-5 mr-2" />
                Connect AliExpress (Coming soon)
              </Button>
              <Button className="w-full" size="lg" onClick={handleFinish}>
                Go to dashboard
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
