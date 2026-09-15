import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validators/task";
import { createTask, listTasks } from "@/lib/data/projects";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const task = await createTask({ ...parsed.data, createdBy: session.user.id });
  return NextResponse.json({ task }, { status: 201 });
}
