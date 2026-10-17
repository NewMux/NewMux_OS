import { z } from "zod";

export const osChangeRequestSchema = z.object({
  title: z.string().trim().min(3, "Give it a short title").max(120),
  /** What to change and why, in plain words: what Claude Code builds from. */
  details: z.string().trim().min(10, "Say what should change").max(8000),
});

export const osChangeCommentSchema = z.object({
  text: z.string().trim().min(3, "Say what to change").max(8000),
});

/** An OS update's number (its GitHub issue), from the route. */
export function osChangeNumber(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new z.ZodError([{ code: "custom", path: ["number"], message: "Not a request number" }]);
  return n;
}
