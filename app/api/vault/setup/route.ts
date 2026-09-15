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
import { setupVaultSchema } from "@/lib/validators/vault";
import { getVaultMasterConfig, setVaultMasterConfig } from "@/lib/data/vault";
import { generateSalt, deriveKey, computeVerifier } from "@/lib/crypto/vault";

export const runtime = "nodejs";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!isPartnerAdmin(session)) return forbidden();

  const existing = await getVaultMasterConfig();
  if (existing) return conflict("The vault is already configured.");

  const body = await req.json();
  const parsed = setupVaultSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const salt = generateSalt();
  const key = deriveKey(parsed.data.passphrase, salt);
  const verifier = computeVerifier(key);
  await setVaultMasterConfig(salt, verifier);

  return NextResponse.json({ ok: true });
});
