import { randomUUID } from "crypto";
import { store } from "./store";
import type { Client, Deal, DealStage, DocumentRecord, OutreachActivity, OutreachChannel, OutreachOutcome, Project } from "./types";
import { createClient } from "./documents";
import { createProject } from "./projects";
import { createDocument } from "./documents";

/**
 * Deposit invoice basis for one-click Won conversion (PRD Module 1): a
 * standard 50% deposit against the quoted value, matching Newmux's usual
 * "50% upfront, 50% on delivery" payment pattern (see the Voya example in
 * lib/data/store.ts). Adjustable per-deal by editing the draft invoice
 * after conversion.
 */
const DEPOSIT_BPS = 5000;

export async function listDeals(): Promise<Deal[]> {
  return [...store.deals].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
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
    convertedClientId: null,
    convertedProjectId: null,
    convertedInvoiceId: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  store.deals.push(deal);
  return deal;
}

export async function listOutreachForDeal(dealId: string): Promise<OutreachActivity[]> {
  return store.outreachActivities
    .filter((a) => a.dealId === dealId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  if (input.outcome === "meeting_booked" && deal.stage === "lead_discovery") deal.stage = "proposal_sent";
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
): Promise<{ deal: Deal; client: Client; project: Project; invoice: DocumentRecord }> {
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");

  if (deal.convertedClientId && deal.convertedProjectId && deal.convertedInvoiceId) {
    const client = store.clients.find((c) => c.id === deal.convertedClientId)!;
    const project = store.projects.find((p) => p.id === deal.convertedProjectId)!;
    const invoice = store.documents.find((d) => d.id === deal.convertedInvoiceId)!;
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

  deal.stage = "won";
  deal.convertedClientId = client.id;
  deal.convertedProjectId = project.id;
  deal.convertedInvoiceId = invoice.id;
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

export async function updateDealStage(dealId: string, stage: DealStage, changedBy: string): Promise<Deal> {
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error("Deal not found");

  if (stage === "won") {
    const result = await convertDealToClient(dealId, changedBy);
    return result.deal;
  }

  deal.stage = stage;
  deal.updatedAt = new Date().toISOString();
  return deal;
}
