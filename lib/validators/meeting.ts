import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().min(1),
  startsAt: z.string().min(1),
  linkedProjectId: z.string().uuid().nullable().optional(),
  linkedClientId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  recurring: z.enum(["none", "weekly", "monthly"]).default("none"),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  startsAt: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  recurring: z.enum(["none", "weekly", "monthly"]).optional(),
  linkedProjectId: z.string().uuid().nullable().optional().or(z.literal("")),
  linkedClientId: z.string().uuid().nullable().optional().or(z.literal("")),
});
