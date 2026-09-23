import { route } from "@/lib/api";
import { globalSearch } from "@/lib/data/search";

export const GET = route({}, async ({ req, session }) => {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return { results: await globalSearch(q, session.user.role) };
});
