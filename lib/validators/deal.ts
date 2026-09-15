import { z } from "zod";

export const createDealSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  quotedValue: z.number().nonnegative(),
  currency: z.string().length(3).default("BHD"),
  ownerId: z.string().uuid(),
  notes: z.string().optional(),
});

export const updateDealStageSchema = z.object({
  stage: z.enum(["lead_discovery", "proposal_sent", "negotiation", "won", "lost"]),
});

export const logOutreachSchema = z.object({
  channel: z.enum(["call", "email", "whatsapp"]),
  outcome: z.enum(["no_answer", "gatekeeper_blocked", "not_interested", "info_requested", "meeting_booked"]),
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
});
