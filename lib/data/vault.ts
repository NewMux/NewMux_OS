import { randomUUID } from "crypto";
import { store } from "./store";
import type { SecretRecord, SecretType } from "./types";

export async function getVaultMasterConfig() {
  return store.vaultMasterConfig;
}

export async function setVaultMasterConfig(kdfSalt: Buffer, passphraseVerifier: Buffer) {
  store.vaultMasterConfig = { kdfSalt, passphraseVerifier };
}

export async function listSecrets(): Promise<Pick<SecretRecord, "id" | "label" | "secretType" | "maskedPreview" | "clientId" | "projectId" | "createdAt">[]> {
  return store.secrets.map(({ id, label, secretType, maskedPreview, clientId, projectId, createdAt }) => ({
    id,
    label,
    secretType,
    maskedPreview,
    clientId,
    projectId,
    createdAt,
  }));
}

export async function getSecretById(id: string): Promise<SecretRecord | undefined> {
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

export async function logVaultAccess(entry: {
  secretId: string;
  accessedBy: string;
  action: "reveal" | "unlock_attempt" | "create" | "update" | "delete";
}) {
  store.vaultAccessLog.push({
    id: randomUUID(),
    secretId: entry.secretId,
    accessedBy: entry.accessedBy,
    action: entry.action,
    accessedAt: new Date().toISOString(),
  });
}
