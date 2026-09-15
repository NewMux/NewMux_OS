import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { getDealById, listOutreachForDeal, listStageHistoryForDeal, DEAL_STAGES } from "@/lib/data/deals";
import { listUsers } from "@/lib/data/users";
import { getClientById, getDocumentById } from "@/lib/data/documents";
import { getProjectById } from "@/lib/data/projects";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DealEditForm } from "@/components/pipeline/DealEditForm";
import { QuickOutcomeModal } from "@/components/pipeline/QuickOutcomeModal";
import { centsToDisplay } from "@/lib/money";
import { ArrowLeft, MoveRight, PhoneCall } from "lucide-react";
import type { DealStage, OutreachActivity } from "@/lib/data/types";

const OUTCOME_LABEL: Record<OutreachActivity["outcome"], string> = {
  no_answer: "No Answer",
  gatekeeper_blocked: "Gatekeeper Blocked",
  not_interested: "Not Interested",
  info_requested: "Info Requested",
  meeting_booked: "Meeting Booked",
};

const CHANNEL_LABEL: Record<OutreachActivity["channel"], string> = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
};

function stageLabel(stage: DealStage): string {
  return DEAL_STAGES.find((s) => s.stage === stage)?.label ?? stage;
}

type TimelineEntry = {
  id: string;
  at: string;
  by: string;
  kind: "outreach" | "stage";
  title: string;
  detail: string | null;
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!canAccessFinance(session)) redirect("/dashboard");

  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) notFound();

  const [outreach, stageHistory, users] = await Promise.all([
    listOutreachForDeal(id),
    listStageHistoryForDeal(id),
    listUsers(),
  ]);

  const [client, project, invoice] = await Promise.all([
    deal.convertedClientId ? getClientById(deal.convertedClientId) : Promise.resolve(undefined),
    deal.convertedProjectId ? getProjectById(deal.convertedProjectId) : Promise.resolve(undefined),
    deal.convertedInvoiceId ? getDocumentById(deal.convertedInvoiceId) : Promise.resolve(undefined),
  ]);

  const userNames: Record<string, string> = {};
  users.forEach((u) => {
    userNames[u.id] = u.fullName;
  });

  const timeline: TimelineEntry[] = [
    ...outreach.map((a) => ({
      id: a.id,
      at: a.createdAt,
      by: userNames[a.contactedBy] ?? "—",
      kind: "outreach" as const,
      title: `${CHANNEL_LABEL[a.channel]} — ${OUTCOME_LABEL[a.outcome]}`,
      detail: a.notes,
    })),
    ...stageHistory.map((h) => ({
      id: h.id,
      at: h.changedAt,
      by: userNames[h.changedBy] ?? "—",
      kind: "stage" as const,
      title: h.fromStage ? `${stageLabel(h.fromStage)} → ${stageLabel(h.toStage)}` : `Created in ${stageLabel(h.toStage)}`,
      detail: null,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const isOpen = deal.stage !== "won" && deal.stage !== "lost";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/pipeline" className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
        <ArrowLeft className="h-3 w-3" /> Back to pipeline
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{deal.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge tone="outline">{stageLabel(deal.stage)}</Badge>
            {centsToDisplay(deal.quotedValueCents, deal.currency)} · {userNames[deal.ownerId] ?? "Unassigned"}
          </p>
        </div>
        {isOpen && <QuickOutcomeModal dealId={deal.id} dealName={deal.name} />}
      </div>

      {deal.stage === "won" && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Converted</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-1 text-sm">
            {client && (
              <Link href={`/clients/${client.id}`} className="text-brand hover:underline">
                {client.name} ({client.clientCode})
              </Link>
            )}
            {project && (
              <Link href={`/projects/${project.id}`} className="text-brand hover:underline">
                {project.name}
              </Link>
            )}
            {invoice && (
              <Link href={`/documents/${invoice.id}`} className="text-brand hover:underline">
                {invoice.documentNumber} — {centsToDisplay(invoice.totalCents, invoice.currency)} deposit
              </Link>
            )}
            {!client && !project && <p className="text-muted-foreground">No linked records.</p>}
          </div>
        </Card>
      )}

      {deal.stage === "lost" && deal.lostReason && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Lost reason</CardTitle>
          </CardHeader>
          <p className="text-sm text-secondary-foreground">{deal.lostReason}</p>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Deal details</CardTitle>
        </CardHeader>
        <DealEditForm deal={deal} owners={users} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <span className="text-xs text-muted-foreground">{outreach.length} outreach touches</span>
        </CardHeader>
        {timeline.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
        <div className="flex flex-col">
          {timeline.map((entry) => (
            <div key={entry.id} className="flex gap-3 border-l border-border pb-4 pl-4 last:pb-0">
              <div className="-ml-[25px] mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-background bg-accent" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  {entry.kind === "outreach" ? (
                    <PhoneCall className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <MoveRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  {entry.title}
                </p>
                {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.at).toLocaleString()} · {entry.by}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
