import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createClientSchema } from "@/lib/validators/client";
import { listClients, createClient } from "@/lib/data/documents";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  const clients = await listClients();
  return NextResponse.json({ clients });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const client = await createClient(parsed.data);
  return NextResponse.json({ client }, { status: 201 });
});
