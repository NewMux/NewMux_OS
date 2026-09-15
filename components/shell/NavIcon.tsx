import { LayoutDashboard, FileText, KanbanSquare, KeyRound, Megaphone, type LucideProps } from "lucide-react";
import type { NavItem } from "@/lib/nav";

const ICONS: Record<NavItem["icon"], React.ComponentType<LucideProps>> = {
  layoutDashboard: LayoutDashboard,
  fileText: FileText,
  kanbanSquare: KanbanSquare,
  keyRound: KeyRound,
  megaphone: Megaphone,
};

export function NavIcon({ icon, className }: { icon: NavItem["icon"]; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
