import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level fallbacks. Against the in-memory store these rarely show, but
 * they cover client-side navigation on a slow connection and become load-bearing
 * once the data layer moves to Postgres.
 */

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden" aria-busy>
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="w-[17rem] shrink-0 lg:w-auto lg:flex-1">
          <Skeleton className="mb-2 h-3 w-24" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: col === 0 ? 2 : 1 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function StatsSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy
    >
      {Array.from({ length: tiles }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </Card>
      ))}
    </div>
  );
}
