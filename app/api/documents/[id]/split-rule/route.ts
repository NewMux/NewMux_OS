import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { invoiceSplitRuleSchema } from "@/lib/validators/finance";
import { setInvoiceSplitRule } from "@/lib/data/finance";

/** Use an existing rule for this invoice, or (ruleId null) go back to its project's rule. */
export const POST = route<{ id: string }>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  await setInvoiceSplitRule(params.id, (await body(req, invoiceSplitRuleSchema)).ruleId, session.user.id);
  return { ok: true };
});
