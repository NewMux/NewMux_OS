import { randomUUID } from "crypto";
import { store } from "./store";
import type { Meeting } from "./types";

export async function listMeetings(): Promise<Meeting[]> {
  return store.meetings.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}

export async function listUpcomingMeetings(withinDays = 7): Promise<Meeting[]> {
  const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;
  return store.meetings
    .filter((m) => new Date(m.startsAt).getTime() <= cutoff && new Date(m.startsAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}

export async function createMeeting(input: {
  title: string;
  startsAt: string;
  linkedProjectId?: string | null;
  linkedClientId?: string | null;
  notes?: string | null;
  recurring: Meeting["recurring"];
  createdBy: string;
}): Promise<Meeting> {
  const meeting: Meeting = {
    id: randomUUID(),
    title: input.title,
    startsAt: input.startsAt,
    linkedProjectId: input.linkedProjectId ?? null,
    linkedClientId: input.linkedClientId ?? null,
    notes: input.notes ?? null,
    recurring: input.recurring,
    createdBy: input.createdBy,
  };
  store.meetings.push(meeting);
  return meeting;
}
