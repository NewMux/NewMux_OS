import { route, body } from "@/lib/api";
import { canAccessKb } from "@/lib/rbac";
import { favoriteSchema } from "@/lib/validators/kb";
import { setFavorite } from "@/lib/data/kb";

export const POST = route<{ id: string }>({ allow: canAccessKb }, async ({ req, params, session }) => {
  const { favorite } = await body(req, favoriteSchema);
  await setFavorite(session.user.id, params.id, favorite);
  return { favorite };
});
