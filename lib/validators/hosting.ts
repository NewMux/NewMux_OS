import { z } from "zod";
import { currency, cycle, paymentMethod, ref, text, ymd } from "./common";

/** Money in major units; blank/null = "amount TBD" (item 13). */
const optionalAmount = z
  .union([z.coerce.number().positive("Must be more than zero").max(1_000_000_000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const hostingSubscriptionSchema = z.object({
  clientId: z.string().uuid(),
  projectId: ref,
  item: z.enum(["server", "domain", "other"]),
  label: text,
  amount: optionalAmount,
  currency: currency.default("BHD"),
  cycle,
  /** Blank clears it (paused or not-started services). */
  nextDueDate: ymd,
  status: z.enum(["active", "overdue", "paused", "not_started"]).optional(),
  recurringExpenseId: ref,
  costPerYear: optionalAmount,
  costCurrency: currency.nullish(),
});
export const createHostingSubscriptionSchema = hostingSubscriptionSchema;

export const collectHostingSchema = z.object({
  amount: optionalAmount,
  paidOn: ymd,
  method: paymentMethod.optional(),
  accountId: ref,
  reference: text,
  invoiceOnly: z.boolean().optional(),
});

export const linkHostingInvoiceSchema = z.object({
  documentId: z.string().uuid(),
  advance: z.boolean().default(false),
});
