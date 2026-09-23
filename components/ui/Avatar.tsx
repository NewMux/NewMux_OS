import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.replace(/[—–-].*$/, "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** Contacts-style monogram (grey gradient) — or a company tile when `square`. */
export function Avatar({ name, size = 40, square, className }: { name: string; size?: number; square?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        "flex shrink-0 select-none items-center justify-center bg-gradient-to-b from-[#a5abb8] to-[#858994] font-rounded font-semibold text-white",
        square ? "rounded-[22%]" : "rounded-full",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
