import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { moveDealSchema } from "@/lib/validators/crm";
import { moveDealStage } from "@/lib/data/crm";

export const POST = route<{ id: string }>({ allow: canAccessCrm }, async ({ req, params, session }) => {
  const { stage, orderedIds, lostReason } = await body(req, moveDealSchema);
  return { deal: await moveDealStage(params.id, stage, session.user.id, { orderedIds, lostReason }) };
});
