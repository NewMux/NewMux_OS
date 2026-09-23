import { route } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { togglePipelineStage } from "@/lib/data/pipeline";

export const POST = route<{ id: string }>({ allow: canAccessCompany }, async ({ params }) => ({ item: await togglePipelineStage(params.id) }));
