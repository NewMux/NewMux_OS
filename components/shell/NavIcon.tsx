import {
  LayoutDashboard,
  FileText,
  KanbanSquare,
  KeyRound,
  Megaphone,
  Wallet,
  Settings,
  Server,
  Users,
  Calendar,
  Building2,
  Rocket,
  BarChart3,
  Target,
  type LucideProps,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

const ICONS: Record<NavItem["icon"], React.ComponentType<LucideProps>> = {
  layoutDashboard: LayoutDashboard,
  fileText: FileText,
  kanbanSquare: KanbanSquare,
  keyRound: KeyRound,
  megaphone: Megaphone,
  wallet: Wallet,
  settings: Settings,
  server: Server,
  users: Users,
  calendar: Calendar,
  building: Building2,
  rocket: Rocket,
  barChart: BarChart3,
  target: Target,
};

export function NavIcon({ icon, className }: { icon: NavItem["icon"]; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
