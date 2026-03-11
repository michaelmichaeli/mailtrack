"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  Mail,
  Package,
  ArrowRight,
  Sparkles,
  Search,
  Bell,
  BarChart3,
  MapPin,
  Zap,
  PartyPopper,
  ChevronRight,
  Eye,
  Globe,
  Shield,
  X,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useI18n } from "@/lib/i18n";

// ─── Tiny sound helper (Web Audio API, no files needed) ────────────
function playSound(type: "pop" | "success" | "whoosh" | "ding") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.08;

    switch (type) {
      case "pop":
        osc.frequency.value = 600;
        osc.type = "sine";
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
        break;
      case "success":
        osc.frequency.value = 523;
        osc.type = "sine";
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        setTimeout(() => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 659; o2.type = "sine";
          g2.gain.value = 0.08;
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
          o2.start(); o2.stop(ctx.currentTime + 0.8);
        }, 150);
        setTimeout(() => {
          const o3 = ctx.createOscillator();
          const g3 = ctx.createGain();
          o3.connect(g3); g3.connect(ctx.destination);
          o3.frequency.value = 784; o3.type = "sine";
          g3.gain.value = 0.08;
          g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
          o3.start(); o3.stop(ctx.currentTime + 1.0);
        }, 300);
        osc.stop(ctx.currentTime + 0.5);
        break;
      case "whoosh":
        osc.frequency.value = 200;
        osc.type = "sawtooth";
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
        break;
      case "ding":
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
    }
  } catch { /* Audio not available */ }
}

function fireConfetti() {
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.3, y: 0.6 } });
  confetti({ ...defaults, particleCount: 50, origin: { x: 0.7, y: 0.6 } });
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 30, origin: { x: 0.5, y: 0.4 } });
  }, 250);
}

function fireCelebration() {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
      zIndex: 9999,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// ─── Floating particles background ────────────────────────────────
function FloatingParticles() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary/10"
          style={{
            width: Math.random() * 20 + 5,
            height: Math.random() * 20 + 5,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────

function WelcomeStep({ userName, onNext }: { userName: string; onNext: () => void }) {
  const firstName = userName?.split(" ")[0] || "there";
  const { t } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => fireConfetti(), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center text-center px-6 py-8"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <Image src="/logo.png" alt="MailTrack" width={80} height={80} className="drop-shadow-lg" priority />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6"
      >
        <h1 className="text-3xl font-bold text-foreground">
          Hey {firstName}! <span className="inline-block animate-bounce">👋</span>
        </h1>
        <p className="text-lg text-muted-foreground mt-2">{t("onboarding.welcome")}</p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-sm text-muted-foreground mt-4 max-w-sm leading-relaxed"
      >
        {t("onboarding.intro")}
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-xs text-muted-foreground/70 mt-2 italic"
      >
        {t("onboarding.setup")}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
        className="mt-8"
      >
        <Button size="lg" onClick={onNext} className="gap-2 text-base px-8">
          {t("onboarding.letsGo")}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

function ConnectEmailStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const { t } = useI18n();

  const handleConnect = () => {
    setConnecting(true);
    playSound("pop");
    const token = api.getToken();
    if (!token) {
      toast.error(t("toast.sessionExpired"));
      setConnecting(false);
      return;
    }
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
    window.location.href = `${API_URL}/api/email/connect/gmail?token=${encodeURIComponent(token)}&returnTo=/onboarding`;
  };

  return (
    <motion.div
      className="flex flex-col items-center text-center px-6 py-8"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/50"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <Mail className="h-10 w-10 text-red-500" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <h2 className="text-2xl font-bold text-foreground">{t("onboarding.connectGmail")}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
          {t("onboarding.connectGmailDesc")}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-4 space-y-2 text-left w-full max-w-xs"
      >
        {[
          { icon: Search, text: t("onboarding.benefit1") },
          { icon: Eye, text: t("onboarding.benefit2") },
          { icon: Shield, text: t("onboarding.benefit3") },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}
            className="flex items-center gap-3 rounded-lg p-2 text-sm text-muted-foreground"
          >
            <item.icon className="h-4 w-4 text-primary shrink-0" />
            {item.text}
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="mt-8 w-full max-w-xs space-y-3"
      >
        <Button
          size="lg"
          className="w-full gap-2 text-base"
          onClick={handleConnect}
          disabled={connecting}
        >
          <Mail className="h-5 w-5" />
          {connecting ? t("onboarding.connecting") : t("onboarding.connectGmail")}
        </Button>
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onSkip}>
          {t("onboarding.doLater")}
        </Button>
      </motion.div>
    </motion.div>
  );
}

function SyncingStep({
  onComplete,
  syncResult,
}: {
  onComplete: () => void;
  syncResult: { emailsParsed: number; ordersCreated: number; totalTracking: number } | null;
}) {
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const { t } = useI18n();
  const messages = [
    t("onboarding.checkingInbox"),
    t("onboarding.foundEmails"),
    t("onboarding.extractingTracking"),
    t("onboarding.crossReferencing"),
    t("onboarding.almostThere"),
  ];
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    if (syncResult) {
      setPhase("done");
      playSound("success");
      fireConfetti();
    }
  }, [syncResult]);

  return (
    <motion.div
      className="flex flex-col items-center text-center px-6 py-8"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.4 }}
    >
      {phase === "scanning" ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Search className="h-10 w-10 text-primary" />
            </div>
          </motion.div>

          <h2 className="text-2xl font-bold text-foreground">{t("onboarding.scanningEmails")}</h2>

          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-muted-foreground mt-3 h-6"
            >
              {messages[msgIndex]}
            </motion.p>
          </AnimatePresence>

          <motion.div className="w-full max-w-xs mt-8">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: 15, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          <p className="text-xs text-muted-foreground/60 mt-3 italic">
            {t("onboarding.scanningHint")}
          </p>
        </>
      ) : (
        <>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
              <PartyPopper className="h-10 w-10 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <h2 className="text-2xl font-bold text-foreground">{t("onboarding.allSynced")}</h2>
            <p className="text-sm text-muted-foreground mt-2">{t("onboarding.heresWhatWeFound")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 grid grid-cols-3 gap-3 w-full max-w-sm"
          >
            {[
              { value: syncResult?.emailsParsed ?? 0, label: t("onboarding.emailsScanned"), emoji: "📧" },
              { value: syncResult?.ordersCreated ?? 0, label: t("onboarding.ordersFound"), emoji: "📦" },
              { value: syncResult?.totalTracking ?? 0, label: t("onboarding.trackingNumbers"), emoji: "🔍" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.15, type: "spring" }}
                className="rounded-xl bg-muted/50 p-3"
              >
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label} {stat.emoji}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8"
          >
            <Button size="lg" onClick={onComplete} className="gap-2 text-base px-8">
              {t("onboarding.seeWhatICanDo")}
              <Sparkles className="h-5 w-5" />
            </Button>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

const FEATURES = [
  {
    icon: Globe,
    titleKey: "onboarding.universalTracking" as const,
    descKey: "onboarding.featureDesc.universalTracking" as const,
    color: "bg-blue-50 dark:bg-blue-950/50",
    iconColor: "text-blue-500",
    emoji: "🌍",
  },
  {
    icon: Zap,
    titleKey: "onboarding.autoSync" as const,
    descKey: "onboarding.featureDesc.autoSync" as const,
    color: "bg-amber-50 dark:bg-amber-950/50",
    iconColor: "text-amber-500",
    emoji: "⚡",
  },
  {
    icon: Bell,
    titleKey: "onboarding.smartNotifications" as const,
    descKey: "onboarding.featureDesc.smartNotifications" as const,
    color: "bg-purple-50 dark:bg-purple-950/50",
    iconColor: "text-purple-500",
    emoji: "🔔",
  },
  {
    icon: MapPin,
    titleKey: "onboarding.liveMaps" as const,
    descKey: "onboarding.featureDesc.liveMaps" as const,
    color: "bg-green-50 dark:bg-green-950/50",
    iconColor: "text-green-500",
    emoji: "📍",
  },
  {
    icon: BarChart3,
    titleKey: "onboarding.viewModes" as const,
    descKey: "onboarding.featureDesc.viewModes" as const,
    color: "bg-pink-50 dark:bg-pink-950/50",
    iconColor: "text-pink-500",
    emoji: "📊",
  },
];

function FeatureTourStep({ onNext }: { onNext: () => void }) {
  const [current, setCurrent] = useState(0);
  const feature = FEATURES[current];
  const isLast = current === FEATURES.length - 1;
  const { t } = useI18n();

  const next = () => {
    playSound("pop");
    if (isLast) {
      onNext();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center text-center px-6 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -100 }}
    >
      {/* Progress dots */}
      <div className="flex gap-2 mb-6">
        {FEATURES.map((_, i) => (
          <motion.div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-primary" : i < current ? "w-2 bg-primary/60" : "w-2 bg-muted"
            }`}
            layout
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -60, scale: 0.95 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center"
        >
          <motion.div
            className={`flex h-20 w-20 items-center justify-center rounded-2xl ${feature.color}`}
            initial={{ rotate: -15, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <feature.icon className={`h-10 w-10 ${feature.iconColor}`} />
          </motion.div>

          <h2 className="text-2xl font-bold text-foreground mt-6">
            {t(feature.titleKey)} {feature.emoji}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
            {t(feature.descKey)}
          </p>
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex gap-3"
      >
        {!isLast && (
          <Button variant="ghost" size="sm" onClick={onNext} className="text-muted-foreground">
            {t("onboarding.skipTour")}
          </Button>
        )}
        <Button size="lg" onClick={next} className="gap-2 px-8">
          {isLast ? t("onboarding.imReady") : t("onboarding.next")}
          <ChevronRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

function CompletionStep({ onFinish }: { onFinish: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    playSound("success");
    fireCelebration();
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center text-center px-6 py-8"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.2 }}
      >
        <Image src="/logo.png" alt="MailTrack" width={96} height={96} className="drop-shadow-xl" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-3xl font-bold text-foreground mt-6"
      >
        {t("onboarding.allSet")}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-sm text-muted-foreground mt-3 max-w-sm leading-relaxed"
      >
        {t("onboarding.allSetDesc")}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3 }}
        className="mt-8"
      >
        <Button size="lg" onClick={onFinish} className="gap-2 text-base px-10 text-lg">
          <Package className="h-5 w-5" />
          {t("onboarding.openDashboard")}
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="text-xs text-muted-foreground/50 mt-4 italic"
      >
        {t("onboarding.proTip")}
      </motion.p>
    </motion.div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────

type WizardStep = "welcome" | "connect-email" | "syncing" | "features" | "complete";

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [userName, setUserName] = useState("");
  const [syncResult, setSyncResult] = useState<{
    emailsParsed: number;
    ordersCreated: number;
    totalTracking: number;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const syncStarted = useRef(false);

  // Fetch user info for personalized greeting
  useEffect(() => {
    api.getMe().then((user) => {
      setUserName(user.name || "");
    }).catch(() => {});
  }, []);

  // Handle return from Gmail OAuth — auto-advance to syncing
  useEffect(() => {
    const success = searchParams.get("success");
    const autoSync = searchParams.get("autoSync");
    if (success && autoSync) {
      toast.success(success);
      startSync();
    }
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
      setStep("connect-email");
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSync = useCallback(async () => {
    if (syncStarted.current) return;
    syncStarted.current = true;
    setStep("syncing");
    try {
      const result = await api.syncEmails();
      setSyncResult({
        emailsParsed: result.emailsParsed ?? 0,
        ordersCreated: result.ordersCreated ?? 0,
        totalTracking: result.totalTracking ?? 0,
      });
    } catch {
      // If sync fails (e.g. no email connected), still allow continuing
      setSyncResult({ emailsParsed: 0, ordersCreated: 0, totalTracking: 0 });
    }
  }, []);

  const handleFinish = async () => {
    playSound("whoosh");
    try {
      await api.completeOnboarding();
    } catch { /* non-critical */ }
    router.push("/packages");
  };

  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      <FloatingParticles />

      <motion.div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        layout
        transition={{ layout: { duration: 0.3 } }}
      >
        {/* Close button */}
        {step !== "syncing" && (
          <button
            onClick={handleFinish}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            aria-label={t("onboarding.closeWizard")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <WelcomeStep
              key="welcome"
              userName={userName}
              onNext={() => { playSound("whoosh"); setStep("connect-email"); }}
            />
          )}

          {step === "connect-email" && (
            <ConnectEmailStep
              key="connect-email"
              onNext={() => startSync()}
              onSkip={() => { setStep("features"); }}
            />
          )}

          {step === "syncing" && (
            <SyncingStep
              key="syncing"
              syncResult={syncResult}
              onComplete={() => { playSound("whoosh"); setStep("features"); }}
            />
          )}

          {step === "features" && (
            <FeatureTourStep
              key="features"
              onNext={() => { playSound("whoosh"); setStep("complete"); }}
            />
          )}

          {step === "complete" && (
            <CompletionStep key="complete" onFinish={handleFinish} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
