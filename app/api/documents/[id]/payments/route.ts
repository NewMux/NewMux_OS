import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { addPaymentSchema } from "@/lib/validators/finance";
import { addPayment, listPaymentsForDocument } from "@/lib/data/finance";
import { getDocumentById } from "@/lib/data/documents";
import { NotFoundError } from "@/lib/data/sql";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const GET = route<P>({ allow: canAccessFinance }, async ({ params }) => ({ payments: await listPaymentsForDocument(params.id) }));

export const POST = route<P>({ allow: canAccessFinance, status: 201 }, async ({ req, params, session }) => {
  const input = await body(req, addPaymentSchema);
  const doc = await getDocumentById(params.id);
  if (!doc) throw new NotFoundError("Invoice");
  const payment = await addPayment({
    documentId: params.id,
    amountCents: majorToMinorUnits(input.amount, doc.currency),
    method: input.method,
    paidOn: input.paidOn ?? undefined,
    reference: input.reference,
    accountId: input.accountId,
    recordedBy: session.user.id,
  });
  return { payment };
});
