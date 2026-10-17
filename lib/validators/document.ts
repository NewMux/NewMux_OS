import { z } from "zod";
import { currency, cycle, ref, text, ymd } from "./common";
import type { DocumentStatus, DocumentType } from "@/lib/data/types";

/**
 * Moves a person can make, per document type (Improvements PRD item 10).
 * "paid" is never a manual target: an invoice becomes paid when its
 * payments cover the total, and returns to sent if they no longer do.
 * "void" (with a reason) replaces deleting anything that was sent.
 */
export const TRANSITIONS: Record<DocumentType, Partial<Record<DocumentStatus, DocumentStatus[]>>> = {
  invoice: {
    draft: ["sent"],
    // Back to draft only while unsigned and unpaid (checked in lib/data/documents.ts).
    sent: ["draft", "void"],
    paid: ["archived", "void"],
  },
  // Signed offers are locked: a change is a new version (revise), not a step back to draft.
  quote: {
    draft: ["sent"],
    sent: ["accepted", "declined", "void"],
    accepted: ["archived", "void"],
    declined: ["sent", "archived"],
  },
  proposal: {
    draft: ["sent"],
    sent: ["accepted", "declined", "void"],
    accepted: ["archived", "void"],
    declined: ["sent", "archived"],
  },
  letter: {
    draft: ["sent"],
    sent: ["archived", "void"],
  },
  contract: {
    draft: ["sent"],
    sent: ["signed", "void"],
    // Contracts accepted before signing existed as a separate step.
    accepted: ["signed", "void"],
    signed: ["archived", "void"],
  },
  credit_note: {
    draft: ["sent"],
    sent: ["void"],
  },
};

export function canTransition(type: DocumentType, from: DocumentStatus, to: DocumentStatus): boolean {
  return TRANSITIONS[type][from]?.includes(to) ?? false;
}

export const lineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const scopeItemSchema = z.object({ deliverable: z.string().trim().min(1).max(500), duration: z.string().trim().max(100).default("") });

export const termsSchema = z.object({
  templateId: z.string().uuid().nullish().transform((v) => v ?? null),
  templateName: z.string().trim().max(200).nullish().transform((v) => v ?? null),
  version: z.number().int().positive().nullish().transform((v) => v ?? null),
  clauses: z.array(z.object({ title: z.string().trim().max(300).default(""), body: z.string().trim().min(1).max(5000) })).max(60),
});

/** The optional server fee (PRD addendum 1.2, section 7): amount for the chosen cycle, in minor units. */
export const serverFeeSchema = z.object({
  amountCents: z.number().int().min(0),
  cycle,
  clientChooses: z.boolean().default(false),
  label: text,
});

/** Content fields of official documents, shared by create and update. */
const officialFields = {
  title: text,
  overview: text,
  scope: z.array(scopeItemSchema).max(40).optional(),
  recipient: text,
  body: z.string().trim().max(30_000).nullish().transform((v) => (v ? v : null)),
  validUntil: ymd,
  signatoryId: ref,
  terms: termsSchema.nullish(),
  /** null removes the fee. */
  serverFee: serverFeeSchema.nullish(),
};

export const createDocumentSchema = z.object({
  type: z.enum(["quote", "proposal", "contract", "invoice", "credit_note", "letter"]) satisfies z.ZodType<DocumentType>,
  /** Optional for letters only. */
  clientId: ref,
  productId: ref,
  projectId: ref,
  dealId: ref,
  currency: currency.default("BHD"),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
  paymentTerms: text,
  notes: text,
  dueAt: ymd,
  /** Defaults to today (item 7). */
  issuedAt: ymd,
  externalRef: text,
  /** Credit notes: the invoice they reduce. */
  creditForId: ref,
  /** At least one, except on letters (none) and proposals (optional). */
  lineItems: z.array(lineItemSchema).default([]),
  ...officialFields,
});

export const updateDocumentSchema = z.object({
  lineItems: z.array(lineItemSchema).optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  currency: currency.optional(),
  clientId: z.string().uuid().optional(),
  projectId: ref.optional(),
  paymentTerms: text.optional(),
  notes: text.optional(),
  dueAt: ymd.optional(),
  issuedAt: ymd.optional(),
  externalRef: text.optional(),
  title: text.optional(),
  overview: text.optional(),
  scope: z.array(scopeItemSchema).max(40).optional(),
  recipient: text.optional(),
  body: z.string().trim().max(30_000).nullish().transform((v) => (v ? v : null)).optional(),
  validUntil: ymd.optional(),
  signatoryId: ref.optional(),
  terms: termsSchema.nullish().optional(),
  serverFee: serverFeeSchema.nullish().optional(),
  /** When the fee changes on a document whose fee is already a hosting subscription: update that subscription too. */
  applyFeeToSubscription: z.boolean().optional(),
});

/** Step one of signing: the signatory's password, checked again at the moment of approval (section 5.2). */
export const issueStartSchema = z.object({
  /** false: issue an invoice or credit note without a signature. */
  sign: z.boolean().default(true),
  password: z.string().max(200).optional(),
});

/** Step two: the PDF the browser made with the drawn signature, as base64. */
export const issueFinishSchema = z.object({
  token: z.string().min(20).max(2000),
  pdf: z.string().min(100).max(14_000_000),
});

export const sendSchema = z.object({ via: z.enum(["email", "whatsapp", "download", "other"]) });

/** Turning an accepted quote into an invoice. full: every line item; deposit: a percentage of the quote; balance: what's left to invoice. */
export const convertToInvoiceSchema = z.object({
  mode: z.enum(["full", "deposit", "balance"]).optional(),
  depositPercent: z.number().min(1).max(100).optional(),
});

export const transitionSchema = z.object({
  to: z.enum(["draft", "sent", "accepted", "declined", "signed", "archived", "void"]) satisfies z.ZodType<DocumentStatus>,
  /** Required when voiding. */
  reason: text,
});
