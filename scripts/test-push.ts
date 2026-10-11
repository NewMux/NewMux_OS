/**
 * Checks for push notifications (lib/push): the encryption is decrypted by an
 * independent implementation (Node's crypto, following RFC 8291), the VAPID
 * signature verifies, and the scheduled check sends each due reminder,
 * follow-up, task, meeting and renewal once, to the right people, and drops
 * devices the browser has gone from. No network: push services are stubbed.
 *
 *   npm run test:push
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import nodeCrypto from "node:crypto";

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "newmux-push-"));
delete process.env.DATABASE_URL;

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
}
const section = (title: string) => console.log(`\n${title}`);

/** A browser's side of a subscription: its key pair and auth secret. */
function fakeBrowser() {
  const ecdh = nodeCrypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = nodeCrypto.randomBytes(16);
  const b64 = (b: Buffer) => b.toString("base64url");
  return { ecdh, auth, p256dh: b64(ecdh.getPublicKey()), authB64: b64(auth) };
}

/** RFC 8291 decryption, written against Node's crypto rather than lib/push. */
function decrypt(body: Uint8Array, browser: ReturnType<typeof fakeBrowser>): string {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16);
  const rs = buf.readUInt32BE(16);
  const idlen = buf[20]!;
  const asPublic = buf.subarray(21, 21 + idlen);
  const ciphertext = buf.subarray(21 + idlen);
  const shared = browser.ecdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), browser.ecdh.getPublicKey(), asPublic]);
  const ikm = Buffer.from(nodeCrypto.hkdfSync("sha256", shared, browser.auth, keyInfo, 32));
  const cek = Buffer.from(nodeCrypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(nodeCrypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = nodeCrypto.createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  if (rs !== 4096 || plain[plain.length - 1] !== 2) throw new Error("bad record");
  return plain.subarray(0, plain.length - 1).toString("utf8");
}

type Sent = { url: string; headers: Record<string, string>; body: Uint8Array };

function stubPushServices(status: (url: string) => number = () => 201): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    sent.push({ url: String(url), headers: init?.headers as Record<string, string>, body: new Uint8Array(init?.body as ArrayBuffer) });
    return new Response(null, { status: status(String(url)) });
  }) as typeof fetch;
  return sent;
}

async function main() {
  const { generateVapidKeys, encryptPayload, sendPush, b64urlToBytes } = await import("../lib/push/webpush");
  const keys = await generateVapidKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@newmux.com";

  section("Encryption and signing");
  const browser = fakeBrowser();
  const message = JSON.stringify({ title: "Call Ox", body: "مرحبا — Arabic and emoji 🔔 survive" });
  const body = await encryptPayload({ p256dh: browser.p256dh, auth: browser.authB64 }, new TextEncoder().encode(message));
  let decrypted = "";
  try {
    decrypted = decrypt(body, browser);
  } catch (e) {
    decrypted = String(e);
  }
  check("An independent RFC 8291 decryption gets the message back", decrypted === message, decrypted);
  const other = fakeBrowser();
  let wrongKey = false;
  try {
    decrypt(body, other);
  } catch {
    wrongKey = true;
  }
  check("Another browser's keys can't read it", wrongKey);
  check("Each message uses a fresh key and salt", Buffer.compare(Buffer.from(body.subarray(0, 86)), Buffer.from((await encryptPayload({ p256dh: browser.p256dh, auth: browser.authB64 }, new TextEncoder().encode(message))).subarray(0, 86))) !== 0);

  let sent = stubPushServices();
  const result = await sendPush({ endpoint: "https://web.push.apple.com/abc123", p256dh: browser.p256dh, auth: browser.authB64 }, { title: "Hi", url: "/home" });
  const auth = sent[0]!.headers.Authorization!;
  const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(auth) ?? [];
  const [h, c, s] = (jwt ?? "").split(".");
  const claims = JSON.parse(Buffer.from(c ?? "", "base64url").toString()) as { aud: string; exp: number; sub: string };
  const pub = b64urlToBytes(keys.publicKey);
  const verifier = nodeCrypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: Buffer.from(pub.slice(1, 33)).toString("base64url"), y: Buffer.from(pub.slice(33)).toString("base64url") }, format: "jwk" });
  const valid = nodeCrypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: verifier, dsaEncoding: "ieee-p1363" }, Buffer.from(s ?? "", "base64url"));
  check("The request is sent and accepted", result.ok && sent.length === 1 && sent[0]!.url === "https://web.push.apple.com/abc123");
  check("The VAPID signature verifies against the public key", valid && k === keys.publicKey);
  check("The VAPID claims name the push service, the contact and a near expiry", claims.aud === "https://web.push.apple.com" && claims.sub === "mailto:test@newmux.com" && claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 24 * 3600);
  check("Headers say how it's encoded and how long to keep it", sent[0]!.headers["Content-Encoding"] === "aes128gcm" && Number(sent[0]!.headers.TTL) > 0);
  check("The body decrypts to the payload", JSON.parse(decrypt(sent[0]!.body, browser)).title === "Hi");
  stubPushServices(() => 410);
  const gone = await sendPush({ endpoint: "https://fcm.googleapis.com/x", p256dh: browser.p256dh, auth: browser.authB64 }, { title: "Hi" });
  check("A 410 is reported as a device that's gone", !gone.ok && gone.gone);

  section("Reminders — input");
  const { reminderSchema } = await import("../lib/validators/notifications");
  const soon = new Date(Date.now() + 3600_000).toISOString();
  check("A reminder for an hour from now is fine", reminderSchema.safeParse({ title: "Call Ox", remindAt: soon }).success);
  check("A time in the past is refused", !reminderSchema.safeParse({ title: "x", remindAt: "2020-01-01T09:00:00+03:00" }).success);
  check("A link outside the app is refused", ["https://evil.example", "//evil.example", "javascript:alert(1)"].every((href) => !reminderSchema.safeParse({ title: "x", remindAt: soon, href }).success));
  check("A link inside the app is kept", reminderSchema.safeParse({ title: "x", remindAt: soon, href: "/clients/1" }).data?.href === "/clients/1");

  section("The scheduled check");
  const { query } = await import("../lib/db");
  const { runDueNotifications } = await import("../lib/push/notify");
  const { savePushSubscription, createReminder, claimNotification } = await import("../lib/data/notifications");
  const users = await query<{ id: string; role: string }>("select id, role from users where is_active order by created_at");
  const partnerA = users.find((u) => u.role === "partner_admin")!.id;
  const partnerB = users.filter((u) => u.role === "partner_admin")[1]?.id ?? partnerA;
  const [project] = await query<{ id: string }>("select id from projects limit 1");

  // Devices: A has a phone, B has a laptop whose subscription has expired.
  const phone = fakeBrowser();
  const laptop = fakeBrowser();
  await savePushSubscription(partnerA, { endpoint: "https://push.example/a-phone", p256dh: phone.p256dh, auth: phone.authB64, device: "iPhone" });
  await savePushSubscription(partnerB, { endpoint: "https://push.example/b-laptop", p256dh: laptop.p256dh, auth: laptop.authB64, device: "Mac" });

  // A fixed "now": 10:00 Bahrain today, so morning notices are due.
  const todayBahrain = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const now = new Date(`${todayBahrain}T07:00:00Z`);
  await query("delete from notification_log");
  // The demo data's own due items go first, so what's counted below is only ours.
  stubPushServices();
  await runDueNotifications(now);

  const r = await createReminder({ userId: partnerA, title: "Call Ox about renewal", body: null, href: "/clients", remindAt: new Date(now.getTime() - 60_000).toISOString(), createdBy: partnerA });
  await createReminder({ userId: partnerA, title: "Later", body: null, href: null, remindAt: new Date(now.getTime() + 3600_000).toISOString(), createdBy: partnerA });
  await query("insert into activities (kind, subject, due_at, created_by) values ('follow_up', 'Chase Voya quote', $1, $2)", [new Date(now.getTime() - 10 * 60_000).toISOString(), partnerA]);
  await query("insert into tasks (project_id, title, due_at, assignee_id, status, priority) values ($1, 'Ship the invoice fix', $2::date, $3, 'todo', 'high')", [project!.id, todayBahrain, partnerA]);
  await query("insert into meetings (title, starts_at, duration_minutes, created_by) values ('Partners sync', $1, 30, $2)", [new Date(now.getTime() + 10 * 60_000).toISOString(), partnerA]);
  await query("insert into meetings (title, starts_at, duration_minutes, created_by) values ('Next week', $1, 30, $2)", [new Date(now.getTime() + 7 * 86400_000).toISOString(), partnerA]);
  await query("insert into certifications (name, status, expiry_date) values ('ISO 27001', 'active', $1::date)", [todayBahrain]);

  sent = stubPushServices((url) => (url.endsWith("b-laptop") ? 410 : 201));
  const summary = await runDueNotifications(now);
  const toPhone = sent.filter((s) => s.url.endsWith("a-phone")).map((s) => JSON.parse(decrypt(s.body, phone)) as { title: string; url: string; tag: string });
  const titles = toPhone.map((p) => p.title);
  check("The due reminder goes, opening its link", toPhone.some((p) => p.title === "Call Ox about renewal" && p.url === "/clients"), titles.join(" | "));
  check("A reminder for later doesn't go yet", !titles.includes("Later"));
  check("The follow-up goes to whoever set it", titles.includes("Follow up: Chase Voya quote"));
  check("The task due today goes to its assignee", titles.includes("Due today: Ship the invoice fix"));
  check("The meeting in 10 minutes goes; next week's doesn't", titles.some((t) => t.endsWith("· Partners sync")) && !titles.some((t) => t.includes("Next week")));
  check("A renewal due today goes to partners", titles.some((t) => t.startsWith("ISO 27001")));
  check("The summary counts them", summary.reminders === 1 && summary.followUps === 1 && summary.tasks === 1 && summary.meetings === 1 && summary.renewals >= 1, JSON.stringify(summary));
  const reminderRow = (await query<{ sent_at: string | null }>("select sent_at from reminders where id = $1", [r.id]))[0];
  check("The reminder is marked sent", !!reminderRow?.sent_at);
  const laptopLeft = await query("select 1 from push_subscriptions where endpoint = 'https://push.example/b-laptop'");
  check("A device the push service says is gone is removed", partnerB === partnerA || laptopLeft.length === 0);

  sent = stubPushServices();
  const again = await runDueNotifications(new Date(now.getTime() + 5 * 60_000));
  const repeats = sent.map((s) => JSON.parse(decrypt(s.body, phone)) as { title: string }).map((p) => p.title);
  check("The next check sends none of them again", !repeats.some((t) => ["Call Ox about renewal", "Follow up: Chase Voya quote", "Due today: Ship the invoice fix"].includes(t) || t.endsWith("· Partners sync")), repeats.join(" | "));
  check("…and counts nothing new", again.reminders === 0 && again.followUps === 0 && again.tasks === 0 && again.meetings === 0, JSON.stringify(again));
  check("Overlapping runs can't both claim one notice", (await claimNotification(partnerA, "race:1")) && !(await claimNotification(partnerA, "race:1")));

  sent = stubPushServices();
  const early = new Date(`${todayBahrain}T04:00:00Z`); // 07:00 Bahrain
  await query("delete from notification_log where key like 'task:%'");
  await runDueNotifications(early);
  check("Tasks due today wait for the morning (not before 9:00)", !sent.some((s) => s.url.endsWith("a-phone") && (JSON.parse(decrypt(s.body, phone)) as { title: string }).title.startsWith("Due today")));

  delete process.env.VAPID_PRIVATE_KEY;
  sent = stubPushServices();
  const off = await runDueNotifications(now);
  check("Without VAPID keys nothing is sent", sent.length === 0 && !!off.skipped);
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;

  section("The cron endpoint");
  const { POST } = await import("../app/api/cron/notifications/route");
  const { NextRequest } = await import("next/server");
  const call = (authorization?: string) => POST(new NextRequest("https://os.newmux.com/api/cron/notifications", { method: "POST", headers: authorization ? { authorization } : {} }));
  delete process.env.CRON_SECRET;
  check("Refuses everything while CRON_SECRET isn't set", (await call("Bearer anything")).status === 403);
  process.env.CRON_SECRET = "s3cret-value-for-tests";
  check("Refuses a wrong secret", (await call("Bearer nope")).status === 403);
  check("Refuses no secret", (await call()).status === 403);
  stubPushServices();
  check("Runs with the right one", (await call("Bearer s3cret-value-for-tests")).status === 200);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
