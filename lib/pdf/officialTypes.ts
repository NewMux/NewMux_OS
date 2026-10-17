import type { CompanyDetails } from "@/lib/data/company";
import type { Currency, DocumentStatus, DocumentType, PaymentMethod, RecurringExpenseCycle, ScopeItem, TermsClause } from "@/lib/data/types";

/**
 * Everything an official document's PDF shows, already resolved by the
 * server (lib/data/officialDocs.ts): the browser renders it with
 * lib/pdf/templates/OfficialPdf.tsx, for the preview, for the PDF that is
 * signed and stored on issue, and for an invoice's statement with its
 * payments. Client-safe: types only.
 */
export type OfficialPdfData = {
  kind: "official";
  filename: string;
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  /** Null while a draft hasn't been given its number. */
  number: string | null;
  version: number;
  externalRef: string | null;
  title: string | null;
  overview: string | null;
  scope: ScopeItem[];
  recipient: string | null;
  body: string | null;
  /** YYYY-MM-DD */
  date: string;
  validUntil: string | null;
  dueAt: string | null;
  client: { name: string; contactName: string | null; address: string | null } | null;
  currency: Currency;
  lineItems: { description: string; quantity: number; unitPriceCents: number }[];
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  /** With {iban} filled in. */
  paymentTerms: string | null;
  notes: string | null;
  terms: { templateName: string | null; clauses: TermsClause[] } | null;
  serverFee: { amountCents: number; cycle: RecurringExpenseCycle; clientChooses: boolean; label: string | null } | null;
  /** Signed documents: the snapshot. Drafts: whoever is chosen, for the preview. */
  signatory: { name: string; position: string } | null;
  signed: boolean;
  creditFor: string | null;
  /** Invoice statements only: what has been received so far. */
  payments: { paidOn: string; amountCents: number; method: PaymentMethod }[] | null;
  paidCents: number;
  creditedCents: number;
  company: CompanyDetails;
};
