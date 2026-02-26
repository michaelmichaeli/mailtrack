import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn("flex flex-col space-y-1 p-5 pb-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: CardProps) {
  return <h3 className={cn("text-base font-semibold leading-none tracking-tight", className)}>{children}</h3>;
}

export function CardDescription({ className, children }: CardProps) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn("px-5 pb-5 pt-0", className)}>{children}</div>;
}

export function CardFooter({ className, children }: CardProps) {
  return <div className={cn("flex items-center px-5 pb-5 pt-0", className)}>{children}</div>;
}
