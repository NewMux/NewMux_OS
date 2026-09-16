import { NextResponse } from "next/server";
import { unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { listNotifications } from "@/lib/data/notifications";

export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();

  // listNotifications does its own rbac filtering, so finance alerts never
  // reach a lead_dev even though the route itself only requires a session.
  const notifications = await listNotifications(session);
  return NextResponse.json({ notifications });
});
