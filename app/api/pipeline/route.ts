import { route, body } from "@/lib/api";
import { canAccessCompany } from "@/lib/rbac";
import { createPipelineItemSchema } from "@/lib/validators/pipeline";
import { createPipelineItem, listPipelineItems } from "@/lib/data/pipeline";

export const GET = route({ allow: canAccessCompany }, async () => ({ items: await listPipelineItems() }));

export const POST = route({ allow: canAccessCompany, status: 201 }, async ({ req }) => ({
  item: await createPipelineItem(await body(req, createPipelineItemSchema)),
}));
