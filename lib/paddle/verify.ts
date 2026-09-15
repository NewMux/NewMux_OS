import { createHmac, timingSafeEqual } from "crypto";

const REPLAY_TOLERANCE_SECONDS = 5 * 60;

/**
 * Paddle Billing signs webhooks as `Paddle-Signature: ts=<unix_ts>;h1=<hex_hmac>`.
 * Verifies HMAC-SHA256 over `${ts}:${rawBody}` using PADDLE_WEBHOOK_SECRET,
 * with a timing-safe comparison and a replay-window check on `ts`.
 */
export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(";").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const tsNumber = Number(ts);
  if (!Number.isFinite(tsNumber) || Math.abs(Date.now() / 1000 - tsNumber) > REPLAY_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${ts}:${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(h1, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
