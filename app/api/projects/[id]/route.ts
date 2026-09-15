import { NextResponse, type NextRequest } from "next/server";
import {
  conflict,
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { updateProjectSchema } from "@/lib/validators/project";
import { archiveSchema } from "@/lib/validators/client";
import {
  updateProject,
  deleteProject,
  setProjectArchived,
  getProjectById,
} from "@/lib/data/projects";
import { getReferences, describeReferences } from "@/lib/data/integrity";

export const PATCH = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const body = await req.json();

    const archive = archiveSchema.safeParse(body);
    if (archive.success) {
      const project = await setProjectArchived(id, archive.data.archived);
      return NextResponse.json({ project });
    }

    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Empty strings from date/url inputs mean "cleared", not "unchanged".
    const patch = Object.fromEntries(
      Object.entries(parsed.data).map(([key, value]) => [
        key,
        value === "" ? null : value,
      ]),
    );
    const project = await updateProject(id, patch);
    return NextResponse.json({ project });
  },
);

export const DELETE = withRoute(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!canAccessFinance(session)) return forbidden();

    const { id } = await params;
    const project = await getProjectById(id);
    if (!project) return NextResponse.json({ ok: true });

    const references = getReferences("project", id);
    if (references.length > 0) {
      return conflict(
        `${project.name} still has linked records. Archive it instead to keep the history.`,
        {
          references: describeReferences(references),
        },
      );
    }

    await deleteProject(id);
    return NextResponse.json({ ok: true });
  },
);
