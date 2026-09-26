import { z } from "zod";
import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { convertQuotationToInvoice } from "@/lib/data/documents";

const schema = z.object({
  /** full: every line item; deposit: a percentage of the quote; balance: what's left to invoice. */
  mode: z.enum(["full", "deposit", "balance"]).optional(),
  depositPercent: z.number().min(1).max(100).optional(),
});

export const POST = route<{ id: string }>({ allow: canAccessFinance, status: 201 }, async ({ req, params, session }) => ({
  invoice: await convertQuotationToInvoice(params.id, session.user.id, await body(req, schema)),
}));
