"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Suspense } from "react";
import { LogoSpinner } from "@/components/ui/logo-spinner";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      api.setToken(token);
      // Check if user needs onboarding
      api.getMe().then((user) => {
        if (!user.onboardingCompleted) {
          router.replace("/onboarding");
        } else {
          router.replace("/packages");
        }
      }).catch(() => {
        router.replace("/packages");
      });
    } else {
      router.replace("/login");
    }
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LogoSpinner size={48} text="Signing you in…" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <LogoSpinner size={48} />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
