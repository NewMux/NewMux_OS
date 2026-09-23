import { route } from "@/lib/api";
import { canRevealVaultSecrets } from "@/lib/rbac";
import { deleteSecret, logVaultAccess } from "@/lib/data/vault";

export const runtime = "nodejs";

export const DELETE = route<{ id: string }>({ allow: canRevealVaultSecrets }, async ({ params, session }) => {
  await deleteSecret(params.id);
  await logVaultAccess({ secretId: params.id, accessedBy: session.user.id, action: "delete" });
  return { ok: true };
});
