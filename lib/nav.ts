import type { UserRole } from "./data/types";

export type NavItem = {
  href: string;
  label: string;
  icon:
    | "layoutDashboard"
    | "fileText"
    | "kanbanSquare"
    | "keyRound"
    | "megaphone"
    | "wallet"
    | "settings"
    | "server"
    | "users"
    | "calendar"
    | "building"
    | "rocket"
    | "barChart"
    | "target";
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layoutDashboard", roles: ["partner_admin", "lead_dev"] },
  { href: "/pipeline", label: "Outreach", icon: "target", roles: ["partner_admin"] },
  { href: "/finance", label: "Finance", icon: "wallet", roles: ["partner_admin"] },
  { href: "/documents", label: "Documents", icon: "fileText", roles: ["partner_admin"] },
  { href: "/hosting", label: "Hosting", icon: "server", roles: ["partner_admin"] },
  { href: "/clients", label: "Clients", icon: "users", roles: ["partner_admin"] },
  { href: "/projects", label: "Projects", icon: "kanbanSquare", roles: ["partner_admin", "lead_dev"] },
  { href: "/meetings", label: "Meetings & Tasks", icon: "calendar", roles: ["partner_admin", "lead_dev"] },
  { href: "/vault", label: "Vault", icon: "keyRound", roles: ["partner_admin", "lead_dev"] },
  { href: "/company", label: "Company", icon: "building", roles: ["partner_admin"] },
  { href: "/ventures", label: "Ventures", icon: "rocket", roles: ["partner_admin"] },
  { href: "/reports", label: "Reports", icon: "barChart", roles: ["partner_admin"] },
  { href: "/growth", label: "Growth", icon: "megaphone", roles: ["partner_admin"] },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["partner_admin"] },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
