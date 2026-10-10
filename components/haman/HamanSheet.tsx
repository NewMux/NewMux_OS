"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { NavButton } from "@/components/ui/Page";
import { Sheet, SheetButton, SheetIconButton } from "@/components/ui/Sheet";
import { RoleContext } from "@/components/shell/QuickAdd";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/data/types";
import { toBlocks, toSpans } from "@/lib/haman/markdown";

type Turn = { role: "user" | "assistant"; content: string; failed?: boolean };
type ServerEvent = { type: "status"; text: string } | { type: "reply"; text: string } | { type: "error"; message: string };

const OPEN_EVENT = "open-haman";

/** Opens Haman from anywhere in the app, optionally asking a question straight away. */
export function openHaman(question?: string) {
  window.dispatchEvent(new CustomEvent<{ question?: string }>(OPEN_EVENT, { detail: { question } }));
}

/** Navigation-bar button for phone screens; on iPad and Mac the sidebar has "Ask Haman". */
export function AskHamanButton() {
  return (
    <NavButton label="Ask Haman" className="text-accent md:hidden" onClick={() => openHaman()}>
      <Sparkles className="h-5 w-5" />
    </NavButton>
  );
}

const SUGGESTIONS: Record<UserRole, string[]> = {
  partner_admin: ["What needs me today?", "Who owes us money?", "How is the pipeline looking?", "What's due this week?"],
  lead_dev: ["What's on my plate today?", "Which tasks are overdue?", "What meetings are coming up?"],
};

/** How many earlier turns go with each question. */
const HISTORY = 16;

/**
 * Ask Haman: a chat with NEWMUX's AI project manager. He answers from the
 * live records through /api/haman and can't change anything. The
 * conversation is kept only while the app stays open.
 */
export function HamanSheet() {
  const role = useContext(RoleContext);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  /** What Haman is doing right now; null when he's idle. */
  const [status, setStatus] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const busyRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const update = useCallback((next: Turn[]) => {
    turnsRef.current = next;
    setTurns(next);
  }, []);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busyRef.current) return;
      busyRef.current = true;
      const asked: Turn[] = [...turnsRef.current, { role: "user", content: q }];
      update(asked);
      setDraft("");
      setStatus("Thinking");

      const finish = (answer: Turn) => update([...asked, answer]);
      try {
        // Error bubbles aren't part of the conversation; the history starts on a question.
        const history = asked.filter((t) => !t.failed).slice(-HISTORY);
        while (history[0]?.role === "assistant") history.shift();
        const res = await fetch("/api/haman", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map(({ role: r, content }) => ({ role: r, content: content.slice(0, 4000) })) }),
        });
        if (!res.ok || !res.body) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 503) setConfigured(false);
          finish({ role: "assistant", content: json.error ?? "Something went wrong. Please try again.", failed: true });
          return;
        }

        // One JSON object per line: status updates, then the reply (or an error).
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answered = false;
        const handle = (line: string) => {
          if (!line.trim()) return;
          let event: ServerEvent;
          try {
            event = JSON.parse(line) as ServerEvent;
          } catch {
            return; // A partial line from a dropped connection: reported below as cut off.
          }
          if (event.type === "status") setStatus(event.text);
          else {
            answered = true;
            finish(event.type === "reply" ? { role: "assistant", content: event.text } : { role: "assistant", content: event.message, failed: true });
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handle);
        }
        handle(buffer);
        if (!answered) finish({ role: "assistant", content: "The answer was cut off. Please ask again.", failed: true });
      } catch {
        finish({ role: "assistant", content: "You appear to be offline. Check your connection and try again.", failed: true });
      } finally {
        busyRef.current = false;
        setStatus(null);
      }
    },
    [update],
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      if (question) void send(question);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [send]);

  // Ask once whether the Claude API key is in place, so the sheet can say what's missing.
  useEffect(() => {
    if (!open || configured !== null) return;
    fetch("/api/haman")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setConfigured(d.configured !== false))
      .catch(() => setConfigured(true));
  }, [open, configured]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, status, open]);

  const busy = status !== null;
  const unavailable = configured === false;

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Haman"
      className="md:h-[min(720px,85vh)]"
      left={<SheetIconButton label="Close" onClick={() => setOpen(false)} />}
      right={
        turns.length > 0 ? (
          <SheetButton disabled={busy} onClick={() => update([])}>
            New
          </SheetButton>
        ) : undefined
      }
    >
      <div className="flex min-h-full flex-col">
        <div className="flex-1 space-y-3 pb-3" aria-live="polite">
          {turns.length === 0 && (
            <div className="flex flex-col items-center px-4 pb-2 pt-8 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/[0.12]">
                <Sparkles className="h-8 w-8 text-accent" strokeWidth={1.6} />
              </span>
              <p className="text-title3 text-label">Ask Haman</p>
              <p className="mt-1 max-w-sm text-subhead text-label-2">
                {unavailable
                  ? "Haman needs a Claude API key before he can answer. Add ANTHROPIC_API_KEY to the app's secrets, then open this again."
                  : "Your AI project manager. He looks things up in NEWMUX OS and answers from the live records."}
              </p>
              {!unavailable && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS[role].map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="press rounded-full bg-fill/[0.12] px-3.5 py-2 text-subhead font-medium text-label">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map((turn, i) =>
            turn.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div dir="auto" className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[6px] bg-accent px-3.5 py-2 text-body text-white">
                  {turn.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div
                  dir="auto"
                  className={cn("max-w-[92%] break-words rounded-[20px] rounded-bl-[6px] px-3.5 py-2.5 text-body", turn.failed ? "bg-ios-red/[0.12] text-label" : "bg-bg-elevated text-label")}
                >
                  <RichText text={turn.content} onNavigate={() => setOpen(false)} />
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-[20px] rounded-bl-[6px] bg-bg-elevated px-3.5 py-2.5 text-subhead text-label-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                {status}…
              </div>
            </div>
          )}
          <div ref={endRef} aria-hidden />
        </div>

        <form
          className="sticky bottom-0 bg-bg pb-1 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <div className="flex items-end gap-2 rounded-[22px] bg-fill/[0.12] py-1.5 pl-4 pr-1.5">
            <textarea
              dir="auto"
              rows={1}
              value={draft}
              maxLength={4000}
              disabled={unavailable}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="Ask about clients, money, projects…"
              aria-label="Ask Haman"
              enterKeyHint="send"
              // 16px or more, so iOS doesn't zoom in on focus.
              className="max-h-32 min-h-[32px] flex-1 resize-none self-center bg-transparent py-1 text-[17px] leading-[22px] text-label placeholder:text-label-3 focus:outline-none disabled:opacity-50"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={busy || unavailable || !draft.trim()}
              className="press glass-prominent flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
            </button>
          </div>
          <p className="px-2 pt-1.5 text-center text-caption2 text-label-2">Haman reads NEWMUX OS and can&apos;t change anything. Check figures that matter.</p>
        </form>
      </div>
    </Sheet>
  );
}

// --- Rendering Haman's replies ---

/** Bold and links. A link inside the app closes the sheet as it opens. */
function Spans({ line, onNavigate }: { line: string; onNavigate: () => void }) {
  return (
    <>
      {toSpans(line).map((span, i) =>
        span.kind === "bold" ? (
          <strong key={i} className="font-semibold">
            {span.text}
          </strong>
        ) : span.kind === "link" && span.internal ? (
          <Link key={i} href={span.href} onClick={onNavigate} className="font-medium text-accent">
            {span.text}
          </Link>
        ) : span.kind === "link" ? (
          <a key={i} href={span.href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent">
            {span.text}
          </a>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}

/** A reply as paragraphs and lists (lib/haman/markdown.ts). */
function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return (
    <div className="space-y-2">
      {toBlocks(text).map((block, i) =>
        block.kind === "p" ? (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Spans line={line} onNavigate={onNavigate} />
              </span>
            ))}
          </p>
        ) : block.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 ps-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Spans line={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 ps-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Spans line={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
