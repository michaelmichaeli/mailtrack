import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/70", className)} />;
}

export function PackageCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 h-[200px] flex flex-col">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-1.5 flex-1 rounded-full" />
      </div>
      <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div>
                <Skeleton className="h-7 w-10 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div>
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
