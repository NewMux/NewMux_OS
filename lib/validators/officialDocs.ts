import { z } from "zod";

const DOC_TYPES = ["quote", "proposal", "contract", "invoice", "credit_note", "letter"] as const;

export const signatorySchema = z.object({
  fullName: z.string().trim().min(1, "Add the name").max(200),
  position: z.string().trim().min(1, "Add the position").max(200),
  userId: z.string().uuid("Choose their login"),
  isActive: z.boolean().default(true),
  defaultFor: z.array(z.enum(DOC_TYPES)).max(6).default([]),
});

export const clauseSchema = z.object({
  title: z.string().trim().max(300).default(""),
  body: z.string().trim().min(1, "A clause needs its text").max(5000),
  defaultOn: z.boolean().default(true),
});

export const termsTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name the product type").max(100),
  isActive: z.boolean().default(true),
  clauses: z.array(clauseSchema).max(60),
});

export const standaloneClausesSchema = z.object({ clauses: z.array(clauseSchema).max(60) });

export const companyDetailsSchema = z.object({
  tradeName: z.string().trim().min(1).max(100).optional(),
  tagline: z.string().trim().max(200).optional(),
  crNumber: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  email: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(50).optional(),
  website: z.string().trim().max(200).optional(),
  iban: z.string().trim().max(50).optional(),
});
