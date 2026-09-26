import { z } from "zod";
import { currency, ref, text, ymd } from "./common";
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
    sent: ["draft", "void"],
    paid: ["archived", "void"],
  },
  quote: {
    draft: ["sent"],
    sent: ["accepted", "declined", "draft", "void"],
    accepted: ["archived", "void"],
    declined: ["sent", "archived"],
  },
  contract: {
    draft: ["sent"],
    sent: ["signed", "draft", "void"],
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

export const createDocumentSchema = z.object({
  type: z.enum(["quote", "contract", "invoice", "credit_note"]) satisfies z.ZodType<DocumentType>,
  clientId: z.string().uuid(),
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
  lineItems: z.array(lineItemSchema).min(1),
});

export const updateDocumentSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1).optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  currency: currency.optional(),
  clientId: z.string().uuid().optional(),
  projectId: ref.optional(),
  paymentTerms: text.optional(),
  notes: text.optional(),
  dueAt: ymd.optional(),
  issuedAt: ymd.optional(),
  externalRef: text.optional(),
});

export const transitionSchema = z.object({
  to: z.enum(["draft", "sent", "accepted", "declined", "signed", "archived", "void"]) satisfies z.ZodType<DocumentStatus>,
  /** Required when voiding. */
  reason: text,
});
