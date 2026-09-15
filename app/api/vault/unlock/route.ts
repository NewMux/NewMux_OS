import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { unlockVaultSchema } from "@/lib/validators/vault";
import { getVaultMasterConfig } from "@/lib/data/vault";
import { deriveKey, verifyPassphrase } from "@/lib/crypto/vault";
import { packVaultSessionCookie, VAULT_SESSION_COOKIE, VAULT_SESSION_MAX_AGE_SECONDS } from "@/lib/crypto/vaultSession";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPartnerAdmin(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const config = await getVaultMasterConfig();
  if (!config) return NextResponse.json({ error: "Vault is not set up yet" }, { status: 409 });

  const body = await req.json();
  const parsed = unlockVaultSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const valid = verifyPassphrase(parsed.data.passphrase, config.kdfSalt, config.passphraseVerifier);
  if (!valid) return NextResponse.json({ error: "Incorrect passphrase" }, { status: 401 });

  const key = deriveKey(parsed.data.passphrase, config.kdfSalt);
  const cookieValue = packVaultSessionCookie(key);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(VAULT_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: VAULT_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
