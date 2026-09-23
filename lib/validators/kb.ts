import { z } from "zod";
import { ref, requiredText, text } from "./common";

const content = z.object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() }).passthrough();

export const spaceSchema = z.object({
  name: requiredText,
  description: text,
  icon: z.string().min(1).max(40).default("book"),
  color: z.string().min(1).max(20).default("blue"),
});

export const createPageSchema = z.object({
  spaceId: z.string().uuid(),
  parentId: ref,
  title: z.string().max(300).optional(),
  emoji: z.string().max(16).nullish(),
  templateId: ref,
  clientId: ref,
  projectId: ref,
  dealId: ref,
  isTemplate: z.boolean().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().max(300).optional(),
  emoji: z.string().max(16).nullable().optional(),
  content: content.optional(),
  spaceId: z.string().uuid().optional(),
  parentId: ref.optional(),
  clientId: ref.optional(),
  projectId: ref.optional(),
  dealId: ref.optional(),
  isTemplate: z.boolean().optional(),
});

export const favoriteSchema = z.object({ favorite: z.boolean() });

export { text };
