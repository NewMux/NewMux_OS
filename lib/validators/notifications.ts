import { z } from "zod";
import { ref, requiredText, text } from "./common";

/** What PushSubscription.toJSON() gives in the browser. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "Push endpoints are https"),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(16).max(100) }),
  device: z.string().trim().max(120).nullish(),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().url().max(2000) });

export const reminderSchema = z.object({
  title: requiredText,
  body: text,
  /** When to send it: a date and time with its offset, e.g. 2026-10-14T09:00:00+03:00. */
  remindAt: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), "Use a date and time like 2026-10-14T09:00:00+03:00")
    .refine((v) => Date.parse(v) > Date.now() - 5 * 60_000, "That time has already passed")
    .refine((v) => Date.parse(v) < Date.now() + 366 * 24 * 3600_000, "Pick a time within a year")
    .transform((v) => new Date(v).toISOString()),
  /** A screen in the app to open when it's tapped, like /clients/…; nothing outside the app. */
  href: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/(?!\/)[^\s\\]*$/, "Only a link inside NEWMUX OS")
    .nullish()
    .transform((v) => v || null),
  /** Who gets it; leave out for yourself. Partners can remind anyone. */
  userId: ref,
});
