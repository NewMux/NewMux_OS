import type { Session } from "next-auth";
import type { UserRole } from "./data/types";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const isAdmin = (session: Session | null) => session?.user?.role === "partner_admin";
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
 * Access matrix (PRD 2.1/2.2). Partner admins see everything. The limited
 * lead-dev role gets delivery tools only: Home, Work (projects, tasks,
 * calendar), the Wiki, and the Vault with masked values — never CRM,
 * Finance, Documents, Growth, Company or Settings. Enforced in API routes
 * and pages, not just hidden in navigation.
 */
export const canAccessCrm = isAdmin;
export const canAccessDocuments = isAdmin;
export const canAccessFinance = isAdmin;
export const canAccessGrowth = isAdmin;
export const canAccessSettings = isAdmin;
export const canAccessCompany = isAdmin;
export const canRevealVaultSecrets = isAdmin;
export const canAccessWork = isSignedIn;
export const canAccessKb = isSignedIn;
