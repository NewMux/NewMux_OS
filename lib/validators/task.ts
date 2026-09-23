import { z } from "zod";
import { ref, requiredText, text, ymd } from "./common";

const priority = z.enum(["urgent", "high", "medium", "low"]);
const status = z.enum(["todo", "in_progress", "in_review", "done"]);

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: requiredText,
  description: text,
  priority: priority.default("medium"),
  status: status.optional(),
  assigneeId: ref,
  dueAt: ymd,
});

export const updateTaskSchema = z.object({
  title: requiredText.optional(),
  description: text.optional(),
  status: status.optional(),
  priority: priority.optional(),
  assigneeId: ref.optional(),
  dueAt: ymd.optional(),
  projectId: z.string().uuid().optional(),
});

export const moveTaskSchema = z.object({
  status,
  orderedIds: z.array(z.string().uuid()),
});

export const subtaskSchema = z.object({ title: requiredText });
export const updateSubtaskSchema = z.object({ title: requiredText.optional(), done: z.boolean().optional() });
export const commentSchema = z.object({ body: z.string().trim().min(1).max(5000) });
