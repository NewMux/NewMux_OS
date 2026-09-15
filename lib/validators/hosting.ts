import { z } from "zod";

export const createHostingSubscriptionSchema = z.object({
  clientId: z.string().uuid(),
  item: z.enum(["server", "domain", "other"]),
  amount: z.number().positive(),
  currency: z.string().length(3).default("BHD"),
  cycle: z.enum(["monthly", "quarterly", "annual"]),
});
