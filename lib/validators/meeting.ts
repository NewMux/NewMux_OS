import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().min(1),
  startsAt: z.string().min(1),
  linkedProjectId: z.string().uuid().nullable().optional(),
  linkedClientId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  recurring: z.enum(["none", "weekly", "monthly"]).default("none"),
});
