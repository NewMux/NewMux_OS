import { route, body } from "@/lib/api";
import { canAccessMarketing } from "@/lib/rbac";
import { deletePost, getPost, updatePost } from "@/lib/data/marketing";
import { NotFoundError } from "@/lib/data/sql";
import { postSchema } from "@/lib/validators/marketing";

type P = { id: string };

/** Replaces the post (the sheet sends every field). */
export const PATCH = route<P>({ allow: canAccessMarketing }, async ({ req, params }) => {
  if (!(await getPost(params.id))) throw new NotFoundError("Post");
  return { post: await updatePost(params.id, await body(req, postSchema)) };
});

export const DELETE = route<P>({ allow: canAccessMarketing }, async ({ params }) => {
  await deletePost(params.id);
  return { ok: true };
});
