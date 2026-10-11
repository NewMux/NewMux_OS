/**
 * Web Push with nothing but Web Crypto, so it runs the same on Cloudflare
 * Workers and on Node (Docker): the payload is encrypted for the browser
 * (RFC 8291, "aes128gcm") and the request is signed with the app's VAPID key
 * (RFC 8292). The browser's push service (Apple, Google, Mozilla) delivers it.
 *
 * Keys: VAPID_PUBLIC_KEY (65-byte uncompressed P-256 point) and
 * VAPID_PRIVATE_KEY (32-byte private scalar), both base64url, made by
 * `npm run push:keys`. VAPID_SUBJECT is a contact the push services can use
 * (default mailto:info@newmux.com).
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = {
  title: string;
  body?: string;
  /** Opened when the notification is tapped. */
  url?: string;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string;
};

export function vapidKeys(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT?.trim() || "mailto:info@newmux.com" };
}

// --- base64url and bytes ---

export function b64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const subtle = () => globalThis.crypto.subtle;
// Typed arrays straight into Web Crypto (TypeScript's BufferSource wants an ArrayBuffer-backed view).
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey("raw", buf(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle().sign("HMAC", k, buf(data)));
}

/** HKDF-SHA256 for a single output block (all RFC 8291 outputs are ≤ 32 bytes). */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

// --- RFC 8291: encrypting the message for one browser ---

const RECORD_SIZE = 4096;

/** The request body for one subscription: header (salt, record size, sender key) + one encrypted record. */
export async function encryptPayload(target: Pick<PushTarget, "p256dh" | "auth">, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(target.p256dh);
  const authSecret = b64urlToBytes(target.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Bad push subscription keys");

  const local = (await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await subtle().exportKey("raw", local.publicKey));
  const uaKey = await subtle().importKey("raw", buf(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await subtle().deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdhSecret, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  // One record, so it ends with the last-record delimiter 0x02 (no padding).
  const record = concat(plaintext, new Uint8Array([2]));
  if (record.length + 16 > RECORD_SIZE) throw new Error("Push message too long");
  const key = await subtle().importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: buf(nonce) }, key, buf(record)));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

// --- RFC 8292: VAPID ---

async function vapidAuthorization(endpoint: string, keys: { publicKey: string; privateKey: string; subject: string }): Promise<string> {
  const pub = b64urlToBytes(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY isn't an uncompressed P-256 key");
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d: keys.privateKey, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true };
  const signingKey = await subtle().importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = bytesToB64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: keys.subject })));
  // Web Crypto's ECDSA signature is already the raw r||s form a JWT uses.
  const signature = new Uint8Array(await subtle().sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, buf(utf8(`${header}.${claims}`))));
  return `vapid t=${header}.${claims}.${bytesToB64url(signature)}, k=${keys.publicKey}`;
}

export type SendResult = { ok: true } | { ok: false; gone: boolean; status: number };

/**
 * Sends one notification. `gone` means the browser has dropped the
 * subscription (unsubscribed, app removed): delete it.
 */
export async function sendPush(target: PushTarget, payload: PushPayload, opts: { ttlSeconds?: number } = {}): Promise<SendResult> {
  const keys = vapidKeys();
  if (!keys) throw new Error("Push isn't set up: VAPID keys are missing");
  const body = await encryptPayload(target, utf8(JSON.stringify(payload)));
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(target.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts.ttlSeconds ?? 24 * 3600),
      Urgency: "high",
    },
    body: buf(body),
  });
  if (res.ok) return { ok: true };
  return { ok: false, gone: res.status === 404 || res.status === 410, status: res.status };
}

/** A new VAPID key pair (npm run push:keys). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = bytesToB64url(await subtle().exportKey("raw", pair.publicKey));
  const jwk = await subtle().exportKey("jwk", pair.privateKey);
  return { publicKey, privateKey: jwk.d! };
}
