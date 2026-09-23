import { z } from "zod";
import { requiredText, text } from "./common";

export const createPipelineItemSchema = z.object({
  name: requiredText,
  notes: text,
});
