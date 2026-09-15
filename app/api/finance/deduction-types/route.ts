import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessSettings } from "@/lib/rbac";
import { createDeductionTypeSchema } from "@/lib/validators/finance";
import { listDeductionTypes, createDeductionType } from "@/lib/data/finance";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  const types = await listDeductionTypes();
  return NextResponse.json({ deductionTypes: types });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessSettings(session)) return forbidden();

  const body = await req.json();
  const parsed = createDeductionTypeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const type = await createDeductionType(parsed.data.name, parsed.data.kind);
  return NextResponse.json({ deductionType: type }, { status: 201 });
});
