import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { bankAccountSchema } from "@/lib/validators/finance";
import { deleteBankAccount, getAccountStatement, updateBankAccount } from "@/lib/data/ledger";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

/** The account's statement; `?to=YYYY-MM-DD` gives the balance on that date. */
export const GET = route<P>({ allow: canAccessFinance }, async ({ req, params }) => {
  const to = req.nextUrl.searchParams.get("to");
  return getAccountStatement(params.id, to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined);
});

export const PATCH = route<P>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  const { openingBalance, ...input } = await body(req, bankAccountSchema);
  return { account: await updateBankAccount(params.id, { ...input, openingBalanceCents: majorToMinorUnits(openingBalance, input.currency) }, session.user.id) };
});

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deleteBankAccount(params.id, session.user.id);
  return { ok: true };
});
