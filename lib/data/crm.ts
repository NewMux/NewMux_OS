import { query, tx } from "@/lib/db";
import { many, one, must, buildUpdate, NotFoundError } from "./sql";
import { logAudit } from "./audit";
import { createProject } from "./projects";
import type { Activity, ActivityKind, Contact, Currency, Deal, DealStage, Project } from "./types";
import { OPEN_DEAL_STAGES } from "./types";
import { centsToDisplay, convertMinorUnits } from "@/lib/money";
import { todayYmd } from "@/lib/time";

/** Default win probability per stage — used when a deal moves stage. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

// --- Contacts ---

export type ContactListItem = Contact & { clientName: string | null };

export async function listContacts(filter: { clientId?: string } = {}): Promise<ContactListItem[]> {
  const params: unknown[] = [];
  const where = filter.clientId ? `where ct.client_id = $${params.push(filter.clientId)}` : "";
  return many<ContactListItem>(
    `select ct.*, c.name as client_name from contacts ct left join clients c on c.id = ct.client_id
     ${where} order by ct.is_primary desc, lower(ct.full_name)`,
    params,
  );
}

export async function getContactById(id: string): Promise<ContactListItem | undefined> {
  return one<ContactListItem>(
    "select ct.*, c.name as client_name from contacts ct left join clients c on c.id = ct.client_id where ct.id = $1",
    [id],
  );
}

export type ContactInput = {
  clientId?: string | null;
  fullName: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
};

export async function createContact(input: ContactInput): Promise<Contact> {
  return tx(async () => {
    if (input.isPrimary && input.clientId) {
      await query("update contacts set is_primary = false where client_id = $1", [input.clientId]);
    }
    return must<Contact>(
      "Contact",
      `insert into contacts (client_id, full_name, title, email, phone, whatsapp, is_primary, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        input.clientId ?? null,
        input.fullName,
        input.title ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.whatsapp ?? null,
        input.isPrimary ?? false,
        input.notes ?? null,
      ],
    );
  });
}

const CONTACT_FIELDS = ["clientId", "fullName", "title", "email", "phone", "whatsapp", "isPrimary", "notes"] as const;

export async function updateContact(id: string, patch: Partial<ContactInput>): Promise<Contact> {
  return tx(async () => {
    if (patch.isPrimary) {
      await query(
        "update contacts set is_primary = false where client_id = coalesce($2, (select client_id from contacts where id = $1)) and id <> $1",
        [id, patch.clientId ?? null],
      );
    }
    const { set, values } = buildUpdate(patch, CONTACT_FIELDS, 2);
    if (!set) return must<Contact>("Contact", "select * from contacts where id = $1", [id]);
    return must<Contact>("Contact", `update contacts set ${set}, updated_at = now() where id = $1 returning *`, [id, ...values]);
  });
}

export async function deleteContact(id: string): Promise<void> {
  const rows = await query("delete from contacts where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Contact");
}

// --- Deals ---

export type DealListItem = Deal & { clientName: string | null; contactName: string | null; ownerName: string | null };

const DEAL_SELECT = `
  select d.*, c.name as client_name, ct.full_name as contact_name, u.full_name as owner_name
  from deals d
  left join clients c on c.id = d.client_id
  left join contacts ct on ct.id = d.contact_id
  left join users u on u.id = d.owner_id`;

export async function listDeals(filter: { clientId?: string; contactId?: string; open?: boolean } = {}): Promise<DealListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.clientId) where.push(`d.client_id = $${params.push(filter.clientId)}`);
  if (filter.contactId) where.push(`d.contact_id = $${params.push(filter.contactId)}`);
  if (filter.open) where.push("d.stage not in ('won', 'lost')");
  return many<DealListItem>(`${DEAL_SELECT} ${where.length ? `where ${where.join(" and ")}` : ""} order by d.sort_order, d.updated_at desc`, params);
}

export async function getDealById(id: string): Promise<DealListItem | undefined> {
  return one<DealListItem>(`${DEAL_SELECT} where d.id = $1`, [id]);
}

export type DealInput = {
  title: string;
  clientId?: string | null;
  contactId?: string | null;
  stage?: DealStage;
  valueCents: number;
  currency: Currency;
  probability?: number;
  expectedClose?: string | null;
  ownerId?: string | null;
  source?: string | null;
  notes?: string | null;
};

export async function createDeal(input: DealInput, createdBy: string): Promise<Deal> {
  const stage = input.stage ?? "lead";
  const deal = await must<Deal>(
    "Deal",
    `insert into deals (title, client_id, contact_id, stage, value_cents, currency, probability, expected_close, owner_id, source, notes, created_by, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, coalesce((select min(sort_order) - 1 from deals where stage = $4), 0))
     returning *`,
    [
      input.title,
      input.clientId ?? null,
      input.contactId ?? null,
      stage,
      input.valueCents,
      input.currency,
      input.probability ?? STAGE_PROBABILITY[stage],
      input.expectedClose ?? null,
      input.ownerId ?? createdBy,
      input.source ?? null,
      input.notes ?? null,
      createdBy,
    ],
  );
  await logAudit({ entityType: "deal", entityId: deal.id, action: "create", summary: `Created deal "${deal.title}" (${centsToDisplay(deal.valueCents, deal.currency)})`, changedBy: createdBy });
  return deal;
}

const DEAL_FIELDS = ["title", "clientId", "contactId", "valueCents", "currency", "probability", "expectedClose", "ownerId", "source", "notes"] as const;

export async function updateDeal(id: string, patch: Partial<DealInput>): Promise<Deal> {
  const { set, values } = buildUpdate(patch, DEAL_FIELDS, 2);
  if (!set) return must<Deal>("Deal", "select * from deals where id = $1", [id]);
  return must<Deal>("Deal", `update deals set ${set}, updated_at = now() where id = $1 returning *`, [id, ...values]);
}

/** Moves a deal to a stage (and optionally a position in that column). */
export async function moveDealStage(
  id: string,
  stage: DealStage,
  changedBy: string,
  opts: { orderedIds?: string[]; lostReason?: string | null } = {},
): Promise<Deal> {
  return tx(async () => {
    const before = await must<Deal>("Deal", "select * from deals where id = $1 for update", [id]);
    const closed = stage === "won" || stage === "lost";
    const deal = await must<Deal>(
      "Deal",
      `update deals set stage = $2::deal_stage, probability = $3, updated_at = now(),
         won_at = case when $2::deal_stage = 'won' then coalesce(won_at, now()) else null end,
         closed_at = case when $4::boolean then coalesce(closed_at, now()) else null end,
         lost_reason = case when $2::deal_stage = 'lost' then coalesce($5::text, lost_reason) else null end
       where id = $1 returning *`,
      [id, stage, STAGE_PROBABILITY[stage], closed, opts.lostReason ?? null],
    );
    if (opts.orderedIds) {
      for (const [i, dealId] of opts.orderedIds.entries()) {
        await query("update deals set sort_order = $2 where id = $1", [dealId, i]);
      }
    }
    if (before.stage !== stage) {
      await logAudit({ entityType: "deal", entityId: id, action: "update", summary: `Moved "${deal.title}" from ${before.stage} to ${stage}`, changedBy });
    }
    return deal;
  });
}

/** One tap on a won deal: spin up a project for the client, linked back to the deal. */
export async function createProjectFromDeal(dealId: string, createdBy: string): Promise<Project> {
  return tx(async () => {
    const deal = await must<Deal>("Deal", "select * from deals where id = $1 for update", [dealId]);
    if (deal.projectId) {
      const existing = await one<Project>("select * from projects where id = $1", [deal.projectId]);
      if (existing) return existing;
    }
    const project = await createProject(
      { name: deal.title, clientId: deal.clientId, description: deal.notes, status: "planning", startedAt: todayYmd() },
      createdBy,
    );
    await query("update deals set project_id = $2 where id = $1", [dealId, project.id]);
    return project;
  });
}

export async function deleteDeal(id: string, deletedBy: string): Promise<void> {
  const rows = await query<{ title: string }>("delete from deals where id = $1 returning title", [id]);
  if (!rows.length) throw new NotFoundError("Deal");
  await logAudit({ entityType: "deal", entityId: id, action: "delete", summary: `Deleted deal "${rows[0]!.title}"`, changedBy: deletedBy });
}

export type PipelineSummary = {
  stage: DealStage;
  count: number;
  totalBhdCents: number;
  weightedBhdCents: number;
}[];

/** Per-stage totals in BHD (weighted by probability) for board headers and Home. */
export async function getPipelineSummary(): Promise<PipelineSummary> {
  const rows = await many<{ stage: DealStage; currency: Currency; valueCents: number; probability: number }>(
    "select stage, currency, value_cents, probability from deals",
  );
  return (["lead", "qualified", "proposal", "negotiation", "won", "lost"] as DealStage[]).map((stage) => {
    const inStage = rows.filter((r) => r.stage === stage);
    const total = inStage.reduce((s, r) => s + convertMinorUnits(r.valueCents, r.currency, "BHD"), 0);
    const weighted = inStage.reduce((s, r) => s + Math.round((convertMinorUnits(r.valueCents, r.currency, "BHD") * r.probability) / 100), 0);
    return { stage, count: inStage.length, totalBhdCents: total, weightedBhdCents: weighted };
  });
}

export function openPipelineTotals(summary: PipelineSummary) {
  const open = summary.filter((s) => OPEN_DEAL_STAGES.includes(s.stage));
  return {
    count: open.reduce((s, r) => s + r.count, 0),
    totalBhdCents: open.reduce((s, r) => s + r.totalBhdCents, 0),
    weightedBhdCents: open.reduce((s, r) => s + r.weightedBhdCents, 0),
  };
}

// --- Activities ---

export type ActivityListItem = Activity & {
  clientName: string | null;
  contactName: string | null;
  dealTitle: string | null;
  createdByName: string | null;
};

const ACTIVITY_SELECT = `
  select a.*, c.name as client_name, ct.full_name as contact_name, d.title as deal_title, u.full_name as created_by_name
  from activities a
  left join clients c on c.id = a.client_id
  left join contacts ct on ct.id = a.contact_id
  left join deals d on d.id = a.deal_id
  left join users u on u.id = a.created_by`;

export async function listActivities(filter: { clientId?: string; dealId?: string; contactId?: string; limit?: number } = {}): Promise<ActivityListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.clientId) where.push(`a.client_id = $${params.push(filter.clientId)}`);
  if (filter.dealId) where.push(`a.deal_id = $${params.push(filter.dealId)}`);
  if (filter.contactId) where.push(`a.contact_id = $${params.push(filter.contactId)}`);
  const limit = `limit $${params.push(filter.limit ?? 100)}`;
  return many<ActivityListItem>(
    `${ACTIVITY_SELECT} ${where.length ? `where ${where.join(" and ")}` : ""} order by coalesce(a.completed_at, a.due_at, a.created_at) desc ${limit}`,
    params,
  );
}

/** Open follow-ups, soonest first (overdue included). */
export async function listOpenFollowUps(): Promise<ActivityListItem[]> {
  return many<ActivityListItem>(`${ACTIVITY_SELECT} where a.due_at is not null and a.completed_at is null order by a.due_at`);
}

export type ActivityInput = {
  kind: ActivityKind;
  subject: string;
  body?: string | null;
  clientId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  dueAt?: string | null;
};

export async function createActivity(input: ActivityInput, createdBy: string): Promise<Activity> {
  // Logged interactions are done the moment they're logged; follow-ups stay open until ticked.
  const completedAt = input.dueAt ? null : new Date().toISOString();
  let clientId = input.clientId ?? null;
  if (!clientId && input.dealId) {
    clientId = (await one<{ clientId: string | null }>("select client_id from deals where id = $1", [input.dealId]))?.clientId ?? null;
  }
  if (!clientId && input.contactId) {
    clientId = (await one<{ clientId: string | null }>("select client_id from contacts where id = $1", [input.contactId]))?.clientId ?? null;
  }
  return must<Activity>(
    "Activity",
    `insert into activities (kind, subject, body, client_id, contact_id, deal_id, due_at, completed_at, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [input.kind, input.subject, input.body ?? null, clientId, input.contactId ?? null, input.dealId ?? null, input.dueAt ?? null, completedAt, createdBy],
  );
}

export async function setActivityCompleted(id: string, completed: boolean): Promise<Activity> {
  return must<Activity>(
    "Activity",
    "update activities set completed_at = case when $2::boolean then now() else null end where id = $1 returning *",
    [id, completed],
  );
}

export async function deleteActivity(id: string): Promise<void> {
  await query("delete from activities where id = $1", [id]);
}
