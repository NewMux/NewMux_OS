import { z } from "zod";
import { amount, currency, ref, requiredText, text, ymd } from "./common";

const email = z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).nullish().transform((v) => v || null);

export const contactSchema = z.object({
  clientId: ref,
  fullName: requiredText,
  title: text,
  email,
  phone: text,
  whatsapp: text,
  isPrimary: z.boolean().optional(),
  notes: text,
});

export const dealStage = z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]);

export const dealSchema = z.object({
  title: requiredText,
  clientId: ref,
  contactId: ref,
  stage: dealStage.optional(),
  value: z.coerce.number().min(0).max(1_000_000_000).default(0),
  currency: currency.default("BHD"),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedClose: ymd,
  ownerId: ref,
  source: text,
  notes: text,
});
export const updateDealSchema = dealSchema.partial();

export const moveDealSchema = z.object({
  stage: dealStage,
  orderedIds: z.array(z.string().uuid()).optional(),
  lostReason: text,
});

export const activitySchema = z.object({
  kind: z.enum(["call", "email", "meeting", "note", "whatsapp", "follow_up"]),
  subject: requiredText,
  body: text,
  clientId: ref,
  contactId: ref,
  dealId: ref,
  dueAt: z
    .string()
    .nullish()
    .transform((v) => (v ? new Date(v).toISOString() : null)),
});

export { amount };
