import { NextRequest, NextResponse } from "next/server";
import { unauthorized, validationError, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validators/task";
import { createTask, listTasks } from "@/lib/data/projects";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const task = await createTask({ ...parsed.data, createdBy: session.user.id });
  return NextResponse.json({ task }, { status: 201 });
});
