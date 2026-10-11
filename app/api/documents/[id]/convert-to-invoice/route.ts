import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { convertQuotationToInvoice } from "@/lib/data/documents";
import { convertToInvoiceSchema } from "@/lib/validators/document";

export const POST = route<{ id: string }>({ allow: canAccessFinance, status: 201 }, async ({ req, params, session }) => ({
  invoice: await convertQuotationToInvoice(params.id, session.user.id, await body(req, convertToInvoiceSchema)),
}));
