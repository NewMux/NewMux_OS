import { query } from "@/lib/db";
import { many, one, must, NotFoundError } from "./sql";
import type { Meeting } from "./types";

export type MeetingListItem = Meeting & { projectName: string | null; clientName: string | null; kbPageTitle: string | null };

const MEETING_SELECT = `
  select m.*, p.name as project_name, c.name as client_name, k.title as kb_page_title
  from meetings m
  left join projects p on p.id = m.linked_project_id
  left join clients c on c.id = m.linked_client_id
  left join kb_pages k on k.id = m.kb_page_id`;

export async function listMeetings(filter: { from?: string; clientId?: string; projectId?: string; dealId?: string } = {}): Promise<MeetingListItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.from) where.push(`m.starts_at >= $${params.push(filter.from)}::timestamptz`);
  if (filter.clientId) where.push(`m.linked_client_id = $${params.push(filter.clientId)}`);
  if (filter.projectId) where.push(`m.linked_project_id = $${params.push(filter.projectId)}`);
  if (filter.dealId) where.push(`m.linked_deal_id = $${params.push(filter.dealId)}`);
  return many<MeetingListItem>(`${MEETING_SELECT} ${where.length ? `where ${where.join(" and ")}` : ""} order by m.starts_at`, params);
}

export async function listUpcomingMeetings(withinDays = 7): Promise<MeetingListItem[]> {
  return many<MeetingListItem>(
    `${MEETING_SELECT} where m.starts_at >= now() - interval '2 hours' and m.starts_at <= now() + ($1 || ' days')::interval
     order by m.starts_at`,
    [String(withinDays)],
  );
}

export async function getMeetingById(id: string): Promise<MeetingListItem | undefined> {
  return one<MeetingListItem>(`${MEETING_SELECT} where m.id = $1`, [id]);
}

export type MeetingInput = {
  title: string;
  startsAt: string;
  durationMinutes?: number;
  location?: string | null;
  linkedProjectId?: string | null;
  linkedClientId?: string | null;
  linkedDealId?: string | null;
  notes?: string | null;
  recurring: Meeting["recurring"];
};

export async function createMeeting(input: MeetingInput & { createdBy: string }): Promise<Meeting> {
  return must<Meeting>(
    "Meeting",
    `insert into meetings (title, starts_at, duration_minutes, location, linked_project_id, linked_client_id, linked_deal_id, notes, recurring, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [
      input.title,
      input.startsAt,
      input.durationMinutes ?? 60,
      input.location ?? null,
      input.linkedProjectId ?? null,
      input.linkedClientId ?? null,
      input.linkedDealId ?? null,
      input.notes ?? null,
      input.recurring,
      input.createdBy,
    ],
  );
}

export async function updateMeeting(id: string, input: MeetingInput): Promise<Meeting> {
  return must<Meeting>(
    "Meeting",
    `update meetings set title = $2, starts_at = $3, duration_minutes = $4, location = $5, linked_project_id = $6,
       linked_client_id = $7, linked_deal_id = $8, notes = $9, recurring = $10 where id = $1 returning *`,
    [
      id,
      input.title,
      input.startsAt,
      input.durationMinutes ?? 60,
      input.location ?? null,
      input.linkedProjectId ?? null,
      input.linkedClientId ?? null,
      input.linkedDealId ?? null,
      input.notes ?? null,
      input.recurring,
    ],
  );
}

export async function setMeetingNotesPage(id: string, kbPageId: string): Promise<void> {
  await query("update meetings set kb_page_id = $2 where id = $1", [id, kbPageId]);
}

export async function deleteMeeting(id: string): Promise<void> {
  const rows = await query("delete from meetings where id = $1 returning id", [id]);
  if (!rows.length) throw new NotFoundError("Meeting");
}
