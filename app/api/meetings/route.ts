import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMeetingSchema } from "@/lib/validators/meeting";
import { listMeetings, createMeeting } from "@/lib/data/meetings";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meetings = await listMeetings();
  return NextResponse.json({ meetings });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const meeting = await createMeeting({ ...parsed.data, createdBy: session.user.id });
  return NextResponse.json({ meeting }, { status: 201 });
}
