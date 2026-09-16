import { NextResponse, type NextRequest } from "next/server";
import { unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { searchAll } from "@/lib/data/search";

export const GET = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();

  // searchAll does the rbac filtering itself, per source, so the session is
  // passed down rather than gated once here.
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchAll(q, session, { limit: 20 });
  return NextResponse.json({ results });
});
