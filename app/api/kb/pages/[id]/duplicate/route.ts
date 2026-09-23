import { route } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { duplicatePage } from "@/lib/data/kb";

export const POST = route<{ id: string }>({ allow: canAccessKb, status: 201 }, async ({ params, session }) => ({
  page: await duplicatePage(params.id, session.user.id),
}));
