import { route } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { deletePipelineItem } from "@/lib/data/pipeline";

export const DELETE = route<{ id: string }>({ allow: canAccessCompany }, async ({ params }) => {
  await deletePipelineItem(params.id);
  return { ok: true };
});
