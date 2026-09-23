import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { setupVaultSchema } from "@/lib/validators/vault";
import { getVaultMasterConfig, setVaultMasterConfig } from "@/lib/data/vault";
import { generateSalt, deriveKey, computeVerifier } from "@/lib/crypto/vault";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPartnerAdmin(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const existing = await getVaultMasterConfig();
  if (existing) return NextResponse.json({ error: "Vault is already configured" }, { status: 409 });

  const body = await req.json();
  const parsed = setupVaultSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const salt = generateSalt();
  const key = deriveKey(parsed.data.passphrase, salt);
  const verifier = computeVerifier(key);
  await setVaultMasterConfig(salt, verifier);

  return NextResponse.json({ ok: true });
}
