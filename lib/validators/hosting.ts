import { z } from "zod";
import { amount, currency, cycle, ref, text, ymd } from "./common";

export const hostingSubscriptionSchema = z.object({
  clientId: z.string().uuid(),
  projectId: ref,
  item: z.enum(["server", "domain", "other"]),
  label: text,
  amount,
  currency: currency.default("BHD"),
  cycle,
  nextDueDate: ymd,
  status: z.enum(["active", "overdue", "paused"]).optional(),
});
export const createHostingSubscriptionSchema = hostingSubscriptionSchema;
