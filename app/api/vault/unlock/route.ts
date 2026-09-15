import { NextRequest, NextResponse } from "next/server";
import {
  conflict,
  forbidden,
  unauthorized,
  validationError,
  withRoute,
} from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { unlockVaultSchema } from "@/lib/validators/vault";
import { getVaultMasterConfig } from "@/lib/data/vault";
import { deriveKey, verifyPassphrase } from "@/lib/crypto/vault";
import {
  packVaultSessionCookie,
  VAULT_SESSION_COOKIE,
  VAULT_SESSION_MAX_AGE_SECONDS,
} from "@/lib/crypto/vaultSession";

export const runtime = "nodejs";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!isPartnerAdmin(session)) return forbidden();

  const config = await getVaultMasterConfig();
  if (!config) return conflict("The vault has not been set up yet.");

  const body = await req.json();
  const parsed = unlockVaultSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const valid = verifyPassphrase(
    parsed.data.passphrase,
    config.kdfSalt,
    config.passphraseVerifier,
  );
  if (!valid) return unauthorized("That passphrase is incorrect.");

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
});
