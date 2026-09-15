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
import { createSecretSchema } from "@/lib/validators/vault";
import {
  listSecrets,
  createSecret,
  getVaultMasterConfig,
  logVaultAccess,
} from "@/lib/data/vault";
import { deriveKey, encryptSecret, maskPreview } from "@/lib/crypto/vault";
import {
  unpackVaultSessionCookie,
  VAULT_SESSION_COOKIE,
} from "@/lib/crypto/vaultSession";

export const runtime = "nodejs";

/**
 * Always masked-preview-only, regardless of role or unlock state — this API
 * contract never emits ciphertext/iv/authTag to any client.
 */
export const GET = withRoute(async () => {
  const session = await auth();
  if (!session) return unauthorized();
  const secrets = await listSecrets();
  return NextResponse.json({ secrets });
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await auth();
  if (!session) return unauthorized();
  if (!isPartnerAdmin(session)) return forbidden();

  const config = await getVaultMasterConfig();
  if (!config) return conflict("The vault has not been set up yet.");

  const cookieValue = req.cookies.get(VAULT_SESSION_COOKIE)?.value;
  const derivedKey = cookieValue ? unpackVaultSessionCookie(cookieValue) : null;
  if (!derivedKey) return unauthorized("The vault is locked.");

  const body = await req.json();
  const parsed = createSecretSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { ciphertext, iv, authTag } = encryptSecret(
    parsed.data.value,
    derivedKey,
  );
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
  await logVaultAccess({
    secretId: secret.id,
    accessedBy: session.user.id,
    action: "create",
  });

  return NextResponse.json(
    {
      secret: {
        id: secret.id,
        label: secret.label,
        maskedPreview: secret.maskedPreview,
      },
    },
    { status: 201 },
  );
});
