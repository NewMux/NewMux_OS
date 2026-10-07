import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { collectHostingSchema } from "@/lib/validators/hosting";
import { collectHostingFee } from "@/lib/data/hosting";
import { must } from "@/lib/data/sql";
import { majorToMinorUnits } from "@/lib/money";
import type { HostingSubscription } from "@/lib/data/types";

/** Invoice + payment + next due date in one step (item 12). */
export const POST = route<{ id: string }>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  const input = await body(req, collectHostingSchema);
  const sub = await must<HostingSubscription>("Hosting subscription", "select * from hosting_subscriptions where id = $1", [params.id]);
  return collectHostingFee(params.id, session.user.id, {
    amountCents: input.amount === null ? null : majorToMinorUnits(input.amount, sub.currency),
    paidOn: input.paidOn,
    method: input.method,
    accountId: input.accountId,
    reference: input.reference,
    invoiceOnly: input.invoiceOnly,
  });
});
