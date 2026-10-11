"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { NavButton } from "@/components/ui/Page";
import { Sheet, SheetButton, SheetIconButton } from "@/components/ui/Sheet";
import { RoleContext } from "@/components/shell/QuickAdd";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/lib/hooks/useMediaQuery";
import type { UserRole } from "@/lib/data/types";
import { toBlocks, toSpans } from "@/lib/haman/markdown";
import type { ProposedAction } from "@/lib/haman/actions";

type Turn = { role: "user" | "assistant"; content: string; failed?: boolean; actions?: Card[] };
type ServerEvent = { type: "status"; text: string } | { type: "action"; action: ProposedAction } | { type: "reply"; text: string } | { type: "error"; message: string };

/** A change Haman prepared, and where the user is with it. */
type Card = ProposedAction & { state: "waiting" | "running" | "done" | "failed" | "cancelled"; note?: string; createdId?: string; secret?: string };

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
  partner_admin: ["What needs me today?", "Who owes us money?", "How is the pipeline looking?", "Add a task for me to follow up tomorrow"],
  lead_dev: ["What's on my plate today?", "Which tasks are overdue?", "What meetings are coming up?", "Mark my overdue tasks in review"],
};

/** How many earlier turns go with each question. */
const HISTORY = 16;

/**
 * Ask Haman: a chat with NEWMUX's AI project manager. He answers from the
 * live records through /api/haman, and prepares changes as cards that only
 * take effect when the user confirms them. The conversation is kept only
 * while the app stays open.
 */
export function HamanSheet() {
  const role = useContext(RoleContext);
  const desktop = useIsDesktop();
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

      const proposed: Card[] = [];
      const finish = (answer: Turn) => update([...asked, proposed.length ? { ...answer, actions: proposed } : answer]);
      try {
        // Error bubbles aren't part of the conversation; the history starts on a question.
        const history = asked.filter((t) => !t.failed).slice(-HISTORY);
        while (history[0]?.role === "assistant") history.shift();
        const res = await fetch("/api/haman", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map((t) => ({ role: t.role, content: withOutcomes(t).slice(-4000) })) }),
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
          else if (event.type === "action") proposed.push({ ...event.action, state: "waiting" });
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

  const router = useRouter();
  const setCard = useCallback(
    (cardId: string, patch: Partial<Card>) =>
      update(turnsRef.current.map((t) => (t.actions?.some((a) => a.id === cardId) ? { ...t, actions: t.actions.map((a) => (a.id === cardId ? { ...a, ...patch } : a)) } : t))),
    [update],
  );

  /** Confirm: the browser calls the app's own route, with the signed-in user's session. */
  const confirmCard = useCallback(
    async (card: Card) => {
      setCard(card.id, { state: "running", note: undefined });
      try {
        const { method, path, body } = card.request;
        const res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: unknown };
        if (!res.ok) {
          const reason = typeof json.error === "string" && json.error ? json.error : "Something went wrong. Please try again.";
          setCard(card.id, { state: "failed", note: reason.charAt(0).toUpperCase() + reason.slice(1) });
          return;
        }
        if (card.kind === "reveal") setCard(card.id, { state: "done", secret: typeof json.value === "string" ? json.value : "" });
        else setCard(card.id, { state: "done", createdId: createdIdOf(json) });
        router.refresh();
      } catch {
        setCard(card.id, { state: "failed", note: "You appear to be offline. Check your connection and try again." });
      }
    },
    [router, setCard],
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

  const close = <SheetIconButton label="Close" onClick={() => setOpen(false)} />;
  const newChat =
    turns.length > 0 ? (
      <SheetButton disabled={busy} onClick={() => update([])}>
        New
      </SheetButton>
    ) : undefined;
  // On iPad and Mac a link only navigates the page beside the panel; on phones the sheet covers it, so it closes.
  const onNavigate = () => {
    if (!desktop) setOpen(false);
  };

  const body = (
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
                  : "Your AI project manager. He answers from the live records in NEWMUX OS, and makes changes for you once you confirm them."}
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
                  <RichText text={turn.content} onNavigate={onNavigate} />
                  {turn.actions?.map((card) => (
                    <ActionCard key={card.id} card={card} onConfirm={() => void confirmCard(card)} onCancel={() => setCard(card.id, { state: "cancelled" })} />
                  ))}
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
          <p className="px-2 pt-1.5 text-center text-caption2 text-label-2">Haman changes nothing until you confirm. Check figures that matter.</p>
        </form>
      </div>
  );

  if (desktop) {
    return (
      <SidePanel open={open} onOpenChange={setOpen} left={close} right={newChat}>
        {body}
      </SidePanel>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen} title="Haman" left={close} right={newChat}>
      {body}
    </Sheet>
  );
}

/**
 * iPad and Mac: Haman sits in a panel on the right, like Mail's inspector,
 * instead of a dialog over the screen. The app beside it stays usable, and
 * on wide windows the page makes room for it (`html[data-haman]` in globals.css).
 */
function SidePanel({ open, onOpenChange, left, right, children }: { open: boolean; onOpenChange: (o: boolean) => void; left: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.haman = "open";
    return () => {
      delete document.documentElement.dataset.haman;
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          // Clicking the page beside the panel keeps it open; ✕ or Escape closes it.
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed bottom-3 right-3 top-3 z-50 flex w-[min(400px,calc(100vw-296px))] flex-col overflow-hidden rounded-[28px] bg-bg shadow-float ring-[0.5px] ring-black/10 animate-slide-in-right focus:outline-none dark:ring-white/10"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-2 pt-3.5">
            <div className="flex justify-start">{left}</div>
            <Dialog.Title className="text-center text-headline">Haman</Dialog.Title>
            <div className="flex justify-end">{right}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// --- Changes Haman prepared ---

/** The id of what a route created ({ task: { id } }, { page: { id } }, …), so Haman can carry on with it. */
function createdIdOf(json: Record<string, unknown>): string | undefined {
  for (const value of Object.values(json)) {
    if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  }
  if (typeof json.pageId === "string") return json.pageId;
  return undefined;
}

/** What Haman is told about each card when the conversation goes back to him. Never a revealed secret. */
function withOutcomes(turn: Turn): string {
  if (!turn.actions?.length) return turn.content;
  const lines = turn.actions.map((a) => {
    const what = `"${a.title} · ${a.target}"`;
    if (a.state === "done") return a.kind === "reveal" ? `[${what}: shown to the user]` : `[${what}: confirmed and saved${a.createdId ? `, id ${a.createdId}` : ""}]`;
    if (a.state === "failed") return `[${what}: failed: ${a.note ?? "unknown error"}]`;
    if (a.state === "cancelled") return `[${what}: cancelled by the user]`;
    return `[${what}: not confirmed yet]`;
  });
  return `${turn.content}\n\n${lines.join("\n")}`;
}

function ActionCard({ card, onConfirm, onCancel }: { card: Card; onConfirm: () => void; onCancel: () => void }) {
  const destructive = card.kind === "delete";
  const settled = card.state === "done" || card.state === "cancelled";
  return (
    <div className={cn("mt-2.5 overflow-hidden rounded-[16px] bg-bg ring-[0.5px] ring-black/10 dark:ring-white/15", settled && "opacity-80")}>
      <div className="px-3.5 pb-2 pt-2.5">
        <p className={cn("text-footnote font-semibold uppercase tracking-wide", destructive ? "text-ios-red" : "text-label-2")}>{card.title}</p>
        <p dir="auto" className="text-headline text-label">
          {card.target}
        </p>
        {card.fields.length > 0 && (
          <dl className="mt-1.5 space-y-1">
            {card.fields.map((f, i) => (
              <div key={i} className="flex gap-3 text-subhead">
                <dt className="w-28 shrink-0 text-label-2">{f.label}</dt>
                <dd dir="auto" className="min-w-0 flex-1 whitespace-pre-wrap break-words text-label">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {card.secret !== undefined && <Secret value={card.secret} />}
        {card.note && <p className="mt-1.5 text-subhead text-ios-red">{card.note}</p>}
      </div>
      {card.state === "waiting" || card.state === "failed" || card.state === "running" ? (
        <div className="flex gap-2 border-t-[0.5px] border-separator px-3 py-2">
          <button type="button" onClick={onCancel} disabled={card.state === "running"} className="press h-9 flex-1 rounded-full bg-fill/[0.12] text-subhead font-medium text-label disabled:opacity-40">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={card.state === "running"}
            className={cn("press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-subhead font-semibold disabled:opacity-60", destructive ? "bg-ios-red text-white" : "glass-prominent")}
          >
            {card.state === "running" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
            {card.state === "failed" ? "Try Again" : destructive ? "Delete" : card.kind === "reveal" ? "Show" : "Confirm"}
          </button>
        </div>
      ) : (
        <p className={cn("flex items-center gap-1.5 border-t-[0.5px] border-separator px-3.5 py-2 text-subhead", card.state === "done" ? "text-ios-green" : "text-label-2")}>
          {card.state === "done" ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2.6} /> {card.kind === "reveal" ? "Shown" : destructive ? "Deleted" : "Done"}
            </>
          ) : (
            "Cancelled"
          )}
        </p>
      )}
    </div>
  );
}

/** A revealed Vault value: hidden until tapped, copyable. It stays on this screen and is never sent to Haman. */
function Secret({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-1 rounded-[10px] bg-fill/[0.12] py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 truncate font-mono text-subhead text-label">{shown ? value : "••••••••••••"}</code>
      <button type="button" aria-label={shown ? "Hide" : "Show"} onClick={() => setShown((v) => !v)} className="press p-2 text-label-2">
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          toast.success("Copied");
        }}
        className="press p-2 text-label-2"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
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
