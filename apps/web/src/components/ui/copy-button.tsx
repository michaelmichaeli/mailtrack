"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface CopyButtonProps {
  value: string;
  className?: string;
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className
      )}
      title={t("common.copyToClipboard")}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
