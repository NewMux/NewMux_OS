import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

/**
 * The vault_session cookie carries the derived master key, encrypted with a
 * server-only secret (VAULT_SESSION_SECRET, distinct from NEXTAUTH_SECRET).
 * Chosen over an in-memory server-side cache because serverless functions
 * (Vercel-style) don't reliably persist memory between invocations — see
 * plan Section 5. The cookie itself never contains the passphrase.
 */

const VAULT_SESSION_TTL_MS = 15 * 60 * 1000;

function sessionSecretKey(): Buffer {
  const secret = process.env.VAULT_SESSION_SECRET;
  if (!secret) {
    // eslint-disable-next-line no-console
    console.warn("[NEWMUX OS] VAULT_SESSION_SECRET is not set — using an insecure dev-only fallback.");
  }
  return scryptSync(secret ?? "dev-only-insecure-fallback-secret", "newmux-vault-session", 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

export function packVaultSessionCookie(derivedKey: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionSecretKey(), iv);
  const expiresAt = Date.now() + VAULT_SESSION_TTL_MS;
  const payload = Buffer.concat([derivedKey, Buffer.from(String(expiresAt))]);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

export function unpackVaultSessionCookie(cookieValue: string): Buffer | null {
  try {
    const buf = Buffer.from(cookieValue, "base64url");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", sessionSecretKey(), iv);
    decipher.setAuthTag(authTag);
    const payload = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const derivedKey = payload.subarray(0, 32);
    const expiresAt = Number(payload.subarray(32).toString("utf8"));
    if (!expiresAt || Date.now() > expiresAt) return null;
    return derivedKey;
  } catch {
    return null;
  }
}

export const VAULT_SESSION_COOKIE = "vault_session";
export const VAULT_SESSION_MAX_AGE_SECONDS = VAULT_SESSION_TTL_MS / 1000;
