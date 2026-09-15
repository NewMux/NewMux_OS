import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { addCertificationSchema } from "@/lib/validators/company";
import { addCertification } from "@/lib/data/company";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = addCertificationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const certification = await addCertification(parsed.data);
  return NextResponse.json({ certification }, { status: 201 });
});
