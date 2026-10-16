"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, GitPullRequest, Plus, Sparkles, X } from "lucide-react";
import { Page, NavButton } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow, ListSection, PlainRowInput } from "@/components/ui/List";
import { Textarea } from "@/components/ui/Input";
import { Sheet, SheetIconButton } from "@/components/ui/Sheet";
import { FormSheet } from "@/components/ui/FormSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/Confirm";
import { useMutation } from "@/lib/useMutation";
import { formatDate } from "@/lib/time";
import { OS_CHANGE_STATUS, type OsChange, type OsChangeStatus } from "@/lib/osChangeTypes";

const MOVING: OsChangeStatus[] = ["working", "checking"];
const DONE: OsChangeStatus[] = ["merged", "closed"];

/**
 * Settings → OS Updates: ask for a change to NEWMUX OS, follow Claude Code
 * building it, ask for changes, and (partners) merge it, which puts it live.
 * Read from GitHub on open and every 20 seconds while something is moving.
 */
export function OsUpdatesScreen({ meId, partner, configured, repo }: { meId: string; partner: boolean; configured: boolean; repo: string }) {
  const [changes, setChanges] = useState<OsChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [openNumber, setOpenNumber] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/os-changes", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { changes?: OsChange[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't reach GitHub.");
      setChanges(json.changes ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach GitHub.");
    }
  }, []);

  useEffect(() => {
    if (configured) void load();
  }, [configured, load]);

  const moving = changes?.some((c) => MOVING.includes(c.status));
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [moving, load]);

  const update = (c: OsChange) => setChanges((list) => (list ? (list.some((x) => x.number === c.number) ? list.map((x) => (x.number === c.number ? c : x)) : [c, ...list]) : [c]));
  const open = changes?.find((c) => c.number === openNumber) ?? null;
  const ready = changes?.filter((c) => c.status === "ready") ?? [];
  const inProgress = changes?.filter((c) => c.status !== "ready" && !DONE.includes(c.status)) ?? [];
  const done = changes?.filter((c) => DONE.includes(c.status)) ?? [];

  const row = (c: OsChange) => (
    <ListRow
      key={c.number}
      title={c.title}
      subtitle={`#${c.number} · ${c.requestedBy ?? "GitHub"} · ${formatDate(c.createdAt)}`}
      trailing={<Badge color={OS_CHANGE_STATUS[c.status].color}>{OS_CHANGE_STATUS[c.status].short}</Badge>}
      onClick={() => setOpenNumber(c.number)}
      chevron
    />
  );

  return (
    <Page
      title="OS Updates"
      back={{ href: "/settings", label: "Settings" }}
      actions={
        configured && (
          <NavButton label="Request a change" onClick={() => setAsking(true)}>
            <Plus className="h-5 w-5" />
          </NavButton>
        )
      }
    >
      <div className="mx-auto max-w-2xl">
        {!configured ? (
          <EmptyState
            icon={GitPullRequest}
            title="GitHub isn't connected"
            message={partner ? "Add GITHUB_TOKEN to the server's secrets to let Claude Code build changes to NEWMUX OS. docs/OS_UPDATES.md has the steps." : "A partner needs to connect GitHub before changes can be requested here."}
          />
        ) : error && !changes ? (
          <EmptyState icon={GitPullRequest} title="Couldn't reach GitHub" message={error} action={<Button onClick={() => void load()}>Try Again</Button>} />
        ) : !changes ? (
          <ListSection>
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
          </ListSection>
        ) : changes.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No requests yet"
            message="Ask for a new feature, a change to a screen or a fix, here or by telling Haman. Claude Code builds it, and a partner merges it to put it live."
            action={<Button onClick={() => setAsking(true)}>Request a Change</Button>}
          />
        ) : (
          <>
            {ready.length > 0 && (
              <ListSection header="Ready to merge" footer={partner ? "Checks have passed. Merging puts it live for everyone a few minutes later." : "Checks have passed. A partner merges it to put it live."}>
                {ready.map(row)}
              </ListSection>
            )}
            {inProgress.length > 0 && <ListSection header="In progress">{inProgress.map(row)}</ListSection>}
            {done.length > 0 && <ListSection header="Done">{done.map(row)}</ListSection>}
            <ListSection footer={`Built by Claude Code in ${repo} on GitHub. Anyone can ask for a change; only partners can merge.`}>
              <ListRow title={<span className="text-accent">Request a Change…</span>} onClick={() => setAsking(true)} />
            </ListSection>
          </>
        )}
      </div>
      <RequestSheet open={asking} onOpenChange={setAsking} onDone={(c) => update(c)} />
      <ChangeSheet change={open} meId={meId} partner={partner} onClose={() => setOpenNumber(null)} onChange={update} onReload={load} />
    </Page>
  );
}

function RequestSheet({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (c: OsChange) => void }) {
  const { run } = useMutation();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  useEffect(() => {
    if (open) {
      setTitle("");
      setDetails("");
    }
  }, [open]);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Request a Change"
      submitLabel="Send"
      canSubmit={title.trim().length >= 3 && details.trim().length >= 10}
      onSubmit={async () => {
        const json = await run<{ change: OsChange }>("/api/os-changes", { body: { title, details }, success: "Sent to Claude Code", refresh: false });
        if (json) onDone(json.change);
        return !!json;
      }}
    >
      <ListSection>
        <PlainRowInput placeholder="Short title, e.g. Add a VAT report" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} />
      </ListSection>
      <ListSection footer="Say what should change and why: which screen, who uses it, what it should show or do. Claude Code builds it on GitHub; nothing goes live until a partner merges it.">
        <Textarea dir="auto" placeholder="What should change" rows={7} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={8000} />
      </ListSection>
    </FormSheet>
  );
}

function ChangeSheet({
  change,
  meId,
  partner,
  onClose,
  onChange,
  onReload,
}: {
  change: OsChange | null;
  meId: string;
  partner: boolean;
  onClose: () => void;
  onChange: (c: OsChange) => void;
  onReload: () => Promise<void>;
}) {
  const { run, pending } = useMutation();
  const confirm = useConfirm();
  const [text, setText] = useState("");
  useEffect(() => setText(""), [change?.number]);
  if (!change) return <Sheet open={false} onOpenChange={() => onClose()} title="">{null}</Sheet>;

  const status = OS_CHANGE_STATUS[change.status];
  const finished = DONE.includes(change.status);
  const canRevise = !finished && change.status !== "working";
  const canWithdraw = !finished && (partner || change.requesterId === meId);

  const merge = async () => {
    const ok = await confirm({ title: `Merge “${change.title}”?`, message: "It goes live in NEWMUX OS for everyone a few minutes from now.", confirmLabel: "Merge" });
    if (!ok) return;
    const json = await run<{ change: OsChange }>(`/api/os-changes/${change.number}/merge`, { success: "Merged. It's live once the deploy finishes.", refresh: false });
    if (json) onChange(json.change);
  };
  const revise = async () => {
    const json = await run<{ change: OsChange }>(`/api/os-changes/${change.number}/comments`, { body: { text }, success: "Sent to Claude Code", refresh: false });
    if (json) {
      setText("");
      onChange(json.change);
    }
  };
  const withdraw = async () => {
    const ok = await confirm({ title: "Withdraw this request?", message: "Its pull request is closed and nothing is merged.", confirmLabel: "Withdraw", destructive: true });
    if (!ok) return;
    if (await run(`/api/os-changes/${change.number}`, { method: "DELETE", success: "Withdrawn", refresh: false })) {
      onClose();
      void onReload();
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`#${change.number}`}
      left={
        <SheetIconButton label="Close" onClick={onClose}>
          <X className="h-5 w-5" />
        </SheetIconButton>
      }
    >
      <div className="pb-8">
        <ListSection>
          <ListRow title={<span className="font-semibold">{change.title}</span>} subtitle={`Asked by ${change.requestedBy ?? "someone on GitHub"} · ${formatDate(change.createdAt)}`} multiline />
          <ListRow title="Status" trailing={<Badge color={status.color}>{status.label}</Badge>} />
          {change.pr && (
            <ListRow
              title="Pull request"
              subtitle={change.pr.changedFiles != null ? `${change.pr.changedFiles} file${change.pr.changedFiles === 1 ? "" : "s"} · +${change.pr.additions} −${change.pr.deletions}` : `#${change.pr.number}`}
              trailing={<ExternalLink className="h-4 w-4 text-label-3" />}
              onClick={() => window.open(change.pr!.url, "_blank", "noopener")}
            />
          )}
          {change.checks && (change.checks.passed + change.checks.failed + change.checks.pending > 0) && (
            <ListRow
              title="Checks"
              subtitle={change.checks.failed ? `Failed: ${change.checks.failedNames.join(", ")}` : undefined}
              detail={change.checks.pending ? `${change.checks.pending} running` : change.checks.failed ? `${change.checks.failed} failed` : `${change.checks.passed} passed`}
              multiline
            />
          )}
        </ListSection>
        <p className="mx-4 -mt-4 mb-6 text-footnote text-label-2">{explain(change.status, partner)}</p>

        {partner && change.status === "ready" && (
          <div className="mx-4 mb-6">
            <Button className="w-full" disabled={pending} onClick={() => void merge()}>
              Merge and Go Live
            </Button>
          </div>
        )}

        <ListSection header="What was asked">
          <p className="whitespace-pre-wrap px-4 py-3 text-body" dir="auto">
            {change.details || "—"}
          </p>
        </ListSection>

        {change.reply && (
          <ListSection header="Claude Code says">
            <p className="max-h-80 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-subhead text-label-2" dir="auto">
              {change.reply}
            </p>
          </ListSection>
        )}

        {canRevise && (
          <ListSection header="Ask for changes" footer="Claude Code picks it up in a minute or two and updates the same request.">
            <Textarea dir="auto" placeholder="What to change, add or fix" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} />
            <div className="flex justify-end px-3 pb-3">
              <Button size="sm" disabled={pending || text.trim().length < 3} onClick={() => void revise()}>
                Send
              </Button>
            </div>
          </ListSection>
        )}

        <ListSection>
          <ListRow title="Open on GitHub" trailing={<ExternalLink className="h-4 w-4 text-label-3" />} onClick={() => window.open(change.issueUrl, "_blank", "noopener")} />
          {canWithdraw && <ListRow title="Withdraw Request" destructive onClick={() => void withdraw()} />}
        </ListSection>
      </div>
    </Sheet>
  );
}

function explain(status: OsChangeStatus, partner: boolean): string {
  switch (status) {
    case "working":
      return "Claude Code is writing the change on GitHub. This usually takes 5 to 20 minutes.";
    case "failed":
      return "The run stopped before it finished. Ask for changes to try again, with any detail that helps.";
    case "answered":
      return "Claude Code replied without changing any code, usually with a question. Answer it under Ask for changes.";
    case "checking":
      return "The change is built. Lint, type checks, tests and a build are running on it.";
    case "checks_failed":
      return "A check failed. Claude Code is asked to fix it automatically (twice at most); you can also ask for changes.";
    case "conflict":
      return "Newer changes touched the same code. Claude Code is asked to sort it out automatically.";
    case "ready":
      return partner ? "Every check passed. Review it on GitHub if you like, then merge to put it live." : "Every check passed. A partner merges it to put it live.";
    case "merged":
      return "Merged. Cloudflare deploys it within a few minutes; reload the app to get it.";
    case "closed":
      return "Closed without merging. Nothing from it went live.";
  }
}
