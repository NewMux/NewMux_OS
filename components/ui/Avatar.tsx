import { cn } from "@/lib/utils";

/** Two letters from a person's name — "Jassim Baqer" → "JB". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({
  name,
  size = "sm",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      // The name is the accessible text; the initials are decoration on top.
      title={name}
      aria-label={name}
      role="img"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-accent font-medium text-secondary-foreground",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
