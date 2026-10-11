import { route, body } from "@/lib/api";
import { canAccessMarketing } from "@/lib/rbac";
import { setPostStatus } from "@/lib/data/marketing";
import { postStatusSchema } from "@/lib/validators/marketing";

/** Moves a post along the board. */
export const POST = route<{ id: string }>({ allow: canAccessMarketing }, async ({ req, params }) => ({
  post: await setPostStatus(params.id, (await body(req, postStatusSchema)).status),
}));
