import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { reconcileSchema } from "@/lib/validators/finance";
import { reconcileAccount } from "@/lib/data/ledger";
import { must } from "@/lib/data/sql";
import { majorToMinorUnits } from "@/lib/money";
import type { BankAccount } from "@/lib/data/types";

export const POST = route<{ id: string }>({ allow: canAccessFinance, status: 201 }, async ({ req, params, session }) => {
  const input = await body(req, reconcileSchema);
  const account = await must<BankAccount>("Account", "select * from bank_accounts where id = $1", [params.id]);
  return {
    reconciliation: await reconcileAccount({
      accountId: params.id,
      statementDate: input.statementDate,
      statementBalanceCents: majorToMinorUnits(input.statementBalance, account.currency),
      adjust: input.adjust,
      note: input.note,
      createdBy: session.user.id,
    }),
  };
});
