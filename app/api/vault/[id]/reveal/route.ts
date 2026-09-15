import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getSecretById, logVaultAccess } from "@/lib/data/vault";
import { decryptSecret } from "@/lib/crypto/vault";
import { unpackVaultSessionCookie, VAULT_SESSION_COOKIE } from "@/lib/crypto/vaultSession";

export const runtime = "nodejs";

/**
 * Lead Dev gets 403 unconditionally here regardless of vault_session state —
 * this is the hard enforcement point for "masked-only" access, not just a
 * hidden button in the UI.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPartnerAdmin(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const secret = await getSecretById(id);
  if (!secret) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cookieValue = req.cookies.get(VAULT_SESSION_COOKIE)?.value;
  const derivedKey = cookieValue ? unpackVaultSessionCookie(cookieValue) : null;
  if (!derivedKey) {
    await logVaultAccess({ secretId: id, accessedBy: session.user.id, action: "unlock_attempt" });
    return NextResponse.json({ error: "VAULT_LOCKED" }, { status: 401 });
  }

  const plaintext = decryptSecret(secret.ciphertext, secret.iv, secret.authTag, derivedKey);
  await logVaultAccess({ secretId: id, accessedBy: session.user.id, action: "reveal" });

  return NextResponse.json({ value: plaintext });
}
