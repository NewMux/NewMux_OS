import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Mock data mode: the in-memory store is always "reachable" by definition.
  // Once Supabase is wired in, this should run `select 1` and check the
  // most recent paddle_webhook_events.received_at.
  return NextResponse.json({
    status: "ok",
    db: "ok",
    mode: "mock",
    checkedAt: new Date().toISOString(),
  });
}
