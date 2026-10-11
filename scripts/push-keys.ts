/**
 * Prints a new VAPID key pair and a CRON_SECRET for push notifications.
 *
 *   npm run push:keys
 *
 * Set all three as secrets (Cloudflare: Worker → Settings → Variables and
 * Secrets; Docker: deploy/.env). Keep the keys: changing them means everyone
 * has to turn notifications on again on each device.
 */
import { generateVapidKeys, bytesToB64url } from "../lib/push/webpush";

async function main() {
  const { publicKey, privateKey } = await generateVapidKeys();
  const cronSecret = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));
  console.log(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nCRON_SECRET=${cronSecret}`);
}

void main();
