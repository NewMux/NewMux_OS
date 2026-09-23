import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CircleCheckBig,
  Contact,
  FileText,
  Handshake,
  House,
  KeyRound,
  Megaphone,
  Receipt,
  Rocket,
  Search,
  Server,
  Settings,
  SquareKanban,
  Sun,
  Users,
  Wallet,
  type LucideProps,
} from "lucide-react";
import type { NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, React.ComponentType<LucideProps>> = {
  home: House,
  today: Sun,
  search: Search,
  crm: Handshake,
  pipeline: SquareKanban,
  clients: Building2,
  contacts: Contact,
  activity: Activity,
  work: CircleCheckBig,
  tasks: CircleCheckBig,
  calendar: CalendarDays,
  finance: Wallet,
  documents: FileText,
  expenses: Receipt,
  hosting: Server,
  reports: BarChart3,
  wiki: BookOpen,
  company: Building2,
  ventures: Rocket,
  vault: KeyRound,
  growth: Megaphone,
  settings: Settings,
};

export function NavIcon({ icon, className, filled, strokeWidth = 2 }: { icon: NavIconName; className?: string; filled?: boolean; strokeWidth?: number }) {
  const Icon = ICONS[icon];
  return <Icon className={className} strokeWidth={strokeWidth} fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.18 : 0} aria-hidden />;
}

export { Users };
