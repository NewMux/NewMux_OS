import { NextResponse } from "next/server";
import { unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { VAULT_SESSION_COOKIE } from "@/lib/crypto/vaultSession";

export const POST = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(VAULT_SESSION_COOKIE);
  return res;
});
