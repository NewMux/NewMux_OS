import { NextRequest, NextResponse } from "next/server";
import { forbidden, notFound, unauthorized, withRoute } from "@/lib/api/errors";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { getSecretById, logVaultAccess } from "@/lib/data/vault";
import { decryptSecret } from "@/lib/crypto/vault";
import {
  unpackVaultSessionCookie,
  VAULT_SESSION_COOKIE,
} from "@/lib/crypto/vaultSession";

export const runtime = "nodejs";

/**
 * Lead Dev gets 403 unconditionally here regardless of vault_session state —
 * this is the hard enforcement point for "masked-only" access, not just a
 * hidden button in the UI.
 */
export const POST = withRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session) return unauthorized();
    if (!isPartnerAdmin(session)) return forbidden();

    const { id } = await params;
    const secret = await getSecretById(id);
    if (!secret) return notFound();

    const cookieValue = req.cookies.get(VAULT_SESSION_COOKIE)?.value;
    const derivedKey = cookieValue
      ? unpackVaultSessionCookie(cookieValue)
      : null;
    if (!derivedKey) {
      await logVaultAccess({
        secretId: id,
        accessedBy: session.user.id,
        action: "unlock_attempt",
      });
      return unauthorized("The vault is locked.");
    }

    const plaintext = decryptSecret(
      secret.ciphertext,
      secret.iv,
      secret.authTag,
      derivedKey,
    );
    await logVaultAccess({
      secretId: id,
      accessedBy: session.user.id,
      action: "reveal",
    });

    return NextResponse.json({ value: plaintext });
  },
);
