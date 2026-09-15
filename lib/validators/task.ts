import { z } from "zod";

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
  assigneeId: z.string().uuid().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  status: z.enum(["todo", "in_progress", "in_review", "done"]).optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
});
