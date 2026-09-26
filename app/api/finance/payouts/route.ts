import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { payoutSchema } from "@/lib/validators/finance";
import { createPayout, listPayouts } from "@/lib/data/ledger";
import { majorToMinorUnits } from "@/lib/money";

export const GET = route({ allow: canAccessFinance }, async ({ req }) => ({
  payouts: await listPayouts({ partyId: req.nextUrl.searchParams.get("partyId") ?? undefined }),
}));

export const POST = route({ allow: canAccessFinance, status: 201 }, async ({ req, session }) => {
  const { amount, ...input } = await body(req, payoutSchema);
  return { payout: await createPayout({ ...input, amountCents: majorToMinorUnits(amount, input.currency) }, session.user.id) };
});
