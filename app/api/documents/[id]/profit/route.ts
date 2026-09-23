import { route } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { getInvoiceProfitBreakdown } from "@/lib/data/finance";

export const GET = route<{ id: string }>({ allow: canAccessFinance }, async ({ params }) => ({
  breakdown: await getInvoiceProfitBreakdown(params.id),
}));
