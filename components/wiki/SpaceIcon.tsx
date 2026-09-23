import { BookOpen, Briefcase, Code2, Heart, Lightbulb, ListChecks, Megaphone, Rocket, Shield, Sparkles, Users, Wallet } from "lucide-react";
import { IconTile } from "@/components/ui/List";
import { asSysColor } from "@/lib/colors";

export const SPACE_ICONS = {
  book: BookOpen,
  listChecks: ListChecks,
  sparkles: Sparkles,
  code: Code2,
  briefcase: Briefcase,
  rocket: Rocket,
  lightbulb: Lightbulb,
  shield: Shield,
  users: Users,
  megaphone: Megaphone,
  wallet: Wallet,
  heart: Heart,
} as const;

export type SpaceIconName = keyof typeof SPACE_ICONS;

export function SpaceIcon({ icon, color, size = "md" }: { icon: string; color: string; size?: "sm" | "md" | "lg" }) {
  const Icon = SPACE_ICONS[icon as SpaceIconName] ?? BookOpen;
  return <IconTile icon={Icon} color={asSysColor(color)} size={size} />;
}
