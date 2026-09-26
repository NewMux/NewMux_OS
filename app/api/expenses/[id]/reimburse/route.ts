import { z } from "zod";
import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { ref, ymd } from "@/lib/validators/common";
import { reimburseExpense } from "@/lib/data/expenses";

/** Pays a partner back for a cost they covered personally (item 16). */
export const POST = route<{ id: string }>({ allow: canAccessFinance, status: 201 }, async ({ req, params, session }) => {
  const input = await body(req, z.object({ paidOn: ymd, accountId: ref }));
  return { payout: await reimburseExpense(params.id, { paidOn: input.paidOn ?? undefined, accountId: input.accountId }, session.user.id) };
});
