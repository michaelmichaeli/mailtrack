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
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      {action && (
        <Link href={action.href}>
          <Button>
            {action.label}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      )}
    </div>
  );
}
