import { z } from "zod";
import { amount, currency, cycle, ref, requiredText, requiredYmd, text, ymd } from "./common";

export const recurringExpenseSchema = z.object({
  name: requiredText,
  category: requiredText,
  amount,
  currency: currency.default("BHD"),
  cycle,
  nextDueDate: ymd,
  linkedClientId: ref,
  linkedProjectId: ref,
});
/** Kept for existing callers. */
export const createRecurringExpenseSchema = recurringExpenseSchema;

export const expenseSchema = z.object({
  description: requiredText,
  category: requiredText,
  vendor: text,
  amount,
  currency: currency.default("BHD"),
  spentOn: requiredYmd,
  linkedClientId: ref,
  linkedProjectId: ref,
  notes: text,
});

export const createDeductionTypeSchema = z.object({
  name: requiredText,
  kind: z.enum(["fixed", "percentage"]),
});

export const profitSplitSplitSchema = z.object({
  partyId: z.string().uuid(),
  percentageBps: z.number().int().min(0).max(10000),
});

export const profitSplitDeductionSchema = z.object({
  deductionTypeId: z.string().uuid(),
  value: z.number().nonnegative(),
});

export const upsertProfitSplitRuleSchema = z.object({
  scopeType: z.enum(["project", "venture"]),
  scopeId: z.string().uuid(),
  splits: z.array(profitSplitSplitSchema).min(1),
  deductions: z.array(profitSplitDeductionSchema),
  isDefault: z.boolean().optional(),
});

export const addPaymentSchema = z.object({
  amount,
  method: z.enum(["cash", "transfer", "card", "cheque"]),
  paidOn: ymd,
  reference: text,
});

export const createPartySchema = z.object({
  name: requiredText,
});

export const ventureSchema = z.object({
  name: requiredText,
  brandDescription: text,
  websiteUrl: text,
  launchStatus: z.enum(["planning", "in_development", "launched", "paused"]),
});
