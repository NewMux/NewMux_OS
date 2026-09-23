import { z } from "zod";
import { requiredText, text } from "./common";

export const clientSchema = z.object({
  name: requiredText,
  industry: text,
  website: text,
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).nullish().transform((v) => v || null),
  phone: text,
  billingAddress: text,
  notes: text,
});
export const createClientSchema = clientSchema;
export const updateClientSchema = clientSchema.partial();
