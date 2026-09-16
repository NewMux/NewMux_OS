import { randomUUID } from "crypto";
import { store } from "./store";
import { AppError } from "@/lib/api/errors";
import type { SecretRecord, SecretType } from "./types";

export async function getVaultMasterConfig() {
  return store.vaultMasterConfig;
}

export async function setVaultMasterConfig(
  kdfSalt: Buffer,
  passphraseVerifier: Buffer,
) {
  store.vaultMasterConfig = { kdfSalt, passphraseVerifier };
}

export async function listSecrets(): Promise<
  Pick<
    SecretRecord,
    | "id"
    | "label"
    | "secretType"
    | "maskedPreview"
    | "clientId"
    | "projectId"
    | "createdAt"
  >[]
> {
  return store.secrets.map(
    ({
      id,
      label,
      secretType,
      maskedPreview,
      clientId,
      projectId,
      createdAt,
    }) => ({
      id,
      label,
      secretType,
      maskedPreview,
      clientId,
      projectId,
      createdAt,
    }),
  );
}

export async function getSecretById(
  id: string,
): Promise<SecretRecord | undefined> {
  return store.secrets.find((s) => s.id === id);
}

export async function createSecret(input: {
  label: string;
  secretType: SecretType;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  maskedPreview: string;
  clientId?: string | null;
  projectId?: string | null;
  createdBy: string;
}): Promise<SecretRecord> {
  const secret: SecretRecord = {
    id: randomUUID(),
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    label: input.label,
    secretType: input.secretType,
    ciphertext: input.ciphertext,
    iv: input.iv,
    authTag: input.authTag,
    maskedPreview: input.maskedPreview,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  store.secrets.push(secret);
  return secret;
}

/**
 * Every caller logs while the secret still exists — deletion logs first, then
 * removes — so the label is resolved here rather than threaded through each
 * call site. It is copied into the entry, not looked up on read, because the
 * deletion case is precisely the one where the lookup would come back empty.
 */
export async function logVaultAccess(entry: {
  secretId: string;
  accessedBy: string;
  action: "reveal" | "unlock_attempt" | "create" | "update" | "delete";
}) {
  const secret = store.secrets.find((s) => s.id === entry.secretId);
  store.vaultAccessLog.push({
    id: randomUUID(),
    secretId: entry.secretId,
    secretLabel: secret?.label ?? "(unknown credential)",
    accessedBy: entry.accessedBy,
    action: entry.action,
    accessedAt: new Date().toISOString(),
  });
}

export async function updateSecretLabel(
  id: string,
  label: string,
  changedBy: string,
): Promise<SecretRecord> {
  const secret = store.secrets.find((s) => s.id === id);
  if (!secret)
    throw new AppError("not_found", "That credential no longer exists.");
  // Log before renaming, so the entry names the credential as it was known.
  await logVaultAccess({
    secretId: id,
    accessedBy: changedBy,
    action: "update",
  });
  secret.label = label;
  return secret;
}

/**
 * Deleting a credential is the most sensitive vault event, so it is recorded in
 * the access log before the record goes — the log entry outlives the secret.
 */
export async function deleteSecret(
  id: string,
  deletedBy: string,
): Promise<void> {
  const index = store.secrets.findIndex((s) => s.id === id);
  if (index === -1)
    throw new AppError("not_found", "That credential no longer exists.");
  await logVaultAccess({
    secretId: id,
    accessedBy: deletedBy,
    action: "delete",
  });
  store.secrets.splice(index, 1);
}

export async function listVaultAccessLog(limit = 50) {
  return [...store.vaultAccessLog]
    .sort((a, b) => (a.accessedAt < b.accessedAt ? 1 : -1))
    .slice(0, limit);
}
