import type { Session } from "next-auth";
import type { UserRole } from "./data/types";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isPartnerAdmin(session: Session | null): boolean {
  return session?.user?.role === "partner_admin";
}

export function requireRole(session: Session | null, allowed: UserRole[]): asserts session is Session {
  if (!session?.user || !allowed.includes(session.user.role)) {
    throw new ForbiddenError();
  }
}

/**
 * Lead Developer/Designer gets no access to Documents (financial) or Growth
 * (marketing spend) modules — confirmed product decision, enforced here at
 * the API/query layer, not just hidden in the UI.
 */
export function canAccessDocuments(session: Session | null): boolean {
  return session?.user?.role === "partner_admin";
}

export function canAccessGrowth(session: Session | null): boolean {
  return session?.user?.role === "partner_admin";
}

export function canRevealVaultSecrets(session: Session | null): boolean {
  return session?.user?.role === "partner_admin";
}

/** Finance (recurring expenses, profit distribution) is admin-only per PRD 2.1. */
export function canAccessFinance(session: Session | null): boolean {
  return session?.user?.role === "partner_admin";
}

/** Settings (profit-split rules, deduction types) is admin-only per PRD 5.3.1. */
export function canAccessSettings(session: Session | null): boolean {
  return session?.user?.role === "partner_admin";
}
