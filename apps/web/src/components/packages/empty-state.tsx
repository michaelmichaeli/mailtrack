import { Package, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  icon?: "package" | "mail";
}

export function EmptyState({ title, description, action, icon = "package" }: EmptyStateProps) {
  const Icon = icon === "mail" ? Mail : Package;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent mb-4">
        <Icon className="h-7 w-7 text-primary/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Link href={action.href}>
          <Button size="sm">
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}
