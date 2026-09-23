import { route } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { convertQuotationToInvoice } from "@/lib/data/documents";

export const POST = route<{ id: string }>({ allow: canAccessFinance, status: 201 }, async ({ params, session }) => ({
  invoice: await convertQuotationToInvoice(params.id, session.user.id),
}));
