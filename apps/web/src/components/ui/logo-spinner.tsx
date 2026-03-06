import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoSpinnerProps {
  size?: number;
  className?: string;
  text?: string;
}

export function LogoSpinner({ size = 48, className, text }: LogoSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="animate-logo-spin">
        <Image src="/logo.png" alt="Loading" width={size} height={size} priority />
      </div>
      {text && <p className="text-sm text-muted-foreground animate-pulse">{text}</p>}
    </div>
  );
}
