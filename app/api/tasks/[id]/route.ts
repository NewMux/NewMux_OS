import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { updateTaskSchema } from "@/lib/validators/task";
import {
  updateTaskStatus,
  updateTaskPriority,
  moveTask,
} from "@/lib/data/projects";

export const PATCH = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    let task;
    if (parsed.data.status && parsed.data.index !== undefined) {
      task = await moveTask(id, parsed.data.status, parsed.data.index);
    } else if (parsed.data.status) {
      task = await updateTaskStatus(id, parsed.data.status);
    }
    if (parsed.data.priority)
      task = await updateTaskPriority(id, parsed.data.priority);
    if (!task) return apiError("validation", "No fields to update.");

    return NextResponse.json({ task });
  },
);
