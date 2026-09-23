import { route } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { createProjectFromDeal } from "@/lib/data/crm";

export const POST = route<{ id: string }>({ allow: canAccessCrm, status: 201 }, async ({ params, session }) => ({
  project: await createProjectFromDeal(params.id, session.user.id),
}));
