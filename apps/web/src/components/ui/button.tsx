import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          // Variants
          variant === "default" && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
          variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          variant === "outline" && "border border-border bg-card hover:bg-accent hover:text-accent-foreground shadow-sm",
          variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
          variant === "destructive" && "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
          variant === "success" && "bg-success text-success-foreground shadow-sm hover:bg-success/90",
          // Sizes
          size === "sm" && "h-8 gap-1.5 px-3 text-xs",
          size === "md" && "h-10 gap-2 px-4 text-sm",
          size === "lg" && "h-12 gap-2 px-6 text-base",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
