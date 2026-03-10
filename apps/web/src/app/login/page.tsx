"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { startAuthentication } from "@simplewebauthn/browser";
import { useI18n } from "@/lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const errorParam = searchParams.get("error");
  const [displayError, setDisplayError] = useState<string | null>(errorParam);

  // Clear error from URL after capturing it so it doesn't persist on navigation
  useEffect(() => {
    if (errorParam) {
      setDisplayError(errorParam);
      router.replace("/login", { scroll: false });
    }
  }, [errorParam, router]);

  const handleGoogleLogin = () => {
    setLoading("google");
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleGitHubLogin = () => {
    setLoading("github");
    window.location.href = `${API_URL}/api/auth/github`;
  };

  const handleAppleLogin = () => {
    setLoading("apple");
    window.location.href = `${API_URL}/api/auth/apple`;
  };

  const handlePasskeyLogin = async () => {
    setLoading("passkey");
    setPasskeyError(null);
    try {
      const options = await api.getPasskeyLoginOptions();
      const credential = await startAuthentication({ optionsJSON: options });
      await api.loginWithPasskey(credential);
      router.push("/packages");
    } catch (err: any) {
      setLoading(null);
      if (err?.name === "NotAllowedError") {
        console.warn("Passkey login dismissed or not available:", err.message);
        return;
      }
      console.error("Passkey login failed:", err);
      setPasskeyError(err?.response?.error ?? err?.message ?? "Passkey login failed");
    }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      await api.devLogin();
      router.push("/dashboard");
    } catch {
      setDevLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-background to-violet-50 dark:from-indigo-950/30 dark:via-background dark:to-violet-950/30 p-4 relative overflow-hidden">
      {/* Decorative background orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl animate-float will-change-transform" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-violet-500/[0.04] blur-3xl animate-float will-change-transform" style={{ animationDuration: '10s', animationDelay: '3s' }} />
      <div className="absolute top-[30%] right-[15%] w-[250px] h-[250px] rounded-full bg-indigo-400/[0.03] blur-2xl animate-float will-change-transform" style={{ animationDuration: '12s' }} />
      <div className="absolute bottom-[30%] left-[10%] w-[200px] h-[200px] rounded-full bg-violet-400/[0.03] blur-2xl animate-float will-change-transform" style={{ animationDuration: '14s', animationDelay: '2s' }} />

      <Card className="w-full max-w-md shadow-2xl border-border/30 backdrop-blur-sm relative z-10 overflow-hidden">
        {/* Top gradient strip */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-violet-500 to-primary" />
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-[2]" />
              <Image src="/logo.png" alt="MailTrack" width={56} height={56} className="drop-shadow-lg relative" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome to MailTrack</CardTitle>
          <CardDescription className="text-sm">
            Every package, every store, one dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {(displayError || passkeyError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{displayError || passkeyError}</AlertDescription>
            </Alert>
          )}

          <Button className="w-full" size="lg" onClick={handleGoogleLogin} disabled={!!loading}>
            <svg className="h-5 w-5 shrink-0" width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading === "google" ? "Signing in…" : t("login.continueWithGoogle")}
          </Button>

          <Button className="w-full" size="lg" variant="outline" onClick={handleGitHubLogin} disabled={!!loading}>
            <svg className="h-5 w-5 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {loading === "github" ? "Signing in…" : t("login.continueWithGithub")}
          </Button>

          <div className="relative my-2">
            <Separator />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-card px-2 text-xs uppercase text-muted-foreground">or</span>
            </div>
          </div>

          <Button className="w-full" size="lg" variant="secondary" onClick={handlePasskeyLogin} disabled={!!loading}>
            <KeyRound className="h-5 w-5 shrink-0" />
            {loading === "passkey" ? "Verifying…" : t("login.signInWithPasskey")}
          </Button>

          {process.env.NODE_ENV !== "production" && (
            <>
              <div className="relative my-2">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-card px-2 text-xs uppercase text-muted-foreground">Dev</span>
                </div>
              </div>

              <Button className="w-full truncate" size="lg" variant="secondary" onClick={handleDevLogin} disabled={devLoading}>
                {devLoading ? "Logging in…" : "Dev Login (michaelmichaeli888@gmail.com)"}
              </Button>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground pt-3">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
