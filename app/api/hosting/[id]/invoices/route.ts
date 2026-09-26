import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { linkHostingInvoiceSchema } from "@/lib/validators/hosting";
import { linkHostingInvoice, listHostingInvoices, unlinkHostingInvoice } from "@/lib/data/hosting";

type P = { id: string };

/** Invoices billed for this hosting fee. */
export const GET = route<P>({ allow: canAccessFinance }, async ({ params }) => ({ invoices: await listHostingInvoices(params.id) }));

/** Link an invoice issued outside "Collect" (item 12). */
export const POST = route<P>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  const { documentId, advance } = await body(req, linkHostingInvoiceSchema);
  await linkHostingInvoice(params.id, documentId, { advance }, session.user.id);
  return { ok: true };
});

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  const documentId = req.nextUrl.searchParams.get("documentId");
  if (documentId) await unlinkHostingInvoice(params.id, documentId, session.user.id);
  return { ok: true };
});
