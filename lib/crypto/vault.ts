import { randomBytes, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from "crypto";

/**
 * AES-256-GCM secrets vault crypto. Must only run in the Node.js runtime
 * (not Edge) — anything importing this needs `export const runtime = "nodejs"`
 * on its route.
 */

const SCRYPT_KEYLEN = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export function generateSalt(): Buffer {
  return randomBytes(16);
}

export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
}

/**
 * Verifier is a second scrypt pass over the derived key, never the
 * passphrase or the raw key itself — the DB stores only this.
 */
export function computeVerifier(key: Buffer): Buffer {
  return scryptSync(key, "newmux-vault-verify", SCRYPT_KEYLEN, SCRYPT_PARAMS);
}

export function verifyPassphrase(passphrase: string, salt: Buffer, storedVerifier: Buffer): boolean {
  const key = deriveKey(passphrase, salt);
  const candidate = computeVerifier(key);
  if (candidate.length !== storedVerifier.length) return false;
  return timingSafeEqual(candidate, storedVerifier);
}

export function encryptSecret(plaintext: string, key: Buffer): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptSecret(ciphertext: Buffer, iv: Buffer, authTag: Buffer, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskPreview(plaintext: string): string {
  if (plaintext.length <= 4) return "*".repeat(plaintext.length);
  return `${"*".repeat(Math.max(plaintext.length - 4, 4))}${plaintext.slice(-4)}`;
}
