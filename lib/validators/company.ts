import { z } from "zod";

export const addCertificationSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["active", "pending", "expired"]),
  expiryDate: z.string().nullable().optional(),
});

export const addPartnershipSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
