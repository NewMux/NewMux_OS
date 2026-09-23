import { route } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { listPagesInSpace } from "@/lib/data/kb";

export const GET = route<{ id: string }>({ allow: canAccessKb }, async ({ params }) => ({ pages: await listPagesInSpace(params.id) }));
