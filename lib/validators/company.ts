import { z } from "zod";
import { requiredText, text, ymd } from "./common";

export const certificationSchema = z.object({
  name: requiredText,
  status: z.enum(["active", "pending", "expired"]),
  expiryDate: ymd,
});
export const addCertificationSchema = certificationSchema;

export const addPartnershipSchema = z.object({
  name: requiredText,
  description: text,
});

export const companyProfileSchema = z.object({
  legalName: requiredText.optional(),
  crNumber: z.string().trim().max(100).optional(),
  crRenewalDate: ymd.optional(),
  mainDomain: z.string().trim().max(200).optional(),
  mainDomainRenewalDate: ymd.optional(),
  vatNumber: text.optional(),
  address: text.optional(),
  phone: text.optional(),
  email: text.optional(),
});
