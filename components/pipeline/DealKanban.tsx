"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { QuickOutcomeModal } from "./QuickOutcomeModal";
import { DragBoard, type BoardItem } from "@/components/kanban/DragBoard";
import { centsToDisplay } from "@/lib/money";
import { ArrowUpRight } from "lucide-react";
import type { Deal, DealStage, OutreachActivity } from "@/lib/data/types";
import { apiMutate } from "@/lib/api/client";

const COLUMNS: { stage: DealStage; label: string }[] = [
  { stage: "lead_discovery", label: "Lead Discovery" },
  { stage: "proposal_sent", label: "Proposal/Quotation Sent" },
  { stage: "negotiation", label: "Negotiation" },
  { stage: "won", label: "Won" },
  { stage: "lost", label: "Lost" },
];

const OUTCOME_LABEL: Record<OutreachActivity["outcome"], string> = {
  no_answer: "No Answer",
  gatekeeper_blocked: "Gatekeeper Blocked",
  not_interested: "Not Interested",
  info_requested: "Info Requested",
  meeting_booked: "Meeting Booked",
};

const COMMON_LOST_REASONS = [
  "Price",
  "Timeline",
  "Went with a competitor",
  "No budget",
  "Went quiet",
];

type DealBoardItem = BoardItem & { deal: Deal };

export function DealKanban({
  deals,
  ownerNames,
  lastOutreach,
}: {
  deals: Deal[];
  ownerNames: Record<string, string>;
  lastOutreach: Record<string, OutreachActivity | undefined>;
}) {
  const router = useRouter();
  const [pendingLost, setPendingLost] = useState<{
    dealId: string;
    index: number;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const items = useMemo<DealBoardItem[]>(
    () =>
      [...deals]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((d) => ({ id: d.id, columnId: d.stage, deal: d })),
    [deals],
  );

  const columns = COLUMNS.map((col) => {
    const inStage = deals.filter((d) => d.stage === col.stage);
    const total = inStage.reduce((sum, d) => sum + d.quotedValueCents, 0);
    return {
      id: col.stage,
      label: col.label,
      meta: `${inStage.length} · ${centsToDisplay(total, "BHD")}`,
    };
  });

  async function persistMove(
    dealId: string,
    stage: DealStage,
    index: number,
    reason?: string,
  ) {
    await apiMutate(`/api/deals/${dealId}/stage`, {
      method: "PATCH",
      body: JSON.stringify({
        stage,
        index,
        ...(reason ? { lostReason: reason } : {}),
      }),
    });
    router.refresh();
  }

  async function handleMove(dealId: string, toColumnId: string, index: number) {
    const stage = toColumnId as DealStage;
    const deal = deals.find((d) => d.id === dealId);

    // Ask why, but only when a deal newly lands in Lost.
    if (stage === "lost" && deal?.stage !== "lost") {
      setPendingLost({ dealId, index });
      setLostReason("");
      return;
    }
    await persistMove(dealId, stage, index);
  }

  async function confirmLost(reason: string) {
    if (!pendingLost) return;
    const { dealId, index } = pendingLost;
    setPendingLost(null);
    await persistMove(dealId, "lost", index, reason);
  }

  return (
    <>
      <DragBoard
        items={items}
        columns={columns}
        onMove={handleMove}
        renderCard={(item) => {
          const deal = item.deal;
          const last = lastOutreach[deal.id];
          return (
            <Card className="cursor-grab text-sm active:cursor-grabbing">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{deal.name}</p>
                <Link
                  href={`/pipeline/${deal.id}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="shrink-0 text-muted-foreground hover:text-brand"
                  aria-label={`Open ${deal.name}`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                {centsToDisplay(deal.quotedValueCents, deal.currency)} ·{" "}
                {ownerNames[deal.ownerId] ?? "Unassigned"}
              </p>

              {last && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Last: {OUTCOME_LABEL[last.outcome]} ({last.channel}) —{" "}
                  {new Date(last.createdAt).toLocaleDateString()}
                </p>
              )}
              {deal.nextFollowUpDate &&
                deal.stage !== "won" &&
                deal.stage !== "lost" && (
                  <p className="mb-2 text-xs text-warning">
                    Follow up:{" "}
                    {new Date(deal.nextFollowUpDate).toLocaleDateString()}
                  </p>
                )}
              {deal.stage === "lost" && deal.lostReason && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Lost: {deal.lostReason}
                </p>
              )}

              {deal.stage === "won" && deal.convertedProjectId && (
                <p className="mb-2 text-xs text-brand">
                  Converted →{" "}
                  <Link
                    href={`/projects/${deal.convertedProjectId}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="underline"
                  >
                    project
                  </Link>
                  {deal.convertedInvoiceId && (
                    <>
                      {" · "}
                      <Link
                        href={`/documents/${deal.convertedInvoiceId}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="underline"
                      >
                        deposit invoice
                      </Link>
                    </>
                  )}
                </p>
              )}

              {deal.stage !== "won" && deal.stage !== "lost" && (
                <div onPointerDown={(e) => e.stopPropagation()}>
                  <QuickOutcomeModal dealId={deal.id} dealName={deal.name} />
                </div>
              )}
            </Card>
          );
        }}
      />

      <Dialog
        open={pendingLost !== null}
        onOpenChange={(open) => !open && confirmLost("")}
      >
        <DialogContent
          title="Why was this deal lost?"
          description="Recorded against the deal and shown in the win/loss breakdown."
        >
          <div className="mb-3 flex flex-col gap-2">
            {COMMON_LOST_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => confirmLost(reason)}
                className="min-h-[40px] rounded-lg border border-border bg-card px-3 text-left text-sm text-foreground hover:border-primary/50"
              >
                {reason}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmLost(lostReason);
            }}
            className="flex flex-col gap-2"
          >
            <Input
              placeholder="Another reason…"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              Save reason
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
