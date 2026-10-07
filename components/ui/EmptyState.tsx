import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-8 py-14 text-center", className)}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fill/[0.1]">
        <Icon className="h-8 w-8 text-label-2" strokeWidth={1.6} />
      </span>
      <p className="text-title3 text-label">{title}</p>
      {message && <p className="mt-1 max-w-sm text-subhead text-label-2">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
