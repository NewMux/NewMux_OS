import { randomUUID } from "crypto";
import { store } from "./store";
import { AppError } from "@/lib/api/errors";
import type { Meeting } from "./types";

export async function listMeetings(): Promise<Meeting[]> {
  return store.meetings.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}

export async function listUpcomingMeetings(withinDays = 7): Promise<Meeting[]> {
  const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;
  return store.meetings
    .filter(
      (m) =>
        new Date(m.startsAt).getTime() <= cutoff &&
        new Date(m.startsAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000,
    )
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

export async function updateMeeting(
  id: string,
  patch: {
    title?: string;
    startsAt?: string;
    notes?: string | null;
    recurring?: Meeting["recurring"];
    linkedProjectId?: string | null;
    linkedClientId?: string | null;
  },
): Promise<Meeting> {
  const meeting = store.meetings.find((m) => m.id === id);
  if (!meeting)
    throw new AppError("not_found", "That meeting no longer exists.");
  Object.assign(meeting, patch);
  return meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  const index = store.meetings.findIndex((m) => m.id === id);
  if (index === -1)
    throw new AppError("not_found", "That meeting no longer exists.");
  store.meetings.splice(index, 1);
}

export async function getMeetingById(id: string): Promise<Meeting | undefined> {
  return store.meetings.find((m) => m.id === id);
}
