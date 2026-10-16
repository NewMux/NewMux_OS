import { NextResponse, type NextRequest } from "next/server";
import { runDueNotifications } from "@/lib/push/notify";
import { syncOsChanges } from "@/lib/osChanges";

/**
 * Sends whatever has come due (lib/push/notify.ts) and moves OS updates
 * along (lib/osChanges.ts: opens pull requests, says when one is ready). Called every 5 minutes
 * by the Cloudflare cron (cloudflare-worker.mjs), with CRON_SECRET as a
 * bearer token. Nobody else can call it: without the secret set it refuses
 * every request.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !(await sameSecret(given, secret))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const notifications = await runDueNotifications();
    // GitHub being down mustn't stop reminders.
    const osChanges = await syncOsChanges().catch((error) => {
      console.error("[cron] OS updates failed", error);
      return { error: "failed" };
    });
    return NextResponse.json({ ...notifications, osChanges });
  } catch (error) {
    console.error("[cron] notifications failed", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** Compares digests, so the time taken says nothing about how much of the secret matched. */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  return x.every((v, i) => v === y[i]);
}
