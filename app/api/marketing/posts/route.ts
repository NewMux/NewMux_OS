import { route, body } from "@/lib/api";
import { canAccessMarketing } from "@/lib/rbac";
import { createPost, listPosts } from "@/lib/data/marketing";
import { postSchema } from "@/lib/validators/marketing";

export const GET = route({ allow: canAccessMarketing }, async ({ req }) => ({
  posts: await listPosts({ from: req.nextUrl.searchParams.get("from") ?? undefined, to: req.nextUrl.searchParams.get("to") ?? undefined }),
}));

export const POST = route({ allow: canAccessMarketing, status: 201 }, async ({ req, session }) => ({
  post: await createPost(await body(req, postSchema), session.user.id),
}));
