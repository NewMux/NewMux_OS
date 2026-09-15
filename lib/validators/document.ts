import { z } from "zod";
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
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const createDocumentSchema = z.object({
  type: z.enum(["quote", "contract", "invoice"]) satisfies z.ZodType<DocumentType>,
  clientId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
});

export const updateDocumentSchema = createDocumentSchema.partial().extend({
  lineItems: z.array(lineItemSchema).optional(),
});

export const transitionSchema = z.object({
  to: z.enum(["draft", "sent", "accepted", "signed", "paid", "archived"]) satisfies z.ZodType<DocumentStatus>,
});
