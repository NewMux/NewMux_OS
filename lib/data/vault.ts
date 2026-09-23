import { query } from "@/lib/db";
import { many, one, must, NotFoundError } from "./sql";
import type { SecretRecord, SecretType } from "./types";

const toBuffer = (v: unknown) => Buffer.from(v as Uint8Array);

export async function getVaultMasterConfig(): Promise<{ kdfSalt: Buffer; passphraseVerifier: Buffer } | null> {
  const row = await one<{ kdfSalt: Uint8Array; passphraseVerifier: Uint8Array }>(
    "select kdf_salt, passphrase_verifier from vault_master_config where id = 1",
  );
  return row ? { kdfSalt: toBuffer(row.kdfSalt), passphraseVerifier: toBuffer(row.passphraseVerifier) } : null;
}

export async function setVaultMasterConfig(kdfSalt: Buffer, passphraseVerifier: Buffer): Promise<void> {
  await query(
    `insert into vault_master_config (id, kdf_salt, passphrase_verifier) values (1, $1, $2)
     on conflict (id) do update set kdf_salt = excluded.kdf_salt, passphrase_verifier = excluded.passphrase_verifier`,
    [kdfSalt, passphraseVerifier],
  );
}

export type SecretSummary = Pick<SecretRecord, "id" | "label" | "secretType" | "maskedPreview" | "clientId" | "projectId" | "createdAt"> & {
  clientName: string | null;
  projectName: string | null;
};

export async function listSecrets(filter: { projectId?: string; clientId?: string } = {}): Promise<SecretSummary[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.projectId) where.push(`s.project_id = $${params.push(filter.projectId)}`);
  if (filter.clientId) where.push(`s.client_id = $${params.push(filter.clientId)}`);
  return many<SecretSummary>(
    `select s.id, s.label, s.secret_type, s.masked_preview, s.client_id, s.project_id, s.created_at,
       c.name as client_name, p.name as project_name
     from secrets_vault s left join clients c on c.id = s.client_id left join projects p on p.id = s.project_id
     ${where.length ? `where ${where.join(" and ")}` : ""} order by s.label`,
    params,
  );
}

export async function getSecretById(id: string): Promise<SecretRecord | undefined> {
  const row = await one<SecretRecord>("select * from secrets_vault where id = $1", [id]);
  if (!row) return undefined;
  return { ...row, ciphertext: toBuffer(row.ciphertext), iv: toBuffer(row.iv), authTag: toBuffer(row.authTag) };
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
}): Promise<Pick<SecretRecord, "id" | "label">> {
  return must(
    "Secret",
    `insert into secrets_vault (label, secret_type, ciphertext, iv, auth_tag, masked_preview, client_id, project_id, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, label`,
    [
      input.label,
      input.secretType,
      input.ciphertext,
      input.iv,
      input.authTag,
      input.maskedPreview,
      input.clientId ?? null,
      input.projectId ?? null,
      input.createdBy,
    ],
  );
}

export async function deleteSecret(id: string): Promise<void> {
  const rows = await query("delete from secrets_vault where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Secret");
}

export async function logVaultAccess(entry: {
  secretId: string;
  accessedBy: string;
  action: "reveal" | "unlock_attempt" | "create" | "update" | "delete";
}): Promise<void> {
  await query("insert into vault_access_log (secret_id, accessed_by, action) values ($1, $2, $3)", [
    entry.secretId,
    entry.accessedBy,
    entry.action,
  ]);
}
