import type { UserRole } from "./data/types";

export type NavItem = {
  href: string;
  label: string;
  icon: "layoutDashboard" | "fileText" | "kanbanSquare" | "keyRound" | "megaphone";
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layoutDashboard", roles: ["partner_admin", "lead_dev"] },
  { href: "/documents", label: "Documents", icon: "fileText", roles: ["partner_admin"] },
  { href: "/projects", label: "Projects", icon: "kanbanSquare", roles: ["partner_admin", "lead_dev"] },
  { href: "/vault", label: "Vault", icon: "keyRound", roles: ["partner_admin", "lead_dev"] },
  { href: "/growth", label: "Growth", icon: "megaphone", roles: ["partner_admin"] },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
