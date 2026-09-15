import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { createPartySchema } from "@/lib/validators/finance";
import { listParties, createParty } from "@/lib/data/finance";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  const parties = await listParties();
  return NextResponse.json({ parties });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessSettings(session)) return forbidden();

  const body = await req.json();
  const parsed = createPartySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const party = await createParty(parsed.data.name);
  return NextResponse.json({ party }, { status: 201 });
});
