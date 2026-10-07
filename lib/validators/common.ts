import { z } from "zod";

/** Optional free text: trims, and turns "" into null so blank inputs clear a field. */
export const text = z
  .string()
  .trim()
  .max(10_000)
  .nullish()
  .transform((v) => (v ? v : null));

export const requiredText = z.string().trim().min(1, "Required").max(500);

/** Optional uuid reference; "" (an unselected <select>) becomes null. */
export const ref = z
  .union([z.string().uuid(), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

export const currency = z.enum(["BHD", "USD"]);

/** YYYY-MM-DD, optional; "" becomes null. */
export const ymd = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

export const requiredYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** A money amount in major units as typed by a person (e.g. 15.5 BHD). */
export const amount = z.coerce.number().positive("Must be more than zero").max(1_000_000_000);

/** A money amount that may be zero or negative (an overdrawn opening balance, a statement figure). */
export const signedAmount = z.coerce.number().min(-1_000_000_000).max(1_000_000_000);

export const cycle = z.enum(["monthly", "quarterly", "annual"]);

export const PAYMENT_METHODS = ["transfer", "benefitpay", "cash", "card", "paypal", "upwork", "cheque", "other"] as const;
export const paymentMethod = z.enum(PAYMENT_METHODS);
