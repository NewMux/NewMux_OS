import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createPipelineItemSchema } from "@/lib/validators/pipeline";
import { listPipelineItems, createPipelineItem } from "@/lib/data/pipeline";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();
  const items = await listPipelineItems();
  return NextResponse.json({ items });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = createPipelineItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const item = await createPipelineItem(parsed.data);
  return NextResponse.json({ item }, { status: 201 });
});
