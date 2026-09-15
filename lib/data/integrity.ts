import { store } from "./store";

/**
 * Referential integrity for deletes.
 *
 * This is an accounting system, so a delete must never silently orphan or
 * destroy financial history. Every DELETE calls `getReferences` first and
 * refuses with a 409 when anything still points at the record, listing what.
 *
 * Records that genuinely cannot exist on their own (a document's line items,
 * a deal's outreach log) are not references — they are owned children and are
 * removed with their parent.
 */

export type EntityKind =
  | "client"
  | "project"
  | "document"
  | "hosting"
  | "meeting"
  | "expense"
  | "secret"
  | "party"
  | "deductionType"
  | "venture"
  | "deal";

export type Reference = { label: string; count: number };

function ref(
  label: string,
  count: number,
  plural = `${label}s`,
): Reference | null {
  return count > 0 ? { label: count === 1 ? label : plural, count } : null;
}

export function getReferences(kind: EntityKind, id: string): Reference[] {
  const found: (Reference | null)[] = [];

  switch (kind) {
    case "client":
      found.push(
        ref("project", store.projects.filter((p) => p.clientId === id).length),
        ref(
          "document",
          store.documents.filter((d) => d.clientId === id).length,
        ),
        ref(
          "hosting subscription",
          store.hostingSubscriptions.filter((h) => h.clientId === id).length,
          "hosting subscriptions",
        ),
        ref(
          "recurring expense",
          store.recurringExpenses.filter((e) => e.linkedClientId === id).length,
        ),
        ref(
          "meeting",
          store.meetings.filter((m) => m.linkedClientId === id).length,
        ),
        ref(
          "won deal",
          store.deals.filter((d) => d.convertedClientId === id).length,
        ),
      );
      break;

    case "project":
      found.push(
        ref("task", store.tasks.filter((t) => t.projectId === id).length),
        ref(
          "document",
          store.documents.filter((d) => d.projectId === id).length,
        ),
        ref(
          "vault secret",
          store.secrets.filter((s) => s.projectId === id).length,
        ),
        ref(
          "recurring expense",
          store.recurringExpenses.filter((e) => e.linkedProjectId === id)
            .length,
        ),
        ref(
          "meeting",
          store.meetings.filter((m) => m.linkedProjectId === id).length,
        ),
        ref(
          "profit-split rule",
          store.profitSplitRules.filter(
            (r) => r.scopeType === "project" && r.scopeId === id,
          ).length,
        ),
        ref(
          "won deal",
          store.deals.filter((d) => d.convertedProjectId === id).length,
        ),
      );
      break;

    case "document":
      found.push(
        ref(
          "recorded payment",
          store.payments.filter((p) => p.documentId === id).length,
        ),
        ref(
          "hosting collection",
          store.hostingSubscriptions.filter((h) => h.linkedInvoiceId === id)
            .length,
        ),
        ref(
          "converted deal",
          store.deals.filter((d) => d.convertedInvoiceId === id).length,
        ),
        ref(
          "document converted from this quote",
          store.documents.filter((d) => d.convertedFromQuotationId === id)
            .length,
          "documents converted from this quote",
        ),
      );
      break;

    case "party":
      found.push(
        ref(
          "profit-split rule",
          store.profitSplitRules.filter((r) =>
            r.splits.some((s) => s.partyId === id),
          ).length,
        ),
      );
      break;

    case "deductionType":
      found.push(
        ref(
          "profit-split rule",
          store.profitSplitRules.filter((r) =>
            r.deductions.some((d) => d.deductionTypeId === id),
          ).length,
        ),
      );
      break;

    case "venture":
      found.push(
        ref(
          "profit-split rule",
          store.profitSplitRules.filter(
            (r) => r.scopeType === "venture" && r.scopeId === id,
          ).length,
        ),
      );
      break;

    // Hosting subscriptions, meetings, expenses, secrets and deals are leaves:
    // nothing else in the model points at them.
    case "hosting":
    case "meeting":
    case "expense":
    case "secret":
    case "deal":
      break;
  }

  return found.filter((r): r is Reference => r !== null);
}

/** Human-readable lines for the confirm dialog, e.g. "3 documents". */
export function describeReferences(references: Reference[]): string[] {
  return references.map((r) => `${r.count} ${r.label}`);
}
