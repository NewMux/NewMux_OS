import { NextResponse } from "next/server";
import { forbidden, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { collectHostingFee } from "@/lib/data/hosting";

export const POST = withRoute(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const result = await collectHostingFee(id, session.user.id);
    return NextResponse.json(result);
  },
);
