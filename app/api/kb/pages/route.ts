import { route, body } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { createPageSchema } from "@/lib/validators/kb";
import { createPage, searchPages } from "@/lib/data/kb";

export const GET = route({ allow: canAccessKb }, async ({ req }) => ({
  pages: await searchPages(req.nextUrl.searchParams.get("q") ?? ""),
}));

export const POST = route({ allow: canAccessKb, status: 201 }, async ({ req, session }) => ({
  page: await createPage(await body(req, createPageSchema), session.user.id),
}));
