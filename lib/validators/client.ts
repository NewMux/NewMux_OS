import { z } from "zod";

/** Archive/restore, sent as the whole PATCH body. */
export const archiveSchema = z.object({ archived: z.boolean() }).strict();

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  nameArabic: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
  contactPhone: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(1),
  nameArabic: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
});
