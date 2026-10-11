import type { Session } from "next-auth";
import type { UserRole } from "./data/types";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const isAdmin = (session: Session | null) => session?.user?.role === "partner_admin";
const isMarketing = (session: Session | null) => session?.user?.role === "marketing";
const adminOrMarketing = (session: Session | null) => isAdmin(session) || isMarketing(session);
const isSignedIn = (session: Session | null) => !!session?.user;

export function isPartnerAdmin(session: Session | null): boolean {
  return isAdmin(session);
}

export function requireRole(session: Session | null, allowed: UserRole[]): asserts session is Session {
  if (!session?.user || !allowed.includes(session.user.role)) {
    throw new ForbiddenError();
  }
}

/**
 * Access matrix (PRD 2.1/2.2). Enforced in API routes and pages, not just
 * hidden in navigation.
 *
 * - Partner (`partner_admin`): everything.
 * - Marketing (`marketing`): everything except money. CRM, Marketing, Work,
 *   the Wiki and Company (profile, ventures, files other than financial
 *   ones), but never Finance, Documents (invoices, quotes, contracts),
 *   hosting fees, payouts, reports, SaaS revenue (Growth), deal or project
 *   values, Settings, Team, or revealing Vault secrets.
 * - Team member (`lead_dev`): delivery tools only: Home, Work (projects,
 *   tasks, calendar), the Wiki, and the Vault with masked values.
 */
export const canAccessCrm = adminOrMarketing;
export const canAccessMarketing = adminOrMarketing;
export const canAccessCompany = adminOrMarketing;
/** Amounts anywhere: deal values, pipeline totals, client balances, project and venture money. */
export const canSeeMoney = isAdmin;
export const canAccessDocuments = isAdmin;
export const canAccessFinance = isAdmin;
export const canAccessGrowth = isAdmin;
export const canAccessSettings = isAdmin;
export const canRevealVaultSecrets = isAdmin;

/** Role-only checks, for code that has a role but no session (Haman, search, notifications). */
export const roleCanSeeMoney = (role: UserRole) => role === "partner_admin";
export const roleCanAccessCrm = (role: UserRole) => role === "partner_admin" || role === "marketing";
export const canAccessWork = isSignedIn;
export const canAccessKb = isSignedIn;
