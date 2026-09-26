import { z } from "zod";
import { ref, requiredText, text, ymd } from "./common";
import { FILE_CATEGORIES } from "@/lib/data/files";

export const fileMetaSchema = z.object({
  name: requiredText,
  category: z.enum(FILE_CATEGORIES).default("other"),
  issueDate: ymd,
  expiryDate: ymd,
  remindDaysBefore: z.coerce.number().int().min(0).max(365).default(30),
  notes: text,
  clientId: ref,
  projectId: ref,
  ventureId: ref,
});
