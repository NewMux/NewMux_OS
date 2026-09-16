import { z } from "zod";

export const createHostingSubscriptionSchema = z.object({
  clientId: z.string().uuid(),
  item: z.enum(["server", "domain", "other"]),
  amount: z.number().positive(),
  currency: z.string().length(3).default("BHD"),
  cycle: z.enum(["monthly", "quarterly", "annual"]),
});

/**
 * Edit-form values arrive as strings from the row-action dialog, so amounts are
 * coerced rather than expected as numbers.
 */
export const updateHostingSubscriptionSchema = z.object({
  item: z.enum(["server", "domain", "other"]).optional(),
  amount: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  cycle: z.enum(["monthly", "quarterly", "annual"]).optional(),
  nextDueDate: z.string().nullable().optional().or(z.literal("")),
  status: z.enum(["active", "overdue", "paused"]).optional(),
});
