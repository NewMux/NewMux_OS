import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateTaskSchema } from "@/lib/validators/task";
import { updateTaskStatus, updateTaskPriority } from "@/lib/data/projects";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let task;
  if (parsed.data.status) task = await updateTaskStatus(id, parsed.data.status);
  if (parsed.data.priority) task = await updateTaskPriority(id, parsed.data.priority);
  if (!task) return NextResponse.json({ error: "no fields to update" }, { status: 400 });

  return NextResponse.json({ task });
}
