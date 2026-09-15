import { z } from "zod";

export const createRecurringExpenseSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  cycle: z.enum(["monthly", "quarterly", "annual"]),
  linkedClientId: z.string().uuid().nullable().optional(),
  linkedProjectId: z.string().uuid().nullable().optional(),
});

export const createDeductionTypeSchema = z.object({
  name: z.string().min(1),
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
  amount: z.number().positive(),
  method: z.enum(["cash", "transfer"]),
});

export const createPartySchema = z.object({
  name: z.string().min(1),
});
