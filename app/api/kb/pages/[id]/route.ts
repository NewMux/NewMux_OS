import { route, body } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { updatePageSchema } from "@/lib/validators/kb";
import { deletePage, getPageById, updatePage } from "@/lib/data/kb";
import { NotFoundError } from "@/lib/data/sql";
import type { KbContent } from "@/lib/data/types";

type P = { id: string };

export const GET = route<P>({ allow: canAccessKb }, async ({ params }) => {
  const page = await getPageById(params.id);
  if (!page) throw new NotFoundError("Page");
  return { page };
});

export const PATCH = route<P>({ allow: canAccessKb }, async ({ req, params, session }) => {
  const { content, ...patch } = await body(req, updatePageSchema);
  const page = await updatePage(params.id, { ...patch, content: content as KbContent | undefined }, session.user.id);
  return { page: { id: page.id, updatedAt: page.updatedAt, title: page.title } };
});

export const DELETE = route<P>({ allow: canAccessKb }, async ({ params }) => {
  await deletePage(params.id);
  return { ok: true };
});
