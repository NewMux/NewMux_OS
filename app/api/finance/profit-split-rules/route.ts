import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { upsertProfitSplitRuleSchema } from "@/lib/validators/finance";
import {
  listProfitSplitRules,
  upsertProfitSplitRule,
} from "@/lib/data/finance";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessSettings(session)) return forbidden();

  const rules = await listProfitSplitRules();
  return NextResponse.json({ rules });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessSettings(session)) return forbidden();

  const body = await req.json();
  const parsed = upsertProfitSplitRuleSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const rule = await upsertProfitSplitRule({
    ...parsed.data,
    updatedBy: session.user.id,
  });
  return NextResponse.json({ rule }, { status: 201 });
});
