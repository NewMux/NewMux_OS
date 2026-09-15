import { z } from "zod";

const PROJECT_STATUSES = [
  "planning",
  "active_sprint",
  "paused",
  "completed",
  "archived",
] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid().nullable().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  clientId: z.string().uuid().nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  targetEndAt: z.string().nullable().optional().or(z.literal("")),
  techStack: z.string().nullable().optional(),
  hostingProvider: z.string().nullable().optional(),
  controlPanelUrl: z.string().url().nullable().optional().or(z.literal("")),
  domain: z.string().nullable().optional(),
  domainRenewalDate: z.string().nullable().optional().or(z.literal("")),
  githubUrl: z.string().url().nullable().optional().or(z.literal("")),
});
