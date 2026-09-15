import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
});
