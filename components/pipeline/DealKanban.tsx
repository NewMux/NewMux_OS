"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { QuickOutcomeModal } from "./QuickOutcomeModal";
import { centsToDisplay } from "@/lib/money";
import type { Deal, DealStage, OutreachActivity } from "@/lib/data/types";

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

export function DealKanban({
  deals: initialDeals,
  ownerNames,
  lastOutreach,
}: {
  deals: Deal[];
  ownerNames: Record<string, string>;
  lastOutreach: Record<string, OutreachActivity | undefined>;
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [updating, setUpdating] = useState<string | null>(null);

  async function changeStage(dealId: string, stage: DealStage) {
    setUpdating(dealId);
    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (res.ok) {
      const { deal } = await res.json();
      setDeals((prev) => prev.map((d) => (d.id === dealId ? deal : d)));
    }
    setUpdating(null);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {COLUMNS.map((col) => (
        <div key={col.stage}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {col.label} · {deals.filter((d) => d.stage === col.stage).length}
          </h3>
          <div className="flex flex-col gap-2">
            {deals
              .filter((d) => d.stage === col.stage)
              .map((deal) => {
                const last = lastOutreach[deal.id];
                return (
                  <Card key={deal.id} className="text-sm">
                    <p className="mb-1 font-medium text-white">{deal.name}</p>
                    <p className="mb-2 text-xs text-slate-500">
                      {centsToDisplay(deal.quotedValueCents, deal.currency)} · {ownerNames[deal.ownerId] ?? "Unassigned"}
                    </p>
                    {last && (
                      <p className="mb-2 text-xs text-slate-500">
                        Last: {OUTCOME_LABEL[last.outcome]} ({last.channel}) — {new Date(last.createdAt).toLocaleDateString()}
                      </p>
                    )}
                    {deal.nextFollowUpDate && deal.stage !== "won" && deal.stage !== "lost" && (
                      <p className="mb-2 text-xs text-amber-400">Follow up: {new Date(deal.nextFollowUpDate).toLocaleDateString()}</p>
                    )}

                    {deal.stage === "won" && deal.convertedProjectId && (
                      <p className="mb-2 text-xs text-emerald-400">
                        Converted →{" "}
                        <Link href={`/projects/${deal.convertedProjectId}`} className="underline">
                          project
                        </Link>{" "}
                        ·{" "}
                        <Link href={`/documents/${deal.convertedInvoiceId}`} className="underline">
                          deposit invoice
                        </Link>
                      </p>
                    )}

                    <div className="flex flex-col gap-2">
                      {col.stage !== "won" && col.stage !== "lost" && <QuickOutcomeModal dealId={deal.id} dealName={deal.name} />}
                      <select
                        value={deal.stage}
                        disabled={updating === deal.id}
                        onChange={(e) => changeStage(deal.id, e.target.value as DealStage)}
                        className="min-h-[36px] w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.stage} value={c.stage}>
                            Move to {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
