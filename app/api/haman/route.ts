import { NextResponse } from "next/server";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { askHaman, hamanConfigured, HamanError, type HamanEvent } from "@/lib/haman/agent";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1]!.role === "user", "The last message must be the question."),
});

/** Whether Haman is set up, so the chat can say what's missing instead of failing. */
export const GET = route({}, async () => ({ configured: hamanConfigured() }));

/**
 * Ask Haman. Any signed-in user; what he can look up follows their role
 * (lib/haman/tools.ts). Streams newline-delimited JSON: a `status` line for
 * each lookup, then one `reply` (or `error`).
 */
export const POST = route({}, async ({ req, session }) => {
  if (!hamanConfigured()) {
    return NextResponse.json({ error: "Haman isn't set up yet. Add ANTHROPIC_API_KEY to the app's secrets." }, { status: 503 });
  }
  const { messages } = await body(req, schema);
  const ctx = { userId: session.user.id, userName: session.user.name ?? session.user.email ?? "a colleague", role: session.user.role };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: HamanEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The reader has gone (sheet closed): nothing left to tell.
        }
      };
      try {
        send({ type: "reply", text: await askHaman(messages, ctx, send, req.signal) });
      } catch (error) {
        if (!(error instanceof HamanError)) {
          // eslint-disable-next-line no-console
          console.error("[haman]", error);
        }
        send({ type: "error", message: error instanceof HamanError ? error.message : "Something went wrong. Please try again." });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the reader.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
});
