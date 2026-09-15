import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPartnerAdmin } from "@/lib/rbac";
import { createSecretSchema } from "@/lib/validators/vault";
import { listSecrets, createSecret, getVaultMasterConfig, logVaultAccess } from "@/lib/data/vault";
import { deriveKey, encryptSecret, maskPreview } from "@/lib/crypto/vault";
import { unpackVaultSessionCookie, VAULT_SESSION_COOKIE } from "@/lib/crypto/vaultSession";

export const runtime = "nodejs";

/**
 * Always masked-preview-only, regardless of role or unlock state — this API
 * contract never emits ciphertext/iv/authTag to any client.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secrets = await listSecrets();
  return NextResponse.json({ secrets });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPartnerAdmin(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const config = await getVaultMasterConfig();
  if (!config) return NextResponse.json({ error: "Vault is not set up yet" }, { status: 409 });

  const cookieValue = req.cookies.get(VAULT_SESSION_COOKIE)?.value;
  const derivedKey = cookieValue ? unpackVaultSessionCookie(cookieValue) : null;
  if (!derivedKey) return NextResponse.json({ error: "VAULT_LOCKED" }, { status: 401 });

  const body = await req.json();
  const parsed = createSecretSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { ciphertext, iv, authTag } = encryptSecret(parsed.data.value, derivedKey);
  const secret = await createSecret({
    label: parsed.data.label,
    secretType: parsed.data.secretType,
    ciphertext,
    iv,
    authTag,
    maskedPreview: maskPreview(parsed.data.value),
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId,
    createdBy: session.user.id,
  });
  await logVaultAccess({ secretId: secret.id, accessedBy: session.user.id, action: "create" });

  return NextResponse.json({ secret: { id: secret.id, label: secret.label, maskedPreview: secret.maskedPreview } }, { status: 201 });
}
