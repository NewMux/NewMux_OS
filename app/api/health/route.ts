import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pingDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await pingDb();
  return NextResponse.json({
    status: db ? "ok" : "degraded",
    db: db ? "ok" : "down",
    mode: process.env.DATABASE_URL ? "postgres" : "pglite",
    checkedAt: new Date().toISOString(),
  });
}
