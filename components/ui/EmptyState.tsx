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
      <Icon className="mb-3 h-12 w-12 text-label-3" strokeWidth={1.4} />
      <p className="text-title3 text-label">{title}</p>
      {message && <p className="mt-1 max-w-sm text-subhead text-label-2">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
