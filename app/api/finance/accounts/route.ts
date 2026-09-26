import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { bankAccountSchema } from "@/lib/validators/finance";
import { createBankAccount, getAccountBalances } from "@/lib/data/ledger";
import { majorToMinorUnits } from "@/lib/money";

export const GET = route({ allow: canAccessFinance }, async () => ({ accounts: await getAccountBalances() }));

export const POST = route({ allow: canAccessFinance, status: 201 }, async ({ req, session }) => {
  const { openingBalance, ...input } = await body(req, bankAccountSchema);
  return { account: await createBankAccount({ ...input, openingBalanceCents: majorToMinorUnits(openingBalance, input.currency) }, session.user.id) };
});
