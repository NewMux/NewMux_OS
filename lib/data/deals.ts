import { randomUUID } from "crypto";
import { store } from "./store";
import type {
  Client,
  Deal,
  DealStage,
  DealStageHistoryEntry,
  DocumentRecord,
  OutreachActivity,
  OutreachChannel,
  OutreachOutcome,
  Project,
} from "./types";
import { createClient, createDocument } from "./documents";
import { createProject } from "./projects";
import { convertMinorUnits } from "@/lib/money";

/**
 * Deposit invoice basis for one-click Won conversion (PRD Module 1): a
 * standard 50% deposit against the quoted value, matching Newmux's usual
 * "50% upfront, 50% on delivery" payment pattern (see the Voya example in
 * lib/data/store.ts). Adjustable per-deal by editing the draft invoice
 * after conversion.
 */
const DEPOSIT_BPS = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Board order, and the order the funnel converts in (won/lost are terminal). */
export const DEAL_STAGES: { stage: DealStage; label: string }[] = [
  { stage: "lead_discovery", label: "Lead Discovery" },
  { stage: "proposal_sent", label: "Proposal/Quotation Sent" },
  { stage: "negotiation", label: "Negotiation" },
  { stage: "won", label: "Won" },
  { stage: "lost", label: "Lost" },
];

/** The progression a deal advances through; Lost is an exit, not a step. */
const FUNNEL_STAGES: DealStage[] = ["lead_discovery", "proposal_sent", "negotiation", "won"];

function stageLabel(stage: DealStage): string {
  return DEAL_STAGES.find((s) => s.stage === stage)?.label ?? stage;
}

function recordStageChange(deal: Deal, fromStage: DealStage | null, toStage: DealStage, changedBy: string, at: string) {
  store.dealStageHistory.push({
    id: randomUUID(),
    dealId: deal.id,
    fromStage,
    toStage,
    changedBy,
    changedAt: at,
  });
}

/** Deals in a stage, in board order. */
function dealsInStage(stage: DealStage): Deal[] {
  return store.deals.filter((d) => d.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder);
}

function resequence(stage: DealStage) {
  dealsInStage(stage).forEach((d, i) => {
    d.sortOrder = i;
  });
}

export async function listDeals(): Promise<Deal[]> {
  return [...store.deals].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getDealById(id: string): Promise<Deal | undefined> {
  return store.deals.find((d) => d.id === id);
}

export async function createDeal(input: {
  name: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  quotedValueCents: number;
  currency: string;
  ownerId: string;
  notes?: string | null;
  nextFollowUpDate?: string | null;
  expectedCloseDate?: string | null;
  createdBy: string;
}): Promise<Deal> {
  const now = new Date().toISOString();
  const deal: Deal = {
    id: randomUUID(),
    name: input.name,
    contactPerson: input.contactPerson ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    stage: "lead_discovery",
    quotedValueCents: input.quotedValueCents,
    currency: input.currency,
    ownerId: input.ownerId,
    notes: input.notes ?? null,
    nextFollowUpDate: input.nextFollowUpDate ?? null,
    expectedCloseDate: input.expectedCloseDate ?? null,
    lostReason: null,
    sortOrder: dealsInStage("lead_discovery").length,
    convertedClientId: null,
    convertedProjectId: null,
    convertedInvoiceId: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  store.deals.push(deal);
  recordStageChange(deal, null, "lead_discovery", input.createdBy, now);
  return deal;
}

export async function updateDeal(
  dealId: string,
  patch: {
    name?: string;
    contactPerson?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    quotedValueCents?: number;
    ownerId?: string;
    notes?: string | null;
    nextFollowUpDate?: string | null;
    expectedCloseDate?: string | null;
    lostReason?: string | null;
  },
): Promise<Deal> {
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");

  Object.assign(deal, patch);
  deal.updatedAt = new Date().toISOString();
  return deal;
}

export async function listOutreachForDeal(dealId: string): Promise<OutreachActivity[]> {
  return store.outreachActivities
    .filter((a) => a.dealId === dealId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listStageHistoryForDeal(dealId: string): Promise<DealStageHistoryEntry[]> {
  return store.dealStageHistory
    .filter((h) => h.dealId === dealId)
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1));
}

/** Quick Outcome Modal (PRD Module 1): log a call/email/WhatsApp result in under 10 seconds. */
export async function logOutreachActivity(input: {
  dealId: string;
  channel: OutreachChannel;
  outcome: OutreachOutcome;
  contactedBy: string;
  notes?: string | null;
  nextFollowUpDate?: string | null;
}): Promise<OutreachActivity> {
  const deal = store.deals.find((d) => d.id === input.dealId);
  if (!deal) throw new Error("Deal not found");

  const activity: OutreachActivity = {
    id: randomUUID(),
    dealId: input.dealId,
    channel: input.channel,
    contactedBy: input.contactedBy,
    outcome: input.outcome,
    notes: input.notes ?? null,
    nextFollowUpDate: input.nextFollowUpDate ?? null,
    createdAt: new Date().toISOString(),
  };
  store.outreachActivities.push(activity);

  if (input.nextFollowUpDate) deal.nextFollowUpDate = input.nextFollowUpDate;
  if (input.outcome === "meeting_booked" && deal.stage === "lead_discovery") {
    await moveDeal(deal.id, "proposal_sent", 0, input.contactedBy);
  }
  deal.updatedAt = activity.createdAt;

  return activity;
}

/**
 * One-Click Deal Conversion (PRD Module 1): moving a deal to Won generates
 * the client directory record, initializes the project workspace, and
 * drafts the initial deposit invoice. Idempotent — calling it again on an
 * already-converted deal just returns the existing records.
 */
export async function convertDealToClient(
  dealId: string,
  convertedBy: string,
): Promise<{ deal: Deal; client: Client; project: Project; invoice: DocumentRecord | null }> {
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");

  if (deal.convertedClientId && deal.convertedProjectId) {
    const client = store.clients.find((c) => c.id === deal.convertedClientId)!;
    const project = store.projects.find((p) => p.id === deal.convertedProjectId)!;
    const invoice = store.documents.find((d) => d.id === deal.convertedInvoiceId) ?? null;
    return { deal, client, project, invoice };
  }

  const client = await createClient({
    name: deal.name.split(" — ")[0] ?? deal.name,
    contactPerson: deal.contactPerson,
    contactEmail: deal.contactEmail,
    contactPhone: deal.contactPhone,
  });

  const project = await createProject({
    clientId: client.id,
    name: deal.name,
    createdBy: convertedBy,
  });

  const depositCents = Math.round((deal.quotedValueCents * DEPOSIT_BPS) / 10000);
  const invoice = await createDocument({
    type: "invoice",
    clientId: client.id,
    projectId: project.id,
    currency: deal.currency,
    taxRateBps: 0,
    paymentTerms: "50% upfront, 50% on delivery",
    notes: `Initial deposit — converted from deal "${deal.name}".`,
    lineItems: [{ description: `Deposit — ${deal.name} (50%)`, quantity: 1, unitPriceCents: depositCents }],
    createdBy: convertedBy,
  });

  deal.convertedClientId = client.id;
  deal.convertedProjectId = project.id;
  deal.convertedInvoiceId = invoice.id;
  deal.nextFollowUpDate = null;
  deal.updatedAt = new Date().toISOString();

  store.auditLog.push({
    id: randomUUID(),
    entityType: "deal",
    entityId: deal.id,
    action: "update",
    summary: `Deal "${deal.name}" won — created client ${client.clientCode}, project "${project.name}", and draft deposit invoice ${invoice.documentNumber}.`,
    changedBy: convertedBy,
    changedAt: deal.updatedAt,
  });

  return { deal, client, project, invoice };
}

/**
 * Board move: drops a deal into `stage` at `index`, reordering the affected
 * columns. Entering Won triggers the one-click conversion; the stage change
 * is recorded either way so the funnel analytics stay accurate.
 */
export async function moveDeal(
  dealId: string,
  stage: DealStage,
  index: number,
  changedBy: string,
  lostReason?: string | null,
): Promise<Deal> {
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");

  const fromStage = deal.stage;
  const stageChanged = fromStage !== stage;

  if (stageChanged) {
    deal.stage = stage;
    recordStageChange(deal, fromStage, stage, changedBy, new Date().toISOString());
    if (stage === "lost") deal.lostReason = lostReason ?? deal.lostReason ?? null;
    if (stage !== "lost") deal.lostReason = null;
  }

  // Place at the requested index within the target column, then renumber both
  // columns so sortOrder stays dense.
  const column = dealsInStage(stage).filter((d) => d.id !== deal.id);
  const clamped = Math.max(0, Math.min(index, column.length));
  column.splice(clamped, 0, deal);
  column.forEach((d, i) => {
    d.sortOrder = i;
  });
  if (stageChanged) resequence(fromStage);

  deal.updatedAt = new Date().toISOString();

  if (stage === "won") await convertDealToClient(dealId, changedBy);

  return deal;
}

// --- Follow-up reminder engine ---

export type FollowUpStatus = "overdue" | "today" | "upcoming";

export type FollowUpReminder = {
  dealId: string;
  dealName: string;
  stage: DealStage;
  stageLabel: string;
  ownerId: string;
  dueDate: string;
  status: FollowUpStatus;
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Reminders are derived from each open deal's next-follow-up date rather than
 * materialized as rows, so they can never drift out of sync with the deal.
 */
export async function listFollowUpReminders(withinDays = 14): Promise<FollowUpReminder[]> {
  const today = startOfDay(new Date());
  const horizon = today + withinDays * DAY_MS;

  return store.deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost" && d.nextFollowUpDate)
    .map((deal) => {
      const due = startOfDay(new Date(deal.nextFollowUpDate!));
      const status: FollowUpStatus = due < today ? "overdue" : due === today ? "today" : "upcoming";
      return {
        dealId: deal.id,
        dealName: deal.name,
        stage: deal.stage,
        stageLabel: stageLabel(deal.stage),
        ownerId: deal.ownerId,
        dueDate: deal.nextFollowUpDate!,
        status,
      };
    })
    .filter((r) => startOfDay(new Date(r.dueDate)) <= horizon)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

// --- Pipeline analytics ---

export type PipelineAnalytics = {
  stages: { stage: DealStage; label: string; count: number; valueBhdCents: number }[];
  funnel: { stage: DealStage; label: string; reachedCount: number; conversionFromPreviousBps: number | null }[];
  avgDaysInStage: { stage: DealStage; label: string; avgDays: number | null }[];
  forecast: { label: string; valueBhdCents: number; dealCount: number }[];
  winLoss: { wonCount: number; lostCount: number; wonValueBhdCents: number; winRateBps: number | null };
  lostReasons: { reason: string; count: number }[];
};

function toBhd(amountMinorUnits: number, currency: string): number {
  return convertMinorUnits(amountMinorUnits, currency, "BHD");
}

export async function getPipelineAnalytics(): Promise<PipelineAnalytics> {
  const deals = store.deals;
  const history = store.dealStageHistory;

  const stages = DEAL_STAGES.map(({ stage, label }) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return {
      stage,
      label,
      count: inStage.length,
      valueBhdCents: inStage.reduce((sum, d) => sum + toBhd(d.quotedValueCents, d.currency), 0),
    };
  });

  // A deal "reached" a stage if its history ever recorded entering it.
  const reachedBy = (stage: DealStage) => new Set(history.filter((h) => h.toStage === stage).map((h) => h.dealId)).size;
  const funnel = FUNNEL_STAGES.map((stage, i) => {
    const reachedCount = reachedBy(stage);
    const previous = i === 0 ? null : reachedBy(FUNNEL_STAGES[i - 1]!);
    return {
      stage,
      label: stageLabel(stage),
      reachedCount,
      conversionFromPreviousBps: previous && previous > 0 ? Math.round((reachedCount / previous) * 10000) : null,
    };
  });

  // Time in stage: from entering a stage until the next transition, or now if
  // the deal is still sitting there.
  const now = Date.now();
  const durationsByStage = new Map<DealStage, number[]>();
  for (const deal of deals) {
    const entries = history.filter((h) => h.dealId === deal.id).sort((a, b) => (a.changedAt < b.changedAt ? -1 : 1));
    entries.forEach((entry, i) => {
      const next = entries[i + 1];
      const end = next ? new Date(next.changedAt).getTime() : now;
      const days = (end - new Date(entry.changedAt).getTime()) / DAY_MS;
      const list = durationsByStage.get(entry.toStage) ?? [];
      list.push(days);
      durationsByStage.set(entry.toStage, list);
    });
  }
  const avgDaysInStage = DEAL_STAGES.filter((s) => s.stage !== "won" && s.stage !== "lost").map(({ stage, label }) => {
    const list = durationsByStage.get(stage) ?? [];
    return {
      stage,
      label,
      avgDays: list.length === 0 ? null : Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10,
    };
  });

  // Forecast: open deals bucketed by expected close month, this month + 2.
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const base = new Date();
  const forecast = [0, 1, 2].map((offset) => {
    const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const inMonth = openDeals.filter((d) => {
      if (!d.expectedCloseDate) return false;
      const close = new Date(d.expectedCloseDate);
      // Anything already past its expected close date still counts this month.
      if (offset === 0 && close.getTime() < month.getTime()) return true;
      return close.getFullYear() === month.getFullYear() && close.getMonth() === month.getMonth();
    });
    return {
      label: month.toLocaleString("en-US", { month: "short", year: "numeric" }),
      valueBhdCents: inMonth.reduce((sum, d) => sum + toBhd(d.quotedValueCents, d.currency), 0),
      dealCount: inMonth.length,
    };
  });

  const won = deals.filter((d) => d.stage === "won");
  const lost = deals.filter((d) => d.stage === "lost");
  const decided = won.length + lost.length;
  const winLoss = {
    wonCount: won.length,
    lostCount: lost.length,
    wonValueBhdCents: won.reduce((sum, d) => sum + toBhd(d.quotedValueCents, d.currency), 0),
    winRateBps: decided === 0 ? null : Math.round((won.length / decided) * 10000),
  };

  const reasonCounts = new Map<string, number>();
  for (const deal of lost) {
    const reason = deal.lostReason?.trim() || "Not recorded";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const lostReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return { stages, funnel, avgDaysInStage, forecast, winLoss, lostReasons };
}
