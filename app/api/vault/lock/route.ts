import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { VAULT_SESSION_COOKIE } from "@/lib/crypto/vaultSession";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(VAULT_SESSION_COOKIE);
  return res;
}
