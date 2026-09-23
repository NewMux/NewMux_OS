import { route } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { collectHostingFee } from "@/lib/data/hosting";

export const POST = route<{ id: string }>({ allow: canAccessFinance }, async ({ params, session }) => collectHostingFee(params.id, session.user.id));
