import { NextRequest, NextResponse } from "next/server";
import { verifyPaddleSignature } from "@/lib/paddle/verify";
import { hasProcessedEvent, claimEvent } from "@/lib/data/saas";
import {
  handleSubscriptionUpsert,
  handleSubscriptionPastDue,
  handleSubscriptionCanceled,
  handleTransactionCompleted,
} from "@/lib/paddle/handlers";

export const runtime = "nodejs";

/**
 * The only public-facing route in this app (spec: zero public API exposure
 * elsewhere). Signature verification is a hard security requirement here.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("Paddle-Signature");
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret || !verifyPaddleSignature(rawBody, signature, secret)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let event: { event_id: string; event_type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  // Idempotency: exact event replays short-circuit here; handlers additionally
  // upsert by Paddle ID so out-of-order/duplicate deliveries stay safe too.
  if (await hasProcessedEvent(event.event_id)) {
    return new NextResponse("ok (duplicate)", { status: 200 });
  }

  switch (event.event_type) {
    case "subscription.created":
    case "subscription.updated":
      await handleSubscriptionUpsert(event);
      break;
    case "subscription.past_due":
      await handleSubscriptionPastDue(event);
      break;
    case "subscription.canceled":
      await handleSubscriptionCanceled(event);
      break;
    case "transaction.completed":
      await handleTransactionCompleted(event);
      break;
    default:
      // Unhandled event type — acknowledged but ignored.
      break;
  }

  await claimEvent(event.event_id);
  return new NextResponse("ok", { status: 200 });
}
