import type { UserRole } from "./data/types";
import type { SysColor } from "./colors";

export type NavIconName =
  | "home"
  | "today"
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
  | "files"
  | "payouts"
  | "ventures"
  | "vault"
  | "growth"
  | "marketing"
  | "content"
  | "campaigns"
  | "leads"
  | "brand"
  | "more"
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

const ALL: UserRole[] = ["partner_admin", "lead_dev", "marketing"];
const ADMIN: UserRole[] = ["partner_admin"];
/** Partners and Marketing: CRM, Marketing and Company (Marketing never sees money in them). */
const BUSINESS: UserRole[] = ["partner_admin", "marketing"];
const MARKETING_ONLY: UserRole[] = ["marketing"];

/**
 * Sections a phone can put in its tab bar. iOS keeps a tab bar to five: Today
 * is always first, the person picks three more (More → Edit, saved in the
 * `tabs` cookie), and the fifth is More, which lists everything else.
 */
export const TABS: NavLink[] = [
  { href: "/home", label: "Today", icon: "today", color: "blue", roles: ALL },
  { href: "/crm", label: "CRM", icon: "crm", color: "indigo", roles: BUSINESS, match: ["/clients", "/contacts"] },
  { href: "/marketing", label: "Marketing", icon: "marketing", color: "pink", roles: BUSINESS },
  { href: "/work", label: "Work", icon: "work", color: "orange", roles: ALL, match: ["/projects", "/tasks", "/meetings"] },
  { href: "/finance", label: "Finance", icon: "finance", color: "green", roles: ADMIN, match: ["/documents", "/hosting", "/reports"] },
  { href: "/wiki", label: "Wiki", icon: "wiki", color: "yellow", roles: ALL },
  { href: "/company", label: "Company", icon: "company", color: "gray", roles: BUSINESS, match: ["/ventures", "/files", "/growth"] },
];

export const MORE_TAB: NavLink = { href: "/more", label: "More", icon: "more", color: "gray", roles: ALL };

/** How many tabs a person chooses (Today and More are always there). */
export const CHOSEN_TABS = 3;

const DEFAULT_TABS: Record<UserRole, string[]> = {
  partner_admin: ["/crm", "/work", "/finance"],
  marketing: ["/crm", "/marketing", "/work"],
  lead_dev: ["/work", "/wiki"],
};

/** The phone's tab bar for a role: Today, the chosen sections (from the cookie, else the defaults), More. */
export function phoneTabs(role: UserRole, saved?: string | null): NavLink[] {
  const available = forRole(TABS, role).filter((t) => t.href !== "/home");
  const wanted = (saved ? saved.split(",") : DEFAULT_TABS[role]).filter((h, i, all) => all.indexOf(h) === i);
  let chosen = wanted.map((h) => available.find((t) => t.href === h)).filter((t): t is NavLink => !!t);
  if (!chosen.length) chosen = DEFAULT_TABS[role].map((h) => available.find((t) => t.href === h)!).filter(Boolean);
  return [TABS[0]!, ...chosen.slice(0, CHOSEN_TABS), MORE_TAB];
}

/** Sections a role can choose for its tab bar (everything but Today). */
export function tabChoices(role: UserRole): NavLink[] {
  return forRole(TABS, role).filter((t) => t.href !== "/home");
}

export type NavSection = NavLink & { children?: NavLink[] };

/**
 * iPad/desktop sidebar: the same five sections as the phone tab bar. The
 * section you're in expands to show its pages; the rest stay collapsed.
 */
export const SIDEBAR: NavSection[] = [
  { href: "/home", label: "Today", icon: "today", color: "blue", roles: ALL },
  {
    href: "/crm",
    label: "CRM",
    icon: "crm",
    color: "indigo",
    roles: BUSINESS,
    match: ["/clients", "/contacts"],
    children: [
      { href: "/crm", label: "Overview", icon: "crm", color: "indigo", roles: BUSINESS },
      { href: "/crm/pipeline", label: "Pipeline", icon: "pipeline", color: "indigo", roles: BUSINESS },
      { href: "/clients", label: "Clients", icon: "clients", color: "indigo", roles: BUSINESS },
      { href: "/contacts", label: "Contacts", icon: "contacts", color: "indigo", roles: BUSINESS },
      { href: "/crm/activities", label: "Activities", icon: "activity", color: "indigo", roles: BUSINESS },
    ],
  },
  {
    href: "/marketing",
    label: "Marketing",
    icon: "marketing",
    color: "pink",
    roles: BUSINESS,
    children: [
      { href: "/marketing", label: "Overview", icon: "marketing", color: "pink", roles: BUSINESS },
      { href: "/marketing/content", label: "Content Calendar", icon: "content", color: "pink", roles: BUSINESS },
      { href: "/marketing/campaigns", label: "Campaigns", icon: "campaigns", color: "pink", roles: BUSINESS },
      { href: "/marketing/leads", label: "Leads", icon: "leads", color: "pink", roles: BUSINESS },
      { href: "/marketing/brand", label: "Brand & Assets", icon: "brand", color: "pink", roles: BUSINESS },
    ],
  },
  {
    href: "/work",
    label: "Work",
    icon: "work",
    color: "orange",
    roles: ALL,
    match: ["/projects", "/tasks", "/meetings"],
    children: [
      { href: "/work", label: "Projects", icon: "work", color: "orange", roles: ALL, match: ["/projects"] },
      { href: "/tasks", label: "My Tasks", icon: "tasks", color: "orange", roles: ALL },
      { href: "/meetings", label: "Calendar", icon: "calendar", color: "red", roles: ALL },
    ],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: "finance",
    color: "green",
    roles: ADMIN,
    match: ["/documents", "/hosting", "/reports"],
    children: [
      { href: "/finance", label: "Overview", icon: "finance", color: "green", roles: ADMIN },
      { href: "/documents", label: "Documents", icon: "documents", color: "green", roles: ADMIN },
      { href: "/finance/expenses", label: "Expenses", icon: "expenses", color: "green", roles: ADMIN },
      { href: "/finance/partners", label: "Partner Payouts", icon: "payouts", color: "green", roles: ADMIN },
      { href: "/hosting", label: "Hosting Fees", icon: "hosting", color: "green", roles: ADMIN },
      { href: "/reports", label: "Reports", icon: "reports", color: "green", roles: ADMIN },
    ],
  },
  { href: "/wiki", label: "Wiki", icon: "wiki", color: "yellow", roles: ALL },
  // Item 22: company-level pages are in the sidebar, not only behind Settings.
  {
    href: "/company",
    label: "Company",
    icon: "company",
    color: "gray",
    roles: BUSINESS,
    match: ["/ventures", "/files", "/growth"],
    children: [
      { href: "/company", label: "Profile & Renewals", icon: "company", color: "gray", roles: BUSINESS },
      { href: "/ventures", label: "Ventures", icon: "ventures", color: "purple", roles: BUSINESS },
      { href: "/files", label: "Files", icon: "files", color: "blue", roles: BUSINESS },
      { href: "/growth", label: "Growth", icon: "growth", color: "pink", roles: ADMIN },
    ],
  },
];

/** Company-level screens: in the account menu (sidebar) and at the top of Settings. */
export const COMPANY_LINKS: NavLink[] = [
  { href: "/company", label: "Company", icon: "company", color: "gray", roles: BUSINESS },
  { href: "/ventures", label: "Ventures", icon: "ventures", color: "purple", roles: BUSINESS },
  { href: "/files", label: "Files", icon: "files", color: "blue", roles: BUSINESS },
  { href: "/vault", label: "Vault", icon: "vault", color: "teal", roles: ALL },
  { href: "/growth", label: "Growth", icon: "growth", color: "pink", roles: ADMIN },
];

const SETTINGS_LINK: NavLink = { href: "/settings", label: "Settings", icon: "settings", color: "gray", roles: ALL };

/** The sidebar tree filtered for a role (sections with no visible pages drop out). */
export function sidebarFor(role: UserRole): NavSection[] {
  return SIDEBAR.filter((s) => s.roles.includes(role)).map((s) => ({ ...s, children: s.children ? forRole(s.children, role) : undefined }));
}

/** Every destination a role can open, for the command palette's "Go to". */
export function allLinksFor(role: UserRole): NavLink[] {
  const pages = sidebarFor(role).flatMap((s) => (s.children?.length ? s.children.map((c) => (c.label === "Overview" ? { ...c, label: s.label } : c)) : [s]));
  const extra = forRole(COMPANY_LINKS, role).filter((l) => !pages.some((p) => p.href === l.href));
  return [...pages, ...extra, SETTINGS_LINK];
}

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
