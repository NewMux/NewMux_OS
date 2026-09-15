import { NextRequest, NextResponse } from "next/server";
import { unauthorized, validationError, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { createMeetingSchema } from "@/lib/validators/meeting";
import { listMeetings, createMeeting } from "@/lib/data/meetings";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  const meetings = await listMeetings();
  return NextResponse.json({ meetings });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const meeting = await createMeeting({
    ...parsed.data,
    createdBy: session.user.id,
  });
  return NextResponse.json({ meeting }, { status: 201 });
});
