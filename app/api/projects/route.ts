import { NextResponse, type NextRequest } from "next/server";
import {
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { createProjectSchema } from "@/lib/validators/project";
import { listProjects, createProject } from "@/lib/data/projects";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();

  const projects = await listProjects({ includeArchived: true });
  return NextResponse.json({ projects });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!canAccessFinance(session)) return forbidden();

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const project = await createProject({
    name: parsed.data.name,
    clientId: parsed.data.clientId ?? null,
    createdBy: session.user.id,
  });
  return NextResponse.json({ project }, { status: 201 });
});
