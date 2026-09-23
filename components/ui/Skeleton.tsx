import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-fill/[0.12]", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

/** Generic page placeholder used by route loading.tsx files. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in px-4 pt-14 md:px-8">
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-56 rounded-card" />
    </div>
  );
}
