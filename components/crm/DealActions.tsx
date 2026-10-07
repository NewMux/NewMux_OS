"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, BookOpen, Pencil, Plus, Trash2, Trophy, XCircle, FolderKanban, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { useConfirm } from "@/components/ui/Confirm";
import { FormSheet } from "@/components/ui/FormSheet";
import { ListSection } from "@/components/ui/List";
import { Textarea } from "@/components/ui/Input";
import { ActivitySheet, DealSheet, type ContactOption } from "./CrmSheets";
import type { Option } from "@/components/forms/Fields";
import { useMutation } from "@/lib/useMutation";
import { DEAL_STAGE } from "@/lib/labels";
import { OPEN_DEAL_STAGES, type DealStage } from "@/lib/data/types";
import type { DealListItem } from "@/lib/data/crm";
import { cn } from "@/lib/utils";

export function DealHeaderActions({ deal }: { deal: DealListItem }) {
  const router = useRouter();
  const { run, pending } = useMutation();
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState("");
  const open = OPEN_DEAL_STAGES.includes(deal.stage);
  const move = (stage: DealStage, extra: Record<string, unknown> = {}) =>
    run(`/api/deals/${deal.id}/stage`, { body: { stage, ...extra }, success: stage === "won" ? "🎉 Deal won" : `Moved to ${DEAL_STAGE[stage].label}` });

  const createProject = async () => {
    const res = await run<{ project: { id: string } }>(`/api/deals/${deal.id}/project`, { success: "Project created", refresh: false });
    if (res) router.push(`/projects/${res.project.id}`);
  };

  return (
    <>
      {/* Stage stepper */}
      <div className="no-scrollbar -mx-1 mt-4 flex gap-1 overflow-x-auto px-1">
        {OPEN_DEAL_STAGES.map((s, i) => {
          const reached = open ? OPEN_DEAL_STAGES.indexOf(deal.stage) >= i : deal.stage === "won";
          return (
            <button
              key={s}
              type="button"
              disabled={pending || deal.stage === s}
              onClick={() => move(s)}
              className={cn(
                "press h-8 flex-1 whitespace-nowrap rounded-full px-3 text-footnote font-semibold transition-colors",
                deal.stage === s ? "bg-accent text-white" : reached ? "bg-accent/15 text-accent" : "bg-fill/[0.12] text-label-2",
              )}
            >
              {DEAL_STAGE[s].label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-3">
        {open && (
          <>
            <Button variant="tinted" className="flex-1 bg-ios-green/15 text-ios-green hover:bg-ios-green/20" disabled={pending} onClick={() => move("won")}>
              <Trophy className="h-4 w-4" /> Won
            </Button>
            <Button variant="destructive-tinted" className="flex-1" disabled={pending} onClick={() => setLosing(true)}>
              <XCircle className="h-4 w-4" /> Lost
            </Button>
          </>
        )}
        {deal.stage === "won" && (
          <>
            {deal.projectId ? (
              <Button variant="tinted" className="flex-1" onClick={() => router.push(`/projects/${deal.projectId}`)}>
                <FolderKanban className="h-4 w-4" /> Open Project
              </Button>
            ) : (
              <Button className="flex-1" disabled={pending} onClick={createProject}>
                <FolderKanban className="h-4 w-4" /> Create Project
              </Button>
            )}
            <Button variant="tinted" className="flex-1" onClick={() => router.push(`/documents/new?type=invoice&dealId=${deal.id}`)}>
              <FileText className="h-4 w-4" /> Invoice
            </Button>
          </>
        )}
        {deal.stage === "lost" && (
          <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => move("lead")}>
            Reopen Deal
          </Button>
        )}
      </div>

      <FormSheet
        open={losing}
        onOpenChange={setLosing}
        title="Mark as Lost"
        submitLabel="Done"
        size="auto"
        onSubmit={async () => !!(await move("lost", { lostReason: reason }))}
      >
        <ListSection footer="Knowing why deals are lost helps price and pitch the next one.">
          <div className="px-4 py-3">
            <Textarea autoFocus rows={3} placeholder="Why was it lost? (price, timing, competitor…)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </ListSection>
      </FormSheet>
    </>
  );
}

export function DealMenu({ deal, clients, contacts, users }: { deal: DealListItem; clients: Option[]; contacts: ContactOption[]; users: Option[] }) {
  const router = useRouter();
  const { run } = useMutation();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const createPage = useCreateLinkedPage();
  return (
    <>
      <Menu
        items={[
          { label: "Edit Deal", icon: Pencil, onSelect: () => setEditing(true) },
          { label: "New Quote", icon: FileText, onSelect: () => router.push(`/documents/new?type=quote&dealId=${deal.id}`) },
          { label: "New Wiki Page", icon: BookOpen, onSelect: () => createPage({ dealId: deal.id, clientId: deal.clientId }, `${deal.title} — notes`) },
          "separator",
          {
            label: "Delete Deal",
            icon: Trash2,
            destructive: true,
            onSelect: async () => {
              if (await confirm({ title: `Delete “${deal.title}”?`, message: "Its activity timeline is deleted too.", destructive: true, confirmLabel: "Delete Deal" })) {
                if (await run(`/api/deals/${deal.id}`, { method: "DELETE", success: "Deal deleted", refresh: false })) {
                  router.push("/crm/pipeline");
                  router.refresh();
                }
              }
            },
          },
        ]}
      />
      <DealSheet deal={deal} open={editing} onOpenChange={setEditing} clients={clients} contacts={contacts} users={users} />
    </>
  );
}

/** "Log" and "Follow-up" buttons for a section header. */
export function ActivityButtons({ link }: { link: { clientId?: string | null; contactId?: string | null; dealId?: string | null } }) {
  const [mode, setMode] = useState<"log" | "follow_up" | null>(null);
  return (
    <>
      <span className="flex gap-3 text-subhead">
        <button type="button" className="flex items-center gap-1 text-accent" onClick={() => setMode("log")}>
          <Plus className="h-4 w-4" />
          Log
        </button>
        <button type="button" className="flex items-center gap-1 text-accent" onClick={() => setMode("follow_up")}>
          <AlarmClock className="h-4 w-4" />
          Remind
        </button>
      </span>
      <ActivitySheet open={mode !== null} onOpenChange={(o) => !o && setMode(null)} link={link} mode={mode ?? "log"} />
    </>
  );
}

type PageLink = { clientId?: string | null; projectId?: string | null; dealId?: string | null };

/** Creates a wiki page linked to a client/project/deal and opens it. */
export function useCreateLinkedPage() {
  const router = useRouter();
  const { run } = useMutation();
  return async (link: PageLink, title: string) => {
    const spaces = await fetch("/api/kb/spaces").then((r) => r.json() as Promise<{ spaces: { id: string; name: string }[] }>);
    const space = spaces.spaces.find((s) => s.name === "Clients") ?? spaces.spaces[0];
    if (!space) return;
    const res = await run<{ page: { id: string } }>("/api/kb/pages", { body: { spaceId: space.id, title, emoji: "📝", ...link }, refresh: false });
    if (res) router.push(`/wiki/${res.page.id}`);
  };
}

export function NewLinkedPageButton({ link, title }: { link: PageLink; title: string }) {
  const create = useCreateLinkedPage();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await create(link, title);
        setPending(false);
      }}
      className="flex min-h-[44px] w-full items-center px-4 text-body text-accent active:bg-fill/20"
    >
      New Linked Page
    </button>
  );
}
