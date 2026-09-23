import { z } from "zod";
import { currency, ref, text, ymd } from "./common";
import type { DocumentStatus, DocumentType } from "@/lib/data/types";

export const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "draft"],
  accepted: ["paid", "signed"],
  signed: ["paid"],
  paid: ["archived"],
  archived: [],
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const lineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const createDocumentSchema = z.object({
  type: z.enum(["quote", "contract", "invoice"]) satisfies z.ZodType<DocumentType>,
  clientId: z.string().uuid(),
  productId: ref,
  projectId: ref,
  dealId: ref,
  currency: currency.default("BHD"),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
  paymentTerms: text,
  notes: text,
  dueAt: ymd,
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
});

export const transitionSchema = z.object({
  to: z.enum(["draft", "sent", "accepted", "signed", "paid", "archived"]) satisfies z.ZodType<DocumentStatus>,
});
