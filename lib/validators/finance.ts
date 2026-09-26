import { z } from "zod";
import { amount, currency, cycle, paymentMethod, ref, requiredText, requiredYmd, signedAmount, text, ymd } from "./common";

export const recurringExpenseSchema = z.object({
  name: requiredText,
  category: requiredText,
  amount,
  currency: currency.default("BHD"),
  cycle,
  nextDueDate: ymd,
  linkedClientId: ref,
  linkedProjectId: ref,
  linkedVentureId: ref,
  /** A partner's card it's charged to, if not the company account (item 16). */
  paidByPartyId: ref,
});
/** Kept for existing callers. */
export const createRecurringExpenseSchema = recurringExpenseSchema;

export const expenseSchema = z.object({
  description: requiredText,
  category: requiredText,
  vendor: text,
  amount,
  currency: currency.default("BHD"),
  /** Non-BHD expenses: the BHD amount actually charged (item 17). Blank = the official peg. */
  amountBhd: z
    .union([z.coerce.number().positive().max(1_000_000_000), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  spentOn: requiredYmd,
  linkedClientId: ref,
  linkedProjectId: ref,
  linkedVentureId: ref,
  /** Pass-through cost of this invoice. */
  documentId: ref,
  accountId: ref,
  paidByPartyId: ref,
  reimbursementStatus: z.enum(["not_required", "pending", "reimbursed"]).optional(),
  fundPartyId: ref,
  receiptFileId: ref,
  notes: text,
});

export const createDeductionTypeSchema = z.object({
  name: requiredText,
  kind: z.enum(["fixed", "percentage"]),
  /** The fund this deduction feeds (e.g. the Newmux reserve), if any. */
  fundPartyId: ref,
});

export const updateDeductionTypeSchema = z.object({
  name: requiredText,
  fundPartyId: ref,
});

export const profitSplitSplitSchema = z.object({
  partyId: z.string().uuid(),
  percentageBps: z.number().int().min(0).max(10000),
});

export const profitSplitDeductionSchema = z.object({
  deductionTypeId: z.string().uuid(),
  value: z.number().nonnegative(),
  base: z.enum(["total", "remaining"]).optional(),
});

export const upsertProfitSplitRuleSchema = z.object({
  scopeType: z.enum(["project", "venture", "document"]),
  scopeId: z.string().uuid(),
  splits: z.array(profitSplitSplitSchema).min(1),
  deductions: z.array(profitSplitDeductionSchema),
  isDefault: z.boolean().optional(),
});

export const addPaymentSchema = z.object({
  amount,
  method: paymentMethod,
  paidOn: ymd,
  reference: text,
  accountId: ref,
});

export const createPartySchema = z.object({
  name: requiredText,
  kind: z.enum(["partner", "fund"]).default("partner"),
});

export const invoiceSplitRuleSchema = z.object({
  /** An existing rule to use, or null for the project's rule. */
  ruleId: ref,
});

export const bankAccountSchema = z.object({
  name: requiredText,
  currency: currency.default("BHD"),
  openingBalance: signedAmount,
  openingBalanceDate: requiredYmd,
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const reconcileSchema = z.object({
  statementDate: requiredYmd,
  statementBalance: signedAmount,
  adjust: z.boolean().default(false),
  note: text,
});

export const payoutSchema = z.object({
  partyId: z.string().uuid(),
  type: z.enum(["share", "advance", "withdrawal", "reimbursement"]),
  amount,
  currency: currency.default("BHD"),
  paidOn: requiredYmd,
  documentId: ref,
  accountId: ref,
  reference: text,
  notes: text,
});

export const ventureSchema = z.object({
  name: requiredText,
  brandDescription: text,
  websiteUrl: text,
  launchStatus: z.enum(["planning", "in_development", "launched", "paused"]),
});
