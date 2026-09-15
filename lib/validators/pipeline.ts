import { z } from "zod";

export const createPipelineItemSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});
