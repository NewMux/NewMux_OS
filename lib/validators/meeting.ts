import { z } from "zod";
import { ref, requiredText, text } from "./common";

export const meetingSchema = z.object({
  title: requiredText,
  startsAt: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .transform((v) => new Date(v).toISOString()),
  durationMinutes: z.coerce.number().int().min(5).max(24 * 60).default(60),
  location: text,
  linkedProjectId: ref,
  linkedClientId: ref,
  linkedDealId: ref,
  notes: text,
  recurring: z.enum(["none", "weekly", "monthly"]).default("none"),
});
export const createMeetingSchema = meetingSchema;
