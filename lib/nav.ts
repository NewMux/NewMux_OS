import type { UserRole } from "./data/types";
import type { SysColor } from "./colors";

export type NavIconName =
  | "home"
  | "search"
  | "crm"
  | "pipeline"
  | "clients"
  | "contacts"
  | "activity"
  | "work"
  | "tasks"
  | "calendar"
  | "finance"
  | "documents"
  | "expenses"
  | "hosting"
  | "reports"
  | "wiki"
  | "company"
  | "ventures"
  | "vault"
  | "growth"
  | "settings";

export type NavLink = {
  href: string;
  label: string;
  icon: NavIconName;
  color: SysColor;
  roles: UserRole[];
  /** Extra path prefixes that count as "inside" this item. */
  match?: string[];
};

const ALL: UserRole[] = ["partner_admin", "lead_dev"];
const ADMIN: UserRole[] = ["partner_admin"];

/** Phone tab bar (iOS keeps it to five). */
export const TABS: NavLink[] = [
  { href: "/home", label: "Home", icon: "home", color: "blue", roles: ALL },
  { href: "/crm", label: "CRM", icon: "crm", color: "indigo", roles: ADMIN, match: ["/clients", "/contacts"] },
  { href: "/work", label: "Work", icon: "work", color: "orange", roles: ALL, match: ["/projects", "/tasks", "/meetings"] },
  { href: "/finance", label: "Finance", icon: "finance", color: "green", roles: ADMIN, match: ["/documents", "/hosting", "/reports"] },
  { href: "/wiki", label: "Wiki", icon: "wiki", color: "yellow", roles: ALL },
];

/** iPad/desktop sidebar, grouped like Mail/Notes. */
export const SIDEBAR: { title?: string; items: NavLink[] }[] = [
  {
    items: [
      { href: "/home", label: "Home", icon: "home", color: "blue", roles: ALL },
      { href: "/search", label: "Search", icon: "search", color: "gray", roles: ALL },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/crm", label: "Overview", icon: "crm", color: "indigo", roles: ADMIN },
      { href: "/crm/pipeline", label: "Pipeline", icon: "pipeline", color: "indigo", roles: ADMIN },
      { href: "/clients", label: "Clients", icon: "clients", color: "indigo", roles: ADMIN },
      { href: "/contacts", label: "Contacts", icon: "contacts", color: "indigo", roles: ADMIN },
      { href: "/crm/activities", label: "Activities", icon: "activity", color: "indigo", roles: ADMIN },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/work", label: "Projects", icon: "work", color: "orange", roles: ALL, match: ["/projects"] },
      { href: "/tasks", label: "My Tasks", icon: "tasks", color: "orange", roles: ALL },
      { href: "/meetings", label: "Calendar", icon: "calendar", color: "red", roles: ALL },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Overview", icon: "finance", color: "green", roles: ADMIN },
      { href: "/documents", label: "Invoices & Quotes", icon: "documents", color: "green", roles: ADMIN },
      { href: "/finance/expenses", label: "Expenses", icon: "expenses", color: "green", roles: ADMIN },
      { href: "/hosting", label: "Hosting Fees", icon: "hosting", color: "green", roles: ADMIN },
      { href: "/reports", label: "Reports", icon: "reports", color: "green", roles: ADMIN },
    ],
  },
  {
    title: "Knowledge",
    items: [{ href: "/wiki", label: "Wiki", icon: "wiki", color: "yellow", roles: ALL }],
  },
  {
    title: "Company",
    items: [
      { href: "/company", label: "Company", icon: "company", color: "gray", roles: ADMIN },
      { href: "/ventures", label: "Ventures", icon: "ventures", color: "purple", roles: ADMIN },
      { href: "/vault", label: "Vault", icon: "vault", color: "gray", roles: ALL },
      { href: "/growth", label: "Growth", icon: "growth", color: "pink", roles: ADMIN },
      { href: "/settings", label: "Settings", icon: "settings", color: "gray", roles: ALL },
    ],
  },
];

/** Modules without a tab, surfaced in Home's "More" section on phones. */
export const MORE_LINKS: NavLink[] = [
  { href: "/meetings", label: "Calendar", icon: "calendar", color: "red", roles: ALL },
  { href: "/reports", label: "Reports", icon: "reports", color: "green", roles: ADMIN },
  { href: "/company", label: "Company", icon: "company", color: "gray", roles: ADMIN },
  { href: "/ventures", label: "Ventures", icon: "ventures", color: "purple", roles: ADMIN },
  { href: "/vault", label: "Vault", icon: "vault", color: "teal", roles: ALL },
  { href: "/growth", label: "Growth", icon: "growth", color: "pink", roles: ADMIN },
  { href: "/settings", label: "Settings", icon: "settings", color: "gray", roles: ALL },
];

export function forRole<T extends NavLink>(items: T[], role: UserRole): T[] {
  return items.filter((i) => i.roles.includes(role));
}

export function isActive(pathname: string, item: NavLink, allItems: NavLink[] = []): boolean {
  const matches = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (matches(item.href) || item.match?.some(matches)) {
    // Prefer the most specific sibling (e.g. /crm/pipeline over /crm).
    return !allItems.some((other) => other !== item && other.href.startsWith(`${item.href}/`) && matches(other.href));
  }
  return false;
}
