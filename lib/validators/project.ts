import { z } from "zod";
import { ref, requiredText, text, ymd } from "./common";

export const PROJECT_COLORS = ["blue", "green", "orange", "red", "purple", "pink", "teal", "indigo", "yellow", "gray"] as const;

export const projectSchema = z.object({
  name: requiredText,
  clientId: ref,
  description: text,
  color: z.enum(PROJECT_COLORS).default("blue"),
  status: z.enum(["planning", "active_sprint", "paused", "completed", "archived"]).default("planning"),
  startedAt: ymd,
  targetEndAt: ymd,
  techStack: text,
  hostingProvider: text,
  controlPanelUrl: text,
  domain: text,
  domainRenewalDate: ymd,
  githubUrl: text,
});
export const updateProjectSchema = projectSchema.partial();
